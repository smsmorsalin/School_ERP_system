# School ERP — Architecture

This document describes the design of the rebuilt School ERP system: the Django
backend, the React frontend, the role model and the security model.

---

## 1. System overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (SPA / React)                       │
│  Access token kept in memory · Refresh token in HttpOnly cookie      │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS (JSON API, Bearer access token)
┌──────────────────────────────▼──────────────────────────────────────┐
│                     Django / Django REST Framework                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ │
│  │ accounts │ │academics │ │attendance│ │  exams   │ │  finance  │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └───────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────────┐  │
│  │communicat│ │dashboard │ │   core   │ │  config (settings)    │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────────┘  │
│                    ┌──────────┐                                    │
│                    │  audit   │  append-only event trail           │
│                    └──────────┘                                    │
└───────────────┬────────────────────────────────┬───────────────────┘
                │                                │
        ┌───────▼───────┐                ┌───────▼───────┐
        │ SQLite / PG   │                │ Media (S3/disk)│
        └───────────────┘                └───────────────┘
```

The backend exposes a versioned REST API under `/api/v1/` and serves the built
React SPA at `/` (SPA fallback). Static files are served by whitenoise.

---

## 2. Project layout

```
backend/
├── config/
│   ├── settings/
│   │   ├── base.py           # shared settings, security, DRF, JWT, throttling
│   │   ├── development.py    # DEBUG=True, permissive local defaults
│   │   └── production.py     # DEBUG=False + hard-fail checks for unsafe config
│   ├── urls.py               # API v1, admin, api/schema, api/docs, SPA fallback
│   ├── wsgi.py / asgi.py
│   └── middleware.py         # CSP + security headers
├── apps/
│   ├── core/                 # BaseModel, RBAC permissions, pagination, filters,
│   │                         # exceptions, middleware, SPA view, utils
│   ├── accounts/             # custom User, Role/Permission, JWT auth, login history
│   ├── academics/            # years, classes, sections, subjects, profiles,
│   │                         # guardian links, timetable
│   ├── attendance/           # attendance records, bulk marking, summaries
│   ├── exams/                # exams, papers, results, report cards, analytics
│   ├── finance/              # fee categories, structures, invoices, payments,
│   │                         #   online payment intents + signed webhooks
│   ├── communication/        # announcements + read receipts
│   ├── dashboard/            # role-aware overview + global search + health
│   └── audit/                # append-only AuditLog, signals, read-only API
├── tests/                    # pytest suite (conftest + 12 modules, 112 tests)
├── manage.py
└── requirements.txt
```

---

## 3. Apps and responsibilities

| App           | Responsibility                                                        |
|---------------|-----------------------------------------------------------------------|
| `accounts`    | Custom email user, RBAC (Role/Permission/UserRole/RolePermission), JWT auth endpoints, admin user CRUD, login history, management commands (`create_initial_roles`, `seed_demo_data`) |
| `academics`   | Academic years, classes, sections, subjects, class-subject assignments, teacher/student/guardian profiles, guardian links, timetable |
| `attendance`  | Per-student attendance, bulk marking, section sheet, summaries, "today" |
| `exams`       | Exams, exam subjects/papers, results, grade bands, publishing, report cards with rank, analytics |
| `finance`     | Fee categories, fee structures, invoices (bulk generate), payments (atomic), receipts, summaries, online payment intents (bKash/Nagad/Rocket/other mobile banking/card/bank) and signed gateway webhooks |
| `communication` | Announcements with audience (all/students/parents/teachers/class) and read receipts |
| `dashboard`   | Role-aware overview aggregates, global search, health check |
| `audit`       | Append-only `AuditLog`, signal-based capture of business-model writes, admin-only read-only API |
| `core`        | Shared `BaseModel`, RBAC permission classes, pagination, filters, error format, security middleware, SPA view |

---

## 4. Identity, roles and access control

### 4.1 Custom user

`accounts.User` extends `AbstractUser` and uses **email** as the unique login
identifier (no username). Key fields:

- `uuid` — public identifier used everywhere in the API (never expose the PK).
- `role_names` / `primary_role` — cached role helper properties.
- `is_admin` — true for superusers *or* users holding the `Admin` role.
- `failed_login_attempts`, `locked_until`, `is_locked` — lockout support.
- `must_change_password` — set for admin-created accounts with a temp password.
- `last_password_change`, `token_version` — credential-change bookkeeping.
- `profile_image` — validated image upload (2 MB, allow-listed types).

### 4.2 Roles

Five system roles are seeded by `create_initial_roles`:

| Role        | Typical access                                                                |
|-------------|-------------------------------------------------------------------------------|
| `Admin`     | Full access to everything, including user/role management.                     |
| `Teacher`   | Reads on academics; attendance marking and result entry for own sections; targeted announcements. |
| `Accountant`| Finance management (fee setup, invoices, payments); no access to people/users. |
| `Student`   | Own profile, own attendance, own results (published), own invoices; read-only. |
| `Parent`    | Linked children only (attendance, results, invoices); read-only.               |

Permissions are stored as bare action codes (e.g. `view_student`,
`mark_attendance`) and assigned to roles. Custom roles can be created in the
Roles screen.

### 4.3 Row-level scoping (IDOR protection)

Every list/detail queryset is scoped to the current user, so a user can never
read or write a record they do not own:

- **Students** — students see only their own profile; parents see only linked
  children; teachers see only students in their assigned sections; admins see all.
- **Teachers** — teachers see only their own teacher profile in the directory.
- **Invoices/Payments** — students/parents see only their own; teachers get
  `403`; accountants/admins see all.
- **Announcements** — filtered by audience and class; teachers can only edit
  their own.
- **Exam results** — hidden until published; teachers can only enter marks for
  exam subjects they manage; parents only for linked children.

Guessing another user's UUID returns `404` (never reveals existence).

---

## 5. Authentication design

### 5.1 Tokens

- **Access token**: 15-minute JWT kept **in memory only** in the browser
  (`lib/api.js`). It is never written to `localStorage`/`sessionStorage`, which
  limits the blast radius of XSS.
- **Refresh token**: 1-day JWT stored in an **HttpOnly, SameSite=Lax, Secure** (in
  production) cookie named `school_erp_refresh`, path-scoped to
  `/api/v1/accounts/auth/`. JavaScript can never read it.
- The refresh token is **rotated on every use** and the previous token is
  blacklisted; replaying a rotated token fails.
- The refresh cookie is only accepted on same-origin POST requests whose
  `Origin` header matches a configured origin; cross-site requests are rejected.

### 5.2 Token-version invalidation

Each access token carries a `token_version` claim. Every credential change
(password change, password reset, admin reset, deactivation) increments the
user's `token_version`. The custom authentication class rejects any token whose
claim does not match the user's current version, so **all outstanding access
tokens die immediately** (not just at expiry). The same events also blacklist
every live refresh token.

### 5.3 Forced password change

Admin-created accounts receive a generated temporary password and
`must_change_password=True`. `MustChangePasswordJWTAuthentication` lets the user
call only `/me/`, `/change-password/`, `/logout/` and `/refresh/`; every other
endpoint returns `403` until the password is changed — enforced server-side for
direct API clients, not just in the UI.

### 5.4 Endpoints

```
POST /api/v1/accounts/auth/login/          → access token + user (sets refresh cookie)
POST /api/v1/accounts/auth/refresh/        → new access token (rotates refresh cookie)
POST /api/v1/accounts/auth/logout/         → blacklists refresh token, clears cookie
POST /api/v1/accounts/auth/change-password/
GET/PATCH /api/v1/accounts/auth/me/
POST /api/v1/accounts/auth/password-reset/
POST /api/v1/accounts/auth/password-reset/confirm/
GET  /api/v1/accounts/auth/me/login-history/
```

Login returns a generic `Invalid email or password.` for unknown accounts,
wrong passwords and locked accounts alike, so the API cannot be used to
enumerate users. Login is throttled at `10/min`; after 5 failures within 15
minutes the account locks.

---

## 6. Security model

### 6.1 Request hardening

- **CSP** and security headers set by `config/middleware.py`
  (`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
  `Permissions-Policy`, and a strict Content-Security-Policy).
