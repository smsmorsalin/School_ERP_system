"""JWT issuing helpers shared by login / refresh / password-reset flows."""

from django.conf import settings
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)
from rest_framework_simplejwt.tokens import RefreshToken


def build_refresh_token(user) -> RefreshToken:
    token = RefreshToken.for_user(user)
    token["email"] = user.email
    token["full_name"] = user.get_full_name()
    token["roles"] = user.role_names
    # Lets the API reject access tokens minted before a credential change.
    token["token_version"] = getattr(user, "token_version", 0)
    return token


def revoke_user_refresh_tokens(user) -> int:
    """Blacklist every live refresh token for ``user``.

    Called after password changes, password resets and account deactivation so
    a stolen refresh token cannot outlive the credential it was issued for.
    """
    if user is None or not getattr(user, "pk", None):
        return 0
    revoked = 0
    outstanding = OutstandingToken.objects.filter(
        user=user, expires_at__gt=timezone.now()
    )
    for token in outstanding:
        _, created = BlacklistedToken.objects.get_or_create(token=token)
        if created:
            revoked += 1
    return revoked



def set_refresh_cookie(response, refresh_token):
    response.set_cookie(
        key=settings.AUTH_REFRESH_COOKIE,
        value=str(refresh_token),
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        path=settings.AUTH_REFRESH_COOKIE_PATH,
        secure=settings.AUTH_REFRESH_COOKIE_SECURE,
        httponly=True,
        samesite=settings.AUTH_REFRESH_COOKIE_SAMESITE,
    )


def clear_refresh_cookie(response):
    response.delete_cookie(
        settings.AUTH_REFRESH_COOKIE,
        path=settings.AUTH_REFRESH_COOKIE_PATH,
        samesite=settings.AUTH_REFRESH_COOKIE_SAMESITE,
    )
