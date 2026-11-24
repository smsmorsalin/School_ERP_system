# Future Implementation — School ERP

This file lists the remaining work and enhancement ideas for the School ERP,
prioritised from "should do before go-live" to "optional polish / feature ideas".

Items marked **[done]** have been implemented and verified (see `AI_HANDOFF.md`).
New analysis-driven items are grouped under **P3.5 — New opportunities**.
The page-per-workflow console redesign produced a queued backlog in
**P3.6 — Console & workflow backlog**.

---

## P0 — Before production go-live

### 1. Live payment provider adapters
The sandbox proves the full checkout lifecycle. Before going live you must add
provider-specific request/response mapping inside
`backend/apps/finance/payment_gateways.py` and
`backend/apps/finance/payment_service.py` for each gateway:

- **bKash** — hosted checkout initiation + callback verification
- **Nagad** — hosted checkout initiation + callback verification
- **Rocket (DBBL)** — hosted checkout initiation + callback verification
- **Other mobile banking** — generic redirect adapter
- **Card** — 3DS-secured hosted checkout + webhook
- **Bank transfer** — redirect to internet banking + callback

Each adapter needs real merchant credentials, sandbox test accounts, and a
registered webhook URL:
`https://<domain>/api/v1/finance/payment-webhook/<gateway>/`

Set in production: `PAYMENT_SANDBOX=False`, `PAYMENT_ONLINE_ENABLED=True`,
`PAYMENT_WEBHOOK_SECRET` (≥32 random chars), `PAYMENT_LIVE_CHECKOUT_BASE` (HTTPS).

### 2. Switch production database to PostgreSQL
Development uses SQLite. Production should use PostgreSQL with `DB_SSLMODE=require`
for managed databases.

### 3. CI pipeline
Add a GitHub Actions workflow that runs on push/PR:
- `.venv/bin/python -m pytest -q` (backend tests)
- `.venv/bin/python manage.py check && makemigrations --check`
- `npm ci && npm run build` (frontend)
- `ruff check` / `npm audit` dependency scan

### 4. Real email backend (SMTP)
Development uses the console backend. Configure SMTP for password-reset mail and
fee reminders. Set `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`
plus host/port/credentials in the Secret (K8s) or `.env` (Compose).

### 5. Secrets hygiene before push
- Confirm `.env`, `.env.compose`, `deploy/k8s/secret.yaml` are gitignored.
- Confirm no API keys, webhook secrets, or DB passwords are committed.
- Rotate any secret that was ever printed to logs or committed.

---

## P1 — Security & operations

### 6. Two-factor authentication (TOTP / WebAuthn)
Optional second factor for Admin and Accountant accounts.

### 7. Audit log [done]
Append-only `AuditLog` with signal-based capture for business apps
(`accounts`, `academics`, `attendance`, `exams`, `finance`, `communication`),
admin-only read-only API at `GET /api/v1/audit/`, and an admin **Audit log**
UI page with filters, search, pagination and CSV export. Captures actor,
action, target, before/after snapshots, IP/user-agent and request id.

Remaining audit refinements:
- Retention / archiving policy for old rows.
- Field-level diffs instead of full before/after snapshots (smaller rows).
- Log shipping to a SIEM / object storage for compliance.

### 8. Media storage via object storage
Django only serves media in DEBUG. In production serve `MEDIA_ROOT` via nginx or
an S3-compatible bucket with signed URLs.

### 9. Structured logging + error monitoring
- Structured JSON request logs to stdout.
- Error monitoring integration (e.g. Sentry).
- Log rotation.

### 10. Backups & restore procedure
Automated PostgreSQL dumps + media volume snapshots, with a documented restore
test cadence.

### 11. Rate-limit tuning & load testing
Run load tests against login/refresh and list endpoints before go-live; tune
Gunicorn workers/threads and Redis-backed throttle cache.

---

## P2 — Payments (polish)

