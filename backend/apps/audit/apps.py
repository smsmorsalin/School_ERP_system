from django.apps import AppConfig


class AuditConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.audit"
    verbose_name = "Audit Log"

    def ready(self):
        # Import signals to connect receivers, then register.
        from apps.audit import signals  # noqa: F401
        signals.register_audit_signals()
