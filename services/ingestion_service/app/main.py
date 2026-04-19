from functools import lru_cache
from pathlib import Path
from tempfile import NamedTemporaryFile
import base64

import docx
import easyocr
import numpy as np
import pdfplumber
from fastapi import FastAPI, HTTPException
from langchain_text_splitters import RecursiveCharacterTextSplitter, TokenTextSplitter
from PIL import Image
from storage3.exceptions import StorageApiError
from supabase import create_client


from shared.config import settings
from shared.schemas.contracts import (HealthResponse, IngestionChunk, IngestionRequest, IngestionResponse)


app = FastAPI(title='ingestion-service', version='1.0.0')
supabase = create_client(settings.supabase_url, settings.supabase_key)


@lru_cache(maxsize=1)
def load_ocr() -> easyocr.Reader:
    return easyocr.Reader(['fr', 'en'], gpu=False)


def pdf_to_text(path: Path) -> str:
    text = ''
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + '\n'
    return text


def image_to_text(path: Path, reader: easyocr.Reader) -> str:
    image_np = np.array(Image.open(path).convert('RGB'))
    results = reader.readtext(image_np)
    return ' '.join([r[1] for r in results])

def docx_to_text(path: Path) -> str:
    doc = docx.Document(path)
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return '\n'.join(paragraphs)

def upload_to_cloud(file_name: str, file_bytes: bytes) -> tuple[bool, str]:
    try:
        supabase.storage.from_(settings.supabase_bucket).upload(
            file_name,
            file_bytes,
            file_options={
                'content-type': 'application/octet-stream',
                'x-upsert': 'false',
            },
        )
        return True, 'Success'
    except StorageApiError as exc:
        error_info = str(exc)
        if '409' in error_info or 'Duplicate' in error_info:
            return False, 'Duplicate'
        return False, f'Storage Error: {error_info}'
    except Exception as exc:
        return False, f'Unexpected Error: {str(exc)}'


@app.get('/health', response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse()


@app.get('/documents/list')
def list_documents() -> dict:
    files = supabase.storage.from_(settings.supabase_bucket).list()
    clean_files = [f for f in files if f.get('name') and f.get('name') != '.emptyFolderPlaceholder']
    return {'files': clean_files}


@app.get('/documents/signed-url')
def signed_url(filename: str, expires_in: int = 120) -> dict:
    response = supabase.storage.from_(settings.supabase_bucket).create_signed_url(filename, expires_in)
    url = response.get('signedURL')
    if not url:
        raise HTTPException(status_code=404, detail='Signed URL unavailable')
    return {'url': url}


@app.post('/documents/upload')
def upload_document(payload: dict) -> dict:
    filename = str(payload.get('filename', '')).strip()
    content_b64 = payload.get('content_b64', '')

    if not filename or not content_b64:
        raise HTTPException(status_code=400, detail='filename and content_b64 are required')

    try:
        raw = base64.b64decode(content_b64)
    except Exception as exc:
        raise HTTPException(status_code=400, detail='Invalid base64 payload') from exc

    success, status = upload_to_cloud(filename, raw)
    return {'success': success, 'status': status, 'filename': filename}


@app.delete('/documents/{filename:path}')
def delete_document(filename: str) -> dict:
    supabase.storage.from_(settings.supabase_bucket).remove([filename])
    return {'deleted': filename}

def hybrid_chunking(text: str, source: str) -> list[IngestionChunk]:
    """
    Optimized Hybrid Chunking Strategy:
    1. Split by logical paragraphs to maintain structural integrity.
    2. Token-based splitting (512 tokens) for optimal embedding performance.
    3. Source Injection: Prepend filename to text to prevent context bleeding.
    """

    # 1️⃣ Split by paragraphs/sections first (Structural)
    # We use a larger window here to capture full logical ideas before sub-splitting
    section_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500,        
        chunk_overlap=0,
        separators=["\n\n", "\n", ". "]
    )

    sections = section_splitter.split_text(text)

    # 2️⃣ Token-aware splitter for Llama-Embeddings
    # 512 is the standard 'gold' size for high-precision RAG
    token_splitter = TokenTextSplitter(
        chunk_size=512,         
        chunk_overlap=100       # ~20% overlap to maintain continuity
    )

    chunks: list[IngestionChunk] = []

    for section_id, section in enumerate(sections):
        if not section.strip():
            continue

        sub_chunks = token_splitter.split_text(section)

        for chunk_id, sub_chunk in enumerate(sub_chunks):
            if not sub_chunk.strip():
                continue

            # 🚀 THE FIX: Source Injection
            # This forces the vector model to 'anchor' this text to the specific document.
            # It solves the problem where 'Rules' in one file look like 'Rules' in another.
            enriched_text = f"SOURCE: [{source}]\nCONTENT: {sub_chunk}"

            metadata = {
                "source": source,
                "section_id": section_id,
                "chunk_id": chunk_id,
                "original_length": len(sub_chunk)
            }

            chunks.append(
                IngestionChunk(
                    text=enriched_text,
                    metadata=metadata
                )
            )

    return chunks

@app.post('/ingest', response_model=IngestionResponse)
def ingest(req: IngestionRequest) -> IngestionResponse:
    try:
        raw = base64.b64decode(req.content_b64)
    except Exception as exc:
        raise HTTPException(status_code=400, detail='Invalid base64 payload') from exc
 
    suffix = Path(req.filename).suffix.lower()
    with NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(raw)
        tmp_path = Path(tmp.name)
 
    try:
        if suffix == '.pdf':
            text = pdf_to_text(tmp_path)
        elif suffix in ['.png', '.jpg', '.jpeg']:
            text = image_to_text(tmp_path, load_ocr())
        elif suffix in ['.docx', '.doc']:
            text = docx_to_text(tmp_path)
        else:
            raise HTTPException(status_code=400, detail=f'Unsupported file type: {suffix}')
 
        chunks = hybrid_chunking(text, req.filename)
 
        return IngestionResponse(chunks=chunks)
    finally:
        tmp_path.unlink(missing_ok=True)