### 12. In-browser checkout verification
The HTTP-level flow is verified (intent → settle → invoice paid → duplicate-safe).
Run a manual click-through of the student/parent "Pay online" flow in a real
browser across mobile and desktop viewports.

### 13. Fee reminder / overdue notification emails [done]
`send_fee_reminders` management command emails students/guardians about
overdue invoices (`--days-overdue`, `--dry-run`, `--limit`). Each send is
recorded in the audit log (`invoice.reminder_sent`). Schedule via CronJob or
cron in production with a working SMTP backend.

### 14. Printable / PDF fee receipts
Generate a receipt PDF after a payment settles, downloadable from the invoice
detail and payment list. Could be attached to fee-reminder emails.

---

## P3 — Frontend quality

### 15. Frontend tests
Add Vitest + React Testing Library tests for:
- Auth guards and route protection
- Form validation and API error handling
- Payment modal and checkout states

### 16. End-to-end tests
Add Playwright E2E tests for the five role flows (login → dashboard → key
actions → logout).

### 17. Accessibility pass
Focus outlines, modal focus traps, `aria-label`s on icon-only buttons, table
`<caption>`/`scope`, colour-contrast review. Drawer/Modal now close on Escape
and the redesign re-audits at 100 Accessibility on the main routes; the
remaining work is a full route sweep plus a real focus trap and skip link.

### 18. Loading skeletons & empty states
Replace bare spinners with skeletons; review empty-state copy across pages.

### 19. Responsive verification [partially done]
The redesigned console was checked at desktop and narrow widths (off-canvas
sidebar, collapsing grids, scrolling tables). Still open: real tablet/mobile
device passes, landscape phones, and 200% browser zoom.

### 20. Per-page `document.title` [done]
`lib/usePageTitle.js` is applied to every routed page so tab titles update on
navigation.

### 21. Audit log UI [done]
Admin **Audit log** page (`/admin/audit`) with filters, search, pagination and
client-side CSV export; route guarded to Admin only.

---

## P4 — Data & productivity features

### 22. CSV export / import [done (export)]
`export_finance_csv` management command exports invoices, payments or fee
structures to CSV (`--model`, `--output`). CSV import for students and marks
is still open.

### 23. Internationalisation
The app is English-only. Add Django `i18n` strings and React locale support if
the school operates in multiple languages.

### 24. Parent multi-child switcher
Improvements to switching between linked children's dashboards/invoices.

### 25. Dashboard date-range filters & downloadable reports
Add date-range pickers to finance/attendance dashboards and export options.

### 26. Attendance "mark all present" bulk action UI [done]
Already implemented in `pages/attendance/RegisterPage.jsx` (convenience button
plus bulk POST).

---

## P3.5 — New opportunities (analysis pass)

These were identified after implementing the audit trail, reminders, CSV
export and page-title features:

### 27. Audit retention & archiving
The `audit_auditlog` table is append-only and grows forever. Add:
- a `prune_audit_log` command that exports rows older than N days to object
  storage / CSV before deleting them (respects the append-only design),
- a retention setting (`AUDIT_RETENTION_DAYS`) honoured by the prune command,
- optional log shipping to a SIEM.

### 28. Field-level audit diffs
Currently every write stores full before/after JSON snapshots. For wide models
this bloats rows. Store only the changed fields plus a `changed_fields` list,
with an option to reconstruct full snapshots on read.

### 29. Notification preferences
Let parents/guardians choose which reminders they receive and when (N days
before/after due date, email vs SMS channel). Store preferences on the user
and honour them in `send_fee_reminders`.

### 30. Bulk SMS reminders
Add an SMS provider alongside email, with sends tracked in the audit log
(`invoice.reminder_sent` extended with channel). Useful where parents have
limited email access.

### 31. Saved filter views
Remember per-page filter choices (audit, invoices, payments, attendance) per
user so the dashboard state persists across reloads.

