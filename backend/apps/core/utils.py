"""Shared helpers."""

import secrets
import string

from django.conf import settings
from django.http import HttpResponseForbidden
from urllib.parse import urlparse

TRUSTED_ORIGIN_HEADERS = ("HTTP_ORIGIN", "HTTP_REFERER")


def generate_temporary_password(length: int = 14) -> str:
    """Return a random password that satisfies the complexity validator."""
    lower = string.ascii_lowercase
    upper = string.ascii_uppercase
    digits = string.digits
    symbols = "!@#$%&*"
    alphabet = lower + upper + digits + symbols
    required = [
        secrets.choice(lower),
        secrets.choice(upper),
        secrets.choice(digits),
        secrets.choice(symbols),
    ]
    required.extend(secrets.choice(alphabet) for _ in range(max(0, length - 4)))
    secrets.SystemRandom().shuffle(required)
    return "".join(required)


def get_client_ip(request) -> str:
    """Return the client IP, ignoring spoofable X-Forwarded-For unless a
    trusted proxy is configured.

    By default we use REMOTE_ADDR. Deployments behind a reverse proxy should
    set ``USE_X_FORWARDED_FOR=true`` and make sure the proxy appends (not
    blindly trusts) the header.

    The **right-most** value is used because it is the address observed by our
    own trusted proxy. Client-supplied values sit to the left of it and can be
    spoofed; trusting the left-most value would let an attacker rotate the
    apparent IP and bypass throttling.
    """
    if getattr(settings, "USE_X_FORWARDED_FOR", False):
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
        if forwarded:
            candidate = forwarded.split(",")[-1].strip()
            if candidate:
                return candidate
    return request.META.get("REMOTE_ADDR") or "0.0.0.0"


def origin_is_trusted(request) -> bool:
    """Validate Origin/Referer for cookie-authenticated state changes.

    Requests without either header (CLI clients) are allowed; browsers always
    send Origin on cross-site POST requests.
    """
    origin = request.META.get("HTTP_ORIGIN")
    referer = request.META.get("HTTP_REFERER")
    allowed = set(settings.CORS_ALLOWED_ORIGINS) | set(settings.CSRF_TRUSTED_ORIGINS)
    allowed.add(settings.FRONTEND_URL)
    # The built SPA is served by Django itself, so its own origin is trusted.
    try:
        allowed.add(f"{request.scheme}://{request.get_host()}")
    except Exception:  # pragma: no cover - defensive
        pass

    raw = origin or referer
    if not raw:
        return True
    try:
        parsed = urlparse(raw)
        base = f"{parsed.scheme}://{parsed.netloc}"
    except ValueError:
        return False
    return base in allowed


def reject_untrusted_origin(request):
    if not origin_is_trusted(request):
        return HttpResponseForbidden("Untrusted origin.")
    return None