- **CORS** restricted to configured origins.
- **Throttling** on anon, login, password-reset and sensitive (change-password)
  endpoints.
- **Protected foreign keys** (`PROTECT`) and **soft deletes** (`is_active`)
  preserve referential integrity and data history.

### 6.2 Password policy

`AUTH_PASSWORD_VALIDATORS` enforces minimum length (10), similarity to the user,
a common-password blocklist, no numeric-only passwords, and a custom complexity
rule (upper, lower, digit and symbol required).

### 6.3 Upload hardening

Avatar uploads are validated with Pillow (real image decode), restricted to
jpg/jpeg/png/webp, capped at 2 MB, and stored under a random path so the
original filename is never used.

### 6.4 Online payment security

The online fee flow is built so a client can never decide how much money moves
or when an invoice becomes paid.

- **Server-side amounts** — the amount is validated against the invoice balance
  while the invoice row is locked (`select_for_update`), so concurrent requests
  cannot overpay.
- **Idempotency** — `POST /finance/payment-intents/` requires an
  `Idempotency-Key`; a unique constraint on `(created_by, idempotency_key)`
  makes retries return the original intent, and a reused key with different
  details is rejected with `409`.
- **Atomic settlement** — a successful intent creates exactly one `Payment` and
  recalculates the invoice in the same transaction. Settling an already-settled
  intent returns it unchanged (no double credit). If the balance changed before
  confirmation, the intent fails safely.
