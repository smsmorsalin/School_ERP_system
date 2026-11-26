"""Validation helpers for the accounts app."""

from apps.core.validators.images import (
    ALLOWED_IMAGE_EXTENSIONS,
    ALLOWED_IMAGE_FORMATS,
    MAX_IMAGE_SIZE,
    validate_image_upload,
)


def validate_profile_image(file):
    """Reject oversized files, disguised extensions and malformed images.

    The shared validator opens the file with Pillow to confirm it really is an
    image, which defeats attacks that rename a script/HTML payload to ``.jpg``.
    """
    return validate_image_upload(file, label="Profile images")


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
