import pytest


class _FakeRepo:
    def __init__(self):
        self.docs = [
            {'name': 'a.pdf', 'uploaded_by': 'admin', 'upload_date': '2025-01-01T00:00:00Z'},
            {'name': 'b.pdf', 'uploaded_by': 'admin', 'upload_date': '2025-01-02T00:00:00Z'},
        ]
        self.deleted = []

    def list_documents(self):
        return self.docs

    def get_signed_url(self, name, expires_in=120):
        return f'https://signed/{name}'

    def upsert_document(self, name, uploaded_by):
        self.docs.append({'name': name, 'uploaded_by': uploaded_by, 'upload_date': '2025-01-03T00:00:00Z'})

    def delete_document(self, name):
        self.deleted.append(name)


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
def test_documents_list_admin(admin_client, monkeypatch):
    repo = _FakeRepo()
    monkeypatch.setattr('gateway.views._document_repo_or_error', lambda: (repo, None))

    resp = admin_client.get('/api/documents')
    assert resp.status_code == 200
    assert len(resp.data['documents']) == 2
    assert 'uploaded_by' in resp.data['documents'][0]


@pytest.mark.django_db
def test_documents_list_employee(employee_client, monkeypatch):
    repo = _FakeRepo()
    monkeypatch.setattr('gateway.views._document_repo_or_error', lambda: (repo, None))

    resp = employee_client.get('/api/documents')
    assert resp.status_code == 200
    assert len(resp.data['documents']) == 2
    assert 'uploaded_by' not in resp.data['documents'][0]


@pytest.mark.django_db
def test_documents_signed_url(admin_client, monkeypatch):
    repo = _FakeRepo()
    monkeypatch.setattr('gateway.views._document_repo_or_error', lambda: (repo, None))

    resp = admin_client.get('/api/documents/signed-url?filename=a.pdf&expires_in=60')
    assert resp.status_code == 200
    assert resp.data['url'].endswith('a.pdf')


@pytest.mark.django_db
def test_documents_upload_success(admin_client, monkeypatch):
    repo = _FakeRepo()
    monkeypatch.setattr('gateway.views._document_repo_or_error', lambda: (repo, None))
    captured = {}

    def _fake_enqueue(filename, content_b64, uploaded_by):
        captured['filename'] = filename
        captured['content_b64'] = content_b64
        captured['uploaded_by'] = uploaded_by

    monkeypatch.setattr('gateway.views._enqueue', _fake_enqueue)

    def _fake_post(url, json=None, timeout=None):
        if url.endswith('/documents/upload'):
            return _FakeResp({'success': True, 'status': 'Success'})
        return _FakeResp({})

    monkeypatch.setattr('gateway.views.requests.post', _fake_post)

    resp = admin_client.post(
        '/api/documents/upload',
        {'filename': 'a.pdf', 'content_b64': 'ZmFrZQ=='},
        format='json',
    )
    assert resp.status_code == 202
    assert resp.data['status'] == 'Processing'
    assert captured['filename'] == 'a.pdf'
    assert captured['content_b64'] == 'ZmFrZQ=='
    assert captured['uploaded_by'] == 'admin_user'


@pytest.mark.django_db
def test_documents_upload_duplicate(admin_client, monkeypatch):
    repo = _FakeRepo()
    monkeypatch.setattr('gateway.views._document_repo_or_error', lambda: (repo, None))

    def _fake_post(url, json=None, timeout=None):
        if url.endswith('/documents/upload'):
            return _FakeResp({'success': False, 'status': 'Duplicate'})
        return _FakeResp({})

    monkeypatch.setattr('gateway.views.requests.post', _fake_post)

    resp = admin_client.post(
        '/api/documents/upload',
        {'filename': 'a.pdf', 'content_b64': 'ZmFrZQ=='},
        format='json',
    )
    assert resp.status_code == 200
    assert resp.data['status'] == 'Duplicate'
    assert repo.docs[-1]['name'] == 'a.pdf'


@pytest.mark.django_db
def test_documents_delete_success(admin_client, monkeypatch):
    repo = _FakeRepo()
    monkeypatch.setattr('gateway.views._document_repo_or_error', lambda: (repo, None))

    def _fake_post(url, json=None, timeout=None):
        if url.endswith('/index/delete'):
            return _FakeResp({'deleted_source': 'a.pdf'})
        return _FakeResp({})

    def _fake_delete(url, timeout=None):
        return _FakeResp({'deleted': 'a.pdf'})

    monkeypatch.setattr('gateway.views.requests.post', _fake_post)
    monkeypatch.setattr('gateway.views.requests.delete', _fake_delete)

    resp = admin_client.delete('/api/documents/a.pdf')
    assert resp.status_code == 200
    assert resp.data['deleted'] == 'a.pdf'
