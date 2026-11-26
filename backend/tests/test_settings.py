"""School branding / customisation settings tests."""

from __future__ import annotations

from io import BytesIO

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.audit.models import AuditLog
from apps.core.models import SchoolSettings

SETTINGS = "/api/v1/settings/"


def png_bytes(size=(24, 24)):
    buffer = BytesIO()
    Image.new("RGB", size, color=(23, 97, 61)).save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.mark.django_db
def test_branding_is_public_before_login(api):
    response = api.get(SETTINGS)
    assert response.status_code == 200, response.content
    assert response.data["school_name"] == "School ERP"
    assert response.data["accent"] == "forest"
    assert response.data["logo_url"] is None
    assert response.data["favicon_url"] is None
    assert response.data["login_headline"].startswith("Everything your school needs")
    # No internal/audit fields leak on the public endpoint.
    assert "updated_by" not in response.data
    assert response.data["updated_by_name"] is None


@pytest.mark.django_db
def test_admin_can_customise_school_identity(auth_client, admin_user):
    client = auth_client(admin_user)
    response = client.patch(
        SETTINGS,
        {
            "school_name": "Green Valley High",
            "short_name": "GVH",
            "tagline": "Learning with purpose",
            "phone": "+880 1700 000000",
            "email": "office@gvh.example",
            "website": "https://gvh.example",
            "accent": "navy",
            "default_theme": "dark",
            "compact_tables": True,
        },
        format="json",
    )
    assert response.status_code == 200, response.content
    assert response.data["school_name"] == "Green Valley High"
    assert response.data["accent"] == "navy"

    obj = SchoolSettings.load()
    assert obj.school_name == "Green Valley High"
    assert obj.compact_tables is True
    assert obj.default_theme == "dark"
    assert obj.updated_by_id == admin_user.id
    assert response.data["updated_by_name"] == admin_user.get_full_name()


@pytest.mark.django_db
def test_admin_can_edit_sign_in_copy(auth_client, admin_user):
    client = auth_client(admin_user)
    response = client.patch(
        SETTINGS,
        {
            "login_headline": "Welcome to *Green Valley*",
            "login_subtext": "Sign in with your school account.",
            "login_notice": "Admissions for 2026–27 are open.",
        },
        format="json",
    )
    assert response.status_code == 200, response.content
    assert response.data["login_notice"] == "Admissions for 2026–27 are open."

    public = client.get(SETTINGS).data
    assert public["login_headline"] == "Welcome to *Green Valley*"
    assert public["login_subtext"] == "Sign in with your school account."
    assert SchoolSettings.load().login_notice.startswith("Admissions")


@pytest.mark.django_db
def test_settings_change_is_audited(auth_client, admin_user):
    client = auth_client(admin_user)
    client.patch(SETTINGS, {"school_name": "Audited School"}, format="json")

    entry = AuditLog.objects.get(action="core.schoolsettings.updated")
    assert entry.target_app == "core"
    assert entry.target_model == "schoolsettings"
    assert entry.actor_id == admin_user.id
    assert entry.before["school_name"] == "School ERP"
    assert entry.after["school_name"] == "Audited School"


@pytest.mark.django_db
def test_non_admins_cannot_change_settings(
    auth_client, teacher_user, accountant_user, students
):
    for user in (teacher_user, accountant_user, students["user1"]):
        response = auth_client(user).patch(
            SETTINGS, {"school_name": "Not allowed"}, format="json"
        )
        assert response.status_code == 403, response.content


@pytest.mark.django_db
def test_unknown_accent_is_rejected(auth_client, admin_user):
    response = auth_client(admin_user).patch(
        SETTINGS, {"accent": "neon"}, format="json"
    )
    assert response.status_code == 400
    assert "accent" in str(response.data["fields"])


@pytest.mark.django_db
def test_settings_are_a_singleton(auth_client, admin_user):
    obj = SchoolSettings.load()
    obj.school_name = "Second school"
    obj.save()
    assert SchoolSettings.objects.count() == 1
    assert SchoolSettings.load().school_name == "Second school"


@pytest.mark.django_db
def test_logo_upload_and_removal(auth_client, admin_user, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    client = auth_client(admin_user)

    upload = SimpleUploadedFile("logo.png", png_bytes(), content_type="image/png")
    response = client.patch(SETTINGS, {"logo": upload}, format="multipart")
    assert response.status_code == 200, response.content
    assert response.data["logo_url"]
    assert SchoolSettings.load().logo

    removed = client.patch(SETTINGS, {"remove_logo": True}, format="json")
    assert removed.status_code == 200, removed.content
    assert removed.data["logo_url"] is None
    assert not SchoolSettings.load().logo


@pytest.mark.django_db
def test_saving_other_fields_keeps_the_logo(auth_client, admin_user, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    client = auth_client(admin_user)

    upload = SimpleUploadedFile("logo.png", png_bytes(), content_type="image/png")
    assert client.patch(SETTINGS, {"logo": upload}, format="multipart").status_code == 200

    # A later PATCH that omits `logo` must not wipe it.
    response = client.patch(SETTINGS, {"accent": "teal"}, format="json")
    assert response.status_code == 200, response.content
    assert response.data["logo_url"]
    assert SchoolSettings.load().logo


@pytest.mark.django_db
def test_favicon_upload_removal_and_preservation(
    auth_client, admin_user, settings, tmp_path
):
    settings.MEDIA_ROOT = tmp_path
    client = auth_client(admin_user)

    upload = SimpleUploadedFile("icon.png", png_bytes(), content_type="image/png")
    response = client.patch(SETTINGS, {"favicon": upload}, format="multipart")
    assert response.status_code == 200, response.content
    assert response.data["favicon_url"]
    assert SchoolSettings.load().favicon

    # Unrelated saves keep it.
    response = client.patch(SETTINGS, {"accent": "maroon"}, format="json")
    assert response.data["favicon_url"]
    assert SchoolSettings.load().favicon

    removed = client.patch(SETTINGS, {"remove_favicon": True}, format="json")
    assert removed.status_code == 200, removed.content
    assert removed.data["favicon_url"] is None
    assert not SchoolSettings.load().favicon


@pytest.mark.django_db
def test_disguised_logo_is_rejected(auth_client, admin_user, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    upload = SimpleUploadedFile(
        "logo.png", b"<script>alert(1)</script>", content_type="image/png"
    )
    response = auth_client(admin_user).patch(
        SETTINGS, {"logo": upload}, format="multipart"
    )
    assert response.status_code == 400
