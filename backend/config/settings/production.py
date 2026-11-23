"""Production settings: secure defaults and hard failures for unsafe config."""

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403

DEBUG = False

# ---------------------------------------------------------------------------
# Transport security
# ---------------------------------------------------------------------------
SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=True, cast=bool)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = config("SECURE_HSTS_SECONDS", default=31_536_000, cast=int)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
# Must be explicitly enabled; the check below refuses to start otherwise.
AUTH_REFRESH_COOKIE_SECURE = config("AUTH_COOKIE_SECURE", default=True, cast=bool)

# ---------------------------------------------------------------------------
# Validate configuration that is dangerous in production
# ---------------------------------------------------------------------------
# ``ALLOWED_HOSTS`` has development defaults in base.py, so check the raw
# environment value rather than the parsed list. Production must opt in.
if not config("ALLOWED_HOSTS", default="").strip():
    raise ImproperlyConfigured(
        "Set ALLOWED_HOSTS to the public host names in production."
    )
if not ALLOWED_HOSTS or "*" in ALLOWED_HOSTS:
    raise ImproperlyConfigured("Set explicit ALLOWED_HOSTS in production.")

_secret_lower = SECRET_KEY.lower()
if len(SECRET_KEY) < 50 or any(
    marker in _secret_lower
    for marker in ("change-me", "changeme", "django-insecure", "your-secret", "example")
):
    raise ImproperlyConfigured(
        "Set a unique SECRET_KEY of at least 50 characters in production."
    )

if not AUTH_REFRESH_COOKIE_SECURE:
    raise ImproperlyConfigured(
        "AUTH_COOKIE_SECURE must be true in production (HTTPS is required)."
    )

if not FRONTEND_URL.startswith("https://"):
    raise ImproperlyConfigured(
        "FRONTEND_URL must use https:// in production."
    )

# ---------------------------------------------------------------------------
# Online payment safety
# ---------------------------------------------------------------------------
# Online payments are opt-in in production: a school that has not completed
# merchant onboarding must not expose a non-functional checkout.
PAYMENT_ONLINE_ENABLED = config("PAYMENT_ONLINE_ENABLED", default=False, cast=bool)
PAYMENT_SANDBOX = config("PAYMENT_SANDBOX", default=False, cast=bool)
PAYMENT_WEBHOOK_SECRET = config("PAYMENT_WEBHOOK_SECRET", default="")
PAYMENT_LIVE_CHECKOUT_BASE = config("PAYMENT_LIVE_CHECKOUT_BASE", default="")

if PAYMENT_SANDBOX:
    raise ImproperlyConfigured(
        "PAYMENT_SANDBOX must be false in production. Sandbox payments never "
        "move real money and are for development/staging only."
    )
if PAYMENT_ONLINE_ENABLED:
    if len(PAYMENT_WEBHOOK_SECRET) < 32:
        raise ImproperlyConfigured(
            "Set PAYMENT_WEBHOOK_SECRET to at least 32 random characters when "
            "online payments are enabled in production."
        )
    if not PAYMENT_LIVE_CHECKOUT_BASE.startswith("https://"):
        raise ImproperlyConfigured(
            "Set PAYMENT_LIVE_CHECKOUT_BASE to the HTTPS hosted-checkout URL "
            "provided by your payment partner."
        )

for origin in CORS_ALLOWED_ORIGINS:
    if not origin.startswith("https://"):
        raise ImproperlyConfigured(
            "CORS_ALLOWED_ORIGINS must only contain https:// origins in production."
        )

for origin in CSRF_TRUSTED_ORIGINS:
    if not origin.startswith("https://"):
        raise ImproperlyConfigured(
            "CSRF_TRUSTED_ORIGINS must only contain https:// origins in production."
        )

if DATABASES["default"]["ENGINE"].endswith("sqlite3"):
    # SQLite is acceptable for small deployments, but warn loudly.
    import logging

    logging.getLogger("django.security").warning(
        "SQLite is being used in production. PostgreSQL is strongly recommended."
    )
