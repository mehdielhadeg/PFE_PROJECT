"""Shared settings for all microservices."""
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    # Pinecone
    pinecone_api_key: str = Field(..., env='PINECONE_API_KEY')
    pinecone_index_name: str = Field('rag', env='PINECONE_INDEX_NAME')
    pinecone_region: str = Field('us-east-1', env='PINECONE_REGION')
    pinecone_dim: int = Field(384, env='PINECONE_DIM')
    pinecone_metric: str = Field('cosine', env='PINECONE_METRIC')

    # Hugging Face
    hf_token: str = Field(..., env='HF_TOKEN')
    hf_embedding_model: str = Field('sentence-transformers/all-MiniLM-L6-v2', env='HF_EMBEDDING_MODEL')
    hf_chat_model: str = Field('Qwen/Qwen2.5-7B-Instruct', env='HF_CHAT_MODEL')

    # Supabase
    supabase_url: str = Field(..., env='SUPABASE_URL')
    supabase_key: str = Field(..., env='SUPABASE_KEY')
    supabase_bucket: str = Field('rag-docs', env='SUPABASE_BUCKET')

    # Service URLs
    ingestion_service_url: str = Field('http://localhost:8001', env='INGESTION_SERVICE_URL')
    indexing_service_url: str = Field('http://localhost:8002', env='INDEXING_SERVICE_URL')
    llm_service_url: str = Field('http://localhost:8003', env='LLM_SERVICE_URL')

    # Debug
    rag_debug_retrieval: bool = Field(False, env='RAG_DEBUG_RETRIEVAL')

    # RAG tuning
    rag_retrieval_k: int = Field(20, env='RAG_RETRIEVAL_K')
    rag_max_context_chunks: int = Field(4, env='RAG_MAX_CONTEXT_CHUNKS')


settings = Settings()
