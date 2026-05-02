"""
Tests for llm_service — no real external services used.
HuggingFace, httpx, and settings are all mocked.

Run with:
    pytest tests/llm/test_llm.py -v
"""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Patch everything BEFORE importing the app so module-level
# login() and ChatHuggingFace() never hit the real network.
# ---------------------------------------------------------------------------
mock_chat_model = MagicMock()

with patch('shared.config.settings') as mock_settings, \
     patch('huggingface_hub.login'), \
     patch('langchain_huggingface.HuggingFaceEndpoint', return_value=MagicMock()), \
     patch('langchain_huggingface.ChatHuggingFace', return_value=mock_chat_model):

    mock_settings.hf_token = 'fake-token'
    mock_settings.hf_chat_model = 'fake/model'
    mock_settings.indexing_service_url = 'http://fake-indexing:8002'
    mock_settings.rag_max_context_chunks = 6
    mock_settings.rag_retrieval_k = 20

    from services.llm_service.app.main import app, build_messages

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_doc(text: str, source: str = 'policy.pdf') -> dict:
    return {'text': text, 'metadata': {'source': source}}


def parse_sse(raw: str) -> list[dict]:
    """Parse raw SSE text into a list of event dicts."""
    events = []
    for line in raw.splitlines():
        if line.startswith('data: ') and line != 'data: [DONE]':
            events.append(json.loads(line[6:]))
    return events


def mock_search_response(docs: list[dict]) -> MagicMock:
    """Build a mock httpx response returning the given docs."""
    resp = MagicMock()
    resp.json.return_value = {'docs': docs}
    resp.raise_for_status = MagicMock()
    return resp


# ===========================================================================
# Unit tests — build_messages
# ===========================================================================

class TestBuildMessages:
    def test_returns_two_messages(self):
        msgs = build_messages('What is the policy?', [make_doc('Some policy text.')])
        assert len(msgs) == 2

    def test_first_message_is_system(self):
        msgs = build_messages('question', [make_doc('text')])
        assert msgs[0]['role'] == 'system'

    def test_second_message_is_user(self):
        msgs = build_messages('question', [make_doc('text')])
        assert msgs[1]['role'] == 'user'

    def test_question_in_user_message(self):
        msgs = build_messages('What are the leave types?', [make_doc('text')])
        assert 'What are the leave types?' in msgs[1]['content']

    def test_source_label_in_user_message(self):
        msgs = build_messages('question', [make_doc('text', source='guide.pdf')])
        assert 'guide.pdf' in msgs[1]['content']

    def test_doc_text_in_user_message(self):
        msgs = build_messages('question', [make_doc('Remote work is allowed.')])
        assert 'Remote work is allowed.' in msgs[1]['content']

    def test_multiple_docs_all_included(self):
        docs = [
            make_doc('Policy text', 'policy.pdf'),
            make_doc('Guide text', 'guide.pdf'),
        ]
        msgs = build_messages('question', docs)
        assert 'policy.pdf' in msgs[1]['content']
        assert 'guide.pdf' in msgs[1]['content']
        assert 'Policy text' in msgs[1]['content']
        assert 'Guide text' in msgs[1]['content']

    def test_empty_docs_produces_empty_context(self):
        msgs = build_messages('question', [])
        assert 'CONTEXTE FOURNI:\n\n' in msgs[1]['content']

    def test_system_prompt_in_french(self):
        msgs = build_messages('question', [])
        assert 'français' in msgs[0]['content']

    def test_missing_metadata_uses_inconnu(self):
        doc = {'text': 'Some text', 'metadata': {}}
        msgs = build_messages('question', [doc])
        assert 'Inconnu' in msgs[1]['content']


# ===========================================================================
# Integration tests — HTTP endpoints
# ===========================================================================

class TestHealthEndpoint:
    def test_health_returns_200(self):
        response = client.get('/health')
        assert response.status_code == 200


class TestAskEndpoint:
    def setup_method(self):
        mock_chat_model.reset_mock()

    def _stream_ask(self, question: str = 'Quels sont les congés ?', top_k: int = 3):
        """Helper to call /ask and return parsed SSE events."""
        with client.stream('POST', '/ask', json={'question': question, 'top_k': top_k}) as r:
            return parse_sse(r.text)
    
    

    def test_ask_response_is_event_stream(self):
        mock_chat_model.stream.return_value = [MagicMock(content='ok')]
        with patch('llm_service.app.main.httpx.AsyncClient') as mock_http:
            mock_http.return_value.__aenter__ = AsyncMock(return_value=mock_http.return_value)
            mock_http.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_http.return_value.post = AsyncMock(return_value=mock_search_response([
                make_doc('text')
            ]))
            with client.stream('POST', '/ask', json={'question': 'test', 'top_k': 3}) as r:
                assert 'text/event-stream' in r.headers['content-type']