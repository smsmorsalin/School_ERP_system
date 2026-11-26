"""School-wide branding and console preferences.

There is exactly one row, identified by a fixed UUID so the audit trail can
reference it like any other record. Administrators edit it from
**Administration → Customisation**; everyone else reads the public subset so
the sign-in screen and sidebar can carry the school's identity.
"""

import uuid

from django.conf import settings
from django.db import models

from apps.core.validators import validate_favicon, validate_logo

SCHOOL_SETTINGS_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


class SchoolSettings(models.Model):
    ACCENT_CHOICES = [
        ("forest", "Forest"),
        ("navy", "Navy"),
        ("plum", "Plum"),
        ("teal", "Teal"),
        ("maroon", "Maroon"),
    ]
    THEME_CHOICES = [
        ("system", "Match system"),
        ("light", "Light"),
        ("dark", "Dark"),
    ]

    id = models.UUIDField(
        primary_key=True, default=SCHOOL_SETTINGS_ID, editable=False
    )

    # Identity
    school_name = models.CharField(max_length=120, default="School ERP")
    short_name = models.CharField(max_length=40, blank=True, default="")
    tagline = models.CharField(max_length=160, blank=True, default="Management console")
    address = models.TextField(blank=True, default="")
    phone = models.CharField(max_length=40, blank=True, default="")
    email = models.EmailField(blank=True, default="")
    website = models.URLField(blank=True, default="")

    # Branding
    logo = models.ImageField(
        upload_to="branding/", blank=True, null=True, validators=[validate_logo]
    )
    favicon = models.ImageField(
        upload_to="branding/", blank=True, null=True, validators=[validate_favicon]
    )
    accent = models.CharField(max_length=20, choices=ACCENT_CHOICES, default="forest")

    # Sign-in screen copy
    login_headline = models.CharField(
        max_length=140,
        blank=True,
        default="Everything your school needs, *in one calm place.*",
    )
    login_subtext = models.TextField(
        blank=True,
        default=(
            "Admissions, attendance, examinations and finance — connected so your "
            "team can spend less time on admin and more time on students."
        ),
    )
    login_notice = models.CharField(max_length=200, blank=True, default="")

    # Console defaults
    default_theme = models.CharField(
        max_length=10, choices=THEME_CHOICES, default="system"
    )
    compact_tables = models.BooleanField(default=False)

    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="settings_updates",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "school_settings"
        verbose_name = "School settings"
        verbose_name_plural = "School settings"

    def __str__(self):
        return self.school_name or "School settings"

    def save(self, *args, **kwargs):
        # Enforce the singleton at the database boundary, not just in the API.
        self.id = SCHOOL_SETTINGS_ID
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        """Return the single settings row, creating defaults on first use."""
        obj, _ = cls.objects.get_or_create(pk=SCHOOL_SETTINGS_ID)
        return obj
