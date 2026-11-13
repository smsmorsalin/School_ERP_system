# API Documentation — School ERP

Base URL: `/api/v1/`

- All endpoints accept and return **JSON** unless noted.
- Resource lookups use the resource **`uuid`** (hex-with-dashes).
- Authenticated endpoints require `Authorization: Bearer <access_token>`.
- The access token (15-minute expiry) is issued by `/login/`; refresh token
  lives in the HttpOnly cookie `school_erp_refresh`.
- OpenAPI schema: `/api/schema/` · Swagger UI: `/api/docs/` (admin/staff in
  production).

---

## Pagination

List endpoints return:

```json
{
  "count": 24,
  "next": "http://.../page=2",
  "previous": null,
  "page": 1,
  "page_size": 20,
  "total_pages": 2,
  "results": [ ... ]
}
```

## Error format

```json
{
  "detail": "Optional overview message.",
  "errors": ["field: message", "other: message"]
}
```

| Status | Meaning                                            |
|--------|----------------------------------------------------|
| 400    | Validation error (field details in `errors`)        |
| 401    | Missing/expired/invalidated token — sign in again  |
| 403    | Authenticated but not allowed (role or scope)      |
| 404    | Not found *or not visible to you* (no enumeration) |
| 429    | Throttled (login/password-reset/sensitive limits)  |

---

## Authentication

### `POST /accounts/auth/login/`

Public. Body:

```json
{ "email": "admin@school.example", "password": "Admin@12345" }
```

Response `200`:

```json
{
  "access": "<jwt>",
  "expires_in": 900,
  "user": { "uuid": "...", "email": "...", "full_name": "...",
            "roles": ["Admin"], "primary_role": "Admin",
            "profile_image_url": null, "must_change_password": false }
}
```

Sets the HttpOnly refresh cookie. Unknown email, wrong password and locked
accounts all return `401 Invalid email or password.` (no enumeration).

Optional header `X-Client-Type: api` returns the refresh token **in the body**
for native/mobile clients instead of only the cookie.

### `POST /accounts/auth/refresh/`

Browser → `{}`, cookie authenticated. Rotates the refresh cookie (old one is
blacklisted) and returns `{ "access": "...", "expires_in": 900 }`.
Rejected (`403`) when the request `Origin` is not a configured origin.

### `POST /accounts/auth/logout/`

Blacklists the current refresh token and clears the cookie.
Response `204`. If there is no cookie, returns `401`.

### `POST /accounts/auth/change-password/`

Authenticated. Body:

```json
{
  "old_password": "current",
  "new_password": "NewStr0ng!Pass",
  "new_password_confirm": "NewStr0ng!Pass"
}
```

Invalidates all tokens (access + refresh). Users with `must_change_password`
must change their password before using other endpoints.

### `GET /accounts/auth/me/`

Returns the current user's profile.

### `PATCH /accounts/auth/me/`

Update personal details:

```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "phone_number": "+8801...",
  "address": "123 Main St"
}
```

`email`, `roles`, `is_active`, `uuid` and `must_change_password` cannot be
changed here (admin-only elsewhere).

Optional `profile_image` upload (jpg/jpeg/png/webp, ≤ 2 MB).

### `GET /accounts/auth/me/login-history/`

Recent sign-ins for the current user.

### `POST /accounts/auth/password-reset/`

Body `{ "email": "..." }`. Always returns `200` with a generic message whether or
not the account exists. Sends a reset link by email.

### `POST /accounts/auth/password-reset/confirm/`

```json
{
  "uid": "<urlsafe-base64 user pk>",
  "token": "<reset token>",
  "new_password": "NewStr0ng!Pass",
  "new_password_confirm": "NewStr0ng!Pass"
}
```

Sets the new password, clears `must_change_password`, revokes all tokens.

### `POST /accounts/auth/register/`

Public registration. **Disabled by default** (`ALLOW_PUBLIC_REGISTRATION=False`)
→ returns `403`. When enabled, creates a regular account.

---

## User management (Admin)

### `GET /accounts/users/`

Admin only. Query params include `search`, `is_active`, `role`.

### `POST /accounts/users/`

Admin only. Body:

