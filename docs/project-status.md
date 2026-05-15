# Project Status — Smart Restaurant OS

Last updated: 2026-05-12

## Architecture

```
+--------------+     +--------------+     +--------------+
|   Next.js    |---->|   NestJS     |---->| PostgreSQL   |
|   Frontend   |     |   API        |     | + Redis      |
|   :3000      |     |   :4000      |     | :5435/:6380  |
+--------------+     +------+-------+     +--------------+
                            |
                     +------v-------+
                     |  FastAPI AI  |  (optional)
                     |   :8000      |
                     +--------------+
```

## Backend Modules (24 controllers)

| Module | Endpoints | Auth | Status |
|--------|-----------|------|--------|
| Health | 1 | Public | Real DB/Redis/AI checks |
| Staff Auth | 3 | Public/JWT | JWT + bcrypt |
| Customer Auth | 5 | Public/JWT | OTP + refresh tokens |
| Tables | 3 | Staff | Status transitions |
| Table Access | 1 | Public | QR/NFC code resolution |
| Sessions | 4 | Mixed | Lifecycle management |
| Menu | 6 | Mixed | Categories/items/additions |
| Orders | 4 | Mixed | Price calc, idempotency, auto-inventory-decrement |
| KDS | 9 | Staff | Queue, item status, 86, undo, waste/remake |
| Waiter | 7 | Staff | Floor view, serve, clear, quick-add, payment confirm |
| Payments | 9 | Mixed | Stripe + mock gateway, split payments, refunds |
| POS | 2 | Staff | Staff order creation |
| Shifts/Tills | 9 | Staff | Attendance, till reconciliation |
| Service Requests | 7 | Mixed | Claim/complete lifecycle |
| Admin | 33 | Staff | Tenant/branch/staff/roles/tax/expenses/tables/orders/finance/settings |
| Analytics | 10 | Staff | Dashboard, sales, menu perf, insights, snapshots |
| Inventory | 9 | Staff | CRUD, adjust, mapping, low-stock, auto-decrement |
| Promotions | 14 | Staff | Discounts/coupons/gift cards with redemption tracking |
| AI | 5 | Mixed | Recommendations + chatbot |
| Realtime | 2 | Public | SSE for branch/session events |
| Notifications | 4 | Staff | Persistent notifications with read tracking |
| Reviews | 2 | Mixed | Order reviews with issue tags + item ratings |
| Devices | 4 | Staff | Branch device provisioning (KDS/POS/WAITER) |
| Branch Settings | 2 | Staff | Per-branch configuration |

**Total: ~155 API endpoints (153 REST + 2 SSE)**

## Frontend Routes (28)

| Surface | Routes | Purpose |
|---------|--------|---------|
| Home | 1 | Demo hub with credentials |
| Customer | 8 | Login, start, menu, cart, order tracking, payment success/cancel |
| Kitchen | 3 | Login, home, KDS queue (multi-lane) |
| Waiter | 3 | Login, home, dashboard (floor map + feed) |
| Admin | 13 | Login, dashboard, POS, menu, inventory, promotions, staff, analytics, shifts, devices, finance, settings |

## Seed Data

- 1 tenant, 2 branches (Downtown Branch, Waterfront Branch), 5 tables (T1-T5)
- 5 staff: owner, cashier, waiter, chef, manager
- 4 roles with 41 permissions
- 5 menu items, 3 additions, 3 categories
- 2 tax rules, 4 inventory items, 4 menu-inventory mappings

## Database Schema

- **51 models**: Full domain coverage from Tenant/Branch through WasteRecord and RecommendationStat
- **29 enums**: Status types, role codes, payment methods, waste reasons, device types, etc.
- Multi-tenant: every operational entity scoped by `tenantId` and `branchId`

## Payment Status

| Area | Status | Notes |
|------|--------|-------|
| Payment adapter pattern | Complete | Provider-agnostic interface |
| Mock gateway | Complete | For development and testing |
| Stripe gateway | Complete | Checkout Sessions, webhook with HMAC-SHA256 verification |
| Split payments | Complete | BY_PEOPLE, BY_ITEMS, BY_AMOUNT with preview endpoint |
| Refunds | Complete | Backend API with audit logging |
| Waiter payment confirmation | Complete | Cash and terminal confirmation endpoints |

Stripe activation requires setting `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` environment variables.

## Multi-Branch Status

| Feature | Status | Notes |
|---------|--------|-------|
| Branch scoping on all queries | Complete | Via JWT tenantId/branchId |
| Multi-branch summary endpoint | Complete | Tenant-wide totals + per-branch KPIs |
| Admin branch selector | Complete | Dropdown for OWNER/MANAGER roles |
| Branch context propagation | Complete | React Context (useAdminBranch) to child pages |
| Second seeded branch | Complete | Waterfront Branch (seed-branch-2) |
| Device management per branch | Complete | Register/manage KDS, POS, WAITER devices |
| Branch settings | Complete | Per-branch configuration endpoint |
| Geo-fencing | MVP | Branch-level customer QR/table session start enforcement |

## Security Status

| Area | Current | Production Requirement |
|------|---------|----------------------|
| Staff auth | JWT in localStorage | httpOnly cookies + CSRF |
| Customer auth | JWT in localStorage | httpOnly cookies |
| OTP delivery | Dev-mode response only | SMS provider (Twilio/etc) |
| Payments | Stripe adapter ready | Configure live Stripe keys |
| SSE | Public endpoints | Staff auth on branch events |
| Geo-fencing | Backend-enforced for QR session start | Add admin UI and staff/payment action rollout before broad production use |
| HTTPS | Not enforced | Required in production |
| PCI | No card data stored | Maintain — Stripe handles cards |
| Rate limiting | Throttler on auth endpoints | Verify limits under load |
| CORS | `origin: true` (dev) | Whitelist specific origins |

## Automated Verification

- **Smoke test**: 16-point API test covering health, auth, menu, sessions, orders, KDS, analytics, AI
- **TypeScript**: All 3 workspaces pass `tsc --noEmit`
- **Build**: 28 frontend routes build successfully
- **E2E**: 24 Playwright tests covering customer ordering, OTP, payments, KDS actions, waiter, admin, mobile viewport

## Remaining Out-of-Scope Items

These items are intentionally excluded from the graduation scope. The architecture supports adding them as future modules:

- **Loyalty & CRM**: Points ledger, tiers, rewards redemption
- **Online Ordering & Call Center**: External order intake, delivery routing
- **Marketplace & Integrations**: Delivery aggregators, accounting software
- **Customer Display Screen (CDS)**: Customer-facing secondary display
- **Supplier Management**: Purchase orders, supplier catalog
- **Advanced ML/Forecasting**: Trained models for demand prediction (rule-based recommendations are implemented)
- **Geo-Fencing Admin UI / Advanced Rules**: MVP backend enforcement exists for QR/table session start; full rule management UI and staff/payment action rollout remain future work
- **Reservation System**: Table booking with time slots
- **Receipt Generation**: PDF/thermal receipt output
- **CI/CD Pipeline**: Automated deployment (GitHub Actions CI config exists for typecheck/build)

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| localStorage tokens stolen via XSS | High | Migrate to httpOnly cookies; add CSP headers |
| OTP codes visible in dev response | Medium | Gated behind `NODE_ENV=development`; never in production |
| No HTTPS in dev | Low | Enforce HTTPS in production reverse proxy |
| SSE leaks branch events to unauthenticated users | Medium | Data is operational only; add auth before production |
| Rate limits too generous | Low | Monitor and tune per deployment |
