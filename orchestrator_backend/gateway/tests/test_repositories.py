from gateway.repositories import DocumentRepository


class _FakeStorage:
    def __init__(self):
        self.bucket = None

    def from_(self, bucket_name):
        self.bucket = bucket_name
        return self

    def create_signed_url(self, name, expires_in):
        return {'signedURL': f'https://signed/{name}?exp={expires_in}'}


class _FakeTable:
    def __init__(self):
        self.called = []

    def select(self, _fields):
        self.called.append('select')
        return self

    def order(self, _field, desc=False):
        self.called.append(('order', desc))
        return self

    def execute(self):
        return type('Resp', (), {'data': [{'name': 'a', 'uploaded_by': 'u', 'upload_date': 'x'}]})

    def upsert(self, _payload, on_conflict=None):
        self.called.append(('upsert', on_conflict))
        return self

    def delete(self):
        self.called.append('delete')
        return self

    def eq(self, _field, _value):
        self.called.append('eq')
        return self


class _FakeSupabase:
    def __init__(self):
        self.table_obj = _FakeTable()
        self.storage = _FakeStorage()

    def table(self, _name):
        return self.table_obj


def test_document_repository_list_and_signed_url():
    fake = _FakeSupabase()
    repo = DocumentRepository(fake, table_name='document_records', bucket_name='rag-docs')

    docs = repo.list_documents()
    assert docs[0]['name'] == 'a'

    url = repo.get_signed_url('a.pdf', 120)
    assert 'a.pdf' in url


def test_document_repository_delete_and_upsert():
    fake = _FakeSupabase()
    repo = DocumentRepository(fake, table_name='document_records', bucket_name='rag-docs')

    repo.upsert_document('a.pdf', 'admin')
    repo.delete_document('a.pdf')
    assert ('upsert', 'name') in fake.table_obj.called
    assert 'delete' in fake.table_obj.called
