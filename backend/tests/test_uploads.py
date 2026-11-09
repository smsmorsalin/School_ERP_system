"""Image-upload validation tests."""

from __future__ import annotations

from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

ME = "/api/v1/accounts/auth/me/"


def png_bytes(size=(10, 10)):
    buffer = BytesIO()
    Image.new("RGB", size, color=(30, 120, 200)).save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.mark.django_db
def test_valid_png_is_accepted(auth_client, admin_user, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    client = auth_client(admin_user)
    upload = SimpleUploadedFile("avatar.png", png_bytes(), content_type="image/png")
    response = client.patch(ME, {"profile_image": upload}, format="multipart")
    assert response.status_code == 200, response.content
    admin_user.refresh_from_db()
    assert admin_user.profile_image


@pytest.mark.django_db
def test_disguised_text_file_is_rejected(auth_client, admin_user, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    client = auth_client(admin_user)
    upload = SimpleUploadedFile(
        "evil.jpg", b"<script>alert(1)</script>", content_type="image/jpeg"
    )
    response = client.patch(ME, {"profile_image": upload}, format="multipart")
    assert response.status_code == 400
    assert "valid image" in str(response.data).lower()


@pytest.mark.django_db
def test_disallowed_extension_is_rejected(auth_client, admin_user, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    client = auth_client(admin_user)
    upload = SimpleUploadedFile("avatar.gif", b"GIF89a", content_type="image/gif")
    response = client.patch(ME, {"profile_image": upload}, format="multipart")
    assert response.status_code == 400


@pytest.mark.django_db
def test_oversized_image_is_rejected(auth_client, admin_user, settings, tmp_path):
    import os

    settings.MEDIA_ROOT = tmp_path
    client = auth_client(admin_user)
    # Large random-noise image so PNG compression cannot shrink it below 2 MB.
    raw = os.urandom(1100 * 1100 * 3)
    image = Image.frombytes("RGB", (1100, 1100), raw)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    oversized = buffer.getvalue()
    assert len(oversized) > 2 * 1024 * 1024

    upload = SimpleUploadedFile("large.png", oversized, content_type="image/png")
    response = client.patch(ME, {"profile_image": upload}, format="multipart")
    assert response.status_code == 400
    assert "2 mb" in str(response.data).lower()
