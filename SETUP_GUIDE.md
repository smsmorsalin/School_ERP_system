# School ERP — Setup Guide

This guide covers local development, running the test suite, building the
frontend, and deploying to production.

---

## 1. Prerequisites

- **Python** 3.12+ (tested on 3.14)
- **Node.js** 18+ and **npm** (only needed if you want the Vite dev server or a
  frontend rebuild)
- **PostgreSQL** 14+ (recommended for production; SQLite is fine for development)

---

## 2. Backend setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Configure the environment

```bash
cp .env.example .env
```

Edit `.env`. The most important keys:

| Variable                  | Development            | Production                              |
|---------------------------|------------------------|------------------------------------------|
| `DEBUG`                   | `True`                 | `False`                                  |
| `SECRET_KEY`              | any value              | `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `ALLOWED_HOSTS`           | `127.0.0.1,localhost`  | your public host(s)                      |
| `DB_ENGINE`               | `django.db.backends.sqlite3` | `django.db.backends.postgresql`     |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_HOST` / `DB_PORT` | — | your PostgreSQL details |
| `FRONTEND_URL`            | `http://localhost:5173`| `https://your-domain`                    |
| `CORS_ALLOWED_ORIGINS`    | `http://localhost:5173,http://127.0.0.1:5173` | `https://your-domain` |
| `CSRF_TRUSTED_ORIGINS`    | same as CORS           | `https://your-domain`                    |
| `AUTH_COOKIE_SECURE`      | `False`                | `True`                                   |
| `JWT_ACCESS_MINUTES`      | `15`                   | `15`                                     |
| `JWT_REFRESH_DAYS`        | `1`                    | `1`                                      |
| `ALLOW_PUBLIC_REGISTRATION` | `False`              | `False`                                  |
| `TIME_ZONE`               | `Asia/Dhaka`           | `Asia/Dhaka`                             |
| `EMAIL_BACKEND`           | console                | SMTP settings (see below)                |
| `PAYMENT_ONLINE_ENABLED`  | `True`                 | `False` until configured, then `True`    |
| `PAYMENT_SANDBOX`         | `True`                 | `False` (required; production refuses `True`) |
| `PAYMENT_WEBHOOK_SECRET`  | empty (sandbox)        | ≥32 random characters                    |
| `PAYMENT_LIVE_CHECKOUT_BASE` | empty (sandbox)     | HTTPS hosted-checkout URL from the provider |
| `PAYMENT_INTENT_TTL_MINUTES` | `30`                | `30` (5–120)                             |

> **Production hard-fail checks** — with `DEBUG=False` the app refuses to start
> if `SECRET_KEY` is missing/short, `ALLOWED_HOSTS` is empty or `*`, any
> `FRONTEND_URL`/CORS/CSRF origin is not HTTPS, or `AUTH_COOKIE_SECURE` is not
> `True`. Under production settings it also refuses to start if
> `PAYMENT_SANDBOX=True`, or if online payments are enabled without a ≥32-char
> `PAYMENT_WEBHOOK_SECRET` and an HTTPS `PAYMENT_LIVE_CHECKOUT_BASE`. This makes
> an insecure deployment fail loudly instead of silently.

### Online fee payments

Out of the box the project runs the **sandbox** adapter: students and parents
can click **Pay online**, choose bKash/Nagad/Rocket/other mobile banking/card/
bank, and complete a simulated checkout at `/checkout/:uuid`. No real money
moves and no merchant account is needed — ideal for demos and testing.

