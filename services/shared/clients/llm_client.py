import httpx

try:
    from shared.config import settings
except ModuleNotFoundError:
    from shared.config import settings  # type: ignore


async def ask_llm(question: str, top_k: int = 6) -> dict:
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            f"{settings.llm_service_url}/ask", json={'question': question, 'top_k': top_k}
        )
        response.raise_for_status()
        return response.json()
