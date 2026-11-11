#!/usr/bin/env sh
# Container entrypoint: optional migrations, then the requested command.
set -eu

: "${DJANGO_SETTINGS_MODULE:=config.settings.production}"
export DJANGO_SETTINGS_MODULE

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
    echo "[entrypoint] applying database migrations"
    python manage.py migrate --noinput
fi

if [ "${CREATE_INITIAL_ROLES:-0}" = "1" ]; then
    echo "[entrypoint] ensuring built-in roles and permissions exist"
    python manage.py create_initial_roles
fi

if [ "${SEED_DEMO_DATA:-0}" = "1" ]; then
    echo "[entrypoint] seeding demo data"
    python manage.py seed_demo_data
fi

exec "$@"
