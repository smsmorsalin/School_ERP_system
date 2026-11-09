"""Custom user model with email login, role cache and lockout support."""

import uuid
from pathlib import Path

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone

from apps.core.models import BaseModel
from apps.accounts.validators import validate_profile_image


def profile_image_path(instance, filename):
    """Store avatars under a random path with a safe extension."""
    ext = Path(filename).suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        ext = ".jpg"
    return f"profile_images/{instance.uuid}/{uuid.uuid4().hex}{ext}"


class UserManager(BaseUserManager):
    """Manager that uses email as the unique identifier (no username)."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser, BaseModel):
    """School ERP user.

    Email is the login identifier. A user can hold several roles
    (e.g. Teacher + Accountant) through ``UserRole``.
    """

    username = None
    email = models.EmailField(unique=True, db_index=True)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    profile_image = models.ImageField(
        upload_to=profile_image_path,
        blank=True,
        null=True,
        validators=[validate_profile_image],
    )
    date_of_birth = models.DateField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    state = models.CharField(max_length=100, blank=True, null=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    postal_code = models.CharField(max_length=20, blank=True, null=True)

    # Account security
    failed_login_attempts = models.PositiveIntegerField(default=0, editable=False)
    locked_until = models.DateTimeField(blank=True, null=True, editable=False)
    last_failed_login = models.DateTimeField(blank=True, null=True, editable=False)
    must_change_password = models.BooleanField(default=False)
    last_password_change = models.DateTimeField(blank=True, null=True)
    # Incremented whenever credentials change so every token issued before the
    # change is rejected immediately (access tokens are otherwise stateless).
    token_version = models.PositiveIntegerField(default=0, editable=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    objects = UserManager()

    class Meta:
        db_table = "user"
        verbose_name = "User"
        verbose_name_plural = "Users"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["email"]),
            models.Index(fields=["is_active"]),
            models.Index(fields=["-created_at"]),
        ]

    def __str__(self):
        return f"{self.get_full_name()} <{self.email}>"

    def save(self, *args, **kwargs):
        self.email = (self.email or "").lower().strip()
        super().save(*args, **kwargs)

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.email

    # -- roles ------------------------------------------------------------
    @property
    def role_names(self):
        """Active role names, cached per model instance."""
        if not hasattr(self, "_role_names_cache"):
            self._role_names_cache = list(
                self.user_roles.filter(is_active=True, role__is_active=True)
                .values_list("role__name", flat=True)
            )
        return self._role_names_cache

    def clear_role_cache(self):
        if hasattr(self, "_role_names_cache"):
            del self._role_names_cache

    def has_role(self, *names):
        return bool(set(self.role_names).intersection(names)) or self.is_superuser

    @property
    def is_admin(self):
        return self.is_superuser or "Admin" in self.role_names

    @property
    def primary_role(self):
        for preferred in ("Admin", "Teacher", "Accountant", "Parent", "Student"):
            if preferred in self.role_names:
                return preferred
        return "Student"

    # -- lockout ----------------------------------------------------------
    @property
    def is_locked(self):
        return bool(self.locked_until and self.locked_until > timezone.now())

    def register_failed_login(self, max_attempts=5, lock_minutes=15):
        self.failed_login_attempts = (self.failed_login_attempts or 0) + 1
        self.last_failed_login = timezone.now()
        if self.failed_login_attempts >= max_attempts:
            self.locked_until = timezone.now() + timezone.timedelta(minutes=lock_minutes)
        self.save(
            update_fields=[
                "failed_login_attempts",
                "last_failed_login",
                "locked_until",
            ]
        )

    def register_successful_login(self):
        self.failed_login_attempts = 0
        self.locked_until = None
        self.last_login = timezone.now()
        self.save(
            update_fields=[
                "failed_login_attempts",
                "locked_until",
                "last_login",
            ]
        )
