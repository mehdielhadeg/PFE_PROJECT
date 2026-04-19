import pytest


class _FakeTable:
    def __init__(self, store):
        self.store = store
        self.key = None

    def select(self, _fields):
        return self

    def eq(self, _field, value):
        self.key = value
        return self

    def limit(self, _n):
        return self

    def execute(self):
        data = []
        if self.key in self.store:
            data = [{'messages': self.store[self.key]}]
        return type('Resp', (), {'data': data})

    def upsert(self, payload, on_conflict=None):
        self.store[payload['user_id']] = payload.get('messages', [])
        return self

    def delete(self):
        if self.key in self.store:
            del self.store[self.key]
        return self


class _FakeSupabase:
    def __init__(self, store):
        self.store = store

    def table(self, _name):
        return _FakeTable(self.store)


@pytest.mark.django_db
def test_conversations_get_put_delete(admin_client, monkeypatch):
    store = {}

    def _fake_supabase_or_error():
        return _FakeSupabase(store), None

    monkeypatch.setattr('gateway.views._supabase_or_error', _fake_supabase_or_error)

    resp = admin_client.put('/api/conversations/current', {'messages': [{'role': 'user', 'content': 'hi'}]}, format='json')
    assert resp.status_code == 200

    resp = admin_client.get('/api/conversations/current')
    assert resp.status_code == 200
    assert resp.data['messages'][0]['content'] == 'hi'

    resp = admin_client.delete('/api/conversations/current')
    assert resp.status_code == 204
