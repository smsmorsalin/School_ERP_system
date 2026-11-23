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
- **Student & academic management** — searchable student directory and profile
  pages, classes, sections, subjects, class-subject assignments,
  teacher/student/guardian records and a weekly timetable.
- **Attendance** — daily register, bulk marking, per-student history,
  class/section summaries and a review workspace.
- **Examinations** — exam directory, per-exam workspace, paper scheduling,
  full-page mark entry, publishing, grade bands, report cards with rank, and
  analytics.
- **Finance** — fee categories and structures, bulk invoice generation, invoice
  statement pages, partial payments, receipts, collection summaries, and
  **secure online fee payments**
  (bKash, Nagad, Rocket, other mobile banking, cards and bank transfer) for
  students and parents.
- **Communication** — role/class-targeted announcements with read receipts.
- **Dashboard** — role-aware overview with charts and a global search.
- **Audit trail** — an immutable, append-only log of every create/update/delete
  on business data (payments, invoices, users, roles, marks, etc.), viewable by
  admins in the UI and at `GET /api/v1/audit/`.
- **Operations tooling** — overdue-fee reminder emails (`send_fee_reminders`) and
  CSV exports for invoices, payments and fee structures (`export_finance_csv`).
- **Security** — see [Security](#-security) below.

## 🧭 Information architecture

The console is organised as a grouped sidebar with **one job per page**. Every
workflow has its own URL, so links are shareable, the browser back button
behaves, and a screen never mixes unrelated controls. Long create/edit forms
open in a right-hand drawer over the list they belong to; multi-step work
(admissions) gets a full page with a sticky guidance aside.

| Sidebar group | Pages |
|---|---|
| **Overview** | Dashboard |
| **School** | Students · Admissions (`/students/new`) · student profile (`/students/:uuid`) · Teachers |
| **Academics** | Classes · Sections · Subjects · Curriculum · Timetable |
| **Attendance** | Take register · Records & trends · My attendance |
| **Examinations** | Exams · exam workspace (`/exams/:uuid`) · analytics (`/exams/:uuid/analytics`) · mark entry (`/exams/:uuid/papers/:paperUuid`) · Results |
| **Finance** | Invoices · invoice detail (`/finance/invoices/:uuid`) · Payments · Fee structures · Fee categories · secure checkout (`/finance/checkout/:uuid`) |
| **Communication** | Announcements |
| **Administration** | User accounts · user detail (`/admin/users/:uuid`) · Roles & access · Audit log |
| **Account** | My profile · Change password |

Sidebar items are filtered by role. Students and parents get read-only variants
(their own record, attendance history, invoices, results); teachers get academic
and attendance tools; accountants get finance; admins get everything.

List pages are built for scanning and filtering. Detail pages carry the full
record, related data and lifecycle actions. Legacy URLs (`/classes`, `/fees`,
`/attendance`, `/invoices/:uuid`, `/users/:uuid`, `/announcements`, …) redirect
to the new locations, so old bookmarks keep working.


## 🧱 Tech Stack

| Layer     | Technology                                                                 |
|-----------|----------------------------------------------------------------------------|
| Backend   | Django 6.0.6, Django REST Framework 3.16.1, SimpleJWT 5.5.1                 |
| Backend   | django-filter 25.1, drf-spectacular 0.28.0, django-cors-headers 4.7.0       |
| Backend   | Pillow 11.3.0 (image validation), whitenoise 6.9.0, gunicorn 23.0.0         |
| Database  | SQLite (development), PostgreSQL (production) via `psycopg` 3.2.9           |
| Frontend  | React 18.3.1, react-router-dom 6.26.2, lucide-react 0.451.0                 |
| Frontend  | Vite 5.4.8, plain CSS (custom design system)                                |
| Testing   | pytest 8.4.2, pytest-django 4.11.1 (112 tests)                              |

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
│   │   ├── finance/            # Fee structures, invoices, payments, receipts,
│   │   │                       #   online payment intents and signed webhooks
│   │   ├── communication/      # Targeted announcements and read receipts
│   │   ├── dashboard/          # Role-aware overview and global search
│   │   ├── audit/              # Append-only audit log (models, signals, API)
│   │   └── core/               # Base models, RBAC, pagination, middleware, SPA
│   ├── tests/                  # pytest suite (112 tests, 12 modules)
│   ├── manage.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/              # 35 page modules (list, detail, workspace, account, auth)
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

## 💳 Online Fee Payments

Students and parents can settle an invoice online from **Invoices → Pay online**.
The checkout offers bKash, Nagad, Rocket, other mobile banking, debit/credit
cards and bank transfer.

- **Students** pay their own invoices; **parents** pay any linked child's invoice.
- Amounts are always calculated and validated on the server; a partial payment
  is allowed and cannot exceed the outstanding balance.
- The UI uses the gateway catalogue from
  `GET /api/v1/finance/payment-gateways/`, so new methods can be enabled without
  a frontend release.
- **Sandbox mode** (`PAYMENT_SANDBOX=True`, default in development/compose)
  simulates the hosted gateway page so the complete flow is testable with no
  merchant credentials and no real money.
- **Live mode** redirects to the HTTPS hosted-checkout URL supplied by your
  payment partner (`PAYMENT_LIVE_CHECKOUT_BASE`) and settles only when the
  provider's signed webhook confirms the transaction.
- **No card numbers, PINs, OTPs or mobile-banking passwords are stored** — only
  the gateway transaction reference and a masked payer reference.

Online payments are **disabled by default in production** until merchant
credentials, a webhook secret and a live checkout URL are configured. See
[DEPLOYMENT.md](DEPLOYMENT.md#online-fee-payments) for the enablement checklist.

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
.venv/bin/python -m pytest        # 112 tests, all green
```

The suite covers authentication, account lockout, JWT rotation/blacklisting,
token-version revocation, the forced-password gate, RBAC and IDOR protection,
attendance bulk marking, exam publishing, finance atomicity, image-upload
validation, online-payment security (ownership scoping, amount caps,
idempotency, sandbox settlement, expiry/cancellation, and signed webhook
verification), audit-log immutability/scoping and fee-reminder delivery.

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

## 🎨 Accessibility & design audit

The frontend is audited with Lighthouse (desktop preset) in both light and dark
themes. After the console redesign, the main routes re-audit at **100
Accessibility / 100 Best Practices** with zero failures. SEO is intentionally
not scored: the ERP is a private console and `robots.txt` disallows crawling.

- **Design system:** a "timetable board" console — chalkboard-green sidebar,
  warm paper surfaces, green ink and a brass accent; ruled section headers,
  stamp-style badges, tabular numerals, a 4/7/10px radius scale and layered,
  offset shadows. Type uses the native UI sans stack, with a monospace face
  reserved for IDs, codes and money.
- **WCAG AA contrast:** fixed at the token level (`--muted` light `#637068`,
  dark `#8b9c91`) so body and secondary text clear 4.5:1 on paper, tinted
  surfaces and the dark theme.
- **Layout system:** grouped sidebar, one workflow per page, right-hand drawers
  for long forms, full-page multi-step admission, toolbar-first lists and
  consistent page headers.
- **Responsive:** the sidebar becomes an off-canvas panel below 960px, list
  grids collapse to one column, tables scroll inside their card and page
  actions wrap instead of overflowing.
- **Light/dark toggle:** a topbar Moon/Sun theme switcher (persisted to
  `localStorage` as `school-erp-theme`) with an inline theme bootstrap in
  `index.html` so `data-theme` is set before first paint — no flash of the
  wrong theme.
- **robots.txt:** served from `frontend/public/` via WhiteNoise (`Disallow: /`
  — the ERP is a private console, not a public site).

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
| Finance       | `finance/` (fee-categories, fee-structures, invoices, payments, payment-gateways, payment-intents, payment-webhook) |
| Communication | `announcements/`                        |
| Dashboard     | `dashboard/overview`, `dashboard/search`, `health` |
| Audit         | `audit/` (admin-only, read-only)        |

## 🛠️ Management Commands

| Command                    | Purpose                                        |
|----------------------------|------------------------------------------------|
| `create_initial_roles`     | Seed the five system roles and permission catalogue |
| `seed_demo_data`           | Create the demo school, users and sample data  |
| `send_fee_reminders`       | Email students/guardians about overdue invoices (`--dry-run`, `--days-overdue`, `--limit`) |
| `export_finance_csv`       | Export invoices, payments or fee structures to CSV (`--model`, `--output`) |

## 📈 Project Status

- **Version:** 1.0.0
- **Status:** ✅ Complete — backend + frontend + tests + docs
- **Roles:** Admin, Teacher, Accountant, Student, Parent
- **Tests:** 112 passing
- **Accessibility:** 100 Accessibility / 100 Best Practices (Lighthouse, main routes, light + dark); SEO intentionally disabled via `robots.txt`
- **Console:** grouped sidebar with one workflow per page, right-hand drawers for long forms, full-page admissions flow, legacy URL redirects
- **Theme:** light/dark toggle (Moon/Sun) persisted to localStorage
- **Online payments:** Sandbox-ready; live mode requires provider credentials
- **Audit:** Append-only trail with admin viewer and read-only API
- **License:** MIT

---

## 🗺️ Roadmap / Future Implementation

The system is feature-complete for its original scope. The following goals are
planned for future releases. Each goal lists the user role it serves and the
current limitation that motivates it. Full details are in
[`FUTURE_IMPLEMENTATION.md`](FUTURE_IMPLEMENTATION.md).

### 👤 Admin (System Administrator)

| Goal | Current limitation |
|------|-------------------|
| Bulk user import/export (CSV/Excel) | Only individual user create/edit exists |
| Academic year lifecycle (close / archive old years) | No year-close workflow |
| Grade band & passing criteria configuration | Grade bands are hardcoded/auto-calculated |
| School-wide settings (name, logo, timezone, currency) | No admin settings page |
| Multi-school / branch support | Single-school only |
| Teacher assignment approval workflow | Teachers assigned directly, no approval |
| System health & backup dashboard | No backup/restore UI or monitoring |
| Email/SMS notification templates | No template management |
| Admission workflow with approval | Direct student creation, no admission pipeline |
| Waitlist management for full sections | No waitlist |
| Holiday & academic calendar management | Timetable exists, no calendar/holiday tracker |

### 👨‍🏫 Teacher

| Goal | Current limitation |
|------|-------------------|
| Lesson planning & daily diary | No lesson plan module |
| Detailed grade book per student | Basic marks entry only, no grade book view |
| Parent messaging / communication | No teacher-parent chat or messaging |
| Attendance trend alerts per student | No at-risk student flags |
| Report card review before publish | Can publish but no preview/review gate |
| Class analytics dashboard | Only exam analytics exists, no class-level analytics |
| Leave / substitute request | No leave management |
| Assignment creation & collection | No assignment module |
| Student behavior / remarks tracking | Only attendance remarks exist |

### 💼 Accountant

| Goal | Current limitation |
|------|-------------------|
| Expense tracking (non-fee expenses) | Income-only, no expense module |
| Staff salary & payroll management | No salary module |
| Financial reports (P&L, balance sheet) | No accounting reports |
| Tax reports & compliance | No tax/GST reporting |
| Automated fee reminders (scheduled) | `send_fee_reminders` is CLI-only, needs SMTP + cron |
| Refund management | No refund workflow |
| Bulk payment upload | Payments recorded one-by-one |
| Fee structure templates | No reusable templates |
| Live online payments | Sandbox only; needs merchant credentials |

### 🎓 Student

| Goal | Current limitation |
|------|-------------------|
| View assignment submissions | No assignment module |
| Download report cards / certificates | No PDF generation |
| Request attendance certificate | No certificate request workflow |
| Update profile details (request) | Profile is read-only |
| View fee payment history | Invoice balance visible, no history export |
| Library / hostel fee integration | Finance limited to fee structures |
| Parent-teacher meeting booking | No meeting scheduler |
| Merit ranking / class rank visibility | Rank in report cards but not student dashboard |

### 👨‍👩‍👧 Parent

| Goal | Current limitation |
|------|-------------------|
| Multi-child unified dashboard | Children listed separately, no combined view |
| Attendance alerts (absent notifications) | No push/email alerts |
| Pay multiple children in one transaction | Pay per invoice only |
| Message child's teacher | No parent-teacher communication |
| Book parent-teacher meetings | No scheduler |
| View child's timetable | No timetable view for parents |
| Apply for leave on behalf of child | No leave application |
| Download child's certificates / report cards | No PDF generation |
| Compare siblings' performance | No comparison view |

### 🆕 New user roles to consider

As the school grows, additional roles may be needed:

| Role | Responsibility |
|------|---------------|
| **Librarian** | Library books, issue/return, fines |
| **Transport Manager** | Routes, vehicles, transport fees, tracking |
| **Hostel Warden** | Rooms, wardens, mess management |
| **Store / Inventory Manager** | Stock, assets, procurement |
| **Examination Controller** | Exam scheduling, paper moderation, result lockdown |
| **Nurse / Medical Staff** | Infirmary records, student health |
| **Counselor** | Student counseling records |
| **Event Coordinator** | School events, calendar |
| **Alumni Coordinator** | Alumni records and events |

### 🔧 Cross-cutting / system features

| Feature | Current limitation |
|---------|-------------------|
| Email notifications (SMTP) | Console backend only |
| SMS notifications | Not implemented |
| Push notifications (web/mobile) | Not implemented |
| Export to PDF / Excel | CSV export exists for finance only |
| Scheduled / automated reports | Not implemented |
| Multi-language (i18n) | English only |
| Mobile app / PWA | Responsive web only |
| File attachments (announcements, assignments) | Profile images only |
| Chat / messaging system | Not implemented |
| Library management | Not implemented |
| Transport management | Not implemented |
| Hostel management | Not implemented |
| Inventory / asset management | Not implemented |
| Event & holiday calendar | Not implemented |
| Alumni management | Not implemented |
| Two-factor authentication (2FA) | Not implemented |
| Single sign-on (SSO) / OAuth | Not implemented |
| Data backup & restore UI | Not implemented |
| Saved filter views per user | Not implemented |
| Global command palette (⌘K) | Not implemented |

### 🖥️ Console & workflow — queued next

These follow directly from the page-per-workflow redesign. Details, scope and
acceptance notes are in [`FUTURE_IMPLEMENTATION.md`](FUTURE_IMPLEMENTATION.md#p36--console--workflow-backlog-queued-next).

| Goal | Current limitation |
|------|-------------------|
| Student 360 workspace (overview, guardians, fees, results, documents) | Student profile is still one long page |
| Admissions pipeline with review and approval | Admission is a single create form |
| Academic-year rollover wizard (promote, copy, archive) | No promotion or year-close workflow |
| Timetable builder with teacher/room clash detection | Grid is edited manually |
| Attendance correction request/approval flow | Corrections are direct edits |
| Guardian directory with sibling linking | Guardians are managed from a student only |
| Student document vault | Only profile photos can be uploaded |
| Notification centre with grouped alerts | Bell shows counts but no inbox |
| Design system gallery and `DESIGN.md` | No contributor reference for tokens/components |
| Frontend test suite (Vitest + Playwright) | No frontend tests |

See [`FUTURE_IMPLEMENTATION.md`](FUTURE_IMPLEMENTATION.md) for the prioritised
backlog (P0 go-live items through P6 QA) and the pre-push checklist.
