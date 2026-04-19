from django.apps import AppConfig


class GatewayConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'gateway'

    def ready(self) -> None:
        # Register model signals.
        from . import signals  # noqa: F401
