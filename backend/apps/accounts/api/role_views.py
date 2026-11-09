"""Role and permission administration."""

from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.models import Permission, Role, UserRole
from apps.accounts.serializers import PermissionSerializer, RoleSerializer
from apps.core.permissions import IsAdmin


class RoleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = RoleSerializer
    lookup_field = "uuid"
    search_fields = ["name", "description"]
    ordering = ["name"]

    def get_queryset(self):
        return Role.objects.annotate(
            user_count=Count(
                "user_roles",
                filter=Q(user_roles__is_active=True, user_roles__user__is_active=True),
            )
        ).prefetch_related("role_permissions__permission")

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.is_system_role:
            return Response(
                {"detail": "Built-in roles cannot be deleted. Deactivate it instead."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if role.user_roles.filter(is_active=True).exists():
            return Response(
                {"detail": "This role is assigned to users and cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])


class PermissionViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = PermissionSerializer
    lookup_field = "uuid"
    filterset_fields = ["category", "is_active"]
    search_fields = ["code", "name"]
    ordering = ["category", "code"]
    queryset = Permission.objects.all()
