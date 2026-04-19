from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = 'ok'


class IngestionRequest(BaseModel):
    filename: str
    content_b64: str = Field(description='Base64 encoded file content')


class IngestionChunk(BaseModel):
    text: str
    metadata: dict


class IngestionResponse(BaseModel):
    chunks: list[IngestionChunk]


class IndexUpsertRequest(BaseModel):
    chunks: list[IngestionChunk]


class IndexDeleteRequest(BaseModel):
    source: str


class AskRequest(BaseModel):
    question: str
    top_k: int = 6
    debug: bool = False


class AskResponse(BaseModel):
    answer: str
    sources: list[str]
    debug_docs: list[dict] | None = None
