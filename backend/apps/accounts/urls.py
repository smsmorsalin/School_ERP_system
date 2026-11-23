"""Accounts URL routes."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts.api import (
    ChangePasswordView,
    CurrentUserView,
    LoginHistoryViewSet,
    LoginView,
    LogoutView,
    MyLoginHistoryView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    PermissionViewSet,
    RefreshView,
    RegisterView,
    RoleViewSet,
    UserViewSet,
)

router = DefaultRouter()
router.register("accounts/users", UserViewSet, basename="user")
router.register("accounts/roles", RoleViewSet, basename="role")
router.register("accounts/permissions", PermissionViewSet, basename="permission")
router.register("accounts/login-history", LoginHistoryViewSet, basename="login-history")

urlpatterns = [
    path("accounts/auth/login/", LoginView.as_view(), name="login"),
    path("accounts/auth/refresh/", RefreshView.as_view(), name="token_refresh"),
    path("accounts/auth/logout/", LogoutView.as_view(), name="logout"),
    path("accounts/auth/register/", RegisterView.as_view(), name="register"),
    path(
        "accounts/auth/change-password/",
        ChangePasswordView.as_view(),
        name="change_password",
    ),
    path("accounts/auth/me/", CurrentUserView.as_view(), name="current_user"),
    path(
        "accounts/auth/me/login-history/",
        MyLoginHistoryView.as_view(),
        name="my_login_history",
    ),
    path(
        "accounts/auth/password-reset/",
        PasswordResetRequestView.as_view(),
        name="password_reset",
    ),
    path(
        "accounts/auth/password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password_reset_confirm",
    ),
    # Backwards-compatible alias used by the original documentation.
    path(
        "accounts/auth/token/refresh/",
        RefreshView.as_view(),
        name="legacy_token_refresh",
    ),
    path("", include(router.urls)),
]
