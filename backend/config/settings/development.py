"""Development settings."""

from .base import *  # noqa: F401,F403

DEBUG = config("DEBUG", default=True, cast=bool)

# Local development convenience: allow the Vite dev server.
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:5173,http://127.0.0.1:5173",
    cast=lambda value: [origin.strip() for origin in value.split(",") if origin.strip()],
)

AUTH_REFRESH_COOKIE_SECURE = config("AUTH_COOKIE_SECURE", default=False, cast=bool)

# SQLite is used in development.
DATABASES["default"].setdefault("OPTIONS", {})
