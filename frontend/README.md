# School ERP — Frontend

React 18 + Vite 5 single-page management console for the School ERP API.

## Stack

- **React 18** with `react-router-dom` v6
- **Vite 5** build tool
- **lucide-react** icons
- Plain CSS design system (no UI framework) with light/dark theming
- Dependency-free custom SVG charts

## Structure

```
src/
├── App.jsx               # route table + RequireAuth / RequireRole guards
├── main.jsx              # providers (Auth, Toast) + router
├── context/
│   ├── AuthContext.jsx   # current user, login/logout, token lifecycle
│   └── ToastContext.jsx  # toast notifications
├── lib/
│   ├── api.js            # fetch wrapper, in-memory access token,
│   │                     # single-flight refresh via HttpOnly cookie
│   ├── constants.js      # labels/options (statuses, grades, audiences)
│   ├── format.js         # currency/date/number/initials helpers
│   ├── hooks.js          # data-fetching hooks
│   ├── theme.js          # light/dark theme
│   └── usePageTitle.js   # per-page document.title
├── components/
│   ├── Layout.jsx        # sidebar + topbar shell
│   ├── ui.jsx            # buttons, cards, tables, badges, inputs, modals
│   └── charts.jsx        # SVG line / donut / bar charts
└── pages/                # 28 page modules (list, detail and workspace screens)
```

## Information architecture

The app uses a grouped sidebar and a list → detail/workspace pattern. Modals
are limited to short create/edit forms; records with history or several
actions have a dedicated URL.

| Area | Routes |
|---|---|
| Overview | `/` |
| People | `/students`, `/students/:uuid`, `/teachers`, `/users`, `/users/:uuid`, `/roles` |
| Academics | `/classes`, `/sections`, `/subjects`, `/subjects/assignments`, `/timetable` |
| Attendance | `/attendance`, `/attendance/records` |
| Examinations | `/exams`, `/exams/:uuid`, `/exams/:uuid/analytics`, `/exams/:uuid/papers/:paperUuid`, `/results` |
| Finance | `/invoices`, `/invoices/:uuid`, `/payments`, `/fees`, `/fees/categories`, `/checkout/:uuid` |
| Communication | `/announcements` |
| Administration | `/users`, `/roles`, `/audit`, `/profile` |

Related views (Classes/Sections, Subjects/Class subjects, Mark
attendance/Records, Fee structures/Categories, exam Papers/Analytics) are
separate sidebar entries backed by the same page component and URL-driven tabs,
so links, refresh and the back button behave predictably.

## Online fee payments

- Students see **Pay online** on their own unpaid invoices; parents see it on
  linked children's invoices (`pages/Invoices.jsx`).
- `components/OnlinePaymentModal.jsx` loads
  `GET /finance/payment-gateways/`, groups the methods (mobile banking /
  card / bank), lets the payer enter an amount capped at the balance, and
  creates the intent with an `Idempotency-Key`.
- `pages/Checkout.jsx` (`/checkout/:uuid`) runs the sandbox checkout
  (pay / decline / cancel), polls the intent while pending, and shows
  success/failure states. In live mode the browser is redirected to the
  provider's hosted page instead.
- No card numbers, PINs, OTPs or wallet passwords are ever entered in this app;
  amounts are decided server-side.

## Commands

```bash
npm install        # install dependencies
npm run dev        # Vite dev server on http://localhost:5173
npm run build      # production bundle to dist/ (served by Django)
npm run preview    # preview the production build
```

## Auth model

- Access token is kept **in memory only** (`lib/api.js`) and never stored in
  `localStorage`/`sessionStorage`.
- The refresh token is an **HttpOnly cookie** (`school_erp_refresh`) that the
  server sets and the browser sends automatically on `/auth/refresh/`.
- When a request returns `401`, the app calls `/auth/refresh/` **once**
  (single-flight), stores the new access token and retries. If refresh fails it
  dispatches `school-erp:session-expired`, which redirects to `/login`.

## Roles & guards

`RequireRole` wraps routes with allowed roles. Users without access see a
friendly "You do not have access" screen instead of a blank page. The sidebar
and topbar render only the sections a role can use.

## Page titles & audit

Every page sets a descriptive `document.title` via `usePageTitle` so the
browser tab updates on client-side navigation. Admins see an **Audit log**
page (`/audit`) with filters, search, pagination and CSV export of the
append-only `audit.AuditLog` (read-only API at `/api/v1/audit/`).

