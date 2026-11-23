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
`<caption>`/`scope`, colour-contrast review.

### 18. Loading skeletons & empty states
Replace bare spinners with skeletons; review empty-state copy across pages.

### 19. Responsive verification
Check layout at tablet and mobile widths; adjust CSS breakpoints as needed.

### 20. Per-page `document.title` [done]
`lib/usePageTitle.js` is applied to all 23 pages so tab titles update on
navigation.

### 21. Audit log UI [done]
Admin **Audit log** page (`/audit`) with filters, search, pagination and
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
Already implemented in `Attendance.jsx` (convenience button + bulk POST).

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

When all rows are green, commit and push.
