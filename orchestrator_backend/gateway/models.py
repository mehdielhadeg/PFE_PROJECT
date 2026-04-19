import uuid

from django.conf import settings
from django.db import models


class DocumentMetadata(models.Model):
    """Logical schema for document metadata stored in Supabase table."""

    name = models.CharField(max_length=255, primary_key=True)
    uploaded_by = models.CharField(max_length=150)
    upload_date = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'document_records'


class ChatMessage(models.Model):
    ROLE_CHOICES = (
        ('user', 'user'),
        ('assistant', 'assistant'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='chat_messages')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class Feedback(models.Model):
    message = models.OneToOneField(ChatMessage, on_delete=models.CASCADE, related_name='feedback')
    is_positive = models.BooleanField()
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