- **Ownership** — students can only pay their own invoices, parents only their
  linked children's, and an intent is visible only to the user who created it
  for a visible invoice. Other users get `404` (no enumeration).
- **Webhooks** — the callback endpoint is intentionally unauthenticated but
  requires `X-Payment-Signature = HMAC-SHA256(PAYMENT_WEBHOOK_SECRET, raw_body)`
  and a fresh `X-Payment-Timestamp` (default ±300s). Events are deduplicated by
  `(gateway, event_id)`, unknown intents are acknowledged and ignored, and
  amount/currency mismatches are rejected.
- **Data minimisation** — card numbers, PINs, OTPs and wallet passwords never
  reach the server. Only the provider transaction reference and a masked payer
  reference (`*******5678`) are stored.
- **Sandbox isolation** — sandbox confirmation is impossible unless
  `PAYMENT_SANDBOX=True`; production settings refuse to start with it enabled.

### 6.5 Production safety

`config.settings.production` refuses to boot when any of these are unsafe:

- missing or `< 50`-char `SECRET_KEY`,
- empty or `*` `ALLOWED_HOSTS`,
- a non-`https://` `FRONTEND_URL`, CORS or CSRF origin,
- `AUTH_COOKIE_SECURE=False`,
- `PAYMENT_SANDBOX=True`,
- online payments enabled without a ≥32-char `PAYMENT_WEBHOOK_SECRET` or an
  HTTPS `PAYMENT_LIVE_CHECKOUT_BASE`,
- SQLite is used (warning; PostgreSQL strongly recommended).

Production also enables `SECURE_SSL_REDIRECT`, HSTS, secure session/CSRF cookies
and the admin-only schema (`/api/schema/` is disabled for non-staff).

### 6.6 Frontend

The React app uses a small `fetch` wrapper (`lib/api.js`) with **single-flight
refresh**: when an API call returns `401`, the app calls `/refresh/` once,
stores the new access token in memory and retries the original request. If the
refresh fails it dispatches a `school-erp:session-expired` event, clears state
and redirects to login. Nothing sensitive is stored in browser storage.

**Design system & theming.** `src/styles.css` holds the design tokens
(Inter-first font stack, layered shadows, `--ring`, `--ease`) and a layered
"professional polish" pass (focus-visible rings, stat-card hover lift, table
header gradient, badge hairline edge, sidebar active accent rail, modal blur,
slim scrollbars, reduced-motion support). Every token has a dark counterpart
under `[data-theme="dark"]`, with WCAG AA contrast fixed at the token level
(`--muted` light `#667085`, dark `#8593b3`). A topbar Moon/Sun `ThemeToggle`
(`Layout.jsx`) persists the choice to `localStorage` (`school-erp-theme`) and
`frontend/public/theme-init.js` sets `data-theme` before first paint so there is
no flash of the wrong theme. `robots.txt` (`Disallow: /`) is served from
`frontend/public/` via WhiteNoise.

### 6.7 Audit logging

`apps.audit` maintains a **tamper-evident, append-only** trail of changes to
business data.

- **Capture** — `post_save` / `post_delete` receivers record one row per write
  for models in the audited apps (`accounts`, `academics`, `attendance`,
  `exams`, `finance`, `communication`). High-churn/internal models (login
  history, permission catalogue, derived join rows, token blacklist) are
  excluded, as is the audit model itself (no recursion).
- **Immutability** — `AuditLog.save()` refuses updates once a row exists and
  `delete()` is blocked; entries are never edited or removed.
- **What is stored** — action (`finance.invoice.updated`), category, actor
  (user + email snapshot), target app/model/UUID/repr, before/after JSON
  snapshots, IP address, user-agent and a per-request correlation id.
- **Failure isolation** — writes run inside a savepoint and are wrapped in a
  broad `except`, so auditing can never fail or break the primary operation.
  Before the audit table is migrated the recorder is a no-op.
- **Access** — `GET /api/v1/audit/` and `/api/v1/audit/{uuid}/` are read-only and
  restricted to admins (`IsAdminUser`); the UI exposes an **Audit log** screen to
  admins with filters, search and CSV export.
