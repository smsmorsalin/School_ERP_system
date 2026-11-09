"""Authentication, session and account-security tests."""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APIClient

from tests.conftest import STRONG_PASSWORD, make_user

LOGIN = "/api/v1/accounts/auth/login/"
REFRESH = "/api/v1/accounts/auth/refresh/"
LOGOUT = "/api/v1/accounts/auth/logout/"
ME = "/api/v1/accounts/auth/me/"
CHANGE = "/api/v1/accounts/auth/change-password/"
USERS = "/api/v1/accounts/users/"


def bearer(client, token):
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


@pytest.mark.django_db
def test_login_sets_http_only_refresh_cookie(login, admin_user):
    response = login(admin_user.email)
    assert response.status_code == 200
    assert response.data["access"]
    assert "refresh" not in response.data  # browser clients never see it

    cookie = response.cookies[settings.AUTH_REFRESH_COOKIE]
    assert cookie["httponly"] is True
    assert cookie["samesite"] == "Lax"
    assert cookie["path"] == settings.AUTH_REFRESH_COOKIE_PATH


@pytest.mark.django_db
def test_api_client_can_opt_in_to_refresh_token(api, admin_user):
    response = api.post(
        LOGIN,
        {"email": admin_user.email, "password": STRONG_PASSWORD},
        format="json",
        HTTP_X_CLIENT_TYPE="api",
    )
    assert response.status_code == 200
    assert response.data["refresh"]


@pytest.mark.django_db
def test_invalid_credentials_are_generic(login, admin_user):
    wrong = login(admin_user.email, "WrongPass@12345")
    unknown = login("nobody@test.example", "WrongPass@12345")

    assert wrong.status_code == 401
    assert unknown.status_code == 401
    assert wrong.data["detail"] == unknown.data["detail"] == "Invalid email or password."


@pytest.mark.django_db
def test_account_locks_after_five_failed_attempts(login, admin_user):
    for _ in range(5):
        response = login(admin_user.email, "WrongPass@12345")
        assert response.status_code == 401

    admin_user.refresh_from_db()
    assert admin_user.failed_login_attempts == 5
    assert admin_user.is_locked is True

    # Even the correct password is refused while the lock is active.
    locked = login(admin_user.email, STRONG_PASSWORD)
    assert locked.status_code == 401
    admin_user.refresh_from_db()
    assert admin_user.is_locked is True


@pytest.mark.django_db
def test_expired_lock_allows_login_again(login, admin_user):
    admin_user.failed_login_attempts = 5
    admin_user.locked_until = timezone.now() - timedelta(minutes=1)
    admin_user.save(update_fields=["failed_login_attempts", "locked_until"])

    response = login(admin_user.email, STRONG_PASSWORD)
    assert response.status_code == 200
    admin_user.refresh_from_db()
    assert admin_user.is_locked is False
    assert admin_user.failed_login_attempts == 0


@pytest.mark.django_db
def test_deactivated_user_cannot_sign_in(login, admin_user):
    admin_user.is_active = False
    admin_user.save(update_fields=["is_active"])
    response = login(admin_user.email, STRONG_PASSWORD)
    assert response.status_code == 401


