import logging

from django.conf import settings
from django.contrib.auth.models import User
from django.db.models.signals import post_delete
from django.dispatch import receiver
from supabase import create_client

logger = logging.getLogger(__name__)
_supabase_client = None


def _supabase_client_or_none():
    global _supabase_client

    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
        return None

    if _supabase_client is None:
        _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

    return _supabase_client


@receiver(post_delete, sender=User)
def delete_user_conversation_row(sender, instance: User, **kwargs) -> None:
    """
    Keep Supabase conversations in sync: hard-delete conversation row
    when a Django user is deleted.
    """
    client = _supabase_client_or_none()
    if client is None:
        return

    try:
        client.table(settings.SUPABASE_CONVERSATIONS_TABLE).delete().eq('user_id', str(instance.id)).execute()
    except Exception as exc:
        logger.warning('Failed deleting conversation row for user_id=%s: %s', instance.id, exc)
