import json
import asyncio
import httpx

from fastapi import FastAPI
from huggingface_hub import login
from fastapi.responses import StreamingResponse
from langchain_huggingface import HuggingFaceEndpoint, ChatHuggingFace

try:
    from shared.config import settings
    from shared.schemas.contracts import HealthResponse, AskRequest, AskResponse
except ModuleNotFoundError:
    from shared.config import settings  # type: ignore
    from shared.schemas.contracts import HealthResponse, AskRequest, AskResponse  # type: ignore


app = FastAPI(title='llm-service', version='1.0.0')

# Connexion sécurisée
login(token=settings.hf_token)

# Configuration du modèle avec une température très basse pour éviter l'invention
"""chat_model = ChatHuggingFace(
    llm=HuggingFaceEndpoint(
        repo_id=settings.hf_chat_model,
        huggingfacehub_api_token=settings.hf_token,
        temperature=0.1,  # 0.1 est idéal pour la stricte vérité
        max_new_tokens=512,
        timeout=300
    )
)"""
chat_model = ChatHuggingFace(
    llm=HuggingFaceEndpoint(
        repo_id=settings.hf_chat_model, # Now pointing to Qwen/Qwen2.5-7B-Instruct
        huggingfacehub_api_token=settings.hf_token,
        temperature=0.1,  
        max_new_tokens=512,
        
    )
)

def build_messages(question: str, docs: list) -> list:
    """
    Construit un prompt structuré avec injection de source pour chaque chunk.
    """
    context_parts = []
    for d in docs:
        source = d.get('metadata', {}).get('source', 'Inconnu')
        text = d.get('text', '')
        context_parts.append(f"--- SOURCE: {source} ---\n{text}")
 
    context_str = "\n\n".join(context_parts)
 
    return [
        {
            'role': 'system',
            'content': (
                "Tu réponds toujours en français. "
                "Tu es un assistant expert et strict en analyse de documents. "
                "Tu dois répondre UNIQUEMENT en utilisant le contexte fourni. "
                "INTERDICTION d'utiliser tes connaissances personnelles ou d'inventer des faits. "
                "Si le contexte est vide ou ne contient pas la réponse, réponds exactement : "
                "'Je ne trouve pas cette information dans les documents fournis.'"
            ),
        },
        {
            'role': 'user',
            'content': f"CONTEXTE FOURNI:\n{context_str}\n\nQUESTION: {question}\n\nREPONSE STRICTE:",
        },
    ]
 
 
async def token_stream(question: str, docs: list, sources: list[str]):
    """Yields SSE events: token chunks, then a final sources event."""
    try:
        for chunk in chat_model.stream(build_messages(question, docs)):
            token = chunk.content
            if token:
                yield f"data: {json.dumps({'type': 'token', 'text': token})}\n\n"
                await asyncio.sleep(0)
    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'text': str(e)})}\n\n"
 
    yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"
    yield "data: [DONE]\n\n"
 
 
@app.get('/health', response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse()
 
 
@app.post('/ask')
async def ask(req: AskRequest) -> StreamingResponse:
    # 1. Fetch docs from indexing service
    async with httpx.AsyncClient(timeout=90) as client:
        try:
            top_k = min(req.top_k, settings.rag_max_context_chunks)
            response = await client.post(
                f"{settings.indexing_service_url}/search",
                json={
                    'question': req.question,
                    'k': settings.rag_retrieval_k,
                    'top_k': top_k,
                },
            )
            response.raise_for_status()
            search_data = response.json()
        except Exception as e:
            err_msg = str(e)
            async def error_stream():
                yield f"data: {json.dumps({'type': 'error', 'text': err_msg})}\n\n"
                yield "data: [DONE]\n\n"
            return StreamingResponse(error_stream(), media_type='text/event-stream')
        
    docs = search_data.get('docs', [])
 
    # 2. Guardrail: no docs → stream a single message and exit
    if not docs:
        async def empty_stream():
            msg = "Je ne trouve pas cette information (la base de documents est actuellement vide ou aucun document ne correspond à votre requête)."
            yield f"data: {json.dumps({'type': 'token', 'text': msg})}\n\n"
            yield f"data: {json.dumps({'type': 'sources', 'sources': []})}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(empty_stream(), media_type='text/event-stream')
 
    # 3. Stream LLM response
    sources = sorted(list({d.get('metadata', {}).get('source', 'unknown') for d in docs}))
 
    return StreamingResponse(
        token_stream(req.question, docs, sources),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
        },
    )