@pytest.mark.django_db
def test_public_registration_is_disabled(api):
    response = api.post(
        "/api/v1/accounts/auth/register/",
        {
            "email": "self@test.example",
            "first_name": "Self",
            "last_name": "Register",
            "password": STRONG_PASSWORD,
            "password_confirm": STRONG_PASSWORD,
        },
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_forced_password_change_gate(auth_client, admin_user):
    admin = auth_client(admin_user)
    created = admin.post(
        USERS,
        {
            "email": "temp@test.example",
            "first_name": "Temp",
            "last_name": "User",
            "roles": ["Student"],
        },
        format="json",
    )
    assert created.status_code == 201, created.content
    temp_password = created.data["temporary_password"]
    assert created.data["must_change_password"] is True

    # Temporary password: self-service endpoints work, everything else is blocked.
    client = APIClient()
    login_response = client.post(
        LOGIN,
        {"email": "temp@test.example", "password": temp_password},
        format="json",
    )
    assert login_response.status_code == 200
    assert login_response.data["user"]["must_change_password"] is True
    token = login_response.data["access"]

    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    assert client.get(ME).status_code == 200
    blocked = client.get("/api/v1/academics/students/")
    assert blocked.status_code == 403
    assert "temporary password" in blocked.data["detail"].lower()

    changed = client.post(
        CHANGE,
        {
            "old_password": temp_password,
            "new_password": "Replaced@2026!",
            "new_password_confirm": "Replaced@2026!",
        },
        format="json",
    )
    assert changed.status_code == 200, changed.content

    # The pre-change access token is rejected immediately.
    assert client.get(ME).status_code == 401

    # Fresh login uses the new password and lifts the gate.
    fresh = APIClient()
    relogin = fresh.post(
        LOGIN,
        {"email": "temp@test.example", "password": "Replaced@2026!"},
        format="json",
    )
    assert relogin.status_code == 200
    assert relogin.data["user"]["must_change_password"] is False
    fresh.credentials(HTTP_AUTHORIZATION=f"Bearer {relogin.data['access']}")
    assert fresh.get("/api/v1/academics/students/").status_code == 200


@pytest.mark.django_db
def test_change_password_revokes_refresh_tokens(auth_client, admin_user):
    client = auth_client(admin_user)

    changed = client.post(
        CHANGE,
        {
            "old_password": STRONG_PASSWORD,
            "new_password": "Changed@2026!",
            "new_password_confirm": "Changed@2026!",
        },
        format="json",
    )
    assert changed.status_code == 200

    # The cookie was cleared and the old refresh token was blacklisted.
    assert client.post(REFRESH, {}, format="json").status_code == 401


@pytest.mark.django_db
def test_admin_password_reset_revokes_sessions(auth_client, admin_user):
    admin = auth_client(admin_user)
    created = admin.post(
        USERS,
        {
            "email": "reset@test.example",
            "first_name": "Reset",
            "last_name": "User",
            "roles": ["Student"],
        },
        format="json",
    )
    uuid = created.data["uuid"]
    temp_password = created.data["temporary_password"]

    victim = APIClient()
    login_response = victim.post(
        LOGIN, {"email": "reset@test.example", "password": temp_password}, format="json"
    )
    assert login_response.status_code == 200
    old_access = login_response.data["access"]

    reset = admin.post(
        f"{USERS}{uuid}/set-password/",
        {
            "new_password": "AdminReset@2026!",
            "new_password_confirm": "AdminReset@2026!",
        },
        format="json",
    )
    assert reset.status_code == 200, reset.content

    victim.credentials(HTTP_AUTHORIZATION=f"Bearer {old_access}")
    assert victim.get(ME).status_code == 401
    assert victim.post(REFRESH, {}, format="json").status_code == 401


@pytest.mark.django_db
def test_refresh_rotates_and_blacklists_old_token(api, admin_user):
    response = api.post(
        LOGIN, {"email": admin_user.email, "password": STRONG_PASSWORD}, format="json"
    )
    old_cookie = response.cookies[settings.AUTH_REFRESH_COOKIE].value

    rotated = api.post(REFRESH, {}, format="json")
    assert rotated.status_code == 200, rotated.content
    assert rotated.data["access"]
    new_cookie = rotated.cookies[settings.AUTH_REFRESH_COOKIE].value
    assert new_cookie != old_cookie

    api.cookies[settings.AUTH_REFRESH_COOKIE] = old_cookie
    replay = api.post(REFRESH, {}, format="json")
    assert replay.status_code == 401


@pytest.mark.django_db
def test_refresh_rejects_untrusted_origin(api, admin_user):
    api.post(LOGIN, {"email": admin_user.email, "password": STRONG_PASSWORD}, format="json")
    response = api.post(REFRESH, {}, format="json", HTTP_ORIGIN="http://evil.example")
    assert response.status_code == 403


@pytest.mark.django_db
def test_logout_blacklists_refresh_token(api, admin_user):
    login_response = api.post(
        LOGIN, {"email": admin_user.email, "password": STRONG_PASSWORD}, format="json"
    )
    old_cookie = login_response.cookies[settings.AUTH_REFRESH_COOKIE].value

    logout = api.post(LOGOUT, {}, format="json")
    assert logout.status_code == 200

    api.cookies[settings.AUTH_REFRESH_COOKIE] = old_cookie
    assert api.post(REFRESH, {}, format="json").status_code == 401


@pytest.mark.django_db
def test_password_reset_request_does_not_enumerate_accounts(api, admin_user):
    known = api.post(
        "/api/v1/accounts/auth/password-reset/",
        {"email": admin_user.email},
        format="json",
    )
    unknown = api.post(
        "/api/v1/accounts/auth/password-reset/",
        {"email": "missing@test.example"},
        format="json",
    )
    assert known.status_code == unknown.status_code == 200
    assert known.data["detail"] == unknown.data["detail"]


@pytest.mark.django_db
def test_password_reset_confirm_flow_revokes_sessions(api, admin_user):
    login_response = api.post(
        LOGIN, {"email": admin_user.email, "password": STRONG_PASSWORD}, format="json"
    )
    old_cookie = login_response.cookies[settings.AUTH_REFRESH_COOKIE].value

    # Sign-in updates last_login, which is part of Django's reset token hash.
    admin_user.refresh_from_db()
    uid = urlsafe_base64_encode(force_bytes(admin_user.pk))
    token = default_token_generator.make_token(admin_user)

    confirm = api.post(
        "/api/v1/accounts/auth/password-reset/confirm/",
        {
            "uid": uid,
            "token": token,
            "new_password": "ResetFlow@2026!",
            "new_password_confirm": "ResetFlow@2026!",
        },
        format="json",
    )
    assert confirm.status_code == 200, confirm.content

    api.cookies[settings.AUTH_REFRESH_COOKIE] = old_cookie
    assert api.post(REFRESH, {}, format="json").status_code == 401

    new_login = api.post(
        LOGIN,
        {"email": admin_user.email, "password": "ResetFlow@2026!"},
        format="json",
    )
    assert new_login.status_code == 200


@pytest.mark.django_db
def test_password_reset_rejects_bad_token(api, admin_user):
    uid = urlsafe_base64_encode(force_bytes(admin_user.pk))
    response = api.post(
        "/api/v1/accounts/auth/password-reset/confirm/",
        {
            "uid": uid,
            "token": "not-a-real-token",
            "new_password": "ResetFlow@2026!",
            "new_password_confirm": "ResetFlow@2026!",
        },
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_profile_update_cannot_change_email_or_roles(auth_client, admin_user):
    client = auth_client(admin_user)
    response = client.patch(
        ME,
        {
            "first_name": "Updated",
            "email": "attacker@test.example",
            "roles": ["Student"],
        },
        format="json",
    )
    assert response.status_code == 200
    admin_user.refresh_from_db()
    assert admin_user.first_name == "Updated"
    assert admin_user.email == "admin@test.example"
    assert "Admin" in admin_user.role_names
