# Microservice Migration (Services-only)

Architecture under `services/`:

- `services/ingestion_service`: extracts text/chunks + cloud document management
- `services/indexing_service`: writes/searches/deletes vectors in Pinecone
- `services/llm_service`: reranks context and generates answers
- `services/frontend_service`: Streamlit frontend (chat + manage docs pages)
- `services/shared`: contracts, config, and service clients

## 1) Configure environment

Create `services/.env` from the template:

```bash
copy .env.example .env
```

Then edit `.env`:

```env
PINECONE_API_KEY=...
PINECONE_INDEX_NAME=rag
PINECONE_REGION=us-east-1
PINECONE_DIM=384
PINECONE_METRIC=cosine

HF_TOKEN=...
HF_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
HF_CHAT_MODEL=mistralai/Mistral-7B-Instruct-v0.2

SUPABASE_URL=...
SUPABASE_KEY=...
SUPABASE_BUCKET=rag-docs

INGESTION_SERVICE_URL=http://localhost:8001
INDEXING_SERVICE_URL=http://localhost:8002
LLM_SERVICE_URL=http://localhost:8003
```

## 2) Local run (without Docker)

Use 4 terminals:

```bash
uvicorn ingestion_service.app.main:app --reload --port 8001
uvicorn indexing_service.app.main:app --reload --port 8002
uvicorn llm_service.app.main:app --reload --port 8003
streamlit run frontend_service/app/main.py --server.port 8501
```

Frontend URL: `http://localhost:8501`

## 3) Streamlit pages

- Chat page: `services/frontend_service/app/main.py`
- Manage documents page: `services/frontend_service/app/pages/Manage_Documents.py`

## 4) Duplicate upload behavior

When uploading from chat page:

1. File is uploaded to cloud with `x-upsert=false`
2. If duplicate, upload is rejected and indexing is skipped
3. If new, ingestion + indexing are executed

## 5) Docker run

```bash
docker compose up --build
```
