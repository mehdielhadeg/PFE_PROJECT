from datetime import datetime, timezone


class DocumentRepository:
    def __init__(self, supabase_client, table_name: str, bucket_name: str) -> None:
        self.client = supabase_client
        self.table_name = table_name
        self.bucket_name = bucket_name

    def list_documents(self) -> list[dict]:
        result = (
            self.client.table(self.table_name)
            .select('name,uploaded_by,upload_date')
            .order('upload_date', desc=True)
            .execute()
        )
        return result.data or []

    def upsert_document(self, name: str, uploaded_by: str) -> None:
        payload = {
            'name': name,
            'uploaded_by': uploaded_by,
            'upload_date': datetime.now(timezone.utc).isoformat(),
        }
        self.client.table(self.table_name).upsert(payload, on_conflict='name').execute()

    def delete_document(self, name: str) -> None:
        self.client.table(self.table_name).delete().eq('name', name).execute()

    def get_signed_url(self, name: str, expires_in: int = 120) -> str | None:
        response = self.client.storage.from_(self.bucket_name).create_signed_url(name, expires_in)
        return response.get('signedURL')
