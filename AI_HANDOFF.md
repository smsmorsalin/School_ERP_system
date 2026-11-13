# AI HANDOFF & PROJECT TRACKER

> **Read this file first.** It is the single source of truth for resuming work on
> this project. It records what is finished, what is verified, what remains, how
> to run everything, and the rules an AI agent must follow.
>
> Last updated: **2026-11-09**
> Repository: <https://github.com/smsmorsalin/School_ERP_system>
> Local working copy used for this build: `/home/smsmorsalin/Documents/Default Project/School_ERP_system`

---

## 0. Quick summary (TL;DR)

The project is a **full-stack School ERP / school management system**:

- **Backend:** Django 6 + Django REST Framework, JWT auth, role-based access control (RBAC), SQLite in development / PostgreSQL for production.
- **Frontend:** React 18 + Vite 5 single-page app (plain CSS, `lucide-react` icons, custom SVG charts), built into `frontend/dist` and served by Django.
- **Status:** Feature-complete for the original scope plus **secure online fee payments** (bKash, Nagad, Rocket, other mobile banking, card, bank). **103 automated tests pass.** All five roles have been smoke-tested in a real browser, and the payment backend is fully covered by tests. Security hardening is implemented and verified.
- **What remains:** optional polish, live provider adapters (needs merchant credentials), and deployment on real infrastructure. See §5.

**If you are an AI resuming this project:** run §2 (setup), run §8 (tests),
then pick the highest-priority unchecked item in §5. Do **not** rebuild finished
features. Verify before changing.

---

## 1. Project layout

```
School_ERP_system/
├── AI_HANDOFF.md              ← this file
├── README.md                  ← user-facing overview
├── ARCHITECTURE.md            ← design notes
├── SETUP_GUIDE.md             ← setup instructions
├── API_DOCUMENTATION.md       ← endpoint reference
├── BACKEND_ANALYSIS.md        ← original analysis
├── IMPLEMENTATION_COMPLETE.md ← original completion notes
├── QUICK_REFERENCE.md         ← cheat sheet
├── .gitignore
├── docs/README.md
├── backend/
│   ├── manage.py
│   ├── pytest.ini
│   ├── pyproject.toml
│   ├── requirements.txt
│   ├── .env                   ← local only (gitignored)
│   ├── .env.example           ← committed template
│   ├── config/
│   │   ├── settings/
│   │   │   ├── base.py        ← main settings + security
│   │   │   ├── development.py
│   │   │   └── production.py  ← hard-fail security checks
│   │   ├── urls.py            ← API + admin + SPA fallback
│   │   ├── asgi.py
│   │   └── wsgi.py
│   ├── apps/
│   │   ├── core/              ← BaseModel, permissions, pagination, filters,
│   │   │                        middleware, exceptions, utils, SPA view
│   │   ├── accounts/          ← users, roles, permissions, auth, login history
│   │   ├── academics/         ← years, classes, sections, subjects, profiles,
│   │   │                        guardians, timetable
│   │   ├── attendance/        ← daily attendance, bulk marking, summaries
│   │   ├── exams/             ← exams, papers, results, report cards, analytics
│   │   ├── finance/           ← fee categories/structures, invoices, payments
│   │   ├── communication/     ← announcements + read tracking
│   │   └── dashboard/         ← role-aware overview, global search, health
│   ├── tests/                 ← 103 pytest tests (conftest + 8 modules)
│   ├── staticfiles/
│   └── media/
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── dist/                  ← committed production build (served by Django)
    └── src/
        ├── App.jsx            ← routes + guards
        ├── main.jsx           ← providers
        ├── components/        ← Layout, ui primitives, charts
        ├── context/           ← AuthContext, ToastContext
        ├── lib/               ← api client, constants, format, hooks, theme
        ├── pages/             ← 21 pages (see §6)
        └── styles.css
```

---

## 2. How to run (development)

### Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env            # then set a real SECRET_KEY
.venv/bin/python manage.py migrate
.venv/bin/python manage.py create_initial_roles
.venv/bin/python manage.py seed_demo_data      # optional demo data
.venv/bin/python manage.py runserver 0.0.0.0:8000
```

API base URL: `http://127.0.0.1:8000/api/v1/`
Health check: `http://127.0.0.1:8000/api/v1/health/`
Swagger (development only): `http://127.0.0.1:8000/api/docs/`
Django admin: `http://127.0.0.1:8000/admin/`

> If the server is already running and you need a clean restart:
> `fuser -k 8000/tcp; cd backend && nohup .venv/bin/python manage.py runserver 0.0.0.0:8000 --noreload > /tmp/opencode/server.log 2>&1 &`

### Frontend (only when changing UI)

```bash
cd frontend
npm install
npm run dev          # Vite dev server on http://localhost:5173
npm run build        # writes frontend/dist (committed; Django serves it)
```

During development Django also serves the built SPA at `http://127.0.0.1:8000/`
with a client-side-routing fallback (`apps/core/spa.py`). Re-run `npm run build`
after any frontend change if you want Django to serve the update.

### Environment variables

Committed template: `backend/.env.example`. Key values:

| Variable | Purpose | Dev default |
|---|---|---|
| `DEBUG` | Debug mode | `True` |
| `SECRET_KEY` | Django secret (≥50 chars in prod) | generated |
| `ALLOWED_HOSTS` | Comma-separated hosts | `127.0.0.1,localhost` |
| `CSRF_TRUSTED_ORIGINS` | Trusted CSRF origins | local Vite URLs |
| `FRONTEND_URL` | Allowed browser origin | `http://localhost:5173` |
| `CORS_ALLOWED_ORIGINS` | CORS origins | local Vite URLs |
| `DB_ENGINE` / `DB_NAME` / `DB_*` | Database | SQLite |
| `JWT_ACCESS_MINUTES` | Access-token lifetime | `15` |
| `JWT_REFRESH_DAYS` | Refresh-token lifetime | `1` |
| `AUTH_COOKIE_SECURE` | Secure refresh cookie | `False` dev / must be `True` prod |
| `ALLOW_PUBLIC_REGISTRATION` | Self sign-up | `False` |
| `USE_X_FORWARDED_FOR` | Trust proxy headers | `False` |
| `TIME_ZONE` | School timezone | `Asia/Dhaka` |

---

## 3. Demo credentials

