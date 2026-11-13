"""
Base Django settings shared by every environment.

Environment values are read with python-decouple from ``backend/.env``.
Real secrets must never be committed to source control.
"""

import os
from datetime import timedelta
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from decouple import AutoConfig

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BASE_DIR.parent

config = AutoConfig(search_path=BASE_DIR)

# Container deployments mount the built SPA and data volumes at custom paths,
# so every filesystem location can be overridden with an environment variable.
FRONTEND_DIST = Path(
    config("FRONTEND_DIST", default=str(PROJECT_ROOT / "frontend" / "dist"))
)

# ---------------------------------------------------------------------------
# Core security
# ---------------------------------------------------------------------------
DEBUG = config("DEBUG", default=False, cast=bool)

SECRET_KEY = config("SECRET_KEY", default="")
if not SECRET_KEY:
    raise ImproperlyConfigured(
        "SECRET_KEY is not set. Copy backend/.env.example to backend/.env "
        "and generate a unique, random secret key."
    )

_INSECURE_SECRETS = {
    "your-secret-key-here-change-in-production",
    "change-me",
    "django-insecure",
}
if not DEBUG and SECRET_KEY in _INSECURE_SECRETS:
    raise ImproperlyConfigured("Refusing to start production with an insecure SECRET_KEY.")

ALLOWED_HOSTS = config(
    "ALLOWED_HOSTS",
    default="127.0.0.1,localhost,testserver",
    cast=lambda value: [item.strip() for item in value.split(",") if item.strip()],
)

# Kubernetes HTTP probes connect to the pod IP and send it as the Host header.
# The Downward API injects POD_IP, so allow exactly that address without
# weakening host validation for public traffic. IPv6 literals appear in the
# Host header inside brackets, so allow both forms.
POD_IP = config("POD_IP", default="").strip()
if POD_IP:
    for pod_host in {POD_IP, f"[{POD_IP}]"}:
        if pod_host not in ALLOWED_HOSTS:
            ALLOWED_HOSTS.append(pod_host)

CSRF_TRUSTED_ORIGINS = config(
    "CSRF_TRUSTED_ORIGINS",
    default="http://localhost:5173,http://127.0.0.1:5173",
    cast=lambda value: [item.strip() for item in value.split(",") if item.strip()],
)

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    # Local apps
    "apps.core",
    "apps.accounts",
    "apps.academics",
    "apps.attendance",
    "apps.exams",
    "apps.finance",
    "apps.communication",
    "apps.dashboard",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.core.middleware.SecurityHeadersMiddleware",
    "apps.core.middleware.RequestIDMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
DB_ENGINE = config("DB_ENGINE", default="django.db.backends.sqlite3")

if DB_ENGINE.endswith("sqlite3"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / config("DB_NAME", default="db.sqlite3"),
            "OPTIONS": {"timeout": 20},
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": DB_ENGINE,
            "NAME": config("DB_NAME", default="schoolerp"),
            "USER": config("DB_USER", default=""),
            "PASSWORD": config("DB_PASSWORD", default=""),
            "HOST": config("DB_HOST", default="localhost"),
            "PORT": config("DB_PORT", default="5432"),
            "CONN_MAX_AGE": config("DB_CONN_MAX_AGE", default=60, cast=int),
            "CONN_HEALTH_CHECKS": config(
                "DB_CONN_HEALTH_CHECKS", default=True, cast=bool
            ),
            "OPTIONS": {"sslmode": config("DB_SSLMODE", default="prefer")},
        }
    }

# ---------------------------------------------------------------------------
# Cache (shared across replicas when REDIS_URL is configured)
# ---------------------------------------------------------------------------
# DRF throttling and any cache-backed state use the default cache. A shared
# Redis cache keeps rate limits consistent when the API runs as many pods.
REDIS_URL = config("REDIS_URL", default="")
if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
            "TIMEOUT": 300,
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "school-erp-local",
        }
    }

# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
    {"NAME": "apps.accounts.validators.ComplexityPasswordValidator"},
]

# Public self-registration is disabled by default: an administrator creates
# accounts. Enable only when the school explicitly wants self sign-up.
ALLOW_PUBLIC_REGISTRATION = config("ALLOW_PUBLIC_REGISTRATION", default=False, cast=bool)

# ---------------------------------------------------------------------------
# Internationalisation
# ---------------------------------------------------------------------------
LANGUAGE_CODE = config("LANGUAGE_CODE", default="en-us")
TIME_ZONE = config("TIME_ZONE", default="UTC")
USE_I18N = True
USE_TZ = True

# Trust X-Forwarded-For only when a known reverse proxy overwrites it.
USE_X_FORWARDED_FOR = config("USE_X_FORWARDED_FOR", default=False, cast=bool)

# ---------------------------------------------------------------------------
# Static & media files
# ---------------------------------------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = Path(config("STATIC_ROOT", default=str(BASE_DIR / "staticfiles")))
STATICFILES_DIRS = [BASE_DIR / "static"] if (BASE_DIR / "static").exists() else []
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
WHITENOISE_MAX_AGE = 31536000
# Serve the compiled SPA's /assets/* directly from WhiteNoise (efficient,
# cacheable) instead of routing every asset through a Django view.
WHITENOISE_ROOT = str(FRONTEND_DIST) if FRONTEND_DIST.exists() else None

MEDIA_URL = "/media/"
MEDIA_ROOT = Path(config("MEDIA_ROOT", default=str(BASE_DIR / "media")))

# Upload limits (defence in depth; serializers validate file type & size too)
DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
DATA_UPLOAD_MAX_NUMBER_FIELDS = 2000

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.accounts.authentication.MustChangePasswordJWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.StandardPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/min",
        "user": "3000/hour",
        "login": "10/min",
        "password_reset": "5/hour",
        "sensitive": "30/hour",
        "payment_intent": "60/hour",
        "payment_webhook": "1200/min",
    },
    "DATETIME_FORMAT": "iso-8601",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "School ERP API",
    "DESCRIPTION": "Complete school management API with role-based access control.",
    "VERSION": "2.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
    "SCHEMA_PATH_PREFIX": "/api/v1",
}

# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=config("JWT_ACCESS_MINUTES", default=15, cast=int)
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=config("JWT_REFRESH_DAYS", default=1, cast=int)
    ),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": config("JWT_ALGORITHM", default="HS256"),
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
    "TOKEN_OBTAIN_SERIALIZER": "apps.accounts.serializers.CustomTokenObtainPairSerializer",
}

# Refresh cookie (HttpOnly, never readable by JavaScript).
AUTH_REFRESH_COOKIE = "school_erp_refresh"
AUTH_REFRESH_COOKIE_PATH = "/api/v1/accounts/auth/"
AUTH_REFRESH_COOKIE_SECURE = config("AUTH_COOKIE_SECURE", default=not DEBUG, cast=bool)
AUTH_REFRESH_COOKIE_SAMESITE = "Lax"

# ---------------------------------------------------------------------------
# CORS / frontend
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:5173,http://127.0.0.1:5173",
    cast=lambda value: [origin.strip() for origin in value.split(",") if origin.strip()],
)
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    "accept",
    "authorization",
    "content-type",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
    "idempotency-key",
]
FRONTEND_URL = config("FRONTEND_URL", default="http://localhost:5173")

