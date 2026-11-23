"""Validation helpers for the accounts app."""

from pathlib import Path

from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError

MAX_IMAGE_SIZE = 2 * 1024 * 1024  # 2 MB
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}


def validate_profile_image(file):
    """Reject oversized files, disguised extensions and malformed images.

    The file is opened with Pillow to confirm it really is an image. This
    defeats attacks that rename a script/HTML payload to ``.jpg``.
    """
    if file is None:
        return

    size = getattr(file, "size", None)
    if size is not None and size > MAX_IMAGE_SIZE:
        raise ValidationError("Profile images must be 2 MB or smaller.")

    ext = Path(getattr(file, "name", "")).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValidationError("Only JPG, PNG or WebP images are allowed.")

    try:
        image = Image.open(file)
        image.verify()
        if image.format not in ALLOWED_IMAGE_FORMATS:
            raise ValidationError("Unsupported image format.")
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise ValidationError("The uploaded file is not a valid image.") from exc
    finally:
        try:
            file.seek(0)
        except Exception:
            pass


class ComplexityPasswordValidator:
    """Require a mix of character classes (length is enforced separately)."""

    def validate(self, password, user=None):
        checks = [
            (any(char.islower() for char in password), "a lowercase letter"),
            (any(char.isupper() for char in password), "an uppercase letter"),
            (any(char.isdigit() for char in password), "a number"),
            (
                any(not char.isalnum() for char in password),
                "a special character",
            ),
        ]
        missing = [label for passed, label in checks if not passed]
        if missing:
            raise ValidationError(
                "Password must contain at least one of each: "
                + ", ".join(missing)
                + ".",
                code="password_too_weak",
            )

    def get_help_text(self):
        return (
            "Your password must contain at least 10 characters, including "
            "uppercase and lowercase letters, a number and a special character."
        )
