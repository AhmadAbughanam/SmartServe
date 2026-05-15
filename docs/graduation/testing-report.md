# Testing Report

Last updated: 2026-04-22

## Summary

| Metric | Value |
|---|---|
| TypeScript typecheck | Pass (API + Web + shared-types, zero errors) |
| Next.js production build | Pass (28 routes compiled) |
| API smoke tests | 15/15 pass |
| E2E tests (Playwright) | 24/24 pass |
| Test files | 14 E2E spec files + 1 smoke test |
| Test framework | Playwright 1.59 (Chromium) |

---

## TypeScript Typecheck

```bash
npm run typecheck
```

All three workspaces checked:
- `@smart-restaurant/api` — zero errors
- `@smart-restaurant/web` — zero errors
- `@smart-restaurant/shared-types` — zero errors

---

## Production Build

```bash
npm run build --workspace @smart-restaurant/web
```

Next.js compiles 28 routes successfully:
- Static pages (prerendered at build time)
- Dynamic pages (server-rendered on demand)
- Standalone output generated for Docker deployment

---

## API Smoke Tests (15 tests)

```bash
npm run smoke
```

| # | Test | Validates |
|---|---|---|
| 1 | GET /api/health | API running, DB + Redis connected |
| 2 | POST /api/auth/staff/login (valid) | Staff authentication works |
| 3 | POST /api/auth/staff/login (invalid) | Rejects wrong password (401) |
| 4 | GET /api/auth/me (no token) | Rejects unauthenticated (401) |
| 5 | GET /api/auth/me (valid token) | Returns staff profile |
| 6 | POST /api/auth/customer/otp/request | OTP generation works |
| 7 | GET /api/menu | Menu categories returned |
| 8 | POST /api/sessions/start | Session creation works |
| 9 | POST /api/sessions/:id/orders | Order placement works |
| 10 | GET /api/sessions/:sid/orders/:oid | Order retrieval works |
| 11 | GET /api/kds/orders (chef token) | KDS queue accessible |
| 12 | POST /api/sessions/:id/service-requests | Service request creation |
| 13 | GET /api/analytics/dashboard (no auth) | Rejects unauthenticated |
| 14 | GET /api/analytics/dashboard (owner) | Dashboard data returned |
| 15 | GET /api/ai/recommendations | AI recommendations work |

---

## E2E Tests (24 tests)

```bash
npm run e2e
```

Runs in Chromium, single worker, sequential execution. Auth tokens are file-cached to avoid rate limiting across runs.

### Test Files and Coverage

| File | Tests | What It Covers |
|---|---|---|
| `00-login-form.spec.ts` | 1 | Admin browser login form -> dashboard redirect |
| `01-home.spec.ts` | 2 | Home page surface cards, customer link navigation |
| `02-customer-order.spec.ts` | 1 | Full customer flow: start session -> browse menu -> add to cart -> place order |
| `03-kds.spec.ts` | 2 | Chef views KDS queue; waiter can view KDS (permission check) |
| `04-waiter.spec.ts` | 2 | Waiter dashboard loads with tables; unauthenticated redirect |
| `05-admin-pos.spec.ts` | 3 | Owner dashboard analytics; POS order creation; chef denied admin (RBAC) |
| `06-admin-pages.spec.ts` | 5 | Menu, staff, analytics, inventory, promotions pages load |
| `07-customer-otp.spec.ts` | 1 | Customer OTP: request code -> extract from dev box -> verify -> redirect |
| `08-payment-flow.spec.ts` | 1 | Mock payment: create order -> pay online -> simulate success -> verify PAID |
| `09-kds-actions.spec.ts` | 1 | KDS item actions: start order -> fire item -> mark done |
| `10-waiter-actions.spec.ts` | 1 | Service request: create via API -> waiter claims -> completes |
| `11-inventory.spec.ts` | 1 | Create inventory item -> adjust stock |
| `12-promotions.spec.ts` | 1 | Create discount -> create coupon linked to discount |
| `13-mobile.spec.ts` | 2 | Mobile viewport (390x844): customer start + waiter dashboard |

### Flows Covered by E2E