- **Request metadata** — `RequestMetadataMiddleware` stores the current request
  on a thread-local and assigns a correlation id for grouping.

See [`FUTURE_IMPLEMENTATION.md`](FUTURE_IMPLEMENTATION.md) for planned
enhancements (retention policy, log shipping, field-level diffs).

---

## 7. API conventions

- Base path `/api/v1/`, JSON, versioned.
- **UUID** lookup for every resource (`{uuid}` path params, `SlugRelatedField`
  with `slug_field="uuid"` for relations) — never integer PKs.
- **Pagination** envelope:

  ```json
  { "count": 24, "next": null, "previous": null,
    "page": 1, "page_size": 20, "total_pages": 2, "results": [ ... ] }
  ```

- **Errors**: `{"detail": "...", "errors": ["field: message"]}` with a
  consistent DRF exception handler.
- **Filtering**: `django-filter` `FilterSet`s (status, class, section, year,
  date ranges, published, etc.).
- **Custom actions** for complex flows (bulk attendance, invoice generate,
  record payment, publish exam, report card, summary, today, my-children, etc.).
- OpenAPI schema at `/api/schema/`, Swagger UI at `/api/docs/`.

---

## 8. Frontend architecture

```
frontend/src/
├── App.jsx               # route table + RequireAuth / RequireRole guards
├── main.jsx              # providers (Auth, Toast), router
├── context/
│   ├── AuthContext.jsx   # holds current user, login/logout, token lifecycle
│   └── ToastContext.jsx  # user feedback toasts
├── lib/
│   ├── api.js            # fetch wrapper, in-memory access token, single-flight refresh
│   ├── constants.js      # labels/options for statuses, grades, audiences
│   ├── format.js         # currency, dates, numbers, initials
│   ├── hooks.js          # reusable data-fetching hooks
│   ├── usePageTitle.js   # per-route document.title helper
│   └── theme.js          # light/dark theme
├── components/
│   ├── Layout.jsx        # sidebar + topbar shell
│   ├── ui.jsx            # buttons, cards, inputs, tables, badges, modals
│   └── charts.jsx        # custom SVG charts (line, donut, bars)
└── pages/                # 28 page modules (list, detail and workspace screens)
```

- **Information architecture**: the sidebar is grouped by school function
  (Overview, People, Academics, Attendance, Examinations, Finance,
  Communication, Administration). Registers are list pages that link to
  dedicated detail pages (`/students/:uuid`, `/users/:uuid`,
  `/invoices/:uuid`) or workspaces (`/exams/:uuid`, `/exams/:uuid/analytics`,
  `/exams/:uuid/papers/:paperUuid`). Modals are reserved for short create/edit
  actions, while anything with history, related records or several actions gets
  a page and a URL.

- **Routing**: `react-router-dom` v6 with nested routes and role guards. A user
  hitting a route outside their role sees a friendly "no access" screen.
- **State**: React context for auth/toasts; local state + hooks for data.
- **Styling**: plain CSS design system (`styles.css`) with CSS variables, a
  responsive sidebar, cards, tables, badges, modals and toasts.
- **Charts**: dependency-free custom SVG charts to keep the bundle small.
- **Theme**: light/dark via `data-theme`.

---

## 9. Data flow (example — attendance)

1. Teacher opens Attendance → the page loads their sections from
   `GET /academics/sections/my-classes/`.
2. Selecting a section loads the register from `GET /attendance/sheet/?section=...&date=...`.
3. Marking saves via `POST /attendance/bulk/` with
   `{section, date, records:[{student, status}]}`.
4. The server validates the teacher owns the section, rejects future dates and
   students from other sections, then bulk-creates/updates records
   transactionally.
5. Summaries come from `GET /attendance/summary/` and `GET /attendance/today/`.

Every step is permission- and scope-checked server-side; the UI is a thin layer
over the same API.

### Online payment flow

1. A student/parent opens **Invoices → Pay online**. The modal loads
   `GET /finance/payment-gateways/` for the enabled methods and flags.
2. Submitting calls `POST /finance/payment-intents/` with an `Idempotency-Key`,
   the invoice UUID, the gateway and (optionally) a partial amount.
3. The server locks the invoice, validates the amount, and returns a checkout
   URL. In sandbox mode this is the in-app `/checkout/{uuid}`; in live mode it
   is the provider's hosted page.
4. The browser polls `GET /finance/payment-intents/{uuid}/`. Settlement happens
   only from the sandbox confirm endpoint (sandbox only) or a signed provider
   webhook (live).
