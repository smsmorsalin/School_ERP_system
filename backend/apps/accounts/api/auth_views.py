"""Authentication endpoints: login, refresh, logout, password reset."""

import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status, views
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import LoginHistory, User
from apps.accounts.serializers import (
    ChangePasswordSerializer,
    LoginHistorySerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    ProfileUpdateSerializer,
    UserRegistrationSerializer,
    UserSerializer,
    issue_tokens,
)
from apps.accounts.tokens import (
    build_refresh_token,
    clear_refresh_cookie,
    revoke_user_refresh_tokens,
    set_refresh_cookie,
)
from apps.core.permissions import IsAdmin, IsSelfOrAdmin
from apps.core.utils import get_client_ip, origin_is_trusted

logger = logging.getLogger("apps.accounts")
UserModel = get_user_model()


def _record_login(request, user, status_value, reason=None):
    ua = request.META.get("HTTP_USER_AGENT", "")[:1000]
    return LoginHistory.objects.create(
        user=user,
        email=(user.email if user else request.data.get("email", ""))[:254],
        status=status_value,
        ip_address=get_client_ip(request),
        user_agent=ua,
        device_type=LoginHistory.device_from_user_agent(ua),
        failure_reason=reason,
    )


class RegisterView(views.APIView):
    """Public registration is disabled by default.

    Schools create accounts through the admin console. When
    ``ALLOW_PUBLIC_REGISTRATION`` is enabled, new accounts always receive the
    Student role — never an administrative one.
    """

    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "login"

    @extend_schema(request=UserRegistrationSerializer, responses={201: UserSerializer})
    def post(self, request):
        if not settings.ALLOW_PUBLIC_REGISTRATION:
            return Response(
                {
                    "detail": "Self-registration is disabled. Please contact the school administrator."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        from apps.accounts.models import Role, UserRole

        serializer = UserRegistrationSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        role = Role.objects.filter(name="Student", is_active=True).first()
        if role:
            UserRole.objects.get_or_create(user=user, role=role)
        user.clear_role_cache()

        logger.info("New self-registered account: %s", user.email)
        return Response(
            {"detail": "Account created. You can now sign in.", "user": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )


class LoginView(views.APIView):
    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "login"

    @extend_schema(
        request=LoginSerializer,
        responses={200: OpenApiResponse(description="Access token + user profile")},
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            email = str(request.data.get("email", ""))[:254]
            failed_user = User.objects.filter(email__iexact=email).first()
            _record_login(request, failed_user, "failed", "Invalid credentials")
            logger.warning("Failed login for %s from %s", email, get_client_ip(request))
            return Response(
                {"detail": "Invalid email or password.", "errors": ["Invalid email or password."]},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        user = serializer.validated_data["user"]
        if user.is_locked:
            return Response(
                {"detail": "Account temporarily locked. Try again later."},
                status=status.HTTP_423_LOCKED,
            )

        user.register_successful_login()
        _record_login(request, user, "success")

        tokens = issue_tokens(user)
        body = {
            "detail": "Signed in successfully.",
            "user": UserSerializer(user, context={"request": request}).data,
            "access": tokens["access"],
            "expires_in": tokens["expires_in"],
        }
        # API/CLI clients can opt in to receiving the refresh token. Browser
        # clients never see it (HttpOnly cookie only).
        if request.headers.get("X-Client-Type", "").lower() == "api":
            body["refresh"] = str(tokens["refresh"])

        response = Response(body, status=status.HTTP_200_OK)
        set_refresh_cookie(response, tokens["refresh"])
        return response


class RefreshView(views.APIView):
    """Rotate the refresh token and issue a fresh access token."""

    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "sensitive"

    def post(self, request):
        if not origin_is_trusted(request):
            return Response(
                {"detail": "Untrusted origin."}, status=status.HTTP_403_FORBIDDEN
            )

        raw_token = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE) or request.data.get(
            "refresh"
        )
        if not raw_token:
            return Response(
                {"detail": "No refresh token provided."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            old_refresh = RefreshToken(raw_token)
            user_id = old_refresh.get("user_id")
            user = User.objects.filter(pk=user_id).first()
            if not user or not user.is_active:
                raise TokenError("User inactive")
        except TokenError:
            response = Response(
                {"detail": "Session expired. Please sign in again."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            clear_refresh_cookie(response)
            return response

        try:
            old_refresh.blacklist()
        except Exception:  # pragma: no cover - blacklist is best effort
            logger.warning("Could not blacklist rotated refresh token for %s", user.email)

        new_refresh = build_refresh_token(user)

        response = Response(
            {
                "access": str(new_refresh.access_token),
                "expires_in": int(
                    settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds()
                ),
                "user": UserSerializer(user, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )
        set_refresh_cookie(response, new_refresh)
        return response


class LogoutView(views.APIView):
    """Blacklist the refresh token and clear the cookie.

    Works even when the short-lived access token has expired.
    """

    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "sensitive"

    def post(self, request):
        if not origin_is_trusted(request):
            return Response(
                {"detail": "Untrusted origin."}, status=status.HTTP_403_FORBIDDEN
            )

        raw_token = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE) or request.data.get(
            "refresh"
        )
        user = request.user if request.user.is_authenticated else None

        if raw_token:
            try:
                token = RefreshToken(raw_token)
                if user is None:
                    user = User.objects.filter(pk=token.get("user_id")).first()
                token.blacklist()
            except TokenError:
                pass

        if user:
            # Close the most recent open session entry.
            last = (
                LoginHistory.objects.filter(
                    user=user, status="success", logout_time__isnull=True
                )
                .order_by("-login_time")
                .first()
            )
            if last:
                from django.utils import timezone

                last.logout_time = timezone.now()
                last.status = "logout"
                last.save(update_fields=["logout_time", "session_duration", "status"])

        response = Response({"detail": "Signed out successfully."})
        clear_refresh_cookie(response)
        return response


class ChangePasswordView(views.APIView):
    permission_classes = (IsAuthenticated,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "sensitive"

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.must_change_password = False
        from django.utils import timezone

        user.last_password_change = timezone.now()
        user.token_version = (user.token_version or 0) + 1
        user.save(
            update_fields=[
                "password",
                "must_change_password",
                "last_password_change",
                "token_version",
            ]
        )

        # Invalidate every refresh token issued before this password change.
        revoke_user_refresh_tokens(user)

        response = Response(
            {"detail": "Password updated. Please sign in again with your new password."}
        )
        clear_refresh_cookie(response)
        return response


class CurrentUserView(views.APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        return Response(UserSerializer(request.user, context={"request": request}).data)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(
            request.user,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {
                "detail": "Profile updated.",
                "user": UserSerializer(request.user, context={"request": request}).data,
            }
        )


class MyLoginHistoryView(views.APIView):
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        entries = LoginHistory.objects.filter(user=request.user)[:50]
        return Response(LoginHistorySerializer(entries, many=True).data)


class PasswordResetRequestView(views.APIView):
    """Always returns the same message (no account enumeration)."""

    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].lower().strip()
        user = User.objects.filter(email__iexact=email, is_active=True).first()

        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
            try:
                send_mail(
                    subject="Reset your School ERP password",
                    message=(
                        "Hello,\n\n"
                        "We received a request to reset your School ERP password.\n"
                        f"Open this link to choose a new password:\n\n{reset_url}\n\n"
                        "The link expires in 3 days. If you did not request this, "
                        "you can safely ignore this email.\n"
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[user.email],
                    fail_silently=True,
                )
            except Exception:  # pragma: no cover
                logger.exception("Password reset email failed")

        return Response(
            {
                "detail": "If an account exists for that email, a reset link has been sent."
            }
        )


class PasswordResetConfirmView(views.APIView):
    permission_classes = (AllowAny,)
    throttle_classes = (ScopedRateThrottle,)
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user_id = force_str(urlsafe_base64_decode(serializer.validated_data["uid"]))
            user = User.objects.get(pk=user_id, is_active=True)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            return Response(
                {"detail": "This reset link is invalid or has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not default_token_generator.check_token(user, serializer.validated_data["token"]):
            return Response(
                {"detail": "This reset link is invalid or has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(serializer.validated_data["new_password"])
        user.must_change_password = False
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
        return Response({"detail": "Password reset successfully. You can sign in now."})
