"""
Tests for indexing_service — no real external services used.
Pinecone, HuggingFaceEmbeddings, and FlashRank are all mocked.

Run with:
    pytest tests/indexing/test_indexing.py -v
"""
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from langchain_core.documents import Document


# ---------------------------------------------------------------------------
# Patch all external dependencies BEFORE importing the app so module-level
# initialisation (PineconeClient, HuggingFaceEmbeddings, PineconeVectorStore)
# never hits the real network.
# ---------------------------------------------------------------------------
mock_vectorstore = MagicMock()
mock_ranker = MagicMock()
mock_pc = MagicMock()
mock_pc.list_indexes.return_value = []  # triggers create_index branch

with patch('shared.config.settings') as mock_settings, \
     patch('pinecone.Pinecone', return_value=mock_pc), \
     patch('langchain_huggingface.HuggingFaceEmbeddings', return_value=MagicMock()), \
     patch('langchain_pinecone.PineconeVectorStore', return_value=mock_vectorstore), \
     patch('flashrank.Ranker', return_value=mock_ranker):

    mock_settings.pinecone_api_key = 'fake-key'
    mock_settings.pinecone_index_name = 'fake-index'
    mock_settings.pinecone_dim = 768
    mock_settings.pinecone_metric = 'cosine'
    mock_settings.pinecone_region = 'us-east-1'
    mock_settings.hf_embedding_model = 'fake-model'

    from services.indexing_service.app.main import (
        app,
        hybrid_retrieval,
        in_memory_docs,
    )

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_doc(text: str, source: str = 'test.pdf') -> Document:
    return Document(page_content=text, metadata={'source': source})


def make_upsert_payload(chunks: list[dict]) -> dict:
    return {'chunks': chunks}


def reset_in_memory():
    """Clear in_memory_docs between tests."""
    in_memory_docs.clear()


# ===========================================================================
# Unit tests — hybrid_retrieval logic
# ===========================================================================

class TestHybridRetrieval:
    def setup_method(self):
        reset_in_memory()
        mock_vectorstore.reset_mock()

    def test_returns_semantic_docs_when_no_bm25_corpus(self):
        mock_vectorstore.similarity_search.return_value = [
            make_doc('Remote work policy text', 'policy.pdf'),
            make_doc('Leave policy text', 'leave.pdf'),
        ]
        results = hybrid_retrieval('remote work', k=5)
        assert len(results) == 2
        mock_vectorstore.similarity_search.assert_called_once_with('remote work', k=5)

    def test_deduplicates_results(self):
        doc = make_doc('Duplicate content', 'policy.pdf')
        mock_vectorstore.similarity_search.return_value = [doc, doc]
        results = hybrid_retrieval('duplicate', k=5)
        assert len(results) == 1

    def test_merges_semantic_and_bm25(self):
        mock_vectorstore.similarity_search.return_value = [
            make_doc('Semantic result', 'policy.pdf'),
        ]
        in_memory_docs.extend([
            make_doc('BM25 keyword result', 'guide.pdf'),
            make_doc('Semantic result', 'policy.pdf'),  # duplicate — should be deduped
        ])
        results = hybrid_retrieval('result', k=5)
        texts = [r.page_content for r in results]
        assert 'Semantic result' in texts
        assert 'BM25 keyword result' in texts
        assert len(results) == 2  # duplicate removed

    def test_returns_empty_when_no_docs(self):
        mock_vectorstore.similarity_search.return_value = []
        results = hybrid_retrieval('anything', k=5)
        assert results == []


# ===========================================================================
# Integration tests — HTTP endpoints
# ===========================================================================

class TestHealthEndpoint:
    def test_health_returns_200(self):
        response = client.get('/health')
        assert response.status_code == 200


class TestUpsertEndpoint:
    def setup_method(self):
        reset_in_memory()
        mock_vectorstore.reset_mock()

    def test_upsert_indexes_chunks(self):
        payload = {
            'chunks': [
                {'text': 'Remote work is allowed.', 'metadata': {'source': 'policy.pdf'}},
                {'text': 'Max 2 days per week.', 'metadata': {'source': 'policy.pdf'}},
            ]
        }
        response = client.post('/index/upsert', json=payload)
        assert response.status_code == 200
        assert response.json()['indexed_chunks'] == 2
        mock_vectorstore.add_documents.assert_called_once()

    def test_upsert_adds_to_in_memory_docs(self):
        payload = {
            'chunks': [
                {'text': 'Annual leave policy.', 'metadata': {'source': 'leave.pdf'}},
            ]
        }
        client.post('/index/upsert', json=payload)
        assert any(d.page_content == 'Annual leave policy.' for d in in_memory_docs)

    def test_upsert_empty_chunks_returns_zero(self):
        payload = {'chunks': []}
        response = client.post('/index/upsert', json=payload)
        assert response.status_code == 200
        assert response.json()['indexed_chunks'] == 0
        mock_vectorstore.add_documents.assert_not_called()

    def test_upsert_returns_correct_count(self):
        payload = {
            'chunks': [
                {'text': f'Chunk {i}', 'metadata': {'source': 'doc.pdf'}}
                for i in range(5)
            ]
        }
        response = client.post('/index/upsert', json=payload)
        assert response.json()['indexed_chunks'] == 5


