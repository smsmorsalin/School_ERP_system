from rest_framework import serializers

from apps.audit.models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = [
            "uuid",
            "actor",
            "actor_email",
            "action",
            "action_category",
            "target_app",
            "target_model",
            "target_uuid",
            "target_repr",
            "before",
            "after",
            "ip_address",
            "user_agent",
            "request_id",
            "metadata",
            "created_at",
            "updated_at",
            "is_active",
        ]
        read_only_fields = fields
