# School ERP — Build Summary

**Status:** ✅ Complete
**Stack:** Django 6.0.6 + DRF 3.16.1 (backend) · React 18 + Vite 5 (frontend)
**Tests:** 103 passing (`pytest`)
**Docs:** [README](README.md) · [ARCHITECTURE](ARCHITECTURE.md) ·
[SETUP_GUIDE](SETUP_GUIDE.md) · [API_DOCUMENTATION](API_DOCUMENTATION.md)

This document summarises what was built and verified.

---

## What was delivered

### Backend (Django + DRF)

- **Custom email-based user model** with UUID public identifiers, role cache,
  lockout fields, `must_change_password` and `token_version`.
- **Full RBAC** — five seeded system roles (Admin, Teacher, Accountant, Student,
  Parent), a permission catalogue, custom roles, and row-level queryset scoping
  in every app (IDOR protection).
- **JWT auth** — 15-minute access tokens in memory, HttpOnly rotating refresh
  cookie, blacklist on logout/rotation, Origin checks on cookie endpoints,
  generic login errors, 10/min login throttle, 5-attempt/15-minute lockout.
- **Token-version invalidation** — every password change/reset/deactivation
  revokes all access tokens immediately and all refresh tokens.
- **Forced password change** — admin-created accounts get a temporary password
  and cannot use the API (except change-password/me/logout/refresh) until they
  set a new password.
- **Apps**: academics (years/classes/sections/subjects/timetable/profiles),
  attendance (bulk marking/summaries), exams (papers/results/publishing/report
  cards/analytics), finance (fee structures/invoices/payments/receipts), and
  communication (audience-targeted announcements with read receipts).
- **Online fee payments** — students pay their own invoices and parents pay
  linked children's invoices via bKash, Nagad, Rocket, other mobile banking,
  card or bank transfer. Server-calculated row-locked amounts, per-user
  idempotency, atomic settlement into the existing ledger, expiry/cancel,
  sandbox confirmation, and HMAC-SHA256-signed timestamp-bounded webhooks with
  event deduplication. Only masked payer references are stored.
- **Role-aware dashboard** with charts data, global search and health check.
- **Security hardening** — CSP/security headers, throttling, Pillow-validated
  image uploads (2 MB, allow-list), soft deletes, protected FKs, password
  complexity policy, disabled public registration.
- **Production settings** that refuse to start on unsafe configuration (weak
  `SECRET_KEY`, wildcard/empty `ALLOWED_HOSTS`, non-HTTPS origins, insecure
  cookies) plus HSTS, SSL redirect and secure cookies.

### Frontend (React + Vite)

- 22 screens: dashboard, students, teachers, users, roles, classes, subjects,
  timetable, attendance, exams, results, invoices, fee setup, payments,
  announcements, profile, change password, forgot/reset password, checkout,
  login, 404.
- Online payment UI: “Pay online” on student/parent invoices, grouped gateway
  picker (mobile banking / card / bank), amount entry capped at the balance,
  and a secure `/checkout/:uuid` page with sandbox pay/decline/cancel and
  live-polling success/failure states.
- Role-aware navigation and route guards with a friendly "no access" screen.
- Custom SVG charts (fee collection, grade distribution, attendance trend).
- Plain CSS design system with light/dark theme, responsive layout, toasts.
- In-memory access token with single-flight refresh; session survives reloads
  via the HttpOnly cookie.

### Tests

70 pytest tests covering authentication, lockout, refresh rotation/blacklist,
token-version revocation, the forced-password gate, RBAC and IDOR protection,
attendance bulk marking, exam publishing and report cards, finance atomicity,
announcement audiences and image-upload validation — plus 25 online-payment
tests covering ownership scoping, amount caps, idempotency, sandbox settlement,
duplicate settlement, expiry, cancellation, declines, balance-change races and
every signed-webhook rejection path (103 total).

---

## Verified end-to-end

- Admin/Teacher/Accountant/Student/Parent logins and role-scoped navigation.
- Forced password change: temp-password login → locked dashboard → change →
  re-login with the new password.
- Session recovery across page reloads via the refresh cookie; logout ends the
  session (reload returns to login).
- Production config hard-fail checks for every unsafe setting variant.
- Demo data: 3 grades, 6 sections, 24 students, 5 roles, invoices, exams and
  results — see [SETUP_GUIDE.md](SETUP_GUIDE.md) for demo credentials.

---

## Rebuild notes

The original repository contained a backend-only skeleton with empty model,
serializer and view files. This rebuild completed the full stack: models, APIs,
security layer, RBAC, tests, the React console and the documentation, while
keeping the original app layout and naming conventions.