### 32. Global command palette
Quick navigation/search (⌘K) to jump to any record, student, invoice or page
from anywhere in the SPA.

### 33. Soft-delete restore UI
Surface `is_active=False` records (users, roles, invoices) for admins with
audited restore actions. Currently soft-deletes exist at the model layer but
there is no restore UI.

### 34. Audit dashboard tiles
Admin dashboard counts of failed logins, role changes and payment activity
drawn from the audit log (fast, read-only aggregates).

### 35. Login-history pagination & filters
The `login-history` data exists but the UI only shows the latest entries. Add
pagination, date filters and export.

### 36. Exam analytics export
Per-class / per-subject performance reports as CSV or PDF for teachers and
admins.

### 37. CSV import for students / marks
Complement the export command with validated import (dry-run mode, row-level
error reporting, audit of imported rows).

---

## P3.6 — Console & workflow backlog (queued next)

These items extend the page-per-workflow console redesign. They are deliberately
**not** part of the completed IA split; each is scoped so it can ship on its own.
“API” marks work that needs backend model/serializer/endpoint changes — the rest
is frontend-only.

| # | Task | Surface | API? |
|---|------|---------|------|
| 38 | Student 360 workspace | Frontend | No |
| 39 | Admissions pipeline | Frontend + API | Yes |
| 40 | Academic-year rollover wizard | Frontend + API | Yes |
| 41 | Timetable builder with clash detection | Frontend + API | Yes |
| 42 | Attendance correction approvals | Frontend + API | Yes |
| 43 | Bulk actions on list pages | Frontend + API | Yes |
| 44 | Guardian directory & sibling linking | Frontend + API | Partial |
| 45 | Student document vault | Frontend + API | Yes |
| 46 | Notification centre | Frontend + API | Yes |
| 47 | First-run admin onboarding | Frontend | No |
| 48 | Design system gallery + `DESIGN.md` | Frontend + docs | No |
| 49 | Frontend test suite (Vitest + Playwright) | Frontend | No |
| 50 | Print & PDF documents | Frontend (+ API for PDF) | Optional |
| 51 | Exam mark-entry grid | Frontend | Optional |
| 52 | Role-based dashboard widgets | Frontend | Optional |

### 38. Student 360 workspace
**Why:** the student profile is still one long page mixing identity, guardians,
attendance, fees and results. Staff scroll to find things that deserve their own
view.

**Scope:** keep the shared student header (photo, name, ID, class/section,
status, quick actions) and split the body into sub-routes:
`/students/:uuid` (overview), `/students/:uuid/guardians`,
`/students/:uuid/attendance`, `/students/:uuid/fees`,
`/students/:uuid/results`. Sub-navigation sits under the header and each tab has
its own URL.

**Acceptance:** deep links and back/forward work; the overview keeps the summary
cards; existing actions (edit, deactivate, record payment, open invoice) stay
reachable; role guards match today’s behaviour; documents join this shell when
task 45 lands.

### 39. Admissions pipeline
**Why:** admission is a single “create student” form. Real schools track
applications, document checks, interviews, offers and waitlists before a student
record exists.

**Scope:** add an application model with statuses `draft → submitted → under_review
→ offered → enrolled / declined / waitlisted`, an `/students/admissions` pipeline
(list + board grouped by status) and `/students/admissions/:uuid` detail with
notes, documents and decision actions. Enrollment creates the student record and
sign-in account atomically, reusing the current admission service.

**Acceptance:** every transition is audited with actor and timestamp; duplicate
email/phone is rejected with a clear message; waitlist ordering is visible;
existing `/students/new` becomes the “enrol now” shortcut; Admin-only (future
Admission Officer role).

### 40. Academic-year rollover wizard
**Why:** there is no safe way to close a year and promote students. Doing it by
hand risks mixed-year data.

