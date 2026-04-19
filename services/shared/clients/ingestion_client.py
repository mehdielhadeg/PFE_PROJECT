import httpx

try:
    from shared.config import settings
except ModuleNotFoundError:
    from shared.config import settings  # type: ignore


async def ingest_file(filename: str, content_b64: str) -> dict:
    payload = {'filename': filename, 'content_b64': content_b64}
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(f"{settings.ingestion_service_url}/ingest", json=payload)
        response.raise_for_status()
        return response.json()
