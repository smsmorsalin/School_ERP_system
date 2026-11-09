"""Custom JWT authentication enforcing session and password-change gates."""

from rest_framework.exceptions import AuthenticationFailed, PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication

# A user holding a temporary password may only inspect their own account,
# change the password, or sign out. Everything else is blocked server-side.
PASSWORD_CHANGE_ALLOWED_PATHS = (
    "/api/v1/accounts/auth/change-password/",
    "/api/v1/accounts/auth/me/",
    "/api/v1/accounts/auth/me/login-history/",
    "/api/v1/accounts/auth/logout/",
    "/api/v1/accounts/auth/refresh/",
)


class MustChangePasswordJWTAuthentication(JWTAuthentication):
    """Apply token-versioning and the forced-password-change gate.

    * Every credential change increments ``user.token_version``; access tokens
      carry the version they were minted with, so old tokens stop working
      immediately (not just when they expire).
    * The React app redirects temporary-password users to the change-password
      screen, but the rule is also enforced here for direct API clients.
    """

    def authenticate(self, request):
        result = super().authenticate(request)
        if result is None:
            return None
        user, token = result

        # Reject tokens minted before the latest credential change. Legacy
        # tokens without the claim are treated as version 0.
        user_version = getattr(user, "token_version", 0) or 0
        token_version = token.get("token_version") or 0
        if int(token_version) != int(user_version):
            raise AuthenticationFailed(
                "This session is no longer valid. Please sign in again."
            )

        if not getattr(user, "must_change_password", False):
            return result

        path = request.path_info
        if any(path.endswith(allowed) for allowed in PASSWORD_CHANGE_ALLOWED_PATHS):
            return result

        raise PermissionDenied(
            "You must change your temporary password before using the API."
        )
