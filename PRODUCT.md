# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Five built-in roles, each with role-scoped access:

- **Admin** — full access to everything, including user and role management.
- **Teacher** — reads on academics; attendance marking and result entry for own sections; targeted announcements.
- **Accountant** — finance management (fee setup, invoices, payments); no access to people or user records.
- **Student** — own profile, attendance, published results, invoices; read-only.
- **Parent** — linked children only (attendance, results, invoices); read-only.

Custom roles can be created in the Roles screen. Every list/detail queryset is scoped to the current user (row-level scoping): students see only themselves, parents only linked children, teachers only their assigned sections, admins see all. Guessing another user's UUID returns `404`.

Confirmed in `ARCHITECTURE.md` §4 (identity, roles, access control) and `README.md`.

## Product Purpose

A complete, security-hardened School ERP connecting admissions, academics, attendance, examinations, finance and communication so school teams spend less time on administration and more time on students.

It is a Django REST backend serving a versioned `/api/v1/` JSON API, with a React SPA console served at `/` (23 route screens). Success means staff run academic and finance operations in the console with row-level data scoping and an immutable audit trail of every business write.

Confirmed in `README.md` and `ARCHITECTURE.md` §1, §3, §8.

## Positioning

The differentiating mechanism neighbors could not truthfully copy:

- Role-based access with row-level data scoping enforced server-side — the UI is a thin layer over the same permission-checked API.
- Security-hardened by design: HttpOnly rotating refresh tokens, token-version invalidation on any credential change, strict CSP/security headers, throttled login with lockout, server-side payment amounts with idempotency keys and signed webhooks, immutable append-only audit log.
- Operations-grade by default: 110-test pytest suite, production settings that refuse to boot on unsafe config, OpenAPI schema and Swagger UI at `/api/schema/` and `/api/docs/`.

## Operating Context

Workflows that are factual parts of using the product:

- Admissions and academics setup: academic years, classes, sections, subjects, class-subject assignments, teacher/student/guardian profiles, guardian links, weekly timetable.
- Attendance: daily register, bulk marking, per-student history, section summaries, "today" view.
- Examinations: exam and paper setup, mark entry, grade bands, publishing, report cards with rank, analytics.
- Finance: fee categories and structures, bulk invoice generation, payments, receipts, collection summaries, CSV exports; secure online fee payments (bKash, Nagad, Rocket, other mobile banking, cards, bank transfer).
- Communication: role/class-targeted announcements with read receipts.
- Dashboard: role-aware overview with charts and global search.
- Audit: admin-only append-only audit log with filters, search and CSV export; overdue-fee reminder emails.

Environment and tools: browsers (React SPA); Django API over HTTPS; SQLite in development, PostgreSQL strongly recommended in production; media on S3/disk; `manage.py`, pytest (110 tests), drf-spectacular, docker-compose. Dev entry is `backend/manage.py`; the frontend is Vite (`frontend/`).

## Capabilities and Constraints

Confirmed functionality:

- JWT authentication: 15-minute access token held in browser memory only (never localStorage/sessionStorage); 1-day refresh token in an HttpOnly, SameSite=Lax, Secure cookie, rotated on every use with replay blacklisting; token-version invalidation kills all outstanding tokens on any credential change; forced password change for admin-created accounts.
- Row-level scoping and IDOR protection on every resource (UUID lookups, never integer PKs).
- Attendance bulk marking with server-side ownership and date validation; transactional saves.
- Exams: papers, results, grade bands, publishing, report cards with rank.
- Finance: fee structures, bulk invoices, atomic payments, receipts; online payment intents validated against locked invoice balances, idempotency-keyed, deduped webhook events, sandbox isolation (`PAYMENT_SANDBOX=True` impossible in production).
- Announcements with audience targeting and read receipts; teachers edit only their own.
- Custom SVG charts (dependency-free), light/dark theme, toast feedback.
- Avatar uploads hardened: Pillow real-image decode, jpg/jpeg/png/webp only, 2 MB cap, random storage paths.
- Password policy: minimum 10 chars, similarity, common-password blocklist, no numeric-only, upper/lower/digit/symbol required.
- CSP and security headers; CORS restricted to configured origins; soft deletes (`is_active`) and protected foreign keys preserve history.

Hard constraints:

- Production refuses to boot with unsafe config (short SECRET_KEY, `*` ALLOWED_HOSTS, non-HTTPS origins, insecure cookies, sandbox mode, missing webhook secret/checkout base); SQLite warned, PostgreSQL recommended.
- Students and parents are read-only and see only their own/linked children's records; teachers cannot touch other sections' students.
- Clients never decide how much money moves or when an invoice becomes paid — amounts are server-validated against a locked row.

Explicitly undecided: none at this time.

## Evidence on Hand

Real project content at `School_ERP_system/`: `README.md`, `ARCHITECTURE.md`, `API_DOCUMENTATION.md`, `SETUP_GUIDE.md`, `AI_HANDOFF.md`, `BACKEND_ANALYSIS.md`, `DEPLOYMENT.md`, `IMPLEMENTATION_COMPLETE.md`, `FUTURE_IMPLEMENTATION.md`; 110 pytest tests in `backend/tests/`; 23 route screens in `frontend/src/pages/`; OpenAPI schema at `/api/schema/`.

No customer testimonials, case studies, benchmarks, or press are on hand — future work must not fabricate these.

## Product Principles

Durable strategic principles derived from confirmed answers (no visual recipes):

1. **Security first.** No user can read or write another user's data; enforcement is server-side, never UI-only.
2. **The server decides money.** Clients never set amounts or payment status; settlement is atomic, idempotent, and creates exactly one immutable payment per intent.
3. **Audit everything.** Every business write leaves an immutable, append-only trace that admins can inspect and export.
4. **Role-aware by default.** Every screen and API response is scoped to the caller's role; out-of-role access yields a friendly "no access" or `404`.
5. **Operations-grade.** A 110-test suite, production hard-fail safety checks, throttled and rate-limited endpoints, and CSV exports for finance and audit.

## Accessibility & Inclusion

Omitted: no product-specific accessibility requirement or standard was established.