- Admin login (browser form)
- Customer ordering (session -> menu -> cart -> order)
- Customer OTP login (request -> verify -> redirect)
- Mock online payment (intent -> gateway -> simulate -> verify)
- KDS viewing (chef + waiter permissions)
- KDS actions (start, fire, ready)
- Waiter dashboard loading
- Waiter service request claim/complete
- Admin page navigation (5 pages)
- POS order creation
- RBAC enforcement (chef denied admin)
- Inventory CRUD
- Promotions CRUD (discount + coupon)
- Mobile viewport rendering

### Flows NOT Covered by E2E

- Stripe live payment flow (mock gateway tested instead)
- Split payment creation
- Gift card creation/redemption
- Shift open/close and till reconciliation
- Staff CRUD operations
- KDS 86, undo, waste recording
- Waiter payment confirmation (cash/terminal)
- Waiter quick-add and table clear
- Multi-branch summary and branch switching
- Device management
- Reviews and issue tags
- Notification endpoints
- Analytics chart data accuracy
- SSE real-time event streams
- Multiple concurrent sessions
- Cart edge cases (empty cart, quantity limits)
- Coupon validation at checkout
- AI chatbot conversation
- Nginx reverse proxy routing
- Docker production deployment

### Coverage Notes for Newer Features

Several features added in Spec Completion Phases 7-8B have backend functional audits (scripted API tests run during development) but no Playwright E2E tests:

- **KDS 86/undo/waste**: Verified via functional audit (15 KDS flows, 0 failures)
- **Waiter payment confirmation**: Verified via functional audit (20 waiter flows, 0 failures)
- **Inventory auto-decrement**: Verified via functional audit
- **Multi-branch summary**: Verified via smoke-level API testing
- **Stripe gateway**: Code-level integration; requires `STRIPE_SECRET_KEY` for live testing
- **Split payments**: Backend API verified; frontend MVP exists

---

## Test Infrastructure

### Auth Strategy

To avoid exhausting the staff login rate limit (10 req/60s) across 24 tests:

1. **File-cached tokens**: `getStaffAuth(email)` logs in once via API and caches the token to `.e2e-auth-cache.json` with a 1-hour TTL.
2. **localStorage injection**: `injectStaffAuth(page, email)` navigates to the origin and injects the token into localStorage, avoiding browser-form login API calls.
3. **Single browser login**: Only `00-login-form.spec.ts` uses the actual login form. All other tests use injected auth.

### Test Helpers

Located in `e2e/helpers.ts`:
- `getStaffAuth(email)` — cached API login
- `injectStaffAuth(page, email)` — localStorage token injection
- `createTestOrder(tableCode)` — reset tables + create session + order via API
- `resetTablesAndSessions()` — end active sessions, clean tables
- `apiPost`, `apiGet`, `apiPatch` — direct API call utilities

---

## How to Run Tests

### Prerequisites

- Docker containers running (`npm run dev:infra`)
- API running (`npm run dev:api`)
- Web running (`npm run dev:web` — for E2E only)
- Database seeded (`npm run seed`)

### Commands

```bash
# Typecheck only
npm run typecheck

# Smoke test (API only, no frontend needed)
npm run smoke

# E2E tests (requires all services running)
npm run e2e

# E2E with Playwright UI (debug mode)
npm run e2e:ui

# Full verification suite
npm run test:all
```

---

## Known Test Limitations

1. **Table state leakage**: E2E tests that create sessions leave tables in OCCUPIED/CLEANING state. Subsequent smoke test runs may fail on session creation until tables are reset (re-seed or run E2E test helpers).

2. **Rate limiting**: If the auth cache file is deleted, the first E2E run makes ~4 login API calls. Running E2E more than 2-3 times within a minute could hit the rate limit. The cache file prevents this in normal operation.

3. **No parallel execution**: Tests run sequentially (1 worker) because they share database state. Parallel execution would cause ordering conflicts.

4. **AI service optional**: Smoke test passes with AI service unavailable (health reports "degraded"). AI recommendation test uses the API's built-in fallback.

5. **Windows-specific**: Tests verified on Windows 11 with Git Bash. Playwright uses Chromium. No cross-browser testing (Firefox, WebKit).

6. **Newer features lack E2E**: Features from Phases 7-8B (KDS 86/undo/waste, waiter payment confirm, inventory auto-decrement, multi-branch, devices) were verified through functional audits but do not have Playwright E2E test files.
