# School ERP System

A complete, security-hardened School Enterprise Resource Planning system with a
Django REST backend and a modern React single-page console.

The system connects admissions, academics, attendance, examinations, finance and
communication so your team spends less time on administration and more time on
students.

> **Resuming development (AI agents / contributors):** read
> [`AI_HANDOFF.md`](AI_HANDOFF.md) first. It tracks what is finished, what is
> verified, what remains, how to run everything, and the project's security rules.

---

## ✨ Features

- **Role-based access** — five built-in roles (`Admin`, `Teacher`, `Accountant`,
  `Student`, `Parent`) with row-level data scoping so every user only ever sees
  the records they are allowed to see.
- **Student & academic management** — classes, sections, subjects, class-subject
  assignments, teacher/student/guardian profiles and a weekly timetable.
- **Attendance** — daily register, bulk marking, per-student history and
  class/section summaries.
- **Examinations** — exam and paper setup, mark entry, publishing, grade bands,
  report cards with rank, and analytics.
- **Finance** — fee categories and structures, bulk invoice generation, partial
  payments, receipts, and collection summaries.
- **Communication** — role/class-targeted announcements with read receipts.
- **Dashboard** — role-aware overview with charts and a global search.
- **Security** — see [Security](#-security) below.

## 🧱 Tech Stack

| Layer     | Technology                                                                 |
|-----------|----------------------------------------------------------------------------|
| Backend   | Django 6.0.6, Django REST Framework 3.16.1, SimpleJWT 5.5.1                 |
| Backend   | django-filter 25.1, drf-spectacular 0.28.0, django-cors-headers 4.7.0       |
| Backend   | Pillow 11.3.0 (image validation), whitenoise 6.9.0, gunicorn 23.0.0         |
| Database  | SQLite (development), PostgreSQL (production) via `psycopg` 3.2.9           |
| Frontend  | React 18.3.1, react-router-dom 6.26.2, lucide-react 0.451.0                 |
| Frontend  | Vite 5.4.8, plain CSS (custom design system)                                |
| Testing   | pytest 8.4.2, pytest-django 4.11.1 (70 tests)                               |

## 📁 Project Structure

```
School_ERP_system/
├── backend/
│   ├── config/                 # Django settings (base / development / production)
│   ├── apps/
│   │   ├── accounts/           # Custom user, RBAC, JWT auth, login history
│   │   ├── academics/          # Classes, sections, subjects, profiles, timetable
│   │   ├── attendance/         # Daily attendance, bulk marking, summaries
│   │   ├── exams/              # Exams, papers, results, report cards, analytics
│   │   ├── finance/            # Fee structures, invoices, payments, receipts
│   │   ├── communication/      # Targeted announcements and read receipts
│   │   ├── dashboard/          # Role-aware overview and global search
│   │   └── core/               # Base models, RBAC, pagination, middleware, SPA
│   ├── tests/                  # pytest suite (70 tests)
│   ├── manage.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/              # 22 route screens
│   │   ├── components/         # Layout, charts, UI primitives
│   │   ├── context/            # Auth + toast providers
│   │   ├── lib/                # API client, formatting, theme, hooks
│   │   └── App.jsx             # Routes, guards
│   ├── package.json
│   └── vite.config.js
├── docs/                       # Supporting documentation
├── README.md                   # This file
├── ARCHITECTURE.md
├── SETUP_GUIDE.md
└── API_DOCUMENTATION.md
```

## 🚀 Quick Start (Development)

### 1. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env           # then edit .env (see SETUP_GUIDE.md)
python manage.py migrate
python manage.py create_initial_roles
python manage.py seed_demo_data

python manage.py runserver 0.0.0.0:8000
```

The API is served at `http://localhost:8000/api/v1/`, the SPA at
`http://localhost:8000/`, and OpenAPI docs at `http://localhost:8000/api/docs/`.

### 2. Frontend (optional — for hot-reload development)

```bash
cd frontend
npm install
npm run dev
```

Vite serves the SPA on `http://localhost:5173`. The production build lives in
`frontend/dist/` and is already served by Django, so the dev server is only
needed while working on the UI.

### Demo accounts

`seed_demo_data` creates a full demo school (3 grades, 6 sections, 24 students,
teachers, guardians, invoices and published exams). All demo passwords are
**not** temporary, so you can sign in immediately.

| Role        | Email                      | Password       |
|-------------|----------------------------|----------------|
| Admin       | `admin@school.example`     | `Admin@12345`  |
| Teacher     | `teacher@school.example`   | `Teacher@12345`|
| Accountant  | `accountant@school.example`| `Account@12345`|
| Student     | `student@school.example`   | `Student@12345`|
| Parent      | `parent@school.example`    | `Parent@12345` |

## 🐳 Docker & Kubernetes

The project ships a production-ready, multi-stage container image and a
Kubernetes (Kustomize) deployment that scales horizontally.

```bash
# Local full stack: PostgreSQL + Redis + Django + nginx
cp .env.compose.example .env      # set a real SECRET_KEY and DB password
docker compose up -d --build
open http://localhost:8080
```

```bash
# Kubernetes
cp deploy/k8s/secret.example.yaml deploy/k8s/secret.yaml
# edit secrets, configmap host names and the image tag, then:
kubectl apply -f deploy/k8s/secret.yaml
kubectl apply -k deploy/k8s
make k8s-migrate
```

The deployment includes liveness/readiness probes, a HorizontalPodAutoscaler
(2–10 backend pods), a PodDisruptionBudget, migration Job, shared Redis cache,
PostgreSQL StatefulSet, TLS Ingress, and a media server backed by an RWX volume.
See **[DEPLOYMENT.md](DEPLOYMENT.md)** for the full guide and
`deploy/k8s/README.md` for the short runbook.

## 🧪 Tests

```bash
cd backend
.venv/bin/python -m pytest        # 70 tests, all green
```

The suite covers authentication, account lockout, JWT rotation/blacklisting,
token-version revocation, the forced-password gate, RBAC and IDOR protection,
attendance bulk marking, exam publishing, finance atomicity and image-upload
validation.

## 🔐 Security

The system is hardened by design. Key guarantees:

- **JWT access tokens live in memory only** (never `localStorage`), limiting XSS
  impact. The **refresh token lives in an HttpOnly, SameSite cookie**
  (`school_erp_refresh`) scoped to the auth API, and is **rotated and
  blacklisted** on every use.
- **Token-version invalidation** — every password change/reset, admin reset or
  deactivation increments the user's `token_version`, so *all* previously issued
  access tokens are rejected immediately and all refresh tokens are blacklisted.
- **Forced password change** — admin-created accounts get a temporary password
  and `must_change_password`; the API refuses everything except password change,
  profile and logout until the password is updated (enforced server-side, not
  just in the UI).
- **Account lockout** — 5 failed attempts in 15 minutes locks the account; login
  errors are generic so accounts cannot be enumerated.
- **RBAC + row-level scoping** — every queryset is scoped to the user's role
  (students see only themselves, parents only linked children, teachers only
  their sections/classes), preventing IDOR.
- **Public self-registration is disabled** by default; admins create accounts.
- **Password policy** — minimum length, complexity (upper/lower/digit/symbol),
  common-password and similarity checks.
- **Upload hardening** — MIME sniffing with Pillow, extension allow-list, 2 MB
  limit, random storage paths.
- **Transport security** — production refuses to start without HTTPS-only
  `FRONTEND_URL`/CORS/CSRF origins, an explicit `ALLOWED_HOSTS`, a strong
  `SECRET_KEY`, a secure refresh cookie and `AUTH_COOKIE_SECURE=True`.
- **Django hardening** — CSP and security headers, throttling on auth/sensitive
  endpoints, soft deletes and protected foreign keys, admin-only schema in
  production.

See [ARCHITECTURE.md](ARCHITECTURE.md#-security-model) for the full model.

## 📚 Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) — Docker and Kubernetes deployment guide
- [AI_HANDOFF.md](AI_HANDOFF.md) — project status and handoff tracker

- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** — step-by-step setup, environment and deployment.
- **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** — complete endpoint reference.
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — system design, apps, permissions and security model.
- `frontend/README.md` — frontend structure and conventions.

## 📋 API Overview

All endpoints are under `/api/v1/` and use UUID lookup. Paginated responses use:

```json
{ "count": 24, "next": null, "previous": null, "page": 1,
  "page_size": 20, "total_pages": 2, "results": [ ... ] }
```

| Area          | Prefix                                  |
|---------------|-----------------------------------------|
| Auth          | `accounts/auth/`                        |
| Accounts/RBAC | `accounts/` (`users`, `roles`, `permissions`, `login-history`) |
| Academics     | `academics/` (years, classes, sections, subjects, students, teachers, timetable) |
| Attendance    | `attendance/` (+ `bulk`, `sheet`, `summary`, `today`) |
| Exams         | `exams/`, `exam-subjects/`, `exam-results/` |
| Finance       | `finance/` (fee-categories, fee-structures, invoices, payments) |
| Communication | `announcements/`                        |
| Dashboard     | `dashboard/overview`, `dashboard/search`, `health` |

## 🛠️ Management Commands

| Command                    | Purpose                                        |
|----------------------------|------------------------------------------------|
| `create_initial_roles`     | Seed the five system roles and permission catalogue |
| `seed_demo_data`           | Create the demo school, users and sample data  |

## 📈 Project Status

- **Version:** 1.0.0
- **Status:** ✅ Complete — backend + frontend + tests + docs
- **Roles:** Admin, Teacher, Accountant, Student, Parent
- **Tests:** 70 passing
- **License:** MIT
