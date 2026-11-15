"""
==========================================================
Audit Log
==========================================================

Purpose:
    Immutable, append-only audit trail for sensitive actions
    across the School ERP (payments, user management, role
    changes, invoice cancellation, etc.).

Design:
    * One row per audited event, never updated or deleted.
    * Captures actor, action, target model/UUID, before/after
      JSON snapshots, request metadata (IP, user agent).
    * Admin-readable via Django admin; not exposed through the
      public REST API (staff only).
    * Soft-delete aware: rows are never hard-deleted; instead
      `is_active=False` marks logical removal (kept for
      compliance/audit continuity).
"""

import json

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.core.models.base_model import BaseModel


class AuditLog(BaseModel):
    """
    Append-only audit event.

    Fields are denormalised (JSON) so the log remains readable
    even if the referenced target row is later soft-deleted.
    """

    # ------------------------------------------------------
    # Actor (who performed the action)
    # ------------------------------------------------------
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_events",
        help_text="User who performed the action (null for system events).",
    )
    actor_email = models.EmailField(
        blank=True,
        help_text="Denormalised actor email (snapshot at event time).",
    )

    # ------------------------------------------------------
    # Action
    # ------------------------------------------------------
    action = models.CharField(
        max_length=64,
        db_index=True,
        help_text="Human-readable action, e.g. 'payment.recorded', 'invoice.cancelled'.",
    )
    action_category = models.CharField(
        max_length=32,
        db_index=True,
        blank=True,
        help_text="Category for grouping/filtering, e.g. 'finance', 'accounts', 'academics'.",
    )

    # ------------------------------------------------------
    # Target (what was acted upon)
    # ------------------------------------------------------
    target_app = models.CharField(
        max_length=64,
        blank=True,
        help_text="Django app label of the target model.",
    )
    target_model = models.CharField(
        max_length=64,
        blank=True,
        help_text="Target model name.",
    )
    target_uuid = models.UUIDField(
        null=True,
        blank=True,
        db_index=True,
        help_text="UUID of the target instance (if any).",
    )
    target_repr = models.CharField(
        max_length=255,
        blank=True,
        help_text="Human-readable target representation (snapshot).",
    )

    # ------------------------------------------------------
    # Before / After snapshots
    # ------------------------------------------------------
    before = models.JSONField(
        null=True,
        blank=True,
        help_text="Snapshot of the target before the change.",
    )
    after = models.JSONField(
        null=True,
        blank=True,
        help_text="Snapshot of the target after the change.",
    )

    # ------------------------------------------------------
    # Request metadata
    # ------------------------------------------------------
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address of the actor's request.",
    )
    user_agent = models.CharField(
        max_length=512,
        blank=True,
        help_text="HTTP User-Agent header.",
    )
    request_id = models.CharField(
        max_length=64,
        blank=True,
        db_index=True,
        help_text="Correlation ID for grouping events from one request.",
    )

    # ------------------------------------------------------
    # Extra context
    # ------------------------------------------------------
    metadata = models.JSONField(
        null=True,
        blank=True,
        help_text="Additional free-form context (e.g. amount changed, old role).",
    )

    class Meta(BaseModel.Meta):
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["-created_at"]),
            models.Index(fields=["actor", "-created_at"]),
            models.Index(fields=["action", "-created_at"]),
            models.Index(fields=["target_app", "target_model", "target_uuid"]),
        ]
        permissions = [
            ("export_auditlog", "Can export audit log entries"),
        ]

    def __str__(self):
        actor = self.actor_email or self.actor_id or "system"
        return f"{self.action} by {actor} at {self.created_at:%Y-%m-%d %H:%M}"

    def save(self, *args, **kwargs):
        # Audit rows are append-only: once created they must not be updated.
        if self.pk is not None:
            raise ValueError("AuditLog entries are append-only and cannot be updated.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Hard-delete is prohibited; soft-delete only.
        raise ValueError("AuditLog entries cannot be deleted.")