**Scope:** `/admin/academic-years/rollover` with steps: choose source and target
year → preview promotions (repeat / promote / graduate) → map sections → choose
what to copy (curriculum, fee structures, timetable template) → review → commit.
Archive the source year read-only.

**Acceptance:** dry-run summary before commit; transactional commit; rerunning is
idempotent; student history stays attached to the source year; audit records the
whole operation.

### 41. Timetable builder with clash detection
**Why:** the timetable grid is edited manually and cannot warn about a teacher or
room being booked twice.

**Scope:** drag-and-drop periods per section, draft/publish state, teacher and
room conflict checks, a teacher-view timetable, and print/export. Keep a
read-only view for students and parents.

**Acceptance:** conflicts block publish with the exact clashing slot; draft
changes are invisible to families; publish is audited; mobile falls back to a
day-by-day list rather than a squeezed grid.

### 42. Attendance correction approvals
**Why:** corrections are direct edits/deletes. Schools usually require a reason
and a second pair of eyes.

**Scope:** teacher submits a correction request (student, date, old → new status,
reason); Admin/Attendance Coordinator approves or rejects; the register locks
after a configurable window; original and corrected values remain in the audit
log.

**Acceptance:** no silent overwrite; approval queue with counts; requester and
reviewer cannot be the same person unless they are Admin; history shows both
values.

### 43. Bulk actions on list pages
**Why:** invoices, users and students are handled one row at a time.

**Scope:** row selection plus a bulk action bar on students, invoices, payments
and user accounts. Start with: generate invoices for a fee structure, deactivate
users, export selected rows, assign a section. Show a confirmation with the
affected count.

**Acceptance:** partial failures are reported per row; every record still gets
its own audit entry; selection clears after the action; keyboard and screen
reader users can select rows.

### 44. Guardian directory & sibling linking
**Why:** guardians can only be reached from a student profile, and siblings are
hard to connect.

**Scope:** `/students/guardians` directory and detail page; link/unlink children,
mark the primary contact, record relationship and communication preferences;
detect duplicate guardian accounts by email/phone.

**Acceptance:** one guardian links to many students; permissions stay
Admin/Teacher/Accountant as today; linking is audited; student profile shows the
same data without a second source of truth.

### 45. Student document vault
**Why:** schools keep birth certificates, transfer certificates, medical notes
and photos outside the ERP.

**Scope:** `/students/:uuid/documents` (inside the 360 shell) with upload, list,
download and delete. Reuse the hardened image rules where relevant; allow PDFs
with MIME sniffing, a size cap, random storage paths and signed download URLs.

**Acceptance:** only Admin/Teacher/Accountant can upload; students and parents see
their own documents read-only if enabled; upload/delete is audited; no public
media URL is exposed.

### 46. Notification centre
**Why:** the bell shows counts, but there is no inbox and no way to review what
was missed.

**Scope:** bell opens a right-hand panel or `/notifications` with grouped items:
announcements, fee reminders, approval requests, exam publish events. Mark one /
all read, filter by type, deep-link to the record. Reuse existing read-receipt
data where possible.

**Acceptance:** unread count matches the API; pagination and empty state exist;
opening an item marks it read; keyboard accessible; no duplicate notifications
after refresh.

### 47. First-run admin onboarding
**Why:** a new school starts with an empty console and no obvious order of
operations.

**Scope:** a dismissible checklist on the dashboard: create academic year →
classes → sections → subjects → curriculum → fee categories/structures → invite
staff → publish an announcement. Deep-link each step and persist completion.

**Acceptance:** progress survives reloads; completed steps re-open their page;
the checklist disappears when done or dismissed; no blocking modal.

### 48. Design system gallery + `DESIGN.md`
**Why:** the console now has a distinct visual language, but contributors have no
single reference for tokens and component states.

**Scope:** an internal `/design` route (Admin/dev only) showing colour tokens,
type scale, spacing, radius/shadow, buttons, inputs, selects, badges, tables,
cards, drawers, modals, notices, empty/error/loading states, in light and dark.
Write `DESIGN.md` beside `PRODUCT.md` and link it from the README and
`frontend/README.md`.