class TestDeleteEndpoint:
    def setup_method(self):
        reset_in_memory()
        mock_vectorstore.reset_mock()

    def test_delete_removes_from_pinecone(self):
        response = client.post('/index/delete', json={'source': 'policy.pdf'})
        assert response.status_code == 200
        mock_vectorstore.delete.assert_called_once_with(filter={'source': 'policy.pdf'})

    def test_delete_returns_deleted_source(self):
        response = client.post('/index/delete', json={'source': 'policy.pdf'})
        assert response.json()['deleted_source'] == 'policy.pdf'

    def test_delete_removes_from_in_memory_docs(self):
        in_memory_docs.extend([
            make_doc('Policy text', 'policy.pdf'),
            make_doc('Guide text', 'guide.pdf'),
        ])
        client.post('/index/delete', json={'source': 'policy.pdf'})
        sources = [d.metadata['source'] for d in in_memory_docs]
        assert 'policy.pdf' not in sources
        assert 'guide.pdf' in sources

    def test_delete_nonexistent_source_does_not_crash(self):
        response = client.post('/index/delete', json={'source': 'nonexistent.pdf'})
        assert response.status_code == 200


class TestSearchEndpoint:
    def setup_method(self):
        reset_in_memory()
        mock_vectorstore.reset_mock()
        mock_ranker.reset_mock()

    def test_empty_question_returns_empty_docs(self):
        response = client.post('/search', json={'question': '', 'k': 5, 'top_k': 3})
        assert response.status_code == 200
        assert response.json()['docs'] == []

    def test_whitespace_question_returns_empty_docs(self):
        response = client.post('/search', json={'question': '   ', 'k': 5, 'top_k': 3})
        assert response.json()['docs'] == []

    def test_search_returns_top_k_results(self):
        mock_vectorstore.similarity_search.return_value = [
            make_doc(f'Result {i}', 'policy.pdf') for i in range(10)
        ]
        mock_ranker.rerank.return_value = [
            {'text': f'Result {i}', 'meta': {'source': 'policy.pdf'}, 'score': 1.0 - i * 0.1}
            for i in range(10)
        ]
        response = client.post('/search', json={'question': 'remote work', 'k': 10, 'top_k': 3})
        assert response.status_code == 200
        assert len(response.json()['docs']) == 3

    def test_search_result_structure(self):
        mock_vectorstore.similarity_search.return_value = [
            make_doc('Policy content', 'policy.pdf'),
        ]
        mock_ranker.rerank.return_value = [
            {'text': 'Policy content', 'meta': {'source': 'policy.pdf'}, 'score': 0.9}
        ]
        response = client.post('/search', json={'question': 'policy', 'k': 5, 'top_k': 1})
        doc = response.json()['docs'][0]
        assert 'text' in doc
        assert 'metadata' in doc
        assert doc['metadata']['source'] == 'policy.pdf'

    def test_search_no_results_returns_empty(self):
        mock_vectorstore.similarity_search.return_value = []
        response = client.post('/search', json={'question': 'unknown topic', 'k': 5, 'top_k': 3})
        assert response.json()['docs'] == []

    def test_search_uses_default_k_and_top_k(self):
        mock_vectorstore.similarity_search.return_value = [
            make_doc('Some result', 'doc.pdf')
        ]
        mock_ranker.rerank.return_value = [
            {'text': 'Some result', 'meta': {'source': 'doc.pdf'}, 'score': 0.8}
        ]
        # No k/top_k provided — should use defaults (k=20, top_k=6)
        response = client.post('/search', json={'question': 'télétravail'})
        assert response.status_code == 200
        mock_vectorstore.similarity_search.assert_called_with('télétravail', k=20)

    def test_reranker_called_with_correct_query(self):
        mock_vectorstore.similarity_search.return_value = [
            make_doc('Content about leaves', 'leave.pdf'),
        ]
        mock_ranker.rerank.return_value = [
            {'text': 'Content about leaves', 'meta': {'source': 'leave.pdf'}, 'score': 0.7}
        ]
        client.post('/search', json={'question': 'congés annuels', 'k': 5, 'top_k': 1})
        call_args = mock_ranker.rerank.call_args[0][0]
        assert call_args.query == 'congés annuels'

    def test_reranker_receives_all_merged_passages(self):
        docs = [make_doc(f'Doc {i}', 'policy.pdf') for i in range(4)]
        mock_vectorstore.similarity_search.return_value = docs
        mock_ranker.rerank.return_value = [
            {'text': f'Doc {i}', 'meta': {'source': 'policy.pdf'}, 'score': 0.9}
            for i in range(4)
        ]
        client.post('/search', json={'question': 'test', 'k': 4, 'top_k': 4})
        passages_sent = mock_ranker.rerank.call_args[0][0].passages
        assert len(passages_sent) == 4