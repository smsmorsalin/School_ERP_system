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
└── pages/                # 23 route screens (incl. the checkout page)
```

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

## Build output

The production bundle in `dist/` is committed and served by Django at `/` via
the SPA fallback, so no separate static host is required.
