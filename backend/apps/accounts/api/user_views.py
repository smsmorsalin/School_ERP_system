"""Administrator user-management endpoints."""

from django.db.models import Count, Q
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.models import LoginHistory, Role, User, UserRole
from apps.accounts.serializers import (
    AdminSetPasswordSerializer,
    AdminUserUpdateSerializer,
    LoginHistorySerializer,
    UserCreateSerializer,
    UserSerializer,
)
from apps.core.permissions import IsAdmin
from apps.accounts.tokens import revoke_user_refresh_tokens


class UserViewSet(viewsets.ModelViewSet):
    """User CRUD restricted to administrators.

    Object-level data is never exposed to ordinary users here; the
    ``/auth/me/`` endpoint is the only self-service surface.
    """

    permission_classes = [IsAdmin]
    lookup_field = "uuid"
    filterset_fields = ["is_active"]
    search_fields = ["email", "first_name", "last_name", "phone_number"]
    ordering_fields = ["created_at", "email", "first_name", "last_name", "last_login"]
    ordering = ["-created_at"]
    http_method_names = ["get", "post", "patch", "put", "delete", "head", "options"]

    def get_queryset(self):
        qs = (
            User.objects.prefetch_related("user_roles__role")
            .annotate()
            .order_by("-created_at")
        )
        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(user_roles__role__name=role, user_roles__is_active=True)
        return qs.distinct()

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action in ("update", "partial_update"):
            return AdminUserUpdateSerializer
        return UserSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        payload = dict(UserSerializer(user, context={"request": request}).data)
        temporary_password = getattr(serializer, "temporary_password", None)
        if temporary_password:
            payload["temporary_password"] = temporary_password
        return Response(payload, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        instance.refresh_from_db()
        instance.clear_role_cache()
        if not instance.is_active:
            revoke_user_refresh_tokens(instance)
        return Response(UserSerializer(instance, context={"request": request}).data)

    def perform_destroy(self, instance):
        if instance.pk == self.request.user.pk:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({"detail": "You cannot delete your own account."})
        # Never delete the final superuser.
        if instance.is_superuser and User.objects.filter(is_superuser=True, is_active=True).count() <= 1:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({"detail": "The last superuser cannot be deleted."})
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])
        UserRole.objects.filter(user=instance).update(is_active=False)
        revoke_user_refresh_tokens(instance)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="set-password")
    def set_password(self, request, uuid=None):
        user = self.get_object()
        serializer = AdminSetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data["new_password"])
        user.must_change_password = True
        user.failed_login_attempts = 0
        user.locked_until = None
        from django.utils import timezone

        user.last_password_change = timezone.now()
        user.token_version = (user.token_version or 0) + 1
        user.save(
            update_fields=[
                "password",
                "must_change_password",
                "failed_login_attempts",
                "locked_until",
                "last_password_change",
                "token_version",
            ]
        )
        revoke_user_refresh_tokens(user)
        return Response(
            {"detail": f"Password set for {user.email}. They must change it at next sign-in."}
        )

    @action(detail=True, methods=["post"], url_path="toggle-active")
    def toggle_active(self, request, uuid=None):
        user = self.get_object()
        if user.pk == request.user.pk:
            return Response(
                {"detail": "You cannot change your own account status."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if user.is_superuser and User.objects.filter(is_superuser=True, is_active=True).count() <= 1:
            return Response(
                {"detail": "The last superuser cannot be deactivated."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.is_active = not user.is_active
        user.save(update_fields=["is_active", "updated_at"])
        if not user.is_active:
            revoke_user_refresh_tokens(user)
        return Response(
            {"detail": f"{user.email} is now {'active' if user.is_active else 'inactive'}."},
        )

    @action(detail=True, methods=["get"], url_path="login-history")
    def login_history(self, request, uuid=None):
        user = self.get_object()
        entries = LoginHistory.objects.filter(user=user)[:100]
        return Response(LoginHistorySerializer(entries, many=True).data)

    @action(detail=True, methods=["post"], url_path="unlock")
    def unlock(self, request, uuid=None):
        user = self.get_object()
        user.failed_login_attempts = 0
        user.locked_until = None
        user.save(update_fields=["failed_login_attempts", "locked_until", "updated_at"])
        return Response({"detail": f"{user.email} has been unlocked."})


class LoginHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = LoginHistorySerializer
    lookup_field = "uuid"
    filterset_fields = ["status", "device_type"]
    search_fields = ["email", "ip_address"]
    ordering = ["-login_time"]

    def get_queryset(self):
        return LoginHistory.objects.select_related("user").all()
