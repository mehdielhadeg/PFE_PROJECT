from fastapi import FastAPI
from flashrank import Ranker, RerankRequest
from langchain_community.retrievers import BM25Retriever
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone as PineconeClient, ServerlessSpec

try:
    from shared.config import settings
    from shared.schemas.contracts import HealthResponse, IndexUpsertRequest, IndexDeleteRequest
except ModuleNotFoundError:
    from shared.config import settings  # type: ignore
    from shared.schemas.contracts import HealthResponse, IndexUpsertRequest, IndexDeleteRequest  # type: ignore


app = FastAPI(title='indexing-service', version='1.0.0')

pc = PineconeClient(api_key=settings.pinecone_api_key)
if settings.pinecone_index_name not in [i.name for i in pc.list_indexes()]:
    pc.create_index(
        name=settings.pinecone_index_name,
        dimension=settings.pinecone_dim,
        metric=settings.pinecone_metric,
        spec=ServerlessSpec(cloud='aws', region=settings.pinecone_region),
    )

embeddings = HuggingFaceEmbeddings(model_name=settings.hf_embedding_model)
vectorstore = PineconeVectorStore(
    index_name=settings.pinecone_index_name,
    embedding=embeddings,
    pinecone_api_key=settings.pinecone_api_key,
)

# In-memory docs to support BM25 keyword retrieval.
# This mirrors your previous Streamlit-session behavior.
in_memory_docs: list[Document] = []
ranker = Ranker()


@app.get('/health', response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse()


@app.post('/index/upsert')
def upsert(req: IndexUpsertRequest) -> dict:
    docs = [Document(page_content=chunk.text, metadata=chunk.metadata) for chunk in req.chunks]
    if docs:
        vectorstore.add_documents(docs)
        in_memory_docs.extend(docs)
    return {'indexed_chunks': len(docs)}


@app.post('/index/delete')
def delete(req: IndexDeleteRequest) -> dict:
    vectorstore.delete(filter={'source': req.source})

    # Keep BM25 corpus aligned with deletions.
    remaining = [d for d in in_memory_docs if d.metadata.get('source') != req.source]
    in_memory_docs.clear()
    in_memory_docs.extend(remaining)

    return {'deleted_source': req.source}


def hybrid_retrieval(question: str, k: int = 20) -> list[Document]:
    semantic_docs = vectorstore.similarity_search(question, k=k)

    if in_memory_docs:
        bm25 = BM25Retriever.from_documents(in_memory_docs)
        bm25.k = k
        keyword_docs = bm25.invoke(question)
    else:
        keyword_docs = []

    seen = set()
    merged = []
    for doc in semantic_docs + keyword_docs:
        if doc.page_content not in seen:
            merged.append(doc)
            seen.add(doc.page_content)

    return merged


@app.post('/search')
def search(payload: dict) -> dict:
    question = str(payload.get('question', '')).strip()
    k = int(payload.get('k', 20))
    top_k = int(payload.get('top_k', 6))

    if not question:
        return {'docs': []}

    docs = hybrid_retrieval(question, k=k)

    if not docs:
        return {'docs': []}

    passages = [
        {'id': i, 'text': d.page_content, 'meta': d.metadata}
        for i, d in enumerate(docs)
    ]

    ranked = ranker.rerank(RerankRequest(query=question, passages=passages))
    top = ranked[:top_k]

    return {
        'docs': [
            {'text': item['text'], 'metadata': item.get('meta', {})}
            for item in top
        ]
    }
