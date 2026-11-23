# syntax=docker/dockerfile:1.7
#
# Multi-stage image for the School ERP:
#   1. build the React SPA
#   2. install Python dependencies
#   3. produce a small, non-root runtime that serves the API, SPA and static
#      files through Gunicorn + WhiteNoise
#
# Build from the repository root:
#   docker build -t school-erp:latest .
#
# The frontend is baked into the image, so no Node runtime is needed in
# production and no separate frontend container is required.

# ---------------------------------------------------------------------------
# Stage 1: frontend build
# ---------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /build/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: runtime
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DJANGO_SETTINGS_MODULE=config.settings.production \
    PORT=8000

# curl is used by the container health check; tzdata makes Django's
# zoneinfo lookups (TIME_ZONE=Asia/Dhaka) work in the slim image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --home-dir /app --shell /usr/sbin/nologin app

WORKDIR /app

# Python dependencies first for better layer caching.
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --upgrade pip \
    && pip install -r /app/backend/requirements.txt

# Application code and the compiled SPA.
COPY backend/ /app/backend/
COPY --from=frontend-builder /build/frontend/dist /app/frontend/dist

# Collect static files at build time so the runtime filesystem can be read-only.
# A throwaway secret is supplied only for this build step.
RUN mkdir -p /app/backend/staticfiles /app/backend/media /app/backend/logs \
    && SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(64))')" \
       DJANGO_SETTINGS_MODULE=config.settings.development \
       python /app/backend/manage.py collectstatic --noinput

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY docker/gunicorn.conf.py /app/gunicorn.conf.py

RUN chmod +x /usr/local/bin/entrypoint.sh \
    && chown -R app:app /app

USER app
WORKDIR /app/backend

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fsS -H 'X-Forwarded-Proto: https' \
        http://127.0.0.1:8000/api/v1/health/ready/ || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--config", "/app/gunicorn.conf.py"]