Seeded by `python manage.py seed_demo_data`:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@school.example` | `Admin@12345` |
| Teacher | `teacher@school.example` | `Teacher@12345` |
| Accountant | `accountant@school.example` | `Account@12345` |
| Student | `student@school.example` | `Student@12345` |
| Parent | `parent@school.example` | `Parent@12345` |

The login page has one-click demo-account buttons that fill these in.
The seed also creates 24 students, 5 roles, classes/sections/subjects,
timetable, attendance, exams/results, invoices/payments and announcements.

---

## 4. What is DONE and VERIFIED

### 4.1 Backend

- [x] Custom email-only user model (no username), UUID public identifiers.
- [x] Roles: **Admin, Teacher, Accountant, Student, Parent**; `role_names`,
      `primary_role`, `is_admin` helpers; permission catalogue + role↔permission.
- [x] JWT auth: access token 15 min, refresh token 1 day, rotation + blacklist.
- [x] Access token kept in memory in the SPA; refresh token only in an
      **HttpOnly** cookie (`school_erp_refresh`, path `/api/v1/accounts/auth/`).
- [x] Login lockout (5 failed attempts → 15-minute lock), generic error messages,
      login history, throttling.
- [x] Forced temporary-password change, enforced **server-side** by
      `MustChangePasswordJWTAuthentication` (not only by the UI).
- [x] Immediate access-token invalidation via `token_version` claim; password
      changes / resets / admin resets / deactivation revoke all refresh tokens.
- [x] Admin user CRUD, temporary passwords, reset password, unlock, activate /
      deactivate, login history.
- [x] Academics: academic years, classes, sections, subjects, class-subjects,
      teacher/student/guardian profiles, guardian links, timetable.
- [x] Attendance: daily register, bulk marking, sheet, summary, today view;
      teacher write access scoped to their own sections.
- [x] Exams: exams, exam subjects, marks entry (bulk), publishing, report cards
      with rank, analytics, grade utilities.
- [x] Finance: fee categories, fee structures, invoices, atomic payment
      recording, invoice generation, summaries, receipts.
- [x] **Online fee payments** for students/parents: provider-agnostic gateway
      catalogue (bKash, Nagad, Rocket, other mobile banking, card, bank),
      `PaymentIntent` checkout lifecycle, idempotent creation, row-locked
      settlement into the existing `Payment` ledger, expiry/cancel, sandbox
      confirmation, and HMAC-SHA256-signed timestamp-bounded webhooks with event
      deduplication. Only masked payer references and provider references are
      stored; no card numbers/PINs/OTPs are ever persisted.
- [x] Communication: announcements with audience scoping, read/unread tracking,
      mark-all-read.
- [x] Dashboard: role-aware overview, global search, health endpoint.
- [x] Role-scoped querysets on every list/detail endpoint (IDOR protection).
- [x] UUID relations exposed via `SlugRelatedField(slug_field="uuid")`.
- [x] Soft deletes, protected FKs, consistent pagination shape
      `{count,next,previous,page,page_size,total_pages,results}`.
- [x] Django admin configured for all major models.
- [x] Production settings hard-fail on: weak/short `SECRET_KEY`, missing or
      wildcard `ALLOWED_HOSTS`, non-HTTPS `FRONTEND_URL`/CORS/CSRF origins,
      insecure refresh cookie, `PAYMENT_SANDBOX=True`, or live payments enabled
      without a strong webhook secret and HTTPS checkout base. Schema/docs are
      admin-only in production.
- [x] 103-test pytest suite — **all passing** (`cd backend && .venv/bin/python -m pytest -q`).

### 4.2 Frontend

- [x] All 21 pages built (see §6), responsive layout with collapsible sidebar.
- [x] Auth context, automatic token refresh, logout, route guards by role.
- [x] Forced-password-change redirect (`/change-password`).
- [x] Role-aware navigation (each role sees only permitted modules).
- [x] Toasts, modals, tables, empty/loading/error states, custom SVG charts.
- [x] Online payments UI: “Pay online” on student/parent invoices, gateway
      selection grouped by mobile banking / card / bank, amount entry capped at
      the balance, and a `/checkout/:uuid` page with sandbox pay/decline/cancel,
      live polling, success/failure states and BDT (`৳`) formatting.
- [x] `npm run build` succeeds with the payment UI (Vite, 1606 modules).
- [x] Browser-tested flows: admin (dashboard/users/roles/profile), teacher
      (attendance/exams/results + role guard), accountant (fees/invoices/
      payments), student (dashboard/results/invoices/attendance + role guard),
      parent (dashboard/results/invoices/attendance + role guard), forced
      password change end-to-end. No unexpected console errors.

### 4.3 Data / repo state

- Demo database: **24 students, 36 users, 5 roles** (test/QA accounts removed).
- `.gitignore` covers Python, venv, `.env`, DB, media, `node_modules`,
  `dist` (with an exception that keeps `frontend/dist` committed), logs, IDE/OS files.
- Git repo initialized; no commits were made during this build.

---

## 5. REMAINING WORK (prioritised backlog)

Copy this checklist into your working notes and tick items off. Verify each item
before and after changing it.

### P0 — must verify on resume (do first, ~10 minutes)

- [x] Run the backend test suite (§8) and confirm **103 passed**.
- [x] Run `npm install && npm run build` in `frontend/` — the build succeeds
      (1606 modules) and `frontend/dist` now contains the payment UI.
- [x] End-to-end verified over real HTTP against the dev server: student login →
      gateway catalogue (all six methods) → intent create → idempotent replay
      (`200`, same uuid) → key reuse with different gateway (`409`) → poll →
      sandbox confirm (receipt created, payer masked `*******5678`) → duplicate
      confirm (still one payment) → invoice `paid`, balance `0.00` → unsigned
      webhook rejected (`503`) → SPA `/checkout/<uuid>` returns the app shell.
- [ ] Start the server, open `/login`, sign in as admin, confirm the dashboard loads.
- [ ] Confirm `manage.py check` reports no issues.
- [ ] Run `makemigrations --check --dry-run` and confirm **no changes detected**.
- [ ] Confirm the payment env vars are present in `.env.compose.example`,
      `docker-compose.yml`, `deploy/k8s/configmap.yaml` and
      `deploy/k8s/secret.example.yaml`.

### P1 — documentation review (mostly written, needs a pass)

- [ ] Re-read `README.md`, `ARCHITECTURE.md`, `SETUP_GUIDE.md`,
      `API_DOCUMENTATION.md` against the actual code and fix any stale details.
- [ ] Add this `AI_HANDOFF.md` link to `README.md`.
- [ ] Document the production deployment checklist (gunicorn + nginx +
      PostgreSQL + HTTPS + media serving + backups).
- [ ] Document the security model (JWT lifecycle, RBAC, lockout, token versioning)
      in `ARCHITECTURE.md`.

### P2 — polish / small UX tasks

- [ ] Per-page `document.title` on SPA navigation. `lib/usePageTitle.js` exists
      but is only used by ~2 pages; apply it to every page so titles update
      (currently the tab title stays "Dashboard · School ERP").
- [ ] Accessibility pass: focus outlines, modal focus traps, `aria-label`s on
      icon-only buttons, table caption/scope, colour contrast.
- [ ] Empty-state and error-state copy review across all pages.
- [ ] Add a "back to top" / sticky table header for long tables if useful.
- [ ] Add loading skeletons where only spinners exist.
- [ ] Verify the layout at tablet and mobile widths (no viewport-resize tool was
      available in this environment; check CSS breakpoints manually).

### P3 — feature ideas (optional, user said "you can add extra")

- [ ] CSV export for users/students/invoices/payments (server-side streaming).
- [ ] CSV import for students / marks.
- [ ] Printable/PDF report cards and fee receipts.
- [ ] Attendance "mark all present" bulk action UI (backend already supports bulk).
- [ ] Fee reminder emails / overdue notifications (needs SMTP config).
- [ ] Announcement attachments.
- [ ] Audit log for admin actions (who changed what, when).
- [ ] Optional 2FA / TOTP for Admin accounts.
- [ ] Dashboard date-range filters and downloadable reports.
- [ ] Parent ↔ multiple children switcher improvements.
- [ ] Internationalisation (currently English only).

### P4 — production & DevOps

- [x] Add `Dockerfile` + `docker-compose.yml` (Django + PostgreSQL + nginx).
- [ ] Add CI (GitHub Actions) running `pytest` + `npm run build` + `ruff`.
- [ ] Switch production to PostgreSQL and confirm migrations.
- [ ] Configure real email backend (SMTP) for password-reset mail.
- [ ] Serve `MEDIA_ROOT` via nginx or object storage (Django only serves media in DEBUG).
- [ ] Set up HTTPS/HSTS, secure cookies, `ALLOWED_HOSTS`, real `SECRET_KEY`.
- [ ] Add database + media backups and a restore procedure.
- [ ] Structured logging / error monitoring (e.g. Sentry) and log rotation.
- [ ] Load-test login/refresh and list endpoints before go-live.
- [ ] **Live online payments:** complete merchant onboarding, implement the
      provider-specific request/response adapters, set `PAYMENT_WEBHOOK_SECRET`
      and `PAYMENT_LIVE_CHECKOUT_BASE`, register the webhook URL, and run a
      low-value live transaction plus a replay check.

### P5 — QA

- [ ] Extend the pytest suite to ≥90% coverage of serializers/views.
- [ ] Add frontend tests (Vitest + React Testing Library) for auth guards,
      forms and API error handling.
- [ ] Add end-to-end tests (Playwright) for the five role flows.
- [ ] Manual test matrix: every page × every role × create/read/update/delete.
- [ ] Security regression tests for every new endpoint (IDOR + permission).
- [ ] Re-run `pip-audit` / `npm audit` and update dependencies.

---

## 6. Frontend pages & routes

| Route | Page | Access |
|---|---|---|
| `/login` | Login | Public |
| `/forgot-password` | ForgotPassword | Public |
| `/reset-password` | ResetPassword | Public |
| `/change-password` | ChangePassword | Any signed-in user (forced when temp password) |
| `/` | Dashboard | Any signed-in user (role-aware content) |
| `/students` | Students | Admin, Teacher (scoped), Parent (children), Student (self) |
| `/teachers` | Teachers | Admin |
| `/users` | Users | Admin |
| `/roles` | Roles | Admin |
| `/classes` | Classes | Admin, Teacher, Student, Parent (read) |
| `/subjects` | Subjects | Admin, Teacher, Student, Parent (read) |
| `/timetable` | Timetable | All signed-in roles (scoped) |
| `/attendance` | Attendance | Admin, Teacher (write), Student/Parent (read) |
| `/exams` | Exams | Admin, Teacher |
| `/results` | Results | All signed-in roles (scoped) |
| `/fees` | Fee setup | Admin, Accountant |
| `/invoices` | Invoices | Admin, Accountant, Student/Parent (own) |
| `/payments` | Payments | Admin, Accountant |
| `/checkout/:uuid` | Secure checkout | Admin, Accountant, Student, Parent (intent scoped) |
| `/announcements` | Announcements | All (staff can write) |
| `/profile` | Profile | Any signed-in user |
| `*` | NotFound | Public |

Route guards live in `frontend/src/App.jsx`; the sidebar is built in
`frontend/src/components/Layout.jsx` from the role list in
`frontend/src/lib/constants.js`.

---

## 7. Security model (do not weaken)

1. **Tokens:** access token (15 min) is kept in JS memory; refresh token (1 day)
   is an HttpOnly, SameSite=Lax cookie scoped to the auth path. Refresh rotates
   and blacklists the old token.
2. **Origin checks:** cookie-based POSTs (refresh/logout) reject untrusted
   `Origin` headers.
3. **Token versioning:** `User.token_version` is embedded in tokens and bumped on
   every credential change; stale access tokens are rejected immediately.
4. **Forced password change:** temporary-password users can only call
   `me`, `change-password`, `login-history`, `logout`, `refresh`; everything
   else returns 403. Enforced in `apps/accounts/authentication.py`.
5. **RBAC + scoping:** every queryset is filtered by role. Detail endpoints use
   `lookup_field="uuid"`, so guessing IDs does not work.
6. **Lockout & throttling:** 5 failed logins lock the account for 15 minutes;
   login/reset/sensitive endpoints are throttled.
7. **Passwords:** ≥10 chars, not common/numeric, not similar to user data, plus
   a custom complexity validator (upper/lower/digit/symbol).
8. **Uploads:** only JPG/PNG/WEBP, ≤2 MB, Pillow-verified, random filenames.
9. **Headers:** CSP, `X-Frame-Options: DENY`, `nosniff`, referrer policy,
   secure cookies in production, HSTS in production.
10. **Production guards:** startup fails if secrets/hosts/cookies/origins are
    unsafe; API schema/docs are admin-only.
11. **Soft deletes + `PROTECT`:** financial and academic records are not
    hard-deleted.
12. **No public registration** unless an operator explicitly enables it.
13. **Online payments:** amounts are server-calculated under invoice row locks;
    intent creation is idempotent per `(user, Idempotency-Key)`; settlement is
    idempotent; webhooks are public but require an HMAC-SHA256 signature over
    the raw body and a fresh timestamp, and are deduplicated by
    `(gateway, event_id)`; sandbox confirmation is impossible when
    `PAYMENT_SANDBOX=False`; only masked payer references are stored; production
    refuses `PAYMENT_SANDBOX=True` or live payments without a strong secret and
    HTTPS checkout base.

When adding an endpoint: add a permission class, scope the queryset, and add a
test for both an allowed and a forbidden role.

---

## 8. Tests

```bash
cd backend
.venv/bin/python -m pytest -q          # 103 tests, expected all green
.venv/bin/python -m pytest -q tests/test_auth.py   # one module
.venv/bin/python manage.py check
.venv/bin/python manage.py makemigrations --check --dry-run
```

Test modules:

| File | Covers |
|---|---|
| `tests/conftest.py` | Fixtures: users, roles, academic data, students, guardians, finance, API clients |
| `tests/test_auth.py` | Login, cookies, lockout, forced change, token revocation/rotation, reset flow, profile immutability |
| `tests/test_permissions.py` | RBAC, IDOR scoping, role management, superuser-only admin grants |
| `tests/test_attendance.py` | Bulk marking, section scoping, future dates, duplicates, summaries |
| `tests/test_exams.py` | Marks entry, scoping, publishing, report cards, analytics |
| `tests/test_finance.py` | Payments, overpayment, cancellation, deletion recalculation, invoice generation |
| `tests/test_online_payments.py` | Gateway catalogue, intent ownership/amount caps, idempotency, sandbox settlement, duplicate settlement, expiry, cancellation, decline, balance-change race, signed webhooks (bad signature, stale timestamp, amount mismatch, unknown intent, replay) |
| `tests/test_communication.py` | Audience filtering, expiry, read state, author-only edits |
| `tests/test_uploads.py` | Valid image, disguised file, bad extension, oversize |

Notes:
- Tests use a disposable SQLite DB and MD5 password hashing (speed only).
- Throttle rates are raised in tests to avoid false 429s; `SimpleRateThrottle`
  is re-pointed at the relaxed rates and the cache is cleared per test so one
  test cannot throttle the next. The real rates stay in settings.
- Online-payment tests authenticate with `RefreshToken.for_user` instead of the
  login endpoint to keep them off the login throttle.
- Reset-token tests call `refresh_from_db()` because `last_login` changes on sign-in.

---

## 9. API surface (base `/api/v1`)

### Auth (`apps/accounts/urls.py`)
```
POST accounts/auth/login/                 → { access, expires_in, user } + refresh cookie
POST accounts/auth/refresh/               → new access + rotated cookie
POST accounts/auth/logout/                → blacklist refresh, clear cookie
POST accounts/auth/register/              → 403 unless ALLOW_PUBLIC_REGISTRATION
GET/PATCH accounts/auth/me/               → profile (email/roles immutable here)
POST accounts/auth/change-password/
POST accounts/auth/password-reset/        → always generic 200 (no enumeration)
POST accounts/auth/password-reset/confirm/
GET  accounts/auth/me/login-history/
```

### Users & roles
```
CRUD accounts/users/                       (Admin only)
POST accounts/users/{uuid}/reset-password/
POST accounts/users/{uuid}/set-password/
POST accounts/users/{uuid}/unlock/
POST accounts/users/{uuid}/toggle-active/
GET  accounts/users/{uuid}/login-history/
CRUD accounts/roles/                       (Admin only; soft delete)
CRUD accounts/permissions/                 (Admin only)
GET  accounts/login-history/
```

### Academics
```
CRUD academics/academic-years|classes|sections|subjects|class-subjects
CRUD academics/teachers|students|guardian-links|timetable
```

### Attendance
```
CRUD attendance/
GET  attendance/sheet/?section=&date=
POST attendance/bulk/
GET  attendance/summary/?section=
GET  attendance/today/
GET  my-attendance/
```

### Exams
```
CRUD exams/            POST exams/{uuid}/publish/    GET exams/analytics/
CRUD exam-subjects/    GET  exam-subjects/{uuid}/sheet/
                       POST exam-subjects/{uuid}/bulk-results/
