from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAdminUser

from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogSerializer


class AuditLogViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """Read-only audit log (staff only)."""

    permission_classes = [IsAdminUser]
    queryset = AuditLog.objects.all().order_by("-created_at")
    serializer_class = AuditLogSerializer
    lookup_field = "uuid"
    filterset_fields = ["action", "action_category", "target_app", "target_model", "actor"]
    search_fields = ["actor_email", "action", "target_repr", "ip_address"]
    ordering = ["-created_at"]
    ordering_fields = ["created_at", "action"]
