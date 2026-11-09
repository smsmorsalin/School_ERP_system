# Quick Reference — School ERP

## Quick start (development)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                      # edit if needed
python manage.py migrate
python manage.py create_initial_roles
python manage.py seed_demo_data           # demo school + accounts
python manage.py runserver 0.0.0.0:8000

# Frontend (optional hot reload)
cd ../frontend && npm install && npm run dev
```

- SPA/API: `http://localhost:8000/`
- API schema: `http://localhost:8000/api/schema/`
- Swagger UI: `http://localhost:8000/api/docs/`

## Tests

```bash
cd backend && .venv/bin/python -m pytest        # 70 tests
```

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@school.example` | `Admin@12345` |
| Teacher | `teacher@school.example` | `Teacher@12345` |
| Accountant | `accountant@school.example` | `Account@12345` |
| Student | `student@school.example` | `Student@12345` |
| Parent | `parent@school.example` | `Parent@12345` |

## Auth flow

```bash
# login → access token in response, refresh token in HttpOnly cookie
curl -X POST http://localhost:8000/api/v1/accounts/auth/login/ \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@school.example","password":"Admin@12345"}'

# authenticated call
curl http://localhost:8000/api/v1/accounts/auth/me/ \
  -H "Authorization: Bearer $ACCESS"
```

## Common management commands

```bash
python manage.py migrate                  # apply migrations
python manage.py collectstatic --noinput  # production static files
python manage.py createsuperuser          # Django admin account
```

## Production

```bash
export DJANGO_SETTINGS_MODULE=config.settings.production
gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4
```

See **[SETUP_GUIDE.md](SETUP_GUIDE.md)** for the full production walkthrough and
`.env` reference, **[ARCHITECTURE.md](ARCHITECTURE.md)** for the design and
**[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** for every endpoint.