# ---------------------------------------------------------------------------
# Online fee payments
# ---------------------------------------------------------------------------
# The sandbox adapter simulates a hosted gateway so the complete flow can be
# tested without merchant credentials. Production must switch it off.
PAYMENT_ONLINE_ENABLED = config("PAYMENT_ONLINE_ENABLED", default=True, cast=bool)
PAYMENT_SANDBOX = config("PAYMENT_SANDBOX", default=DEBUG, cast=bool)
PAYMENT_CURRENCY = config("PAYMENT_CURRENCY", default="BDT")
PAYMENT_INTENT_TTL_MINUTES = config(
    "PAYMENT_INTENT_TTL_MINUTES", default=30, cast=int
)
PAYMENT_WEBHOOK_SECRET = config("PAYMENT_WEBHOOK_SECRET", default="")
PAYMENT_WEBHOOK_TOLERANCE_SECONDS = config(
    "PAYMENT_WEBHOOK_TOLERANCE_SECONDS", default=300, cast=int
)
# Live gateways redirect the browser to their own hosted checkout page. Until
# real merchant credentials are configured, this may stay empty in development.
PAYMENT_LIVE_CHECKOUT_BASE = config("PAYMENT_LIVE_CHECKOUT_BASE", default="")

if PAYMENT_INTENT_TTL_MINUTES < 5 or PAYMENT_INTENT_TTL_MINUTES > 120:
    raise ImproperlyConfigured(
        "PAYMENT_INTENT_TTL_MINUTES must be between 5 and 120 minutes."
    )
if PAYMENT_WEBHOOK_TOLERANCE_SECONDS < 30 or PAYMENT_WEBHOOK_TOLERANCE_SECONDS > 3600:
    raise ImproperlyConfigured(
        "PAYMENT_WEBHOOK_TOLERANCE_SECONDS must be between 30 and 3600 seconds."
    )
if PAYMENT_CURRENCY != "BDT":
    raise ImproperlyConfigured(
        "Only BDT is supported by the configured Bangladesh payment gateways."
    )

# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------
EMAIL_BACKEND = config(
    "EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend"
)
EMAIL_HOST = config("EMAIL_HOST", default="localhost")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=True, cast=bool)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="School ERP <no-reply@school.example>")

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOG_DIR = Path(config("LOG_DIR", default=str(BASE_DIR / "logs")))
try:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR_WRITABLE = os.access(LOG_DIR, os.W_OK)
except OSError:
    # Read-only container filesystems may not provide a writable log directory.
    # File logging is then disabled and console (stdout) logging is used.
    LOG_DIR_WRITABLE = False

_LOG_HANDLERS = ["console", "file"] if LOG_DIR_WRITABLE else ["console"]
_LOGGING_HANDLERS = {
    "console": {"class": "logging.StreamHandler", "formatter": "simple"},
}
if LOG_DIR_WRITABLE:
    _LOGGING_HANDLERS["file"] = {
        "class": "logging.handlers.RotatingFileHandler",
        "filename": LOG_DIR / "django.log",
        "maxBytes": 5 * 1024 * 1024,
        "backupCount": 5,
        "formatter": "verbose",
    }

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{asctime} {levelname} {name} {process:d} {thread:d} {message}",
            "style": "{",
        },
        "simple": {"format": "{levelname} {message}", "style": "{"},
    },
    "handlers": _LOGGING_HANDLERS,
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django": {
            "handlers": _LOG_HANDLERS,
            "level": "INFO",
            "propagate": False,
        },
        "apps": {
            "handlers": _LOG_HANDLERS,
            "level": "INFO",
            "propagate": False,
        },
        "django.security": {
            "handlers": _LOG_HANDLERS,
            "level": "WARNING",
            "propagate": False,
        },
    },
}

# ---------------------------------------------------------------------------
# Baseline security headers (production tightens further)
# ---------------------------------------------------------------------------
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
X_FRAME_OPTIONS = "DENY"

# Content-Security-Policy used when Django serves the SPA (production).
CONTENT_SECURITY_POLICY = config(
    "CONTENT_SECURITY_POLICY",
    default=(
        "default-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; "
        "style-src 'self' 'unsafe-inline'; script-src 'self'; "
        "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; "
        "form-action 'self'; object-src 'none'"
    ),
)