```json
{
  "email": "new.user@school.example",
  "first_name": "New",
  "last_name": "User",
  "roles": ["Student"],
  "phone_number": "+8801..."
}
```

Only superusers may assign the `Admin` role. Creates the account with a
temporary password and `must_change_password=True`. Response `201` includes
`temporary_password` (return it to the user; not shown again).

### `GET /accounts/users/{uuid}/` · `PATCH` · `DELETE`

Admin only (GET is allowed for the user's own record). `DELETE` is a soft
delete (`is_active=False`.

### `POST /accounts/users/{uuid}/set-password/`

Admin sets a new password for a user. Forces `must_change_password=True` and
revokes all their sessions.

### `POST /accounts/users/{uuid}/toggle-active/`

Activate/deactivate the account. Deactivation revokes all sessions.

### `POST /accounts/users/{uuid}/unlock/`

Clear a lockout (`failed_login_attempts=0`, `locked_until=None`).

### `GET /accounts/users/{uuid}/login-history/`

Admin reads the login history of a given user.

---

## Roles & permissions (Admin)

- `GET /accounts/roles/` · `create` · `GET|PATCH /accounts/roles/{uuid}/` ·
  `DELETE` (soft delete for regular roles; system roles cannot be deleted).
- `GET /accounts/permissions/` — the permission catalogue.

Role create/update body:

```json
{
  "name": "Librarian",
  "description": "Library staff",
  "permission_codes": ["view_student"]
}
```

`permission_codes` replace the role's permissions.

---

## Academics

| Endpoint | Notes |
|---|---|
| `/academics/academic-years/` | Academic years; `GET /academics/academic-years/current/` returns the current one |
| `/academics/classes/` | School classes (Class 1..12) |
| `/academics/sections/` | Sections; `GET /sections/my-classes/` for teachers; `GET /sections/{uuid}/roster/` for students in the section |
| `/academics/subjects/` | Subjects (name, code, credits) |
| `/academics/class-subjects/` | Class-subject-teacher assignments |
| `/academics/students/` | Students; `GET /academics/students/me/`; `GET /academics/students/my-children/` (parent); `GET /academics/students/{uuid}/guardians/` |
| `/academics/teachers/` | Teachers; `GET /academics/teachers/me/` |
| `/academics/guardian-links/` | Guardian–student links |
| `/academics/timetable/` | Weekly timetable entries |

Writes to academic records are **admin-only**. Teachers and parents read only
within their scope.

### Create a student (Admin)

`POST /academics/students/`

```json
{
  "user": {
    "email": "student.new@school.example",
    "first_name": "Sam",
    "last_name": "Lee",
    ...
  },
  "current_section": "<section uuid>",
  "roll_number": 12,
  "gender": "male",
  "date_of_birth": "2012-04-05",
  "admission_date": "2026-01-10"
}
```

`student_id` (e.g. `STU-2026-0012`) is generated automatically.

---

## Attendance

| Endpoint | Notes |
|---|---|
| `POST /attendance/bulk/` | Bulk mark a section for one date |
| `GET /attendance/sheet/?section=&date=` | Register for a section on a date |
| `GET /attendance/summary/?section=&from=&to=` | Section summary/percentages |
| `GET /attendance/today/` | Today's overview for the user's scope |
| `GET /my-attendance/` | Attendance history for a student/parent |

### Bulk mark

`POST /attendance/bulk/`

```json
{
  "section": "<uuid>",
  "date": "2026-11-08",
  "records": [
    { "student": "<student uuid>", "status": "present" },
    { "student": "<uuid>", "status": "absent", "remarks": "sick" }
  ]
}
```

`status` ∈ `present | absent | late | excused`. Validation: teacher must own the
section, date cannot be in the future, students must belong to the section and
each student appears at most once. Returns
`{ "created": n, "updated": n }`.

---

## Exams & Results

| Endpoint | Notes |
|---|---|
| `/exams/` | Exams; `POST /exams/{uuid}/publish/`, `GET /exams/analytics/` |
| `/exam-subjects/` | Papers; `POST /exam-subjects/{uuid}/bulk-results/`, `GET /exam-subjects/{uuid}/sheet/` |
| `/exam-results/` | Results; `GET /exam-results/report-card/?student=` |

### Enter marks (Teacher)

`POST /exam-subjects/{uuid}/bulk-results/`

```json
{ "results": [ { "student": "<uuid>", "marks_obtained": 87 } ] }
```

Teacher must manage that subject; published exams are read-only; marks must be
`0..max_marks`; students must be in the section.

### Publish an exam (Admin)

`POST /exams/{uuid}/publish/`

```json
{ "published": true }
```

Results become visible to students/parents only after publishing.

### Report card

`GET /exam-results/report-card/?student=<uuid>`

Returns totals, grade, position/rank and per-subject marks. Students see their
own report; parents only for linked children.

---

## Finance

| Endpoint | Notes |
|---|---|
| `/finance/fee-categories/` | Fee categories (admin/accountant) |
| `/finance/fee-structures/` | Per-class fee definitions (admin/accountant) |
| `/finance/invoices/` | Invoices; `POST /invoices/generate/`, `POST /invoices/{uuid}/payments/`, `POST /invoices/{uuid}/cancel/`, `GET /invoices/{uuid}/receipt/` |
| `/finance/payments/` | Payments; `GET /payments/summary/` |
| `/finance/payment-gateways/` | Enabled online-payment methods + currency/sandbox flags |
| `/finance/payment-intents/` | Create/list online checkout sessions (`Idempotency-Key` required on create) |
| `/finance/payment-intents/{uuid}/` | Poll a checkout session |
| `/finance/payment-intents/{uuid}/sandbox-confirm/` | Complete a sandbox payment |
| `/finance/payment-intents/{uuid}/cancel/` | Cancel a pending checkout |
| `/finance/payment-webhook/{gateway}/` | Public signed provider callback |

Teachers get `403` on all finance reads and writes. Students/parents see only
their own invoices/payments.

### Generate invoices (bulk)

`POST /finance/invoices/generate/`

```json
{
  "fee_structure": "<fee structure uuid>",
  "section": "<uuid>"
}
```

Creates an invoice for each student in the section that does not already have
one for that structure. Returns `{ "created": n, "skipped": n }`.

### Record a payment (Accountant)

`POST /finance/invoices/{uuid}/payments/`

```json
{
  "amount": "200.00",
  "method": "cash",
  "reference": "RCPT-1024",
  "notes": "term 1 part payment"
}
```

Atomic and row-locked: overpayment, re-payment of a cancelled invoice and
paying beyond the remaining balance are rejected. The invoice's
`amount_paid`/`status`/`balance` are recalculated; deleting a payment
recalculates them back.

`method` ∈ `cash | card | bank` (see `finance/models`).

---

## Online fee payments

Students pay their own invoices; parents pay invoices of linked children. Admins
and accountants can read every intent but cannot create one on a student's
behalf through this API.

### `GET /finance/payment-gateways/`

Returns the methods the UI may offer:

```json
{
  "enabled": true,
  "sandbox": true,
  "currency": "BDT",
  "intent_ttl_minutes": 30,
  "gateways": [
    {
      "code": "bkash",
      "label": "bKash",
      "category": "mobile_banking",
      "category_label": "Mobile banking",
      "description": "Pay from your bKash mobile wallet.",
      "brand_color": "#e2136e",
      "initials": "bK"
    }
  ]
}
```

Gateway `code`s: `bkash`, `nagad`, `rocket`, `mobile_banking`, `card`, `bank`.
When `enabled` is `false`, `gateways` is empty and the UI hides checkout.

### `POST /finance/payment-intents/`

Headers: `Idempotency-Key: <8–128 safe characters>` (required).

```json
{
  "invoice": "<invoice uuid>",
  "gateway": "bkash",
  "amount": "250.00"
}
```

`amount` is optional; omitting it pays the full outstanding balance. The server
always re-validates against the locked invoice row. Responses:

- `201` — new intent; body includes `uuid`, `intent_number`, `amount`,
  `currency`, `status`, `checkout_url`, `sandbox`, `expires_at`.
- `200` — replay of the same key/details (`Idempotency-Replayed: true`).
- `409` — the key was reused with different invoice/gateway/amount.
- `400` — invalid amount, cancelled/paid invoice, or missing header.
- `404` — invoice not visible to the caller (no enumeration).

### `GET /finance/payment-intents/` · `GET /finance/payment-intents/{uuid}/`

List or poll a checkout session. Students/parents only see intents they created
for invoices they can access.

### `POST /finance/payment-intents/{uuid}/sandbox-confirm/`

Sandbox only (`403` when `PAYMENT_SANDBOX=False`).

```json
{ "outcome": "succeeded", "payer_reference": "01712345678" }
```

`outcome` ∈ `succeeded | failed`. Success atomically creates the ledger
`Payment`, recalculates the invoice and returns the intent with `payment`.
Declining leaves the invoice untouched. Re-confirming a settled intent is
idempotent and cannot double-charge.

### `POST /finance/payment-intents/{uuid}/cancel/`

Cancels a pending intent. Any later confirmation returns `409`.

### `POST /finance/payment-webhook/{gateway}/`

Public (no JWT). Required headers:

| Header | Meaning |
|---|---|
| `X-Payment-Signature` | `HMAC-SHA256(PAYMENT_WEBHOOK_SECRET, raw_body)` hex (optionally `sha256=` prefixed) |
| `X-Payment-Timestamp` | Unix seconds; rejected outside `PAYMENT_WEBHOOK_TOLERANCE_SECONDS` (default 300) |

```json
{
  "event_id": "evt_001",
  "event_type": "payment.succeeded",
  "intent": "<intent uuid>",
  "status": "succeeded",
  "amount": "250.00",
  "currency": "BDT",
  "provider_reference": "TRX-998877",
  "payer_reference": "01712345678"
}
```

- `200 processed` — settled (or marked failed for `status: failed`).
- `200 duplicate` — `event_id` already processed; no second payment.
- `200 ignored` — unknown intent or non-actionable status.
- `400` — malformed payload, missing amount, or amount/currency mismatch.
- `401` — bad signature or stale timestamp. `503` if payments are disabled or
  the secret is unset.

### Security properties

- Amounts are server-calculated and capped by the invoice balance.
- Invoice rows are locked during creation and settlement.
- Idempotency is unique per `(user, key)`.
- Webhooks are HMAC-verified over the raw body, timestamp-bounded and
  deduplicated by `(gateway, event_id)`.
- Only masked payer references (`*******5678`) and provider references are kept;
  card numbers, PINs, OTPs and wallet passwords are never stored.
- Both create and webhook endpoints are rate-limited (`payment_intent`,
  `payment_webhook` scopes).

---

## Communication — Announcements

| Endpoint | Notes |
|---|---|
| `/announcements/` | List (scoped by audience) + create |
| `GET /announcements/unread-count/` | Unread count for the current user |
| `POST /announcements/{uuid}/read/` | Mark one as read |
| `POST /announcements/mark-all-read/` | Mark all visible as read |

### Create (Admin/Teacher)

`POST /announcements/`

```json
{
  "title": "Parent teacher meeting",
  "body": "Friday at 10:00.",
  "audience": "all"
}
```

`audience` ∈ `all | students | parents | teachers | class`. Teachers may only
post `students`/audience-of-their-class; students and parents cannot post.
Expired announcements (`expires_at`) are hidden for non-admins.

---

## Dashboard

- `GET /dashboard/overview/` — role-aware tiles (students, finance, attendance,
  recently admitted, upcoming exams, latest announcements).
- `GET /dashboard/search/?q=` — global search scoped to the user's permissions.
- `GET /health/` — liveness probe (`{ "status": "ok" }`).

---

## Management commands

| Command | Purpose |
|---|---|
| `python manage.py create_initial_roles` | Seed the 5 system roles + permissions |
| `python manage.py seed_demo_data` | Seed a demo school, users and data |

---

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@school.example` | `Admin@12345` |
| Teacher | `teacher@school.example` | `Teacher@12345` |
| Accountant | `accountant@school.example` | `Account@12345` |
| Student | `student@school.example` | `Student@12345` |
| Parent | `parent@school.example` | `Parent@12345` |
