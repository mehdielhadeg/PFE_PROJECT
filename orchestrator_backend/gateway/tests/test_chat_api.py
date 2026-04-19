import json
import pytest


class _FakeStreamResp:
    def raise_for_status(self):
        return None

    def iter_lines(self, decode_unicode=False):
        payload = "data: " + json.dumps({'type': 'token', 'text': 'ok'}) + "\n\n"
        if decode_unicode:
            yield payload
        else:
            yield payload.encode('utf-8')


@pytest.mark.django_db
def test_chat_returns_answer(admin_client, monkeypatch):
    def _fake_post(*_args, **_kwargs):
        return _FakeStreamResp()

    monkeypatch.setattr('gateway.views.requests.post', _fake_post)

    resp = admin_client.post('/api/chat', {'question': 'hi', 'top_k': 3}, format='json')
    assert resp.status_code == 200
    body = b''.join(resp.streaming_content).decode('utf-8')
    assert 'data:' in body
