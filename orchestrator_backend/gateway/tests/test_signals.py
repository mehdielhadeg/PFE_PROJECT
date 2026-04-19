import pytest


class _FakeTable:
    def __init__(self):
        self.deleted_user_id = None

    def delete(self):
        return self

    def eq(self, _field, value):
        self.deleted_user_id = value
        return self

    def execute(self):
        return None


class _FakeSupabase:
    def __init__(self):
        self.table_obj = _FakeTable()

    def table(self, _name):
        return self.table_obj


@pytest.mark.django_db
def test_user_delete_signal_deletes_conversation_row(admin_user, monkeypatch, settings):
    settings.SUPABASE_CONVERSATIONS_TABLE = 'conversation_sessions'

    fake = _FakeSupabase()
    monkeypatch.setattr('gateway.signals._supabase_client_or_none', lambda: fake)

    user_id = admin_user.id
    admin_user.delete()

    assert fake.table_obj.deleted_user_id == str(user_id)
