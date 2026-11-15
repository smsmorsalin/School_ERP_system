"""
==========================================================
Audit signals
==========================================================

Connects post_save/post_delete on audited models to create
immutable AuditLog entries.

Usage:
    from apps.audit.signals import register_audit_signals
    register_audit_signals(sender_invoice, action="invoice.created")
"""

from __future__ import annotations

from decimal import Decimal

from django.db import connection, transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.audit.models import AuditLog


# Cache the "table exists" probe once it becomes true. Before the first
# migration it stays false, so migration-time saves are not audited.
_AUDIT_TABLE_READY = False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _audit_table_exists():
    """True once the audit_auditlog table has been created (post-migration)."""
    global _AUDIT_TABLE_READY
    if _AUDIT_TABLE_READY:
        return True
    try:
        _AUDIT_TABLE_READY = (
            AuditLog._meta.db_table in connection.introspection.table_names()
        )
    except Exception:
        return False
    return _AUDIT_TABLE_READY


def _snapshot(instance):
    """Return a JSON-serialisable snapshot of a model instance."""
    if instance is None:
        return None
    data = {}
    for field in instance._meta.concrete_fields:
        value = getattr(instance, field.attname)
        if isinstance(value, Decimal):
            value = str(value)
        elif hasattr(value, "isoformat"):
            value = value.isoformat()
        elif hasattr(value, "hex"):
            value = str(value)
        data[field.name] = value
    return data


def _get_request_metadata():
    """Best-effort extraction of request metadata from thread-local storage."""
    # Avoid importing middleware internals here; populated by
    # apps.audit.middleware.RequestMetadataMiddleware when installed.
    from apps.audit.middleware import get_current_request  # noqa: WPS433

    request = get_current_request()
    if request is None:
        return {}
    meta = {
        "ip_address": getattr(request, "META", {}).get("REMOTE_ADDR"),
        "user_agent": request.META.get("HTTP_USER_AGENT", ""),
        "request_id": getattr(request, "id", None),
    }
    if hasattr(request, "user") and request.user.is_authenticated:
        meta["actor"] = request.user
    return meta


def record_audit(
    *,
    action: str,
    actor=None,
    target=None,
    before=None,
    after=None,
    action_category: str = "",
    metadata: dict | None = None,
    **kwargs,
):
    """Create an AuditLog entry. Safe to call outside request context.

    No-op during migration (before the audit table exists) and swallows
    unexpected errors so auditing never breaks the caller.
    """
    try:
        # Use a savepoint so a failed audit write can never leave the caller's
        # transaction in a broken state.
        with transaction.atomic():
            if not _audit_table_exists():
                return
            meta = _get_request_metadata()
            actor = meta.get("actor", actor)
            AuditLog.objects.create(
                actor=actor,
                actor_email=(actor.email if actor and hasattr(actor, "email") else ""),
                action=action,
                action_category=action_category,
                target_app=target._meta.app_label if target else "",
                target_model=target._meta.model_name if target else "",
                target_uuid=target.pk if target else None,
                target_repr=str(target)[:255] if target else "",
                before=_snapshot(before) if before is not None else None,
                after=_snapshot(after) if after is not None else None,
                ip_address=meta.get("ip_address"),
                user_agent=meta.get("user_agent", ""),
                request_id=meta.get("request_id", "") or "",
                metadata=metadata or {},
                **kwargs,
            )
    except Exception:
        # Auditing must never break the primary operation.
        pass


# Only audit business models from the local apps. Third-party/internal
# high-churn rows (token blacklist, sessions, content types) are noise.
AUDITED_APPS = {
    "finance",
    "academics",
    "attendance",
    "exams",
    "communication",
    "accounts",
}
EXCLUDED_MODELS = {
    "accounts.loginhistory",   # already an explicit login record
    "accounts.permission",     # seeded catalogue, not user activity
    "accounts.rolepermission", # derived from role edits
    "accounts.userrole",       # covered by the user/role change itself
}


def _should_audit(sender) -> bool:
    if sender is AuditLog:
        return False
    label = f"{sender._meta.app_label}.{sender._meta.model_name}"
    if label in EXCLUDED_MODELS:
        return False
    return sender._meta.app_label in AUDITED_APPS


# ---------------------------------------------------------------------------
# Signal receivers (connected in ready())
# ---------------------------------------------------------------------------
@receiver(post_save)
def _audit_post_save(sender, instance, created, **kwargs):
    if not _should_audit(sender):
        return
    action = f"{sender._meta.app_label}.{sender._meta.model_name}.{'created' if created else 'updated'}"
    record_audit(
        action=action,
        actor=kwargs.get("actor"),
        target=instance,
        after=instance,
        action_category=sender._meta.app_label,
    )


@receiver(post_delete)
def _audit_post_delete(sender, instance, **kwargs):
    if not _should_audit(sender):
        return
    record_audit(
        action=f"{sender._meta.app_label}.{sender._meta.model_name}.deleted",
        actor=kwargs.get("actor"),
        target=instance,
        before=instance,
        action_category=sender._meta.app_label,
    )


def register_audit_signals():
    """Explicit registration hook called from AppConfig.ready()."""
    # Signal receivers are decorated; importing this module connects them.
    return True