CRUD exam-results/     GET  exam-results/report-card/?student=&exam=
```

### Finance
```
CRUD finance/fee-categories|fee-structures|invoices|payments
POST finance/invoices/generate/
POST finance/invoices/{uuid}/payments/
GET  finance/invoices/{uuid}/receipt/
GET  finance/payments/summary/
GET  finance/payment-gateways/
CRUD finance/payment-intents/            (list/retrieve/create; Idempotency-Key on create)
POST finance/payment-intents/{uuid}/sandbox-confirm/
POST finance/payment-intents/{uuid}/cancel/
POST finance/payment-webhook/{gateway}/  (public, HMAC-signed)
```

### Communication
```
CRUD announcements/
POST announcements/{uuid}/read/
POST announcements/mark-all-read/
GET  announcements/unread-count/
```

### Dashboard
```
GET dashboard/overview/
GET dashboard/search/?q=
GET health/
```

Pagination shape everywhere:
`{ count, next, previous, page, page_size, total_pages, results }`.

Permission codes are **bare actions** such as `view_student` or
`mark_attendance` (not `category.action`).

---

## 10. Known issues / gotchas

- **SPA page titles:** `document.title` does not update on client-side
  navigation for most pages (minor; see P2).
- **Browser tooling:** the accessibility snapshot often omits form inputs; use
  DOM evaluation or the login page's demo-account buttons when testing.
- **Login throttle:** rapidly repeated logins can return HTTP 429 by design.
- **Refresh on first load:** an expected `401` from the initial refresh attempt
  may appear in the console before the user signs in.
- **Media in production:** Django serves `/media/` only in DEBUG; configure nginx
  or object storage.
- **SQLite:** fine for development; not recommended for production (settings warn).
- **Seed command:** `seed_demo_data` is idempotent-ish but designed for a clean
  demo DB; don't run it against real data.
- **Role deletion** is a soft delete (`is_active=False`); role lists include
  inactive roles.

---

## 11. Conventions & rules for the next agent

1. **Understand before editing.** Read the relevant model, serializer, view,
   URL, and test before changing behaviour.
2. **Never weaken security.** Do not remove permission classes, queryset
   scoping, token checks, or production guards. Add tests for new rules.
3. **Keep the style.** Match existing naming, docstrings, and plain-CSS design.
   Backend is organised into small modules per concern.
4. **UUIDs in the API.** Expose `uuid`, never database integer IDs.
5. **Pagination shape** must stay consistent across endpoints.
6. **Migrations:** add one per logical change; run `makemigrations --check`.
7. **Run the suite** (`pytest -q`) after every backend change.
8. **Rebuild the frontend** (`npm run build`) after UI changes so Django serves it.
9. **Don't commit secrets.** `.env`, DB, media, and logs are gitignored.
10. **Update this file.** When you finish a task, tick it in §5 and add a line to
    the session log in §13. That is how the next agent resumes.

---

## 12. Useful commands

```bash
# Backend
cd backend
.venv/bin/python manage.py runserver 0.0.0.0:8000 --noreload
.venv/bin/python manage.py migrate
.venv/bin/python manage.py create_initial_roles
.venv/bin/python manage.py seed_demo_data
.venv/bin/python manage.py createsuperuser
.venv/bin/python manage.py check
.venv/bin/python manage.py makemigrations --check --dry-run
.venv/bin/python -m pytest -q