To go live you need real provider credentials. Set `PAYMENT_SANDBOX=False`, a
strong `PAYMENT_WEBHOOK_SECRET`, `PAYMENT_LIVE_CHECKOUT_BASE` and
`PAYMENT_ONLINE_ENABLED=True`, then register the webhook URL
`https://<domain>/api/v1/finance/payment-webhook/<gateway>/` with each provider.
See [DEPLOYMENT.md](DEPLOYMENT.md#online-fee-payments) for the full checklist.
The provider-specific request/response adapters in
`backend/apps/finance/` still need to be completed for each live gateway.

### Email (production)

```ini
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=no-reply@your-domain
EMAIL_HOST_PASSWORD=your-password
DEFAULT_FROM_EMAIL=School ERP <no-reply@your-domain>
```

### Initialize the database

```bash
python manage.py migrate
python manage.py create_initial_roles   # seeds the 5 system roles + permissions
python manage.py seed_demo_data         # optional: demo school + demo accounts
```

To create a real administrator instead of (or in addition to) the demo data:

```bash
python manage.py createsuperuser
```

> The demo `admin@school.example` is **not** a Django superuser; it has the
> `Admin` role. Use `createsuperuser` if you want Django-admin access with a
> separate account, or promote a user in the Users screen.

### Run the development server

```bash
python manage.py runserver 0.0.0.0:8000
```

- SPA: `http://localhost:8000/`
- API: `http://localhost:8000/api/v1/`
- API schema: `http://localhost:8000/api/schema/`
- Swagger UI: `http://localhost:8000/api/docs/`
- Django admin: `http://localhost:8000/admin/`

---

## 3. Frontend

The SPA in `frontend/dist/` is already built and served by Django. To develop
the UI with hot reload:

```bash
cd frontend
npm install
npm run dev          # Vite dev server on http://localhost:5173
```

To rebuild the production bundle (served by Django at `/`):

```bash
npm run build
```

### Demo accounts

| Role        | Email                      | Password       |
|-------------|----------------------------|----------------|
| Admin       | `admin@school.example`     | `Admin@12345`  |
| Teacher     | `teacher@school.example`   | `Teacher@12345`|
| Accountant  | `accountant@school.example`| `Account@12345`|
| Student     | `student@school.example`   | `Student@12345`|
| Parent      | `parent@school.example`    | `Parent@12345` |

---

## 4. Tests

```bash
cd backend
.venv/bin/python -m pytest          # 103 tests
.venv/bin/python -m pytest -v       # verbose
.venv/bin/python -m pytest tests/test_auth.py   # one file
```

Tests use a disposable SQLite database and never touch your real data. Password
hashing and throttle rates are relaxed in tests; everything security-relevant is
left intact.

---

## 5. Production deployment

### 5.1 Database

Switch to PostgreSQL in `.env` (see the table above), then:

```bash
python manage.py migrate
```

### 5.2 Static files & media

```bash
python manage.py collectstatic --noinput   # serves via whitenoise
mkdir -p media                              # user uploads (avatars)
```

### 5.3 Run with Gunicorn

```bash
export DJANGO_SETTINGS_MODULE=config.settings.production
gunicorn config.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers 4 \
  --timeout 60 \
  --access-logfile - --error-logfile -
```

`config.settings.production` enables HTTPS redirects, HSTS, secure cookies and
the security headers.

### 5.4 Reverse proxy (nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain;

    ssl_certificate     /etc/letsencrypt/live/your-domain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name your-domain;
    return 301 https://$host$request_uri;
}
```

> The production settings read `HTTP_X_FORWARDED_PROTO` for the SSL redirect, so
> nginx must forward `X-Forwarded-Proto` (shown above). Set
> `USE_X_FORWARDED_FOR=True` in `.env` only when a trusted proxy sets
> `X-Forwarded-For` for real client IPs.

---

## 6. Troubleshooting

**Port already in use**

```bash
fuser -k 8000/tcp      # Linux
lsof -ti:8000 | xargs kill -9   # macOS
```

**Django refuses to start in production**

The server prints a clear `ImproperlyConfigured` message. The most common causes
are a weak `SECRET_KEY`, an empty/wildcard `ALLOWED_HOSTS`, a non-HTTPS
`FRONTEND_URL`/CORS/CSRF origin, or `AUTH_COOKIE_SECURE=False`.

**Login always fails / account locked**

Five failed attempts in 15 minutes locks an account. Use the **Unlock** action on
the user in the Users screen (admin), or wait for the lockout to expire. A locked
account returns a generic error for both correct and incorrect passwords.

**I forgot the admin password**

```bash
python manage.py shell -c "from apps.accounts.models import User; u=User.objects.get(email='admin@school.example'); u.set_password('NewPass@12345'); u.token_version+=1; u.must_change_password=False; u.save()"
```

**Database reset (development only)**

```bash
rm db.sqlite3
python manage.py migrate
python manage.py create_initial_roles
python manage.py seed_demo_data
```

---

## 7. Related documentation

- **[README.md](README.md)** — project overview and feature list
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — design, apps, RBAC and security model
- **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** — full endpoint reference
- `frontend/README.md` — frontend conventions
