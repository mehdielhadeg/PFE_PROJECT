import httpx

try:
    from shared.config import settings
except ModuleNotFoundError:
    from shared.config import settings  # type: ignore


async def upsert_chunks(chunks: list[dict]) -> dict:
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            f"{settings.indexing_service_url}/index/upsert", json={'chunks': chunks}
        )
        response.raise_for_status()
        return response.json()


async def delete_by_source(source: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            f"{settings.indexing_service_url}/index/delete", json={'source': source}
        )
        response.raise_for_status()
        return response.json()