5. Settlement creates exactly one immutable `Payment` and recalculates the
   invoice, so the existing receipts/summaries immediately reflect it.

---

## 11. Future architecture considerations

The current architecture supports five roles (Admin, Teacher, Accountant,
Student, Parent) and seven core apps. As the school grows, the following
architectural extensions are anticipated:

### 11.1 New user roles

| Role | Suggested app | Responsibility |
|------|--------------|---------------|
| Librarian | `library` | Book catalog, issue/return, fines, overdue reports |
| Transport Manager | `transport` | Routes, vehicles, transport fees, student transport assignment |
| Hostel Warden | `hostel` | Room allocation, mess management, hostel fee tracking |
| Store / Inventory Manager | `inventory` | Stock levels, procurement, asset register |
| Examination Controller | `exams` (extended) | Exam calendar, paper moderation, result lockdown controls |
| Nurse / Medical Staff | `medical` | Student health records, vaccination tracker, infirmary log |
| Counselor | `counseling` | Counseling session records, student case notes |
| Event Coordinator | `events` | School events, holiday calendar |

Each new role would follow the existing RBAC pattern: a `Role` record, scoped
querysets in the relevant viewsets, and sidebar entries in
`frontend/src/components/Layout.jsx`.

### 11.2 New apps / modules

| Module | Domain | Notes |
|--------|--------|-------|
| `library` | Library management | Books, members, loans, fines |
| `transport` | Transport management | Routes, vehicles, drivers, transport fees |
| `hostel` | Hostel management | Rooms, wardens, mess, hostel fees |
| `inventory` | Store / asset management | Stock, procurement, assets |
| `medical` | Infirmary / health | Student health records, vaccinations |
| `counseling` | Student counseling | Session records, case notes |
| `events` | Events & calendar | School events, holidays, academic calendar |
| `expense` | Expense tracking | Non-fee expenses, vendor payments |
| `payroll` | Staff salary | Salary structures, payslips, disbursement |
| `assignment` | Assignments | Creation, submission, grading |
| `lesson_plan` | Lesson planning | Daily/weekly teaching plans |
| `leave` | Leave management | Staff/student leave applications and approvals |
| `certificate` | Certificates | PDF generation for report cards, attendance, transfer |
| `communication_extended` | Messaging | Teacher-parent chat, announcements with attachments |
| `alumni` | Alumni management | Alumni records, events, networking |

### 11.3 Cross-cutting architectural changes

| Change | Motivation |
|--------|------------|
| SMTP email backend (replace console) | Password resets, fee reminders, alerts need real delivery |
| SMS provider integration | Parents with limited email access |
| PDF generation service | Report cards, invoices, certificates, receipts |
| File storage (S3/object storage) | Attachments beyond profile images |
| Real-time messaging (WebSockets) | Chat, notifications |
| PWA / mobile app | Offline access, mobile-first experience |
| i18n / multi-language | Schools operating in multiple languages |
| Two-factor authentication (TOTP/WebAuthn) | Admin/Accountant account security |
| SSO / OAuth integration | Single sign-on for staff |
| Multi-school / branch support | School chains and campuses |
| Scheduled jobs (Celery / cron) | Automated reports, reminders, backups |
| Data backup & restore UI | Self-service backup management |
| Audit retention & archiving | Compliance for append-only audit log |

### 11.4 Data model extensions anticipated

- **Library:** `Book`, `BookCopy`, `Loan`, `Fine`, `Reservation`
- **Transport:** `Route`, `Vehicle`, `Driver`, `TransportAssignment`, `TransportFee`
- **Hostel:** `Hostel`, `Room`, `Bed`, `HostelAssignment`, `MessMenu`
- **Inventory:** `Item`, `ItemCategory`, `StockMovement`, `Supplier`, `PurchaseOrder`
- **Medical:** `HealthRecord`, `Vaccination`, `InfirmaryVisit`, `Allergy`
- **Expense:** `ExpenseCategory`, `Expense`, `Vendor`, `Reimbursement`
- **Payroll:** `SalaryStructure`, `Payslip`, `PayrollRun`
- **Assignment:** `Assignment`, `Submission`, `SubmissionGrade`
- **Leave:** `LeaveType`, `LeaveApplication`, `LeaveApproval`

See [`FUTURE_IMPLEMENTATION.md`](FUTURE_IMPLEMENTATION.md) for the prioritised
backlog (P0 go-live through P5 QA) and the pre-push checklist.

---

## 10. Related documents

- **[README.md](README.md)** — overview and quick start
- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** — environment and deployment
- **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** — endpoint reference
