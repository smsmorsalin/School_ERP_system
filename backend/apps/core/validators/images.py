"""Image validation for shared branding assets.

Profile photos and the school logo share the same safety rules: a hard size
cap, a short extension allow-list and a real Pillow decode so a renamed script
can never be stored as an image.
"""

from pathlib import Path

from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError

MAX_IMAGE_SIZE = 2 * 1024 * 1024  # 2 MB
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}


def validate_image_upload(file, label="Image"):
    """Reject oversized files, disguised extensions and malformed images."""
    if file is None:
        return

    size = getattr(file, "size", None)
    if size is not None and size > MAX_IMAGE_SIZE:
        raise ValidationError(f"{label} must be 2 MB or smaller.")

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


def validate_logo(file):
    """School logo validator used by the settings model."""
    return validate_image_upload(file, label="Logo")


def validate_favicon(file):
    """Browser-tab icon; same safety rules as the logo."""
    return validate_image_upload(file, label="Favicon")