## Theme toggle

A light/dark theme switcher (Moon/Sun icons) lives in the topbar between the
global search and notifications (`ThemeToggle` in `Layout.jsx`). The choice is
persisted to `localStorage` under `school-erp-theme` and applied before first
paint:

- `src/lib/theme.js` — `initialTheme()` / `setStoredTheme()` helpers and the
  `useTheme` hook (resolves saved theme → system preference → light).
- `frontend/index.html` loads `/theme-init.js` (an external same-origin script,
  CSP-compliant) so `data-theme` is set on `<html>` before the bundle renders,
  preventing any flash of the wrong theme.
- `frontend/public/theme-init.js` is committed and copied into `dist/` by the
  Vite build; `robots.txt` (`Disallow: /`) is also served from `public/`
  via WhiteNoise.

Every design token has a dark counterpart in `styles.css` under
`[data-theme="dark"]`, so both themes stay WCAG AA compliant (contrast fixed at
the token level, `--muted` light `#667085` / dark `#8593b3`).

## Build output

The production bundle in `dist/` is committed and served by Django at `/` via
the SPA fallback, so no separate static host is required. Latest build: CSS
~46 kB (gzip ~10 kB) and JS ~466 kB (gzip ~120 kB).

**Lighthouse audit** — every route scores **100 Accessibility / 100 Best
Practices** with zero failures, in both light and dark themes. SEO is
intentionally not scored because `robots.txt` disallows indexing for this
private console.

---

## 🗺️ Frontend Roadmap / Future Implementation

The following frontend goals are planned for future releases. Details and
priorities are in [`FUTURE_IMPLEMENTATION.md`](../FUTURE_IMPLEMENTATION.md).

### Frontend quality (P3)

| Goal | Current limitation |
|------|-------------------|
| Frontend tests (Vitest + React Testing Library) | No frontend test suite exists |
| End-to-end tests (Playwright) for five role flows | No E2E coverage |
| Loading skeletons | Bare spinners on many pages |
| Responsive verification | Tablet/mobile breakpoints not manually verified |
| Sticky table headers | Long tables scroll without pinned headers |
| Back-to-top button | Long pages lack quick navigation |

### Role-specific UI gaps

| Role | Missing UI |
|------|-----------|
| **Teacher** | Lesson planner, grade book view, parent messaging, leave request, assignment module |
| **Accountant** | Expense module, payroll UI, financial reports (P&L, balance sheet), bulk payment upload, refund workflow |
| **Student** | Assignment submissions, certificate/report card download, attendance certificate request, profile edit request |
| **Parent** | Multi-child unified dashboard, attendance alerts, teacher messaging, meeting booking, leave application, sibling comparison |
| **Admin** | Bulk user import/export, school-wide settings page, system health dashboard, notification templates, waitlist UI |

### New-role UI to add later

| Role | Suggested screens |
|------|-------------------|
| **Librarian** | Book catalog, issue/return, fines, overdue report |
| **Transport Manager** | Routes, vehicles, transport fees, student transport assignment |
| **Hostel Warden** | Room allocation, mess menu, hostel fee tracking |
| **Store Manager** | Stock levels, procurement, asset register |
| **Examination Controller** | Exam calendar, paper moderation, result lockdown controls |
| **Nurse / Medical** | Student health records, vaccination tracker, infirmary log |
| **Counselor** | Counseling session records, student case notes |

### Cross-cutting frontend features

| Feature | Current limitation |
|---------|-------------------|
| PDF / Excel export | No client-side or server-side PDF generation |
| File attachments | Profile images only; no document upload |
| Chat / messaging | No real-time or in-app messaging |
| PWA / mobile app | Responsive web only, no PWA manifest or service worker |
| Multi-language (i18n) | English-only UI strings |
| Two-factor authentication UI | No 2FA setup/verify screens |
| Single sign-on (SSO) | No OAuth/OIDC login buttons |
| Saved filter views | Filters reset on reload |
| Global command palette (⌘K) | No quick navigation/search overlay |
| Dark-mode polish | WCAG AA contrast verified; additional dark refinements possible |

See [`FUTURE_IMPLEMENTATION.md`](../FUTURE_IMPLEMENTATION.md) for the
prioritised backlog and pre-push checklist.