**Acceptance:** the gallery renders from the real components (no copies); no
production sidebar entry; `DESIGN.md` matches `styles.css`; both themes shown.

### 49. Frontend test suite (Vitest + Playwright)
**Why:** the backend has 112 tests; the console has none.

**Scope:** Vitest + React Testing Library for route guards, form validation, API
error states, drawer open/close and the admission flow; Playwright for the five
role flows (login → dashboard → key action → logout) plus admission and invoice
payment. Wire both into CI.

**Acceptance:** tests run headless with no fixed sleeps; CI fails on regressions;
the five role flows and the two money/admission paths are covered; snapshots are
avoided for volatile data.

### 50. Print & PDF documents
**Why:** invoices, receipts, report cards and timetables are still screen-only.

**Scope:** print styles for invoice/receipt, report card and timetable (school
header, A4 page breaks, no nav chrome), then optional server-side PDF generation
for email attachments.

**Acceptance:** A4 output has no clipped tables; totals and balances are visible;
the school name/logo come from settings; printing does not trigger dark theme.

### 51. Exam mark-entry grid
**Why:** mark entry is a form per paper; teachers enter dozens of rows and want a
spreadsheet-like flow.

**Scope:** keyboard-first grid (arrow keys, Enter, Tab), per-cell validation
against paper max marks, bulk paste, autosave draft and an explicit publish gate.

**Acceptance:** navigation never loses unsaved marks; invalid values are blocked
with row context; draft vs published is visible; publish is audited.

### 52. Role-based dashboard widgets
**Why:** every role sees a fixed dashboard, and admins cannot emphasise the
numbers their school cares about.

**Scope:** a small widget picker (attendance, fee collection, admissions,
upcoming exams, audit activity) with role-aware defaults, persisted per user and
a reset-to-default action.

**Acceptance:** layout has no shift on load; each widget has an empty state;
students/parents only see their own data; preference is stored per user.

### Suggested delivery order

| Wave | Tasks | Reason |
|------|-------|--------|
| 1 — foundation | 48, 49, 47 | Design reference, regression safety, first-run clarity |
| 2 — academic operations | 38, 40, 41, 42 | Highest daily value for Admin/Teacher |
| 3 — people & admissions | 39, 44, 45 | Extends the student lifecycle |
| 4 — scale & polish | 43, 46, 50, 51, 52 | Efficiency and presentation once the core is stable |

---

## Pre-push checklist (run before `git push`)

| # | Check | Command |
|---|-------|---------|
| 1 | Full test suite green | `cd backend && .venv/bin/python -m pytest -q` |
| 2 | Django system check | `.venv/bin/python manage.py check` |
| 3 | No migration drift | `.venv/bin/python manage.py makemigrations --check --dry-run` |
| 4 | Frontend builds | `cd frontend && npm ci && npm run build` |
| 5 | No secrets committed | `git status` + grep for `.env`, `secret.yaml`, tokens |
| 6 | `.gitignore` covers env/media/db | review `.gitignore` |
| 7 | Docs match code | README, ARCHITECTURE, SETUP_GUIDE, API_DOCUMENTATION, DEPLOYMENT |
| 8 | Demo credentials preserved | admin/teacher/accountant/student/parent logins still work |
| 9 | Production hard-fail still guards | run production settings with unsafe values → expect `ImproperlyConfigured` |
| 10 | K8s kustomizations in sync | `deploy/k8s/kustomization.yaml` and `jobs/kustomization.yaml` |
| 11 | Lighthouse spot-check | serve `frontend/dist` and audit `/`, `/students`, `/finance/invoices` → Accessibility + Best Practices 100 |
| 12 | Design detector clean | run the Impeccable detector against the built console → no findings |

When all rows are green, commit and push.
