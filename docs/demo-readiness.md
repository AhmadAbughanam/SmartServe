# Demo Readiness Checklist

This checklist is for a staging/demo run of Smart Restaurant OS. It is not a claim of full production readiness.

## Pre-Demo Commands

Run these before a live demo:

```bash
npm install
npm run dev:infra
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run typecheck
npm run test:critical
npm run build:web
```

With the API running, verify health and the seeded API path:

```bash
npm run dev:api
npm run smoke:health
npm run smoke
```

Start the web app:

```bash
npm run dev:web
```

Use `npm run build:api` before CI/staging deploy. On Windows, this can be blocked by the known Prisma query-engine file lock described below.

## Required Environment

Minimum backend variables:

| Variable | Demo value | Notes |
|---|---|---|
| `DATABASE_URL` | Local Postgres from `npm run dev:infra` | Required by API and Prisma |
| `REDIS_URL` | Local Redis from `npm run dev:infra` | Required by API |
| `JWT_SECRET` | Development placeholder is acceptable only locally | Use a strong random secret outside local demo |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:4000` | Must be explicit in production |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | Used by security headers/cookies |
| `PAYMENT_PROVIDER` | `mock` | Demo/staging only; real payments require Stripe config |
| `AI_SERVICE_URL` | `http://localhost:8000` or unset | AI is optional; dashboard falls back if unavailable |
| `GEOFENCING_ENABLED` | `true` | Safe by default because seeded branches keep branch geofencing disabled |
| `GEOFENCING_DEMO_BYPASS` | `false` | Keep disabled unless explicitly demonstrating bypass behavior outside production |

Frontend:

| Variable | Demo value |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:4000` for separate local API, or empty behind Nginx |

Do not commit real `.env`, `.env.production`, provider keys, JWT secrets, or database passwords.

## Seeded Demo Data

The seed script creates known demo accounts. These are for local/demo use only.

| Role | Email | Password |
|---|---|---|
| Owner | `owner@demo.com` | `password123` |
| Cashier | `cashier@demo.com` | `password123` |
| Waiter | `waiter@demo.com` | `password123` |
| Chef | `chef@demo.com` | `password123` |

Seeded branch/table examples:

- `seed-branch-1` / Downtown Branch
- `seed-branch-2` / Waterfront Branch
- Tables `T1` through `T5`

For repeat demos, prefer a table without an active leftover session, or reset and reseed the database.

## Golden Demo Path

1. Open `http://localhost:3000`.
2. Log in as owner at `/admin` with `owner@demo.com` / `password123`.
3. Show branch-aware admin/dashboard data and select `seed-branch-1` when needed.
4. Start a customer table session at `/customer/start?branchId=seed-branch-1&tableCode=T5`.
5. Load the menu, add an available item to cart, and submit the order.
6. Log in to KDS at `/kitchen` with `chef@demo.com` / `password123`.
7. Move the order through kitchen states until it is ready.
8. Log in to waiter at `/waiter` with `waiter@demo.com` / `password123`.
9. Serve the ready order. Inventory decrement runs through the centralized order status transaction.
10. Complete payment through waiter checkout/manual payment or mock customer payment.
11. Return to admin dashboard/analytics to show updated operational data.
12. Open AI/business insights. If AI provider is unavailable, show the fallback message while real analytics still render.

## Automated Coverage Map

| Demo area | Coverage |
|---|---|
| Branch isolation | `npm run test:critical` includes `test:branch-access` |
| Public QR order creation | `test:public-order` |
| Geo-fenced QR session start | `test:geofencing` |
| Payment amount/status safety | `test:payment-safety` and waiter payment checks |
| Inventory decrement on `SERVED` | `test:inventory-transactions` |
| DTO validation | `test:dto-validation` |
| AI output validation/fallback | `test:ai-output-validation`, business insights, demand forecast tests |
| Waiter/KDS handoff | waiter order assignment checks and smoke test |
| API health | `npm run smoke:health` |
| Seeded full API path | `npm run smoke` |

Frontend resilience is primarily verified by `npm run build:web` and manual demo checks; there is not yet a comprehensive frontend unit-test suite.

## Fallback Plan

### AI unavailable

The API health endpoint may report `status: degraded` when AI is down. Core operations still work. Business insights and demand forecasting should return computed analytics with an AI fallback message.

### Payment provider unavailable

Use `PAYMENT_PROVIDER=mock` for demo/staging. Do not use mock provider for real customer payments. For a live payment-provider demo, configure Stripe keys and webhook signing in a staging account.

### Seeded table already active

Use another seeded table, clear the table from the waiter/admin flow, or reset/reseed the database before the demo.

### Location permission denied

Seeded demo branches have branch geofencing disabled, so the golden path does not require browser location. If you enable it for a demo branch, set branch latitude/longitude and use a mock or real location inside the configured radius.

### Windows Prisma EPERM

On Windows, `prisma generate` or `npm run build:api` can fail with `EPERM` while renaming `query_engine-windows.dll.node`. Stop running Node/API/Prisma processes, then rerun:

```bash
npm run prisma:generate
npm run build:api
```

The GitHub Actions CI runs on Ubuntu and is not expected to hit this Windows file-locking issue.

## Reviewer Talking Points

- Tenant and branch access are centralized through `BranchAccessService`; frontend permissions are only UX hints.
- Public QR ordering derives tenant, branch, table/session, source, prices, and totals from trusted backend/database records.
- Geo-fencing is backend-enforced for public QR/table session start; the browser only provides coordinates.
- Payment intents, manual payments, and webhooks use server-side amount validation and trusted provider/manual rules.
- Inventory decrements when an order becomes `SERVED`, inside the same transaction as status history and movement logs.
- AI features compute real analytics first, then use AI only for explanation/wording with output validation and fallback.
- `npm run test:critical` covers the core business/security paths that would break a SaaS demo or leak data.

## Risks To Disclose

- Staff/customer tokens are still stored in browser storage in parts of the frontend; migrate fully to httpOnly cookie/session patterns for production.
- `PAYMENT_PROVIDER=mock` is demo/staging only. Real payments require a configured provider, webhook endpoint, and operational reconciliation.
- Inventory is checked at order creation and decremented at `SERVED`; there is no reservation system yet, so stock can change between those events.
- Frontend automated coverage is lighter than backend critical coverage.
- AI provider outputs are validated and optional, but provider latency/availability still affects summary freshness.
- Seeded accounts use known passwords and must never be present in real production data.
- Geo-fencing is a location friction control only. Browser GPS can be spoofed or inaccurate indoors.
