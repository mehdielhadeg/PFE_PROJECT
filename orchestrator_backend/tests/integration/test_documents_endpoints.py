import pytest


class _FakeRepo:
    def __init__(self):
        self.docs = [
            {'name': 'a.pdf', 'uploaded_by': 'admin', 'upload_date': '2025-01-01T00:00:00Z'},
        ]

    def list_documents(self):
        return self.docs

    def get_signed_url(self, name, expires_in=120):
        return f'https://signed/{name}'

    def upsert_document(self, name, uploaded_by):
        self.docs.append({'name': name, 'uploaded_by': uploaded_by, 'upload_date': '2025-01-02T00:00:00Z'})

    def delete_document(self, name):
        return None


class _FakeResp:
    def __init__(self, payload, ok=True):
        self._payload = payload
        self._ok = ok

    def raise_for_status(self):
        if not self._ok:
            raise Exception('bad')

    def json(self):
        return self._payload


@pytest.mark.django_db
def test_documents_list_integration(admin_client, monkeypatch):
    repo = _FakeRepo()
    monkeypatch.setattr('gateway.views._document_repo_or_error', lambda: (repo, None))

    resp = admin_client.get('/api/documents')
    assert resp.status_code == 200
    assert len(resp.data['documents']) == 1


@pytest.mark.django_db
def test_documents_upload_integration(admin_client, monkeypatch):
    repo = _FakeRepo()
    monkeypatch.setattr('gateway.views._document_repo_or_error', lambda: (repo, None))

    def _fake_post(url, json=None, timeout=None):
        if url.endswith('/documents/upload'):
            return _FakeResp({'success': True, 'status': 'Success'})
        if url.endswith('/ingest'):
            return _FakeResp({'chunks': [{'text': 'x', 'metadata': {'source': 'a.pdf'}}]})
        if url.endswith('/index/upsert'):
            return _FakeResp({'indexed_chunks': 1})
        return _FakeResp({})

    monkeypatch.setattr('gateway.views.requests.post', _fake_post)

    resp = admin_client.post(
        '/api/documents/upload',
        {'filename': 'a.pdf', 'content_b64': 'ZmFrZQ=='},
        format='json',
    )
    assert resp.status_code == 200
    assert resp.data['status'] == 'Success'