# Frontend
cd frontend
npm run dev
npm run build

# Production smoke (must fail on unsafe config, load on safe config)
cd backend
DJANGO_SETTINGS_MODULE=config.settings.production .venv/bin/python -c \
  "import django; django.setup(); print('loaded')"
```

---

## 13. Session log (append newest at the top)

### 2026-11-12 — Secure online fee payments
- Added a provider-agnostic online payment flow for students and parents:
  bKash, Nagad, Rocket, other mobile banking, card and bank transfer.
- New models `PaymentIntent` and `PaymentWebhookEvent` (migration
  `finance/0002_online_payments.py`); the existing `Payment` ledger stays
  authoritative and successful intents settle into it atomically.
- New API: gateway catalogue, idempotent intent create/list/retrieve,
  sandbox-confirm, cancel and signed webhook callback.
- Security: server-calculated amounts, invoice row locking, per-user
  idempotency, HMAC-SHA256 webhook signatures with timestamp tolerance and
  event deduplication, masked payer references only, sandbox gated by
  `PAYMENT_SANDBOX`, production hard-fail rules.
- Frontend: “Pay online” on student/parent invoices, gateway picker,
  `/checkout/:uuid` sandbox/live page with polling, and BDT (`৳`) formatting.
- Added `tests/test_online_payments.py` (25 tests). Full suite: **103 passed**;
  `manage.py check` clean; `makemigrations --check` reports no changes.
- Fixed cross-test throttle contamination in `tests/conftest.py`.
- Added payment env vars to `.env.compose.example`, `docker-compose.yml`,
  `deploy/k8s/configmap.yaml`, `deploy/k8s/secret.example.yaml`.
- Updated README, API, deployment, setup, architecture and handoff docs, plus
  `.env.example`, `.env.compose.example`, `docker-compose.yml` and the K8s
  ConfigMap/Secret templates with the payment variables.
- Ran `npm install && npm run build` (Node 20): build succeeds, `frontend/dist`
  updated. Verified the full payment lifecycle over live HTTP (login,
  catalogue, intent, replay, conflict, sandbox settle, duplicate-settle
  idempotency, invoice paid, rejected unsigned webhook, SPA checkout route);
  the demo database was restored afterwards.
- **Still open:** in-browser click-through of the new screens (the HTTP-level
  flow is verified; visual polish may still need a manual pass), and live
  provider adapters (no merchant credentials available).

### 2026-11-09 — Verification & handoff
- Re-ran full pytest suite: **70 passed**; `manage.py check` clean.
- Verified parent flow in browser: dashboard, results, invoices, attendance,
  and the `/users` role guard ("You do not have access"). No console errors.
- Verified forced-password-change end-to-end: temp-password login redirects to
  `/change-password`; weak/similar password rejected by the server; strong
  password accepted; session invalidated; re-login reaches the dashboard.
- Verified `/login` → parent demo login and logout/sign-out.
- Removed the temporary test user; DB restored to 24 students / 36 users / 5 roles.
- Created this `AI_HANDOFF.md` tracker.

### 2026-11-08 — Security, tests & UI hardening
- Added `token_version` migration and immediate access-token invalidation.
- Added `MustChangePasswordJWTAuthentication` server-side gate.
- Added/verified production hard-fail checks (secret, hosts, HTTPS, cookie).
- Added 70-test pytest suite; fixed `StudentProfile.save` timezone bug, exam
  subject swagger fallback, announcement write permissions, and test fixtures.
- Built and browser-verified all role UIs.

---

## 14. Definition of "done" (final acceptance checklist)

- [x] `pytest -q` all green (currently 103).
- [x] `manage.py check` clean; `makemigrations --check` reports no changes.
- [x] `npm run build` succeeds; `frontend/dist` updated.
- [x] Sandbox checkout verified end-to-end over HTTP from `/invoices`
      (intent → confirm → invoice paid, duplicate-safe).
- [ ] All five demo roles can sign in and see only their permitted modules.
- [ ] Forced password change works for admin-created users.
- [ ] Password reset email flow works with a real mail backend.
- [ ] Production settings refuse unsafe configuration.
- [ ] README/ARCHITECTURE/SETUP_GUIDE/API docs match the code.
- [ ] No secrets, DB files, media, or logs committed.
- [ ] Deployment guide validated on a staging server.
