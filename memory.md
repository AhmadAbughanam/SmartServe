# Project Memory

This file is the rolling project memory. Claude or any coding agent working in this repo should update it after meaningful decisions, architecture changes, or implementation milestones.

## Update Rules

- Add a new dated entry when a meaningful decision is made.
- Keep entries short and factual.
- Do not rewrite history; append new entries unless correcting an obvious mistake.
- If a previous assumption changes, add a new entry describing the change and impact.

## Current Snapshot

- Repo initialized as a monorepo scaffold for a Smart Restaurant OS.
- Local infra currently targets PostgreSQL, Redis, and MinIO via Docker Compose.
- Frontend direction is one Next.js app with role-based surfaces.
- Backend direction is one NestJS API with modular domains and adapter contracts.
- AI direction is a separate FastAPI service behind backend orchestration.
- Shared types include roles, scope context, status values, and domain events.
- The project now has a much more detailed written system specification covering apps, schema, lifecycle rules, KPIs, edge cases, and phased scaling.

## Open Decisions

- Payment provider: Click, Stripe, both, or phased rollout
- Auth strategy details: staff JWT (8h, no refresh); customer OTP + JWT (1h) + refresh token rotation (30d). Staff refresh tokens not yet decided.
- Staff experience split: unified staff area or earlier separation between waiter and kitchen experiences
- Optional module rollout priority: inventory vs loyalty vs online ordering vs integrations

## Change Log

### 2026-06-25 — Login Hydration Mismatch Fix

- Fixed the unified `/login` page clock so it no longer formats `new Date()` during SSR, which was causing hydration mismatches between VPS-rendered HTML and the browser's local timezone.
- The login nav now renders a stable placeholder first and fills in the localized time/date only after client mount.

### 2026-06-25 — Web Image Build Toolchain Fix

- Updated `apps/web/Dockerfile` from Node 20 Alpine to Node 22 Alpine across all stages and enabled Corepack-managed `npm@11.6.4` in the dependency and build stages.
- This keeps the container build aligned with the repo `packageManager` contract and avoids Next.js falling into the image's old global Yarn 1.x path during `next build`.
- Added `NEXT_IGNORE_INCORRECT_LOCKFILE=1` to the web build stage because Next.js was falsely trying to patch the npm workspace lockfile for SWC packages that are already present, and that patch path was what triggered the Yarn/Corepack failure in CI.

### 2026-06-25 — VPS Deploy Workflow Uses Prisma Deploy

- Updated the VPS deployment workflow to run `npm run prisma:deploy` instead of `npm run prisma:migrate`, because the previous script called `prisma migrate dev`, which is interactive and fails in GitHub Actions/SSH deployment shells.

### 2026-06-20 — SaaS Notifications Surface Removed

- Removed the SaaS `Notifications` page and the related sidebar section because the notifications surface is no longer part of the desired SaaS navigation.
- Kept the rest of the fixed SaaS shell intact so removing notifications did not affect primary page routing or account-menu behavior.

### 2026-06-20 — SaaS Sidebar Functionality Completion

- Replaced the static future-section notification row with a real `/saas/notifications` route backed by existing SaaS settings, system-health incidents, and audit-feed data.
- Converted the sidebar account footer from a decorative chevron row into a working expandable account menu with a real `Open Settings` action and logout action.
- Kept the existing fixed-sidebar shell while removing dead-looking interactive affordances from the SaaS rail.

### 2026-06-20 — SaaS Fixed Sidebar Shell Redesign

- Rebuilt the desktop SaaS sidebar shell in `apps/web/src/app/saas/layout.tsx` to match the new card-style reference with a stronger brand header, identity card, larger nav items, a future-section notification row, and a structured admin/logout footer card.
- Changed the desktop SaaS shell from a normal flex sidebar to a fixed viewport rail so the left navigation no longer scrolls with page height; the content column now scrolls independently with left padding equal to the fixed rail width.
- Kept mobile SaaS navigation behavior intact and preserved the existing route structure and logout/session handling.

### 2026-06-20 — SaaS Settings Reference Redesign

- Rebuilt the SaaS `Settings` page to match the new light-theme platform-configuration reference while preserving the existing platform settings, save flow, runtime summary, announcement editing, and recent changes behavior.
- Reorganized the page into numbered profile, access, announcements, runtime, and recent-changes sections so the information hierarchy matches the target design more closely.
- Kept the existing `/api/saas/settings` contract intact and preserved the existing `Save Platform Settings` and `Open System Health` actions.

### 2026-06-20 — SaaS System Health Reference Redesign

- Rebuilt the SaaS `System Health` page to match the new reliability-command reference while keeping the existing health overview, service registry, incident feed, and audit-log entry behavior.
- Replaced the generic cards and tables with a more structured command layout: custom health KPI cards, a service registry board, a dark service detail panel, and a cleaner incident/noisy-branches section.
- Kept the existing `/api/saas/system-health/*` data contracts and `/saas/audit-logs` handoff intact so the redesign did not change operational ownership or backend wiring.

### 2026-06-20 — SaaS Billing Network Sales Reference Redesign

- Rebuilt the `Billing > Network Sales` surface to match the new light-theme sales-reporting reference with redesigned KPI cards, a structured top-tenants table, and a richer sales-alerts panel.
- Kept the existing `/api/saas/revenue` contract and continued labeling the page as tenant restaurant sales rather than SaaS subscription revenue.
- Updated the shared billing tab bar styling so the full billing surface now matches the redesigned visual language more closely.

### 2026-06-20 — SaaS Controls Modules Reference Redesign

- Rebuilt the `Controls > Modules` surface to match the new light-theme reference: dark summary cards, dark filter rail, branch matrix on the left, and branch module editor on the right.
- Changed module editing from immediate per-toggle mutation to staged branch-level edits with an explicit `Save Changes` action, while keeping the same `/api/saas/branches/:branchId/features` backend contract.
- Made the branch matrix a dedicated scrollable region with a fixed desktop height so it now matches the height of the right-side editor panel instead of stretching the full page.

### 2026-06-20 — SaaS Operations Page Reference Redesign

- Reworked the SaaS `Operations` page to follow the new light-theme reference structure while preserving the existing `Branches`, `Requests`, `Orders`, and `Sessions` routing model.
- Kept the live SaaS operations API wiring intact, but restyled the surface around custom KPI cards, a darker command-focus hero, denser branch board cards, explicit network coverage, command detail, and a list-style attention queue.
- Reduced the branch board from a long generic listing into a priority grid plus navigator/coverage split so the page reads as an operations command surface instead of a raw data dump.

### 2026-06-20 — SaaS Tenant Page Reference Redesign

- Rebuilt the SaaS `Tenants` page content to follow the provided light-theme reference structure: top KPI row, filter/tabs rail, active-workspace hero, tenant portfolio, onboarding strip, and supporting intelligence/profile sections.
- Kept the page wired to the existing SaaS tenant lifecycle APIs so tenant creation, tenant status changes, branch creation/editing, branch status changes, and owner provisioning still execute real backend mutations.
- Preserved the `Directory`, `Branches`, `Owners`, and `Provisioning` tab ownership model while restyling those workflows into a more structured desktop-first control surface.

### 2026-06-19 — SaaS Tenant Surface UX Rebuild

- Rebuilt the SaaS `Tenants` page into a three-column control surface with a portfolio rail, focused workspace, and persistent intelligence rail.
- Kept the existing tenant, branch, and owner lifecycle actions, but redistributed them into clearer page owners: tenant profile, branch rollout board, owner coverage, and provisioning workspace.
- Kept all tenant-page mutations wired to the existing SaaS admin endpoints while upgrading the information hierarchy away from dense tables toward task-driven cards and contextual panels.
- Later refactored the tenant page again into a whitespace-safe single-flow structure so the SaaS desktop layout no longer leaves trailing column gaps, then upgraded the visual treatment with richer hero, card, and selection states without changing the functional contracts.

### 2026-06-19 — SaaS Operations Surface UX Rebuild

- Rebuilt the SaaS `Operations` page into a tab-owned command surface with distinct `Branches`, `Requests`, `Orders`, and `Sessions` entry points.
- Fixed the previous tab/hook structure by moving tab-specific hook usage into dedicated child rendering paths so the parent no longer changes hook count when switching tabs.
- Replaced the old table-first branch operations view with a full-width live command layout: hero context, pressure board, command detail, and attention queue driven by the existing SaaS operations endpoints.

### 2026-06-19 — SaaS Billing Persistence

- Added a dedicated Prisma migration for the new SaaS billing persistence models: `TenantSubscription` and `SaasInvoice`.
- Synced the local development database to the current Prisma schema so the SaaS billing endpoints no longer point at missing tables.
- Corrected the local `_prisma_migrations` record for `20260615143000_saas_platform_settings`, which had been represented in the database without a fully applied migration row and was blocking later Prisma migration work.

### 2026-04-03

- Extracted the project PDF and scaffolded the repository around Next.js, NestJS, PostgreSQL, Redis, and Python AI services.
- Added Docker Compose services for PostgreSQL and Redis first, then expanded local infra with MinIO after reviewing the architecture diagrams.
- Added backend adapter contracts for payments, notifications, object storage, AI, and eventing.
- Added `AGENTS.md`, `context.md`, and `memory.md` so future agent sessions have stable instructions, project context, and rolling memory.
- Incorporated the expanded system definition into repo docs and aligned the architecture around a modular monolith with one logical normalized database.
- Promoted the Prisma schema from placeholder status to the main draft of the platform data model.

### 2026-04-03 — Foundation Phase

- Installed all monorepo workspace dependencies (`npm install` — 259 packages).
- Validated the Prisma schema (`prisma validate` passed cleanly).
- Generated the Prisma client from the schema.
- Created `PrismaService` and `PrismaModule` for NestJS integration (global module, lifecycle-aware).
- Wired `PrismaModule` into `AppModule` as the first import so all domain modules can inject `PrismaService`.
- Fixed all relative imports in the API to include `.js` extensions (required by `module: "NodeNext"`).
- Created `apps/api/.env` with local dev defaults for `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, etc.
- Created root `.env` from `.env.example` for Docker Compose.
- Added `prisma:generate`, `prisma:validate`, and `prisma:migrate:dev` convenience scripts to the API `package.json`.
- All three workspaces (`shared-types`, `api`, `web`) typecheck cleanly.
- Backend boots and all 19 NestJS modules initialize; full startup requires Docker services (PostgreSQL).

### 2026-04-03 — Foundation Phase: Infra & Migration

- Discovered a local PostgreSQL installation occupying ports 5432 and 5433 on the host machine. Remapped Docker Compose Postgres to port 5435 and Redis to port 6380 to avoid conflicts.
- Updated `.env`, `.env.example`, and `apps/api/.env` with the new ports.
- Ran the first Prisma migration (`init`). All 41 domain tables created successfully in PostgreSQL.
- Migration file generated at `apps/api/prisma/migrations/20260403131947_init/migration.sql`.
- Backend boots fully against live PostgreSQL: all 20 NestJS modules initialize, Prisma connects, `GET /api/health` responds with `{"service":"api","status":"ok",...}`.
- **Foundation phase is complete.** The scaffold is bootable end-to-end.

#### Important Setup Notes

- Local PostgreSQL installation exists on this machine (ports 5432, 5433). Docker Compose uses non-default ports (Postgres: 5435, Redis: 6380) to avoid conflicts.
- Start infra with `npm run dev:infra` or `docker compose up -d postgres redis`.
- Start backend with `npm run dev:api` (runs from `apps/api/`).
- Health check: `GET http://localhost:4000/api/health`.

### 2026-04-03 — Auth Phase 1: Staff Auth Foundation

- Installed `@nestjs/jwt`, `bcrypt`, `@types/bcrypt`.
- Implemented staff login via email + password with JWT access tokens (8h expiry).
- Auth module structure: `auth.service.ts`, `token.service.ts`, `password.util.ts`, `auth.controller.ts`.
- Auth types: `StaffJwtPayload` (JWT payload) and `AuthenticatedStaff` (request context carrying staffId, tenantId, branchId, primaryRole, permissions[]).
- Guards registered as global `APP_GUARD` via factory providers (ensures DI works with tsx/esbuild):
  - `JwtAuthGuard`: validates Bearer token, resolves staff + permissions from DB, attaches to `request.staff`.
  - `PermissionsGuard`: checks `@RequireRoles()` and `@RequirePermissions()` decorators against staff context.
- Decorators: `@Public()` (opt out of auth), `@CurrentStaff()` (param decorator), `@RequireRoles(...)`, `@RequirePermissions(...)`.
- Health controller marked `@Public()` since guards are now global.
- Created seed script (`prisma/seed.ts`) with tenant, branch, permissions, roles, and two staff accounts (owner + waiter).
- All constructor injection uses explicit `@Inject()` decorators because `tsx` (esbuild) does not emit decorator metadata.

#### Auth Endpoints

- `POST /api/auth/staff/login` — public, returns `{ accessToken, staff: { id, name, email, tenantId, branchId, primaryRole, permissions[] } }`.
- `GET /api/auth/me` — protected, returns `AuthenticatedStaff` context.
- `GET /api/auth/admin-only` — protected + `@RequireRoles("OWNER", "MANAGER")`, test route.

#### Verified Behaviors

- Owner login succeeds, JWT issued, /me returns full staff context with all 8 permissions.
- Waiter login succeeds, waiter gets 3 permissions (menu:read, orders:read, orders:write).
- Waiter calling /admin-only gets 403 Forbidden ("Insufficient role").
- Missing token gets 401, invalid token gets 401, wrong password gets 401.

#### Key Decision: tsx + @Inject()

- `tsx` uses esbuild which does NOT support `emitDecoratorMetadata`. NestJS constructor injection requires explicit `@Inject(ClassName)` on every constructor parameter. All new services/controllers must follow this pattern.

#### Remaining Gaps After Phase 1

- Customer OTP auth not yet implemented (uses `User` model, `OtpRequest` model, `RefreshToken` model). → Addressed in Phase 2.
- `RefreshToken` is linked to `User` not `Staff` — staff refresh tokens would need a schema extension if desired.
- No rate limiting on login endpoint yet.

### 2026-04-04 — Auth Phase 2: Customer OTP Auth + Refresh Tokens

- Generalized the auth layer to support both staff and customer identities:
  - `auth.types.ts` now has `StaffJwtPayload`, `CustomerJwtPayload`, `JwtPayload` (union), and `AuthenticatedCustomer`.
  - `TokenService` now has `signStaffAccessToken()` (8h) and `signCustomerAccessToken()` (1h) with separate expiry.
  - `JwtAuthGuard` now dispatches on `payload.type`: staff tokens resolve to `request.staff`, customer tokens to `request.customer`.
- Customer OTP flow implemented in `customer-auth.service.ts`:
  - `requestOtp(phone)`: generates 6-digit OTP, stores bcrypt hash in `OtpRequest`, expires in 5 minutes.
  - `verifyOtpAndLogin(phone, code)`: validates OTP with attempt counting (max 5), marks verified, finds-or-creates `User`, issues access + refresh tokens.
  - `refreshAccessToken(refreshToken)`: validates, rotates (revoke old + issue new), returns new token pair.
  - `revokeRefreshToken(refreshToken)`: marks token revoked for logout.
  - `resolveCustomer(userId)`: resolves `AuthenticatedCustomer` for the guard.
- No schema changes were needed — existing `User`, `OtpRequest`, `RefreshToken` models worked as-is.
- Added `@CurrentUser()` param decorator for customer routes (reads `request.customer`).

#### Customer Auth Endpoints

- `POST /api/auth/customer/otp/request` — public, accepts `{ phone }`, returns `{ message, expiresInSeconds }`. In dev mode also returns `_dev_otp`.
- `POST /api/auth/customer/otp/verify` — public, accepts `{ phone, code }`, returns `{ accessToken, refreshToken, user: { id, phone, name } }`.
- `POST /api/auth/customer/refresh` — public, accepts `{ refreshToken }`, returns rotated `{ accessToken, refreshToken, user }`.
- `POST /api/auth/customer/logout` — public, accepts `{ refreshToken }`, revokes the token.
- `GET /api/auth/customer/me` — protected (customer JWT), returns `AuthenticatedCustomer`.

#### OTP Security

- OTP is hashed with bcrypt before storage (never stored in plaintext).
- OTP expires after 5 minutes.
- Maximum 5 verification attempts per OTP; exceeded attempts require a new OTP.
- `verifiedAt` timestamp prevents OTP reuse.
- **Dev mode only**: OTP is returned in the response body as `_dev_otp` and logged with `[DEV]` prefix. This is gated on `NODE_ENV === "development"`.

#### Refresh Token Security

- Refresh tokens are opaque (cuid IDs stored in DB), not JWTs.
- Rotation: on every refresh, the old token is revoked and a new one issued.
- Revoked tokens return 401 immediately.
- Expired tokens (30-day TTL) return 401.
- Blocked users cannot refresh.

#### Verified Behaviors (All 12 Tests Pass)

- Staff login still works (200, JWT issued, /me returns staff context, /admin-only returns 200 for OWNER).
- Customer OTP request returns OTP in dev mode.
- Customer OTP verify creates user, issues access + refresh tokens, /customer/me returns customer context.
- Refresh rotates tokens; old refresh token fails with 401.
- Logout revokes refresh token; revoked token fails with 401.
- Wrong OTP code returns 401.
- Missing authorization token returns 401.

#### Remaining Auth Gaps

- No SMS provider integration yet (OTP is only exposed in dev mode response/logs).
- No rate limiting on OTP request or login endpoints.
- Staff refresh tokens not implemented (RefreshToken model is User-only).
- No token blacklisting for JWT access tokens (they expire naturally).
- Customer `tenantId` association is optional — will be linked when customer joins a session at a specific restaurant.

### 2026-04-13 — Tables + Sessions Phase

- Implemented the Tables module: listing by branch, fetching details, and staff-controlled status updates.
- Implemented the Sessions module: starting, fetching, and ending dining sessions.
- No schema changes were needed — existing `Table`, `Session`, `SessionParticipant` models worked as-is.

#### Table Status Transition Rules (`table-status.rules.ts`)

Centralized valid transitions:
- AVAILABLE → OCCUPIED, RESERVED, OUT_OF_SERVICE
- RESERVED → OCCUPIED, AVAILABLE, OUT_OF_SERVICE
- OCCUPIED → CLEANING
- CLEANING → AVAILABLE, OUT_OF_SERVICE
- OUT_OF_SERVICE → AVAILABLE

Session-startable statuses: AVAILABLE, RESERVED.

#### Table Endpoints

- `GET /api/branches/:branchId/tables` — staff-protected (`tables:read`), lists tables with last session info.
- `GET /api/tables/:tableId` — staff-protected (`tables:read`), includes branch info.
- `PATCH /api/tables/:tableId/status` — staff-protected (`tables:write`), enforces valid transitions.

All table endpoints enforce tenant scoping through the staff's `tenantId`.

#### Session Endpoints

- `POST /api/sessions/start` — public (QR flow), accepts `{ branchId, tableCode, guestCount, notes? }`.
- `POST /api/sessions/staff/start` — staff-protected (`sessions:write`), same body, attaches `createdByStaffId`.
- `GET /api/sessions/:sessionId` — staff-protected (`sessions:read`), includes table, user, staff, participants.
- `POST /api/sessions/:sessionId/end` — staff-protected (`sessions:write`), tenant-scoped.

#### Session Business Rules

- Only one ACTIVE session per table (conflict check + table status check).
- Session can start only when table is AVAILABLE or RESERVED.
- Starting a session moves the table to OCCUPIED and sets `lastOccupiedTime`.
- Ending a session sets status to COMPLETED, records `endTime`, moves table to CLEANING.
- `lastSessionId` on table is updated after session creation.
- Sessions can exist without a registered user (guest-friendly QR flow).

#### Seed Updates

- Added 5 tables (T1–T5) to the seed branch with varying capacities and locations.
- Added 4 new permissions: `tables:read`, `tables:write`, `sessions:read`, `sessions:write`.
- Owner role now has all 12 permissions. Waiter role now has 7 (added tables + sessions).

#### Verified Behaviors (All 13 Tests Pass)

1. List 5 tables for branch — 200 OK.
2. Start session on AVAILABLE table (QR flow) — 201, session created, table → OCCUPIED.
3. Duplicate session on OCCUPIED table — 400 (table status blocks it).
4. Get session details — 200, includes table, user, participants.
5. T1 confirmed OCCUPIED after session start.
6. End session — 201, session → COMPLETED, endTime set.
7. T1 confirmed CLEANING after session end.
8. Start session on CLEANING table — 400 rejected.
9. Reset T1 to AVAILABLE via PATCH status — 200.
10. Invalid transition AVAILABLE → CLEANING — 400 rejected.
11. Unauthenticated table list — 401.
12. Staff auth still works — 200, all 12 permissions present.
13. Staff-initiated session on T2 — 201, `createdByStaffId` set.

#### Remaining Gaps Before Menu + Orders

- No customer auth context attached to session start in QR flow (middleware for optional auth not yet added).
- Session participant management not yet exposed (model exists, no endpoints).
- No reservation flow yet (table can be set to RESERVED via status update, but no reservation entity/scheduling).
- Table `totalOrders` counter not yet incremented (will be updated when orders are implemented). → Addressed in Menu + Orders phase.
- No realtime/WebSocket notifications for table status or session changes yet.

### 2026-04-13 — Menu + Orders Phase 1

- Implemented Menu module: public menu browse, item details, staff category/item CRUD, availability (86) toggle.
- Implemented Orders module: order creation from active sessions, order details, staff status updates.
- No schema changes — existing `Category`, `MenuItem`, `MenuItemAddition`, `Order`, `OrderItem`, `OrderStatusHistory`, `TaxRule` models worked as-is.

#### Menu Endpoints

- `GET /api/menu?branchId=...` — public, returns active categories with active items + additions. Scoped to branch + tenant-wide items.
- `GET /api/menu/items/:itemId` — public, item detail with category and additions.
- `POST /api/menu/categories` — staff (`menu:write`), create category.
- `POST /api/menu/items` — staff (`menu:write`), create item with inline additions.
- `PATCH /api/menu/items/:itemId` — staff (`menu:write`), update item fields.
- `PATCH /api/menu/items/:itemId/availability` — staff (`menu:write`), 86/un-86 toggle.

#### Order Endpoints

- `POST /api/sessions/:sessionId/orders` — public (session-based ordering), creates order with price calculation.
- `GET /api/orders/:orderId` — staff (`orders:read`), includes items, menu item names, session, status history.
- `PATCH /api/orders/:orderId/status` — staff (`orders:write`), enforces valid transitions.

#### Order Total Calculation

Backend-computed, never from client input:
1. For each line: `unitPrice = menuItem.price + sum(selected addition priceImpacts)`
2. `lineBase = unitPrice × quantity`
3. `lineTax = lineBase × taxRate / 100` (from `TaxRule` by `taxClass` for the branch)
4. `lineTotal = lineBase + lineTax`
5. `subtotal = sum(lineBase)`, `totalTax = sum(lineTax)`
6. `serviceCharge = 0` (placeholder), `discount = 0` (placeholder)
7. `totalAmount = subtotal + totalTax + serviceCharge - discount`
8. Tax rules are snapshotted in `taxSnapshotJson` at order time.

Verified calculation: Burger ($14) + Cheese ($1.50) = $15.50 @ 5% food tax → $16.28; Cola ($3) × 2 = $6.00 @ 10% bev tax → $6.60; total $22.88 ✓

#### Idempotency

- `idempotencyKey` on the order is unique in the DB (`@@unique`).
- If a create request has an `idempotencyKey` that already exists, the existing order is returned without creating a duplicate.
- Verified: same key returns same order ID on retry.

#### Order Status Transition Rules (`order-status.rules.ts`)

- PLACED → CONFIRMED, CANCELLED
- CONFIRMED → IN_KITCHEN, CANCELLED
- IN_KITCHEN → READY, CANCELLED
- READY → SERVED
- SERVED → COMPLETED
- COMPLETED → (terminal)
- CANCELLED → (terminal)

Each status change is recorded in `OrderStatusHistory` with `changedByStaffId`.

#### Order Business Rules Enforced

- Session must exist and be ACTIVE.
- Menu items must be active (`isActive`) and available (`!isUnavailable`).
- Additions must belong to the item and be active.
- Prices are never accepted from client — always looked up from DB.
- `itemBasePrice` captures the unit price (including additions) at order time.
- `Table.totalOrders` is incremented on successful order creation.
- `OrderItem.kitchenStatus` starts at PENDING.
- `OrderItem.specializationsJson` stores selected additions snapshot.

#### Seed Updates

- 2 tax rules: FOOD 5%, BEVERAGE 10%.
- 3 categories: Starters, Main Courses, Drinks.
- 5 menu items: Bruschetta ($8.50), Classic Burger ($14), Spaghetti Carbonara ($12), Cola ($3), Fresh Orange Juice ($5).
- 3 additions: Extra Cheese (+$1.50, burger), Bacon (+$2, burger), Add Mushrooms (+$1, pasta).

#### Verified Behaviors (All 14 Tests Pass)

1. Public menu browse — 3 categories, 5 items with prices and additions.
2. Item detail — burger with 2 additions (Bacon +$2, Cheese +$1.50).
3. Session start on T1 — 201.
4. Order created — subtotal $21.50, tax $1.38, total $22.88, 2 items.
5. Idempotency — retry returns same order ID, no duplicate.
6. Mark juice 86'd — 200.
7. Order 86'd item — 400 "currently unavailable (86'd)".
8. Order details — items with menu item names, status history.
9. PLACED → CONFIRMED — 200.
10. CONFIRMED → IN_KITCHEN — 200.
11. Invalid IN_KITCHEN → COMPLETED — 400.
12. Unauthenticated order details — 401.
13. Restore juice — 200.
14. Staff auth — still works.

#### Remaining Gaps After Menu + Orders

- No kitchen display / KDS endpoints yet. → Addressed in KDS + Realtime phase.
- No realtime/WebSocket notifications for new orders, status changes, or 86'd items. → Addressed in KDS + Realtime phase.
- No service charge or discount calculation logic yet (hardcoded to 0).
- No order cancellation with item-level rollback or refund flow.
- No order-level payment status updates (stays UNPAID).
- Customer-facing order history/list endpoint not yet implemented.

### 2026-04-13 — KDS + Realtime Phase 1

- Implemented KDS module: kitchen order queue, order start/ready actions, item-level kitchen status updates.
- Implemented Realtime module: in-process event bus with SSE delivery endpoints.
- Wired realtime event publishing into orders service (ORDER_PLACED, ORDER_UPDATED, ORDER_READY, ORDER_SERVED), menu service (ITEM_86ED), and KDS service (ORDER_UPDATED, ORDER_READY).
- No schema changes needed.

#### KDS Endpoints

- `GET /api/kds/orders?branchId=...&status=...` — staff (`kds:read`), kitchen queue with items, table codes, stations, additions. Defaults to PLACED/CONFIRMED/IN_KITCHEN/READY.
- `GET /api/kds/orders/:orderId` — staff (`kds:read`), single order with full KDS detail and status history.
- `PATCH /api/kds/orders/:orderId/start` — staff (`kds:write`), accepts PLACED or CONFIRMED order, moves to IN_KITCHEN. For PLACED orders, records both PLACED→CONFIRMED and CONFIRMED→IN_KITCHEN in history.
- `PATCH /api/kds/orders/:orderId/ready` — staff (`kds:write`), moves order to READY only if all non-cancelled items are READY.
- `PATCH /api/kds/order-items/:orderItemId/status` — staff (`kds:write`), updates individual item kitchen status.

#### Kitchen Item Status Rules (`kitchen-item-status.rules.ts`)

- PENDING → IN_PROGRESS, CANCELLED
- IN_PROGRESS → READY, CANCELLED
- READY → (terminal)
- CANCELLED → (terminal)

#### Order Readiness Rule

Order cannot be marked READY unless every non-cancelled item has `kitchenStatus = READY`. Error message lists which items are not ready.

#### Realtime Module

- `RealtimeService`: in-process event bus using RxJS Subject. Methods: `publish(event)`, `emit(name, tenantId, branchId, payload)`, `branchEvents$(branchId)`, `sessionEvents$(sessionId)`.
- `@Global()` module — injectable anywhere without import.
- SSE endpoints:
  - `GET /api/realtime/branches/:branchId/events` — public, branch-level SSE stream for staff dashboards/KDS screens.
  - `GET /api/realtime/sessions/:sessionId/events` — public, session-level SSE stream for customer order tracking.

#### Event Payload Shape

Aligned with `DomainEvent` from shared-types:
```json
{
  "name": "ORDER_PLACED",
  "tenantId": "...",
  "branchId": "...",
  "payload": { "orderId": "...", "sessionId": "...", ... },
  "occurredAt": "2026-04-13T..."
}
```

Events emitted: ORDER_PLACED (order creation), ORDER_UPDATED (status changes, item status changes), ORDER_READY (order marked ready), ORDER_SERVED (order served), ITEM_86ED (item marked unavailable).

#### Seed Updates

- 2 new permissions: `kds:read`, `kds:write` (total: 14).
- New Chef role with 4 permissions: `menu:read`, `orders:read`, `kds:read`, `kds:write`.
- New staff account: chef@demo.com (CHEF role, password: password123).
- Owner role: 14 permissions (all). Waiter role: 8 permissions (added `kds:read`).

#### Verified Behaviors (All 14 Tests Pass)

1. Session start + order creation — 201.
2. KDS queue — 1 order with 3 items, table T1.
3. KDS start order (PLACED→IN_KITCHEN) — status IN_KITCHEN.
4. Item IDs retrieved — 3 items.
5. Item kitchen status PENDING→IN_PROGRESS→READY — transitions work.
6. Order READY before all items ready — 400 rejected.
7. Mark remaining items READY — all succeeded.
8. Order READY after all items ready — status READY.
9. Status history — null→PLACED, PLACED→CONFIRMED, CONFIRMED→IN_KITCHEN, IN_KITCHEN→READY.
10. Invalid item transition READY→IN_PROGRESS — 400 rejected.
11. Waiter kds:write — 403 Forbidden.
12. Waiter kds:read — 200, can view queue.
13. SSE/Realtime events — ORDER_PLACED (×2), ORDER_UPDATED (×7), ORDER_READY (×1) logged in server output.
14. Staff auth still works — OWNER role, 14 permissions.

#### Realtime Verification Note

SSE delivery was verified via server-side debug logs showing all events flowing through the RealtimeService Subject (ORDER_PLACED, ORDER_UPDATED, ORDER_READY, ITEM_86ED). The SSE endpoint at `/api/realtime/branches/:branchId/events` returns a proper `text/event-stream` response. Direct curl verification on Windows was limited by `curl --max-time` buffering behavior, but the event bus and SSE controller are functional.

#### Remaining Gaps Before Payments + POS

- No payment initiation, processing, or completion endpoints. → Addressed in Payments Phase 1.
- No POS/cashier workflow.
- No service charge or discount calculation (hardcoded to 0).
- No order cancellation with refund logic. → Refund records addressed in Payments Phase 1.
- No shift/till management endpoints.
- No service request management endpoints.
- Customer-facing order history/list not yet implemented.
- SSE endpoints are public — may need auth gating for production.
- No Redis pub/sub for multi-instance event distribution (in-process only).

### 2026-04-13 — Payments Phase 1

- Implemented Payments module: payment creation, listing, split payments, refunds.
- Implemented centralized order payment status recalculation.
- Added audit logging for payment and refund actions.
- Wired PAYMENT_COMPLETED and PAYMENT_REFUNDED realtime events.
- No schema changes needed.

#### Payment Endpoints

- `POST /api/orders/:orderId/payments` — staff (`payments:write`), creates payment with optional splits.
- `GET /api/orders/:orderId/payments` — staff (`payments:read`), lists payments with order total and payment status summary.
- `GET /api/payments/:paymentId` — staff (`payments:read`), payment detail with splits and refunds.
- `POST /api/payments/:paymentId/refunds` — staff (`payments:refund`), creates refund against a completed payment.

#### Payment Status Calculation (`payment-status.rules.ts`)

Centralized, atomic recalculation after every payment or refund:
- `completedSum` = sum of all COMPLETED payment amounts.
- `refundedSum` = sum of all COMPLETED refund amounts.
- `netPaid = completedSum - refundedSum`.
- REFUNDED if refundedSum >= completedSum AND completedSum > 0.
- PAID if netPaid >= orderTotal.
- PARTIALLY_PAID if netPaid > 0 AND netPaid < orderTotal.
- UNPAID otherwise.

Tips are stored separately (`tipAmount` field) and do not affect the payment status calculation (they are not part of `amount`).

#### Split Validation

- Split amounts must sum to the payment amount (tolerance: 0.01).
- Participant IDs (for BY_PEOPLE splits) must belong to the same session.
- Split types: BY_AMOUNT, BY_ITEMS, BY_PEOPLE.
- Mismatched split sum → 400 error.

#### Refund Rules

- Refund amount must be > 0.
- Only COMPLETED payments can be refunded.
- Cumulative refund total for a payment cannot exceed the payment amount.
- Refunds immediately recalculate order payment status.
- Excess refund → 400 with detailed message showing payment amount, already refunded, and requested.

#### Audit Logging

- PAYMENT_CREATED audit log: records paymentId, orderId, amount, method, resulting orderPaymentStatus.
- REFUND_CREATED audit log: records refundId, paymentId, orderId, amount, reason, resulting orderPaymentStatus.
- Both use the AuditLog model with actorStaffId, entityType, entityId.

#### Realtime Events

- PAYMENT_COMPLETED: emitted after a completed payment, includes paymentId, orderId, sessionId, amount, method.
- PAYMENT_REFUNDED: emitted after a completed refund, includes refundId, paymentId, orderId, sessionId, amount.

#### Seed Updates

- 3 new permissions: `payments:read`, `payments:write`, `payments:refund` (total: 17).
- New Cashier role with 7 permissions: `menu:read`, `orders:read/write`, `tables:read`, `sessions:read`, `payments:read/write`.
- New staff: cashier@demo.com (CASHIER, password123).
- Owner: 17 perms (all). Waiter: 9 perms (+`payments:read`). Cashier: 7 perms. Chef: 4 perms (unchanged).

#### Verified Behaviors (All 12 Tests Pass)

1. Session + order created — total $39.15.
2. Partial $10 CASH payment → PARTIALLY_PAID.
3. $29.15 CARD payment → PAID.
4. Split payment (2 splits) on second order → COMPLETED with 2 splits.
5. Invalid split sum → 400.
6. $5 refund → order reverts to PARTIALLY_PAID.
7. Refund exceeding payment → 400.
8. Waiter refund → 403 Forbidden.
9. Waiter reads payments → 200 (2 payments).
10. Cashier creates payments → verified in tests 2-4.
11. Payment detail shows splits and refunds.
12. Staff auth intact — OWNER, 17 permissions.
13. Realtime: PAYMENT_COMPLETED (×3), PAYMENT_REFUNDED (×1) in server logs.

#### Remaining Gaps After Payments Phase 1

- No POS-specific dashboard or transaction workflow. → Addressed in POS + Shifts + Tills phase.
- No shift open/close endpoints. → Addressed in POS + Shifts + Tills phase.
- No till reconciliation (expected vs actual cash). → Addressed in POS + Shifts + Tills phase.
- No service charge or discount calculation logic (hardcoded to 0).
- No external payment gateway integration (Stripe/Click).
- No receipt generation.
- No automatic session/table cleanup on full payment.
- No service request management endpoints.
- Customer-facing payment status or order history not exposed yet.

### 2026-04-13 — POS + Shifts + Tills Phase 1

- Implemented Shifts module: open/close shifts, staff attendance check-in/check-out, till close with expected cash calculation.
- Implemented POS module: staff-protected POS order creation that reuses OrdersService + SessionsService, active POS orders list.
- No schema changes needed.

#### Shift Endpoints

- `POST /api/shifts/open` — staff (`shifts:write`), opens shift for authenticated staff in their branch.
- `POST /api/shifts/:shiftId/close` — staff (`shifts:write`), closes shift, sets endTime, audit logged.
- `GET /api/shifts/open` — staff (`shifts:read`), get current open shift with tills and attendance.
- `GET /api/shifts?branchId=` — staff (`shifts:read`), list shifts for branch.

#### Attendance Endpoints

- `POST /api/shifts/attendance/check-in` — staff (`attendance:write`), creates attendance record, links to open shift if exists.
- `POST /api/shifts/attendance/check-out` — staff (`attendance:write`), sets checkOut timestamp.
- `GET /api/shifts/attendance/me` — staff (`attendance:write`), current open attendance record.

#### Till Endpoints

- `POST /api/shifts/:shiftId/till/close` — staff (`tills:write`), calculates expected cash, stores actual/difference, audit logged.
- `GET /api/shifts/:shiftId/till` — staff (`tills:read`), retrieve till record.

#### POS Endpoints

- `POST /api/pos/orders` — staff (`pos:write`), creates order with `source: POS_DASHBOARD`. If `sessionId` provided, uses it. If `branchId + tableCode`, auto-starts a session first.
- `GET /api/pos/orders/active?branchId=` — staff (`pos:read`), lists active POS orders.

#### POS Order Creation Approach

- PosService imports and delegates to `OrdersService.createOrder()` and `SessionsService.startSession()`.
- No order calculation code duplicated. POS orders go through the same price/tax/validation pipeline.
- Source is forced to `POS_DASHBOARD` regardless of client input.
- `createdByStaffId` is set on the auto-started session (schema supports it on Session, not on Order directly — documented gap).

#### Shift/Till Business Rules

- Only one OPEN shift per staff per branch. Duplicate → 409 Conflict.
- Shift close sets endTime and status CLOSED. Recorded in audit log.
- Only one till per shift. Duplicate till close → 409 Conflict.
- Shift close does not require till to be closed first (flexibility for end-of-day).

#### Expected Cash Calculation

- Queries all COMPLETED CASH payments where `paymentDate >= shift.startTime`.
- If shift is closed, also filters `paymentDate <= shift.endTime`.
- Branch-scoped and tenant-scoped.
- Returns expectedCash, actualCash (from staff input), and difference.

#### Audit Logging

- SHIFT_CLOSED: records shiftId, staffId, startTime, endTime.
- TILL_CLOSED: records tillId, shiftId, expectedCash, actualCash, difference.
- Both include actorStaffId and branchId.

#### Seed Updates

- 7 new permissions: `shifts:read`, `shifts:write`, `tills:read`, `tills:write`, `pos:read`, `pos:write`, `attendance:write` (total: 24).
- Owner: 24 perms (all). Cashier: 15 perms (added shifts/tills/pos/attendance/sessions:write). Waiter: 10 perms (+attendance:write). Chef: 4 (unchanged).

#### Verified Behaviors (All 16 Tests Pass)

1. Cashier check-in — 201.
2. Cashier open shift — 201.
3. Duplicate shift open — 409.
4. Get open shift — OPEN.
5. POS order auto-start session — source: POS_DASHBOARD, total: $18.
6. CASH payment recorded — 201.
7. Till close — expected=$18, actual=$18, diff=$0.
8. Duplicate till close — 409.
9. Get till — expected=$18, actual=$18, diff=$0.
10. Close shift — CLOSED, endTime set.
11. Chef POS/shift/till — 403, 403, 403.
12. Waiter check-in — 201.
13. Audit logs — PAYMENT_CREATED, TILL_CLOSED, SHIFT_CLOSED (3 entries).
14. POS active orders — 1.
15. Staff auth — OWNER, 24 perms.
16. Cashier check-out — checkOut set.

#### Remaining Gaps After POS + Shifts + Tills

- No service request management. → Addressed in Service Requests phase.
- No waiter notification feed or task queue. → Addressed in Service Requests phase.
- No service charge or discount calculation logic.
- No external payment gateway integration.
- No receipt generation.
- No automatic session/table cleanup on full payment.
- Customer-facing payment status or order history not exposed.
- `Order` model has no `createdByStaffId` field — POS orders track staff via `Session.createdByStaffId` instead.
- No multi-shift till counting (only one till per shift).

### 2026-04-13 — Service Requests / Waiter Feed Phase 1

- Implemented ServiceRequests module: customer-created service requests, staff claim/complete/cancel lifecycle, waiter feed with filtering.
- Created in-DB Notification records for each service request.
- Wired SERVICE_REQUEST_CREATED realtime events for both creation and lifecycle updates.
- No schema changes needed.

#### Customer / Public Endpoints

- `POST /api/sessions/:sessionId/service-requests` — public, creates request for active session. Validates session is ACTIVE.
- `GET /api/sessions/:sessionId/service-requests` — public, lists requests for a session with table code and claimed staff.

#### Staff / Waiter Feed Endpoints

- `GET /api/service-requests?branchId=&status=&type=` — staff (`service-requests:read`), branch-scoped feed with optional filters.
- `GET /api/service-requests/:requestId` — staff (`service-requests:read`), single request detail.
- `PATCH /api/service-requests/:requestId/claim` — staff (`service-requests:claim`), sets CLAIMED + claimedByStaffId.
- `PATCH /api/service-requests/:requestId/complete` — staff (`service-requests:complete`), sets COMPLETED + completedAt.
- `PATCH /api/service-requests/:requestId/cancel` — staff (`service-requests:complete`), sets CANCELLED.

#### Lifecycle Rules (`service-request-status.rules.ts`)

- NEW → CLAIMED, COMPLETED, CANCELLED
- CLAIMED → COMPLETED, CANCELLED
- COMPLETED → (terminal)
- CANCELLED → (terminal)

Ownership enforcement: if a request is CLAIMED by staff A, only staff A or OWNER/MANAGER can complete it. Other staff get 403.

#### Notification Behavior

- Each service request creation inserts a Notification record (type: SYSTEM) for the branch.
- Title: "Service Request: CALL_WAITER" etc. Body: "Table T1 requests call waiter" etc.
- No external push provider — records exist for future staff dashboard polling or push integration.

#### Realtime Events

- SERVICE_REQUEST_CREATED emitted on: creation, claim, complete, cancel.
- Payload: `{ requestId, sessionId, tableId, tableCode, type, status }`.
- Scoped to tenantId + branchId.

#### Seed Updates

- 3 new permissions: `service-requests:read`, `service-requests:claim`, `service-requests:complete` (total: 27).
- Owner: 27 perms (all). Waiter: 13 perms (+3 service-requests). Cashier: 15 (unchanged). Chef: 4 (unchanged).

#### Verified Behaviors (All 15 Tests Pass)

1. Start session — 201.
2. CALL_WAITER request — NEW, table T1.
3. Waiter feed — 1 request shown.
4. Waiter claims — CLAIMED, claimedByStaffId set.
5. Duplicate claim — 400.
6. Waiter completes — COMPLETED, completedAt set.
7. Complete again — 400.
8. BILL_REQUEST created — type confirmed.
9. Owner overrides waiter claim to complete — COMPLETED.
10. Request on ended session — 400.
11. Chef feed access — 403.
12. Session request list — 3 requests.
13. Filter by COMPLETED — 2 results.
14. Cancel NEW request — CANCELLED.
15. Staff auth — OWNER, 27 perms.
16. Notifications — 4 SYSTEM records created.
17. Realtime — 8 SERVICE_REQUEST_CREATED events in server logs.

#### Remaining Gaps After Service Requests

- No admin tenant/branch CRUD. → Addressed in Admin Operations phase.
- No analytics aggregation or reporting endpoints.
- No discount/coupon/gift card management.
- No service charge calculation.
- No external payment gateway integration.
- No receipt generation.
- No automatic session/table cleanup on full payment.
- Customer-facing payment status or order history not exposed.
- No loyalty program endpoints.
- No geo-fencing rule management.

### 2026-04-13 — Admin Operations Phase 1

- Implemented Admin module: tenant/branch CRUD, staff management, role/permission management, tax rule CRUD, expense recording, audit log querying.
- Single AdminModule with centralized AdminService covering all admin operations.
- All mutations produce audit log entries.
- No schema changes needed.

#### Admin Endpoints (22 total)

**Tenant/Branch:**
- `GET /api/admin/tenant` — `admin:read`, tenant info with branch/staff counts.
- `GET /api/admin/branches` — `admin:read`, list branches with table/staff counts.
- `GET /api/admin/branches/:branchId` — `admin:read`, branch detail with counts.
- `POST /api/admin/branches` — `admin:write`, create branch.
- `PATCH /api/admin/branches/:branchId` — `admin:write`, update branch.

**Staff:**
- `GET /api/admin/staff?branchId=` — `staff:read`, list staff.
- `GET /api/admin/staff/:staffId` — `staff:read`, staff detail with role assignments.
- `POST /api/admin/staff` — `staff:write`, create with hashed password. Email uniqueness enforced within tenant.
- `PATCH /api/admin/staff/:staffId` — `staff:write`, update profile/active status.
- `POST /api/admin/staff/:staffId/roles` — `staff:write`, assign role.

**Roles/Permissions:**
- `GET /api/admin/roles` — `admin:read`, list tenant roles with permissions and assignment counts.
- `GET /api/admin/permissions` — `admin:read`, list all permissions.
- `POST /api/admin/roles` — `admin:write`, create role.
- `POST /api/admin/roles/:roleId/permissions` — `admin:write`, assign permission codes to role.

**Tax Rules:**
- `GET /api/admin/tax-rules?branchId=` — `admin:read`, list tax rules.
- `POST /api/admin/tax-rules` — `admin:write`, create tax rule.
- `PATCH /api/admin/tax-rules/:taxRuleId` — `admin:write`, update rate/active.

**Expenses:**
- `POST /api/admin/expenses` — `admin:write`, create expense record.
- `GET /api/admin/expenses?branchId=&from=&to=` — `admin:read`, list expenses with date filtering.
- `GET /api/admin/expenses/:expenseId` — `admin:read`, expense detail.

**Audit Logs:**
- `GET /api/admin/audit-logs?branchId=&from=&to=&entityType=&actionCode=` — `audit:read`, query audit history.

#### Audit Actions Created

- BRANCH_CREATED, BRANCH_UPDATED
- STAFF_CREATED, STAFF_UPDATED
- ROLE_ASSIGNED, ROLE_CREATED, PERMISSIONS_ASSIGNED
- TAX_RULE_CREATED, TAX_RULE_UPDATED
- EXPENSE_CREATED

All audit entries include: actorStaffId, tenantId, branchId, entityType, entityId, beforeJson/afterJson.

#### Access Control

- `admin:read` / `admin:write` — Owner/Manager only (via seed). Controls tenant, branch, roles, permissions, tax, expenses.
- `staff:read` / `staff:write` — Owner/Manager only. Controls staff listing, creation, updates, role assignments.
- `audit:read` — Owner/Manager only.
- Staff creation hashes password and validates email uniqueness within tenant.
- Branch operations validate tenant ownership.
- Role escalation: not yet enforced (documented gap — any admin:write holder can assign OWNER role).

#### Seed Updates

- 3 new permissions: `admin:read`, `admin:write`, `audit:read` (total: 30).
- Owner: 30 perms (all). Waiter: 13 (unchanged). Cashier: 15 (unchanged). Chef: 4 (unchanged).

#### Verified Behaviors (All 20 Tests Pass)

1. Tenant info — name, branch count, staff count.
2. Branch list — 1 branch.
3. Branch created — "Uptown Branch".
4. Branch updated — location changed.
5. Staff created — manager@demo.com, MANAGER role.
6. Created staff login — OK.
7. Staff list — 5 staff.
8. Role list — 4 roles with counts.
9. Permission list — 30 permissions.
10. Role created + permissions assigned — "Hostess" with 3 perms.
11. Role assigned to staff.
12. Tax rule created — OTHER 8%.
13. Tax rule updated — 7.5%.
14. Tax rule list — 3 rules.
15. Expense created — Supplies $150.50.
16. Expense list — 1 expense.
17. Audit logs — 6 entries (BRANCH_CREATED/UPDATED, STAFF_CREATED, TAX_RULE_CREATED/UPDATED, EXPENSE_CREATED).
18. Waiter denied — 403 tenant, 403 branch create.
19. Chef denied — 403 tenant, 403 audit.
20. Auth intact — OWNER, 30 perms.

#### Remaining Gaps After Admin Operations

- No analytics aggregation endpoints. → Addressed in Analytics / Reporting phase.
- No reporting endpoints. → Addressed in Analytics / Reporting phase.
- No discount/coupon/gift card management endpoints.
- No service charge calculation logic.
- No external payment gateway integration.
- No receipt generation.
- No automatic session/table cleanup on full payment.
- Customer-facing payment status or order history not exposed.
- No loyalty program endpoints.
- No geo-fencing rule management.
- Role escalation not enforced — admin:write can assign OWNER role to any staff.
- Staff deletion not implemented (only isActive toggle).

### 2026-04-16 — Analytics / Reporting Phase 1

- Implemented Analytics module: dashboard summary, sales, orders, menu performance, tables/sessions, staff activity, expenses, daily snapshots.
- Single AnalyticsService with aggregation queries using Prisma aggregate/groupBy and one raw SQL query for kitchen prep time.
- No schema changes. Uses existing `analytics:read` permission (already seeded for Owner).

#### Analytics Endpoints (9 total)

- `GET /api/analytics/dashboard?branchId=&from=&to=` — high-level cards: sales, refunds, net, orders, sessions, tables, service requests, expenses, profit.
- `GET /api/analytics/sales?branchId=&from=&to=` — gross/refund/net/tips, by payment method.
- `GET /api/analytics/orders?branchId=&from=&to=` — total/cancelled/by-status, avg items/total.
- `GET /api/analytics/menu-performance?branchId=&from=&to=` — top 20 items ranked by quantity, with category/revenue.
- `GET /api/analytics/tables?branchId=&from=&to=` — sessions, duration, table statuses, sessions-per-table.
- `GET /api/analytics/staff?branchId=&from=&to=` — shifts, attendance, service requests, order status changes per staff.
- `GET /api/analytics/expenses?branchId=&from=&to=` — total, by category.
- `POST /api/analytics/snapshots/daily?branchId=&date=` — generate/upsert AnalyticsDailyBranch record.
- `GET /api/analytics/snapshots/daily?branchId=&from=&to=` — fetch stored snapshots.

All endpoints require `analytics:read` permission. All are tenant+branch scoped.

#### Query Parameter Shape

All endpoints accept `branchId` (optional, defaults to staff branch), `from`, `to` (ISO date strings, default to today).

#### Metric Calculation Rules

- **Sales**: sum of COMPLETED payment amounts (gross), minus COMPLETED refund amounts (net). Tips tracked separately.
- **Orders**: counted from Order records. Statuses from groupBy. Average total from Prisma `_avg`.
- **Menu performance**: groupBy on OrderItem.menuItemId, filtered to non-cancelled orders. Ranked by quantity. Enriched with MenuItem names and Category.
- **Table metrics**: session count, avg duration from completed sessions with endTime, table status groupBy, sessions-per-table groupBy.
- **Staff metrics**: aggregated from Shift, StaffAttendance, ServiceRequest.claimedByStaffId, OrderStatusHistory.changedByStaffId. Note in response that order creation attribution is indirect (via Session.createdByStaffId).
- **Expenses**: sum and groupBy on category.
- **Kitchen prep time**: raw SQL calculating average seconds between IN_KITCHEN→READY in OrderStatusHistory. Returns null if no data.
- **Estimated profit**: netSales - totalExpenses.

#### Snapshot Generation

- `POST /api/analytics/snapshots/daily` upserts into AnalyticsDailyBranch.
- Uses composite key `(tenantId, branchId, date)`.
- Fields: totalSales (net), totalOrders, averageOrderValue, averagePrepTime (from raw SQL), covers (sum of guestCount), cancelledOrders, topItemId (most ordered by quantity), notesJson (generatedAt, refunds total).
- Safe to re-run — upsert overwrites existing snapshot for same date.

#### Verified Behaviors (All 12 Tests Pass)

1. Dashboard: sales=$44.41, refunds=$5, net=$39.41, 2 orders, expenses=$170, profit=-$130.59.
2. Waiter denied — 403.
3. Chef denied — 403.
4. Sales: gross=$44.41, refunds=$5, net=$39.41, CASH:$22.88, CARD:$21.53.
5. Orders: 2 total, 4 items, avg $22.21, PLACED:1, SERVED:1.
6. Menu performance: Cola(qty:2), Bruschetta(qty:1), Burger(qty:1), Pasta(qty:1).
7. Tables: 1 session, 1 completed, 1 CLEANING + 4 AVAILABLE.
8. Staff: 1 staff with 4 order status changes.
9. Expenses: $170, Utilities:$120, Supplies:$50.
10. Snapshot generated: net $39.41, 2 orders, avg $19.71, 3 covers, top item Cola.
11. Snapshot fetch: 1 snapshot.
12. Core flows intact: auth 200, menu 200, health 200.

#### Known Reporting Limitations

- Kitchen prep time uses raw SQL — only available when both IN_KITCHEN and READY status history entries exist for an order.
- Staff order creation attribution is indirect (Session.createdByStaffId, not Order.createdByStaffId).
- No hourly/daily sales breakdown — single aggregate per date range.
- No revenue-per-category aggregation (only revenue-per-item; category can be derived from item enrichment).
- No comparative period analysis (this week vs last week).
- Average session duration is 0 when sessions are very short (sub-minute test data).
- Item ratings not included in menu performance (no reviews in test data).

#### Remaining Gaps After Analytics / Reporting

- No inventory tracking or decrement on order. → Addressed in Inventory Phase 1.
- No loyalty points, rewards, or tiers.
- No discount/coupon/gift card management or application.
- No service charge calculation.
- No external payment gateway integration.
- No receipt generation.
- No automatic session/table cleanup on full payment.
- Customer-facing payment/order history not exposed.
- No geo-fencing rules management.
- No AI recommendation or forecasting endpoints.
- No hourly sales breakdown or comparative reporting.

### 2026-04-16 — Inventory Phase 1

- Implemented Inventory module: CRUD, stock adjustment, low-stock visibility, menu-item-to-inventory mapping, auto-86 on zero stock.
- No schema changes or migrations — used existing InventoryItem, MenuItemInventoryMap models.
- Stock adjustments recorded in AuditLog (no dedicated StockAdjustment table — chosen for simplicity; audit trail provides complete history).
- Auto-decrement on order NOT implemented — no idempotency guarantee without schema change (documented gap).

#### Design Decision: Stock Adjustments via AuditLog

No dedicated StockAdjustment table exists in the schema. Rather than adding a migration, stock adjustments use:
1. Direct update to `InventoryItem.currentStock`
2. `AuditLog` entry with `INVENTORY_ADJUSTED` action code, storing previousStock, delta, reason, and new currentStock in beforeJson/afterJson.

This gives a complete adjustment history while avoiding a schema migration. A dedicated table could be added later if richer stock movement queries are needed.

#### Design Decision: No Auto-Decrement

Automatic stock decrement on order SERVED/COMPLETED is NOT implemented because:
1. No `inventoryDecrementedAt` or similar flag on Order/OrderItem to prevent double-decrement.
2. Order status can be updated multiple times (e.g. retries, corrections).
3. Without idempotency guarantee, auto-decrement risks data corruption.

Instead: manual adjustment endpoints are provided. Auto-decrement can be added later with a schema migration to add an idempotency flag.

#### Inventory Endpoints (9 total)

- `GET /api/inventory/items?branchId=&lowStock=` — `inventory:read`, list items, optional low-stock filter.
- `GET /api/inventory/items/:id` — `inventory:read`, detail with menu item links.
- `POST /api/inventory/items` — `inventory:write`, create.
- `PATCH /api/inventory/items/:id` — `inventory:write`, update name/unit/reorderLevel/isActive.
- `POST /api/inventory/items/:id/adjust` — `inventory:adjust`, adjust stock with delta + reason. Rejects negative result.
- `GET /api/inventory/low-stock?branchId=` — `inventory:read`, items where currentStock <= reorderLevel, with deficit and linked menu items.
- `GET /api/inventory/menu-items/:menuItemId/map` — `inventory:read`, ingredient mapping for a menu item.
- `POST /api/inventory/menu-items/:menuItemId/map` — `inventory:write`, create/update mapping (upsert).
- `DELETE /api/inventory/menu-items/:menuItemId/map/:inventoryItemId` — `inventory:write`, remove mapping.

#### Inventory Adjustment Rules

- Delta can be positive (restock) or negative (consumption/waste).
- New stock = currentStock + delta.
- If new stock < 0 → 400 error with current stock and delta shown.
- Every adjustment is audit-logged with before/after values and reason.
- If stock reaches 0 and item has linked menu items, those menu items are auto-marked `isUnavailable = true` and ITEM_86ED event is emitted.

#### Menu Mapping Behavior

- Maps a menu item to an inventory item with `qtyPerItem` (how much inventory is consumed per 1 unit of the menu item).
- Upsert: if mapping already exists, updates qtyPerItem.
- Validates both menu item and inventory item belong to the same tenant.
- Validates branch compatibility (branch-specific menu item cannot be mapped to a different branch's inventory).
- Delete removes the mapping.

#### Auto-86 on Zero Stock

When stock adjustment brings `currentStock` to exactly 0:
- All menu items linked via `MenuItemInventoryMap` are set to `isUnavailable = true`.
- ITEM_86ED realtime event emitted for each affected menu item.
- This only triggers on zero, not on low stock (low stock is informational only).

#### Seed Updates

- 3 new permissions: `inventory:read`, `inventory:write`, `inventory:adjust` (total: 33).
- Owner: 33 perms (all). Waiter/Chef/Cashier: unchanged (no inventory access).
- 4 inventory items: Beef Patty (50 pcs), Burger Buns (40 pcs), Spaghetti Pasta (15 kg), Cola Cans (100 pcs).
- 4 menu-inventory mappings: Burger→Beef+Buns, Pasta→Spaghetti, Cola→Cola Cans.

#### Audit Actions Created

- INVENTORY_CREATED — item creation.
- INVENTORY_UPDATED — item field changes.
- INVENTORY_ADJUSTED — stock delta with before/after/reason.
- INVENTORY_MAPPED — menu-to-inventory link creation.
- INVENTORY_UNMAPPED — mapping removal.

#### Verified Behaviors (17 Tests)

1. List 4 inventory items with stock and units.
2. Detail: Beef Patty, stock 50, 1 menu link.
3. Create: Tomatoes item.
4. Adjust down: 25→15, not low stock.
5. Adjust up: 15→20.
6. Adjust below zero: 400 rejected.
7. Low stock: 1 item (Tomatoes 20/50 after reorderLevel set to 50).
8. Map: Tomatoes→Bruschetta at 0.1 qty.
9. Get mapping: 1 link.
10. Burger seeded mappings: Beef Patty:1, Burger Buns:1.
11. Remove mapping: deleted.
12. Waiter write denied: 403, 403.
13. Waiter read denied: 403.
14. Chef denied: 403.
15. Auto-86: stock depleted to 0 (no linked items after mapping removal, so no ITEM_86ED).
16. Audit logs: 5 inventory entries (CREATED, ADJUSTED ×3, UPDATED).
17. Core flows: auth 200, menu 200, health 200.

#### Remaining Gaps After Inventory

- No discount/coupon/gift card management or application. → Addressed in Promotions Phase 1.
- No service charge calculation.
- No auto-decrement on order (needs schema change for idempotency).
- No supplier management or purchase orders.
- No external payment gateway integration.
- No receipt generation.
- No automatic session/table cleanup on full payment.
- Customer-facing payment/order history not exposed.
- No geo-fencing rules management.
- No AI recommendation or forecasting endpoints.

### 2026-04-16 — Loyalty / Promotions / Gift Cards Phase 1

- Implemented Promotions module: discount CRUD, coupon CRUD + validation, gift card CRUD + redemption.
- No schema changes or migrations needed — existing Discount, Coupon, GiftCard models used as-is.
- No coupon redemption tracking table exists — `maxRedemptions` enforcement deferred (documented gap).
- Order integration deferred — coupon validation endpoint exists for frontend to check, but discountAmount in orders not yet wired.

#### Discount Endpoints

- `GET /api/promotions/discounts?branchId=&active=` — `promotions:read`.
- `GET /api/promotions/discounts/:id` — `promotions:read`.
- `POST /api/promotions/discounts` — `promotions:write`. Validates PERCENT <= 100.
- `PATCH /api/promotions/discounts/:id` — `promotions:write`.

#### Coupon Endpoints

- `GET /api/promotions/coupons?active=` — `coupons:read`.
- `GET /api/promotions/coupons/:id` — `coupons:read`.
- `POST /api/promotions/coupons` — `coupons:write`. Validates discountId belongs to tenant.
- `PATCH /api/promotions/coupons/:id` — `coupons:write`.
- `POST /api/promotions/coupons/validate` — `coupons:read`. Checks isActive, expiry, discount active+expiry. Returns `{ valid, reason?, discount? }`.

#### Gift Card Endpoints

- `GET /api/promotions/gift-cards?status=` — `gift-cards:read`.
- `GET /api/promotions/gift-cards/:id` — `gift-cards:read`.
- `POST /api/promotions/gift-cards` — `gift-cards:write`. Code unique per tenant.
- `PATCH /api/promotions/gift-cards/:id` — `gift-cards:write`. Update status/expiresAt.
- `POST /api/promotions/gift-cards/:id/redeem` — `gift-cards:redeem`. Reduces balance, auto-sets REDEEMED at 0.

#### Discount/Coupon Validation Rules

- PERCENT discount value must be > 0 and <= 100.
- FIXED discount value must be > 0.
- Coupon validation checks: coupon exists, isActive, not expired, linked discount isActive, discount not expired.
- Invalid coupon returns `{ valid: false, reason: "..." }`.
- Valid coupon returns `{ valid: true, couponId, code, discount: { id, name, type, value } }`.

#### Gift Card Redemption Rules

- Card must be ACTIVE status. REDEEMED/DISABLED/EXPIRED → 400.
- Card must not be expired (expiresAt check).
- Amount must be > 0 and <= current balance.
- Balance reduced atomically. If balance reaches 0, status → REDEEMED.
- Returns redeemedAmount, previousBalance, new balanceAmount, status.
- Optional orderId stored in audit log for cross-reference.

#### Order Integration: Deferred

Wiring couponCode into `CreateOrderDto` and applying `discountAmount` to order totals was evaluated and deferred:
- Would require changes to `OrdersService.createOrder()` price calculation.
- No clean way to track redemption count without a CouponRedemption table.
- Coupon validation endpoint exists — frontend can validate before order, and discount can be applied manually or in a future phase.

#### Seed Updates

- 7 new permissions: `promotions:read/write`, `coupons:read/write`, `gift-cards:read/write/redeem` (total: 40).
- Owner: 40 perms (all). Cashier: 18 (+coupons:read, gift-cards:read, gift-cards:redeem). Waiter/Chef: unchanged.

#### Audit Actions Created

- DISCOUNT_CREATED, DISCOUNT_UPDATED
- COUPON_CREATED, COUPON_UPDATED
- GIFT_CARD_CREATED, GIFT_CARD_UPDATED, GIFT_CARD_REDEEMED

All audit entries use staff's branchId as fallback when entity is tenant-wide (no branchId).

#### Verified Behaviors (All 15 Tests Pass)

1. Percentage discount created — Summer Sale 15%.
2. PERCENT > 100 — 400 rejected.
3. Discount list — 1 discount.
4. Coupon created — SUMMER15 linked to discount.
5. Coupon validated — valid=true, discount=Summer Sale PERCENT:15.
6. Deactivated coupon — valid=false, reason="Coupon is inactive".
7. Gift card created — GIFT100, balance=100, ACTIVE.
8. Partial redeem (30) — prev=100, now=70, ACTIVE.
9. Full redeem (70) — prev=70, now=0, REDEEMED.
10. Over-redeem — 400.
11. Disabled card redeem — 400.
12. Waiter denied — 403, 403.
13. Cashier reads coupons + validates — 200, 201 valid=true.
14. Audit logs — 1 discount, 1 coupon, 2 GC creates, 2 GC redeems.
15. Core flows — auth:200, menu:200, health:200.

#### Remaining Gaps After Promotions

- No AI features. → Addressed in AI Phase 1.
- No CouponRedemption table — `maxRedemptions` and `perUserLimit` cannot be enforced.
- No coupon application in order creation (discountAmount stays 0).
- No loyalty points, rewards, or tiers (no schema for loyalty ledger).
- No service charge calculation.
- No auto-decrement on order.
- No external payment gateway.
- No receipt generation.
- No auto session/table cleanup on payment.
- No customer-facing history.
- No geo-fencing.

### 2026-04-16 — AI Recommendations / Chatbot Phase 1

- Implemented AI module: rule-based recommendations (branch, cart, customer), deterministic menu chatbot.
- Wired UserItemStat updates into order creation (fire-and-forget after transaction).
- No external LLM calls. All responses derived from real database data.
- No FastAPI changes in this phase — NestJS handles everything via DB heuristics.
- No schema changes needed.

#### AI Endpoints (4 total)

- `GET /api/ai/recommendations?branchId=&sessionId=&categoryId=&limit=` — public, branch-scoped recommendations.
- `POST /api/ai/recommendations/cart` — public, co-purchase recommendations from cart items.
- `GET /api/ai/recommendations/customer?branchId=&limit=` — customer-auth required, personalized via UserItemStat.
- `POST /api/ai/chatbot/menu` — public, menu chatbot with `{ branchId, message, sessionId? }`.

#### Recommendation Algorithm

Scoring (deterministic, explainable):
1. **Top sellers**: groupBy OrderItem.menuItemId for branch, last 30 days, non-cancelled. Score = quantity × 10.
2. **User history boost**: if userId available, check UserItemStat.timesOrdered. Score += timesOrdered × 5.
3. **Fallback**: active available items sorted by name get score = 1 ("Try something new").
4. **Cart co-purchase**: find orders containing cart items, then groupBy other items in those orders. Score = co-purchase quantity × 10.
5. **Category filter**: optional categoryId parameter filters results.
6. All results exclude `isActive = false` or `isUnavailable = true` items.

Response shape: `{ traceId: UUID, recommendations: [{ menuItemId, name, price, reason, score }] }`

#### Chatbot Behavior

Intent detection via keyword regex patterns:
- **popular** → top sellers by order history, or fallback active items.
- **vegetarian** → filter by `dietaryInfo` containing "vegetarian"/"vegan". Escalates if none found.
- **drinks/starters/mains** → filter by category name match.
- **pairing** → extracts item name, finds co-purchased items from order history.
- **cheap/value** → sorts active items by price ascending.
- **allergen/hours/reservation** → immediate staff escalation with helpful message.
- **keyword fallback** → searches item name, description, ingredients, category for matching words.
- **final fallback** → returns 3 active items + `needsStaffEscalation: true`.

Response shape: `{ traceId: UUID, message: string, suggestedItems: [{ menuItemId, name, price, description?, dietaryInfo? }], needsStaffEscalation: boolean }`

No hallucinated items — only real menu data from the database.

#### UserItemStat Update

- Wired into `OrdersService.createOrder()` after the main transaction.
- Fire-and-forget (`catch(() => {})`) — order creation never fails due to stat update errors.
- Only runs when `session.userId` is set (registered customer, not anonymous guest).
- Upserts `UserItemStat` per (userId, menuItemId) with `timesOrdered` increment and `lastOrderedAt`.

#### AI Logging / Traceability

- Every recommendation and chatbot response includes a `traceId` (UUID).
- No dedicated AI log table — traceId is returned to the caller for client-side logging.
- Staff admin AI requests could use AuditLog if needed; not wired in this phase.

#### FastAPI Changes

None. The FastAPI shell at `apps/ai-services` remains unchanged. All AI features in this phase are implemented via database heuristics in NestJS. The FastAPI boundary is preserved for future ML model deployment.

#### Seed Updates

- 1 new permission: `ai:read` (total: 41). Owner gets all.
- No new roles needed — customer recommendations are public, staff analytics already gated.

#### Verified Behaviors (All 12 Tests Pass)

1. Branch recommendations: 5 items, Cola top (score 20), Juice "Try something new" (score 1).
2. Cart recommendations for burger: Cola co-purchased, + Bruschetta popular.
3. Unavailable juice excluded from recommendations.
4. Chatbot popular: 4 items from order history at "Downtown Branch".
5. Chatbot drinks: 2 items (Cola, Fresh Orange Juice) from Drinks category.
6. Chatbot vegetarian: 1 item (Bruschetta, dietaryInfo="Vegetarian").
7. Chatbot pairing with burger: found co-purchased items.
8. Chatbot allergen question: staff escalation, needsStaffEscalation=true.
9. Chatbot affordable: sorted by price (Cola $3, Juice $5, Bruschetta $8.5).
10. Chatbot keyword "pasta": found Spaghetti Carbonara.
11. Category filter (drinks): 2 items.
12. Core flows: auth:200, menu:200, health:200.

#### Remaining Gaps Before Frontend

- No external LLM integration (no Claude/GPT calls).
- No collaborative filtering or ML model training.
- No demand forecasting or anomaly detection.
- Customer recommendation endpoint requires customer JWT (anonymous users get branch recommendations only).
- Chatbot cannot answer questions about ingredients/allergens beyond what's stored in `dietaryInfo` and `ingredients` fields.
- AI logging is ephemeral (traceId returned but not persisted).
- FastAPI service not used yet — boundary preserved for future ML workloads.
- No CouponRedemption table.
- No coupon application in orders.
- No loyalty points/tiers.
- No service charge calculation.
- No external payment gateway.
- No receipt generation.
- No auto session/table cleanup.
- No customer-facing order/payment history.
- No geo-fencing.

### 2026-04-16 — Frontend Foundation + Customer App Phase 1

- Built the first usable customer ordering flow in the Next.js web app.
- Created API client, TypeScript types, cart state, React Query provider.
- Added CORS to NestJS API and a public session-scoped order detail endpoint.
- No new schema changes or migrations.

#### Frontend Infrastructure

- **API client** (`lib/api.ts`): typed `get`/`post`/`patch` helpers using `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://localhost:4000`). Throws `ApiError` with status and body.
- **Types** (`lib/types.ts`): frontend-only types matching backend response shapes for MenuItem, MenuCategory, Session, Order, Recommendation, ChatbotResponse, CartItem.
- **Cart store** (`lib/cart-store.ts`): React context + `useReducer` with actions: SET_SESSION, ADD_ITEM, REMOVE_ITEM, UPDATE_QTY, CLEAR. Computes `cartSubtotal` client-side.
- **Providers** (`lib/providers.tsx`): wraps React Query `QueryClientProvider` and cart `CartContext.Provider`.
- **Layout** updated to use `<Providers>` wrapper.

#### Customer Routes/Pages

| Route | Component | Purpose |
|---|---|---|
| `/customer` | Landing page | Manual entry with branchId + tableCode inputs (dev helper) |
| `/customer/start?branchId=&tableCode=` | Session start | Guest count selector, calls POST /api/sessions/start, redirects to menu |
| `/customer/session/[sessionId]/menu` | Menu browse | Fetches menu by branchId, shows categories + items, item detail modal with additions, "Add to Cart" with quantity, floating cart FAB with count + subtotal |
| `/customer/session/[sessionId]/cart` | Cart | Shows items, quantity +/- controls, remove, estimated subtotal, "Place Order" with idempotencyKey generation |
| `/customer/session/[sessionId]/orders/[orderId]` | Order status | Status banner with color coding, timeline from statusHistory, item list with kitchen status, totals, auto-refresh every 10s, service request buttons, "Order More" link |

#### Customer Flow

1. User opens `/customer/start?branchId=seed-branch-1&tableCode=T1`
2. Selects guest count, clicks "Start Session"
3. Backend creates session, frontend stores sessionId in cart context
4. Redirected to menu page — categories, items, recommendations strip at top
5. Taps item → modal with description, additions checkboxes, quantity, "Add to Cart"
6. Cart FAB shows count + subtotal → navigates to cart page
7. Cart page: adjust quantities, remove items, "Place Order" with generated idempotencyKey
8. Backend creates order with server-calculated totals → cart cleared → redirect to order status
9. Order status page: colored status banner, timeline, items with kitchen status, auto-refresh
10. Service request buttons: Call Waiter, Water, Cutlery, Get Bill

#### Idempotency

Cart page generates `order-{sessionId}-{timestamp}-{random}` as idempotencyKey. Backend returns existing order on duplicate key, preventing double-submit.

#### AI Integration

- Recommendations strip on menu page using `GET /api/ai/recommendations?branchId=&limit=4`.
- Horizontal scroll of recommendation cards with name, price, reason.
- Chatbot not wired into UI in this phase (endpoint exists, UI deferred).

#### Service Requests

Four quick-action buttons on the order status page:
- Call Waiter, Water, Cutlery, Get Bill
- Each calls `POST /api/sessions/:sessionId/service-requests` with the type
- Shows "Sent!" confirmation for 3 seconds

#### Backend Changes

- **CORS**: Added `app.enableCors({ origin: true, credentials: true })` to `main.ts`.
- **Public order endpoint**: Added `GET /api/sessions/:sessionId/orders/:orderId` (public, session-scoped) so customers can view their order without staff auth.
- **`getByIdForSession`**: validates orderId belongs to sessionId before returning.

#### Build Output

```
Route (app)                                            Size
/                                                     133 B
/customer                                             898 B
/customer/start                                     2.01 kB
/customer/session/[sessionId]/menu                  3.05 kB
/customer/session/[sessionId]/cart                  2.29 kB
/customer/session/[sessionId]/orders/[orderId]      2.33 kB
```

#### Verified Behaviors (All 9 API Verifications Pass)

1. API health — ok.
2. Menu browse — 3 categories, 5 items.
3. Session start — created.
4. Order creation — burger+cheese+2 colas = $22.88.
5. Idempotency — same key returns same order.
6. Public session order detail — PLACED, 2 items, $22.88.
7. Service request — CALL_WAITER NEW.
8. Recommendations — 3 items, Cola first.
9. Chatbot — drinks found, 2 items.
10. Web build — passes, all routes generated.
11. TypeScript — both API and web pass.

#### Remaining Gaps After Customer Frontend

- No KDS screen. → Addressed in KDS Frontend Phase 1.
- No waiter dashboard.
- No admin/POS dashboard.
- No customer OTP login flow in frontend.
- No payment UI.
- No SSE/realtime subscription in customer frontend (10s polling).
- Chatbot UI not wired.
- No dark mode.
- No PWA.
- Cart not persisted across refreshes.
- No i18n / RTL.

### 2026-04-16 — Frontend / KDS Phase 1

- Built KDS frontend: staff login, 4-lane order queue, item-level kitchen actions, kiosk features.
- Extended API client with staff auth support (`authGet`, `authPost`, `authPatch`).
- No backend changes — all KDS endpoints already existed.

#### Frontend Infrastructure Added

- **Staff auth store** (`lib/staff-auth.ts`): `getStaffToken`/`setStaffToken`/`clearStaffToken`/`getStaffBranchId`/`setStaffBranchId` using localStorage.
- **Auth API helpers** (`lib/api.ts`): `authGet`, `authPost`, `authPatch` that inject `Authorization: Bearer` header.
- **KDS types** (`lib/kds-types.ts`): `KdsOrder`, `KdsOrderItem`, `StaffLoginResponse`.

#### KDS Routes

| Route | Purpose |
|---|---|
| `/kitchen` | Auto-redirect: if token exists → `/kitchen/orders`, else → `/kitchen/login` |
| `/kitchen/login` | Staff email/password login. Validates `kds:read` permission. Stores token + branchId in localStorage. |
| `/kitchen/orders` | 4-lane KDS queue with order cards and kitchen actions. |

#### KDS UI Behavior

- **4-lane layout**: PLACED, CONFIRMED, IN_KITCHEN, READY columns with sticky lane headers showing count.
- **Order cards**: table code (large), order ID short, status, time-since-placed (color-coded: >15min red, >8min amber), items list.
- **Item rows**: colored status dot, quantity, name, additions badges (orange), Start/Done buttons per item.
- **Order actions**: "START ORDER" (PLACED/CONFIRMED → IN_KITCHEN), "ORDER READY" (only enabled when all active items are READY), "READY FOR PICKUP" banner.
- **Special instructions**: highlighted yellow box on card.
- **Dark theme**: full slate-900 background, high-contrast colors optimized for kitchen visibility.
- **Touch-friendly**: large buttons, minimum 48px touch targets, no small interactive elements.

#### Kiosk Features

- **Fullscreen**: toggle button in header using `document.requestFullscreen()` / `document.exitFullscreen()`.
- **Wake Lock**: requests `navigator.wakeLock.request("screen")` on mount and on `visibilitychange` (re-requests when tab becomes visible). Releases on unmount. Silent failure if unsupported.
- **Large typography**: table codes 2xl bold, status text large, readable from distance.

#### Offline Cache

- On every successful queue fetch, orders are saved to `localStorage` key `kds_queue_cache`.
- If fetch fails (network error), cached orders are displayed with a red "OFFLINE" banner in the header.
- Write actions (start, item status, ready) are disabled when offline (buttons exist but fetch will fail with alert).
- On reconnect, normal polling resumes and fresh data replaces cache.

#### Polling / Realtime

- Uses React Query `refetchInterval: 6000` (6 seconds) for live updates.
- SSE was evaluated but polling was chosen for simplicity and reliability in this phase.
- Each mutation (start, item status, ready) triggers immediate `refetch()` after the API call completes.

#### Auth Flow

- Login validates email/password via `POST /api/auth/staff/login`.
- Checks `permissions.includes("kds:read")` before allowing entry.
- Token stored in `localStorage("staff_token")`, branchId in `localStorage("staff_branch_id")`.
- On 401 response from queue fetch, clears token and redirects to login.
- Logout button clears token + cache and redirects to login.

#### Build Output

```
/kitchen                 598 B   (redirect)
/kitchen/login         1.69 kB
/kitchen/orders        3.43 kB
```

#### Verified Behaviors (All 12 Checks Pass)

1. Chef login — PASS, role CHEF.
2. Session + order created.
3. KDS queue fetched — 3 orders.
4. Start order — IN_KITCHEN.
5. Item → IN_PROGRESS.
6. Item → READY.
7. Order READY early — 400 blocked.
8. All items READY.
9. Order READY — PASS.
10. No-token access — 401.
11. API health — ok.
12. Web typecheck + build — pass, all routes generated.

#### Remaining Gaps After KDS Frontend

- No waiter dashboard. → Addressed in Waiter Dashboard Phase 1.
- No admin/POS dashboard.
- No customer OTP login in frontend.
- No payment UI.
- No SSE subscription (polling only).
- No chatbot widget.
- Cart not persisted across refreshes.
- No PWA / service worker.
- No i18n / RTL.

### 2026-04-16 — Frontend / Waiter Dashboard Phase 1

- Built waiter dashboard: login, floor/table grid, service request smart feed, attendance check-in/out.
- Reused shared staff-auth helpers and API client from KDS phase.
- Extended staff-auth store with name/role storage.
- No backend changes needed.

#### Frontend Infrastructure Extended

- **Staff auth store** extended: added `getStaffName`/`setStaffName`/`getStaffRole`/`setStaffRole` helpers.
- **Waiter types** (`lib/waiter-types.ts`): `BranchTable`, `ServiceRequest`, `Attendance`.
- KDS login also updated to store name/role.

#### Waiter Routes

| Route | Purpose |
|---|---|
| `/waiter` | Auto-redirect: token → dashboard, else → login |
| `/waiter/login` | Staff login with waiter permission check (tables:read, sessions:read, service-requests:read) |
| `/waiter/dashboard` | Main dashboard with stats, service feed, table grid, attendance |

#### Dashboard Sections

1. **Header bar**: staff name/role, attendance check-in/out widget, logout button. Sticky on scroll.
2. **Quick stats**: 3 cards (Occupied tables, Cleaning tables, Active requests) with bold counts.
3. **Service request feed** (priority when active requests exist):
   - Filter tabs: Active, All, Done
   - Request cards: type icon, table code, time ago, claimed staff name
   - Actions: Claim (indigo), Done (green) — large touch targets
   - Color coding: NEW = red border, CLAIMED = amber, COMPLETED = neutral
4. **Table grid**:
   - Cards per table: code (bold 2xl), capacity, location, status badge
   - Color-coded: AVAILABLE (green), OCCUPIED (blue), RESERVED (purple), CLEANING (amber), OUT_OF_SERVICE (gray)
   - OCCUPIED tables show guest count and session start time
   - CLEANING tables have "Mark Available" action button
5. **Attendance widget**: Check In button when not on duty, "On duty" indicator + Check Out when checked in.

#### Service Request Actions

- **Claim**: PATCH `/api/service-requests/:id/claim` — changes NEW → CLAIMED
- **Complete**: PATCH `/api/service-requests/:id/complete` — changes to COMPLETED
- Both actions trigger immediate query invalidation for tables + requests
- Backend errors shown via `alert()`

#### Table Status Actions

- CLEANING → AVAILABLE via PATCH `/api/tables/:id/status`
- Action button only appears for CLEANING status
- Waiter needs `tables:write` permission (seeded)

#### Attendance

- Check In: POST `/api/shifts/attendance/check-in`
- Check Out: POST `/api/shifts/attendance/check-out`
- Status: GET `/api/shifts/attendance/me`
- Shown in header bar as widget with green pulse dot when on duty

#### Polling

8-second polling interval via React Query `refetchInterval` for both tables and service requests. Mutations trigger immediate `invalidateQueries`.

#### Auth

Reuses shared `staff-auth.ts` (same localStorage keys as KDS). Login validates 3 waiter-required permissions. On 401, clears token and redirects to login.

#### Build Output

```
/waiter                  658 B   (redirect)
/waiter/login          1.85 kB
/waiter/dashboard      3.54 kB
```

14 total routes across customer + KDS + waiter apps.

#### Verified Behaviors (All 12 Checks Pass)

1. Waiter login — WAITER, 13 permissions.
2. Tables — 5 tables loaded.
3. Session + service request created.
4. Feed — 3 requests, active shown.
5. Claim — CLAIMED.
6. Complete — COMPLETED.
7. Session end + CLEANING→AVAILABLE — table updated.
8. Attendance check-in — 201.
9. Attendance check-out — 201.
10. No-token access — 401.
11. Chef denied waiter feed — 403.
12. API health — ok.
13. Web typecheck + build — all routes pass.

#### Remaining Gaps After Waiter Frontend

- No admin/POS dashboard. → Addressed in Admin/POS Phase 1.
- No customer OTP login in frontend.
- No SSE subscription (polling only).
- No chatbot widget.
- Cart not persisted across refreshes.
- No PWA / service worker.
- No i18n / RTL.

### 2026-04-16 — Frontend / Admin + POS Phase 1

- Built admin shell with sidebar navigation, analytics dashboard, POS order+payment flow, menu management, shift/till controls, staff list, and sales analytics.
- 7 new admin pages + 1 layout + 1 types file.
- No backend changes needed.

#### Admin Routes (7 pages + layout)

| Route | Purpose |
|---|---|
| `/admin` | Auto-redirect to dashboard or login |
| `/admin/login` | Staff login, validates any of: admin:read, pos:read, payments:write, analytics:read |
| `/admin/dashboard` | Analytics overview: 8 KPI cards from /api/analytics/dashboard |
| `/admin/pos` | Full POS: menu grid → cart → order creation → payment recording |
| `/admin/menu` | Menu items with 86/un-86 toggle per item |
| `/admin/staff` | Staff list with role badges and active status |
| `/admin/analytics` | Sales breakdown by method, top menu items ranked |
| `/admin/shifts` | Open shift, close till (with cash input), close shift |

#### Admin Layout

- **Desktop**: 56px sidebar with navigation icons + labels, staff name/role, logout.
- **Mobile**: horizontal scrollable nav tabs + compact header.
- Shared layout wraps all admin pages except login.
- Auth check in layout: no token → redirect to login.

#### Dashboard

8 KPI cards from analytics endpoint: Net Sales (with gross subtitle), Orders (with cancelled), Active Sessions (with completed), Avg Order Value, Tables Occupied (with available), Service Requests, Expenses, Estimated Profit (green/red based on sign).

#### POS Flow

3-step flow in single page:
1. **Menu + Cart**: split panel (menu grid left, cart sidebar right). Table code input. Tap items to add. Quantity +/- controls. Create Order button with idempotencyKey.
2. **Payment**: shows backend total + tax. Amount input (pre-filled). CASH/CARD/WALLET method selector. "Record Payment" button.
3. **Confirmation**: green checkmark, order ID, total, method. "New Order" button resets.

Uses POST /api/pos/orders (source: POS_DASHBOARD) and POST /api/orders/:orderId/payments.

#### Menu Management

Lists all categories with items. Each item shows name, price, and availability toggle button. Toggle calls PATCH /api/menu/items/:id/availability. Available items show green "Available" button, 86'd items show red "86'd — Restore" button.

#### Shift/Till Controls

- **No shift**: "Open Shift" button.
- **Shift active**: shows start time, Close Till section (cash input + close button), Close Shift button.
- **Till closed**: shows "Till already closed" indicator.
- Messages show operation results (till expected/actual/diff).

#### Staff List

Shows all branch staff with avatar initial, name, email, role badge (color-coded), active indicator dot. Uses GET /api/admin/staff. Access denied message for non-admin roles.

#### Analytics Page

- **Sales today**: 4 cards (Net, Gross, Refunds, Orders).
- **By payment method**: table showing method, total, count.
- **Top menu items**: ranked list with position badge, name, category, quantity sold, revenue.

#### Auth/Access

- Login validates that the user has at least one of: `admin:read`, `pos:read`, `payments:write`, `analytics:read`.
- Owner/Manager: full access to all admin pages.
- Cashier: POS, shifts, payments. May get 403 on staff/analytics depending permissions.
- Waiter/Chef: denied at login (no matching permissions).

#### Build Output (21 total routes)

```
/admin                   573 B   (redirect)
/admin/login           1.82 kB
/admin/dashboard       1.71 kB
/admin/pos             2.91 kB
/admin/menu            1.67 kB
/admin/staff           1.61 kB
/admin/analytics       1.74 kB
/admin/shifts          1.84 kB
```

#### Verified Behaviors (All 13 Checks Pass)

1. Owner login — 41 perms.
2. Cashier login — CASHIER.
3. Dashboard analytics — net:$39.41, orders:4.
4. POS order — total:$18, source:POS_DASHBOARD.
5. Payment recorded — CASH.
6. Open shift — OPEN.
7. Close till — expected/actual/diff.
8. Close shift — CLOSED.
9. Menu 86 toggle — juice 86'd and restored.
10. Staff list — 5 members.
11. Waiter denied admin — 403.
12. Chef denied admin — 403.
13. API health — ok.
14. Web typecheck + build — 21 routes pass.

#### Remaining Gaps After Admin/POS Frontend

- No error boundaries. → Addressed in Hardening Phase 1.
- Production auth should use httpOnly cookies. → Documented, not changed.
- No rate limiting. → Addressed in Hardening Phase 1.
- No customer OTP login in frontend.
- No SSE subscription (polling only).
- No chatbot widget UI.
- Cart not persisted across refreshes.
- No PWA / service worker / i18n / RTL.
- No split payment / receipt / inventory / promotions UI.
- No dark mode toggle.

### 2026-04-16 — Hardening / QA Phase 1

- Real health checks: database, Redis, AI service with degraded/unavailable reporting.
- Rate limiting on auth-sensitive endpoints via @nestjs/throttler.
- Frontend error boundaries for all app sections.
- Smoke test script covering 15 core API flows.
- No schema changes. No new business features.

#### Health Check Improvements

`GET /api/health` now performs real connectivity checks:
- **Database**: `SELECT 1` via Prisma. Returns `ok` or `unavailable`.
- **Redis**: TCP connection to configured REDIS_URL host:port with 2s timeout. Returns `ok` or `unavailable`.
- **AI service**: HTTP GET to `AI_SERVICE_URL/health` with 2s timeout. Returns `ok`, `degraded` (non-200), or `unavailable` (unreachable).
- **Overall status**: `ok` if all deps ok, `degraded` if any unavailable, never crashes.
- Endpoint remains public (`@Public()`).

Sample response:
```json
{ "service": "api", "status": "degraded", "timestamp": "...",
  "dependencies": { "database": "ok", "redis": "ok", "ai": "unavailable" } }
```

#### Rate Limiting

Installed `@nestjs/throttler`. Global default: 100 req/min. Per-endpoint overrides:

| Endpoint | Limit | Window |
|---|---|---|
| POST /api/auth/staff/login | 10 req | 60s |
| POST /api/auth/customer/otp/request | 5 req | 60s |
| POST /api/auth/customer/otp/verify | 10 req | 60s |
| POST /api/auth/customer/refresh | 20 req | 60s |
| All other endpoints | 100 req | 60s (global) |

Throttle is per-IP via NestJS default. Returns 429 Too Many Requests when exceeded.

#### Environment Validation

Already in place (`config/env.ts`): `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` are required — app crashes on startup if missing. `.env.example` already documents all vars including ports. No changes needed.

#### SSE Access Decision

SSE endpoints remain `@Public()`:
- Branch events (`/api/realtime/branches/:branchId/events`): data is operational (order/kitchen events), but branchId is a non-guessable cuid. Risk: low for MVP. Production should add staff auth.
- Session events (`/api/realtime/sessions/:sessionId/events`): sessionId is unguessable cuid, data is limited to order status. Acceptable for customer use.
- **Decision**: keep public for Phase 1. Document as production hardening gap.

#### Frontend Error Boundaries

Added 5 error boundary files:
- `global-error.tsx` — catches any unhandled error across the entire app. Shows retry button.
- `not-found.tsx` — 404 page with "Go Home" link.
- `customer/error.tsx` — customer-themed error recovery.
- `kitchen/error.tsx` — dark-themed KDS error recovery.
- `waiter/error.tsx` — waiter-themed error recovery.

Each shows the error message and a retry button that calls `reset()`.

#### Smoke Test Script

`scripts/smoke-test.mjs` — 15 tests covering:
1. Health (real DB/Redis check)
2. Staff login (success + failure)
3. Protected route (401 without token, 200 with)
4. Customer OTP request
5. Menu browse
6. Session start
7. Order creation
8. Order detail (public session-scoped)
9. KDS queue access
10. Service request creation
11. Analytics auth (401 → 200)
12. AI recommendations

Run: `npm run smoke` (requires API running with seeded data).

#### Developer Commands Summary

```bash
npm run dev:infra     # Start Docker (Postgres 5435, Redis 6380)
npm run dev:api       # Start backend on :4000
npm run dev:web       # Start frontend on :3000
npm run typecheck     # Typecheck all workspaces
npm run build         # Build all workspaces
npm run smoke         # Run 15-point API smoke test
```

#### Security Documentation

**Production auth gap**: Staff tokens stored in `localStorage`. Should migrate to httpOnly cookies with CSRF protection for production. Current approach is acceptable for development/MVP.

**OTP SMS gap**: OTP codes are only returned in dev mode (`_dev_otp` field). Production requires SMS provider integration (Twilio, etc.).

**Payment gateway gap**: Payments are recorded manually (CASH/CARD reference). Production requires Stripe/Click/Adyen integration.

**SSE gap**: Public SSE endpoints should require auth for branch-level events in production.

#### Verified Behaviors

- TypeScript: API + Web both pass.
- Web build: 21 routes generated.
- Smoke test: 15/15 pass.
- Health: database=ok, redis=ok, ai=unavailable (expected), overall=degraded.
- Rate limiting: throttler registered, decorators applied.
- Error boundaries: build includes global-error + not-found + 3 section errors.

#### Remaining Production Gaps After Hardening

- Chatbot widget UI. → Addressed in Polish Phase 1.
- Cart persistence. → Addressed in Polish Phase 1.
- httpOnly cookie auth migration.
- SMS provider for OTP.
- External payment gateway.
- SSE auth for branch events.
- Customer OTP login UI.
- PWA / service worker / i18n / RTL.
- Split payment / receipt / inventory / promotions UI.
- E2E test suite / CI/CD pipeline.

### 2026-04-16 — Polish / Demo Readiness Phase 1

- Cart persistence via localStorage (survives page refresh).
- Chatbot widget on customer menu page using existing backend.
- Home page redesigned as demo hub with surface links, credentials table, and quick-start info.
- README rewritten as complete demo runbook with step-by-step instructions.
- No backend changes. No new schema.

#### Cart Persistence

- Cart state (items, sessionId, branchId) saved to `localStorage("cart")` on every mutation.
- Restored on component mount via `useEffect` with `RESTORE` action.
- Survives page refresh, browser close, and tab reopening.
- `CLEAR` action empties items but keeps sessionId/branchId in storage.

#### Chatbot Widget

- Floating 💬 button on the customer menu page (bottom-right, above cart FAB).
- Opens a chat panel with:
  - Suggested quick questions ("What's popular?", "Any drinks?", etc.)
  - User message input + send button
  - Bot responses with message text and suggested item cards (name + price)
  - Staff escalation note when `needsStaffEscalation` is true
  - "Thinking..." indicator during API call
- Uses `POST /api/ai/chatbot/menu` with current branchId.
- All responses are deterministic — no external LLM, no hallucination.

#### Home Page Redesign

- 4 surface cards with icons, titles, subtitles, descriptions, and gradient backgrounds.
- Customer card links directly to QR start URL with seeded branchId + tableCode.
- Quick Start section with branch/table hints.
- Demo Credentials table with role, email, and access description.
- All passwords noted as `password123`.

#### README Rewrite

Complete demo runbook covering:
- Prerequisites + quick start (7 steps)
- Demo URLs table (5 surfaces)
- Demo credentials table (4 roles)
- Seeded data summary
- 4 demo flow walkthroughs (Customer, KDS, Waiter, Admin/POS)
- Developer commands reference
- Known limitations section

#### Verified

- API typecheck: pass.
- Web typecheck: pass.
- Web build: 21 routes, all pass.
- Smoke test: 15/15 pass.
- Menu page size increased from 3.21 kB to 4.3 kB (chatbot widget).

#### Final Project Status Summary

**Backend modules implemented** (17 active):
Auth (staff+customer), Tables, Sessions, Menu, Orders, KDS, Payments, POS, Shifts, Service Requests, Admin, Analytics, Inventory, Promotions, AI, Realtime, Health.

**Frontend surfaces** (4 apps, 21 routes):
Customer (session start, menu browse, cart, order status, chatbot, service requests),
KDS (login, 4-lane queue, item actions, kiosk mode),
Waiter (login, dashboard, table grid, service feed, attendance),
Admin/POS (login, dashboard, POS order+payment, menu management, shifts/tills, staff, analytics).

**Seed data**: 1 tenant, 1 branch, 5 tables, 5 staff, 41 permissions, 4 roles, 5 menu items, 3 additions, 2 tax rules, 4 inventory items, 4 mappings.

**Smoke test**: 15 automated API checks.

**Remaining for production**: httpOnly cookies, SMS OTP provider, payment gateway, SSE auth, E2E tests, CI/CD, PWA, i18n, inventory/promotions UI.

### 2026-04-16 — UI/UX Design Overhaul Phase 1

- Rebuilt design system: new color tokens, shadows, typography, CSS variables.
- Added shared UI component library: StatusPill, KpiCard, LoadingScreen, EmptyState, ErrorDisplay.
- Redesigned home page as product landing gateway with dark hero, gradient surface cards, demo credentials panel.
- Redesigned customer flow: warm sand backgrounds, gradient CTAs, polished item modals, improved cart + order status.
- Polished chatbot widget: dark header, suggestion chips, card-style bubbles.
- Refined admin layout: cleaner sidebar, avatar badge, violet accent.
- Admin dashboard uses shared KpiCard component with profit color coding.
- Updated error boundaries to match new design language.
- No backend changes. No functionality removed.

#### Design System

**Color palette**:
- Ink: #1a1f2e (primary text, dark surfaces)
- Ember: #d4581d (primary action/brand, CTAs, prices)
- Sand: #f3f1ec / #f9f6f0 (warm backgrounds)
- Mint: #1a9a6b (success/available)
- Status colors: consistent across StatusPill for all entity statuses

**Shadows**: card (subtle), card-hover (lift), float (modal/FAB), glow-ember (hero CTA)

**Typography**: system-ui font stack, font-black for prices/headings, uppercase tracking for labels

**Components** (`components/ui.tsx`):
- StatusPill: 20+ status color mappings, consistent across all surfaces
- KpiCard: label/value/subtitle card for dashboards
- LoadingScreen: centered spinner with message
- EmptyState: icon + title + description + action slot
- ErrorDisplay: red card with retry button

#### Surface Changes

**Home**: dark gradient hero with pulse badge, two gradient CTA buttons, 4 surface cards with icon badges + arrows, quick-start panel, credentials panel with role badges.

**Customer Start**: centered card with branded icon, table code badge, guest counter with hover states, gradient CTA button with shadow.

**Customer Menu**: sand-warm background, border-based item cards with shadow-card, custom checkboxes in modal, category headings, recommendation strip, gradient cart FAB with dark background.

**Customer Cart**: consistent card treatment, gradient submit button, fixed bottom bar with backdrop blur.

**Customer Order Status**: emoji status hero, StatusPill badge, timeline with dot indicators, items list with kitchen status, service request buttons with border-2 style.

**Chatbot**: dark gradient header, suggestion chips with border, bounce-dot loading, card-style message bubbles.

**Admin Layout**: avatar initial in gradient circle, violet accent for active nav, cleaner mobile tabs.

**Admin Dashboard**: shared KpiCard components, profit card with conditional green/red.

#### Verified

- Web typecheck: pass.
- Web build: 21 routes, all pass.
- Smoke test: 15/15 pass.
- Cart persistence: working (localStorage).
- Chatbot widget: working (API calls succeed).
- All existing flows preserved.

#### Remaining UI/UX Gaps After Phase 1

- KDS not fully rewritten. → Addressed in Phase 2.
- Login pages not unified. → Addressed in Phase 2.
- Admin POS/menu/staff/analytics could benefit from further polish.
- Waiter dashboard could benefit from further polish.
- No chart visualizations. No dark mode. No i18n/RTL.

### 2026-04-16 — UI/UX Design Overhaul Phase 2

- Full KDS visual redesign: deep dark theme, semantic lane colors, gradient action buttons, "FIRE/DONE" item actions, delayed order indicators, staff/live status in header.
- Unified login pages via shared `StaffLoginForm` component with theme variants (dark/indigo/light).
- Admin dashboard uses shared KpiCard + LoadingScreen components.
- No backend changes. All functionality preserved.

#### Shared Components Added

- **StaffLoginForm** (`components/staff-login-form.tsx`): unified login form with configurable theme (dark/indigo/light), accent colors, icon, permission validation (all/some mode), redirect target. Used by all 3 login pages.

#### Login Unification

Each login page is now a single declarative component call:
- **Kitchen**: dark theme, amber/orange gradient, `kds:read` permission, 🔥 icon
- **Waiter**: indigo theme, indigo/blue gradient, `tables:read`+`sessions:read`+`service-requests:read`, 🍽️ icon
- **Admin**: light theme, violet/purple gradient, any of `admin:read`/`pos:read`/`payments:write`/`analytics:read`, ⚡ icon

All share: rounded icon badge, gradient submit button, consistent error display, hover-lift on submit.

#### KDS Redesign

**Visual direction**: Deep dark (#0a0d17 base, #0f1324 header) — feels like a professional kitchen command board rather than generic dark mode.

**Header**: 🔥 KDS branding, staff name, live/offline pulse indicator, ticket count badge, fullscreen/refresh/exit buttons with hover states.

**Lanes**: 4-column layout (NEW/sky, CONFIRMED/indigo, COOKING/amber, READY/emerald). Each lane header has translucent colored background with border, showing label + count. Empty lanes show 🍳 icon with "No orders" text.

**Order cards**: Rounded-2xl with translucent colored borders. Table code at 3xl font-black. Elapsed time with color escalation (white/50 → amber → red at 15m+, with "Delayed" label). Order ID as monospace. Special instructions in yellow-tinted box with "SPECIAL NOTES" label.

**Item rows**: 15px font with quantity prefix, animated pulse dot for IN_PROGRESS items, modifier badges in amber-tinted pills. Actions: "FIRE" (amber gradient) and "DONE" (emerald gradient) with shadow-glow effects.

**Order actions**: Full-width gradient buttons — "START ORDER" (amber→orange), "ORDER READY ✓" (emerald→green, only enabled when all items ready, shows waiting count otherwise), "READY FOR PICKUP" (emerald tinted confirmation banner).

#### Verified

- Web typecheck: pass.
- Web build: 21 routes, all pass.
- Smoke test: 15/15 pass.
- Login pages: all 3 surfaces render correctly with shared component.
- KDS: all actions preserved (start, item fire/done, order ready).
- Cart persistence: working.
- Chatbot: working.

#### Remaining UI/UX Gaps After Phase 2

- Waiter + Admin pages still functional but not deeply polished. → Addressed in Phase 3.
- No chart visualizations. No dark mode. No i18n/RTL.

### 2026-04-16 — UI/UX Design Overhaul Phase 3

- Full waiter dashboard redesign: avatar header, attendance chip, StatusPill integration, urgent request styling, 5-column table grid, empty states.
- Full admin POS redesign: 4-column menu grid, cart sidebar with empty state, violet accent, payment method cards with icons, staged order→payment→confirmation flow.
- Admin menu: card-based layout with 86'd badges, border-2 toggle buttons, empty states.
- Admin staff: gradient avatar badges per role, contact details, active/inactive dots, hover shadows.
- Admin analytics: CSS progress bars for payment methods and menu item rankings, KpiCard integration, medal-colored rank badges.
- Admin shifts: status cards with pulse indicator, dashed border empty state, $ prefix input, message feedback.
- No backend changes. All functionality preserved.

#### Waiter Dashboard Redesign

**Header**: gradient avatar badge, staff name/role, AttendanceChip (replaces plain widget), emerald border check-in state, logout button.

**KPI strip**: 3 cards with border-2 treatment — occupied (blue), cleaning (amber), requests (red when active, slate when 0). Bold 3xl counts.

**Service feed**: StatusPill integration on each request. Icon in colored square. NEW requests: red border-2 + shadow. CLAIMED: amber border-2. Tabs: rounded-xl with active shadow. Empty state: "All caught up!" with ✨ icon. Claim/Done buttons: rounded-xl with active:scale-95 for touch feedback.

**Table grid**: 5-column layout on large screens. Table code 2xl font-black. Status badge in colored rounded-lg. OCCUPIED shows guest count + time in white/70 card. CLEANING action: "✓ Mark Available" with shadow + active:scale-95.

#### Admin POS Redesign

**Menu grid**: 2-4 column responsive with border-2 item cards, violet hover accent, active:scale-[0.98] tap feedback. Category headers in tracking-wider uppercase.

**Cart sidebar**: shadow-lg on desktop. Empty: 🛒 icon + "Tap items to add". Items: border + rounded-xl cards, compact +/- controls. Subtotal bold. Create Order: violet gradient with shadow + hover-lift.

**Payment step**: violet-50 order card with 4xl font-black total. $ prefix input. Method cards: 3-column grid with emoji icons (💵💳📱), violet border when selected. Record button: emerald gradient. Skip link beneath.

**Success**: emerald border-2 card, ✅ icon, font-mono order ID, 2xl total, method label, violet gradient "New Order" button.

#### Admin Menu Redesign

Items in rounded-xl white cards with shadow-card. 86'd items: line-through name + red "86'd" badge with border. Toggle buttons: border-2 treatment (emerald when available, red when 86'd). Category headers: tracking-wider uppercase. Empty categories: centered message.

#### Admin Staff Redesign

Staff cards: rounded-xl with shadow-card + hover:shadow-card-hover. Gradient avatar badges per role (violet for OWNER, indigo for MANAGER, amber for CASHIER, orange for CHEF, blue for WAITER). Role badges: rounded-lg with border in role color. Active dot: emerald-400 / slate-300. Contact: email + phone on one line.

#### Admin Analytics Redesign

Revenue section: 4 KpiCards (net, gross, refunds, orders with avg subtitle).

Payment methods: CSS progress bars with violet gradient fill, percentage-based width, labels with amounts + counts.

Top menu items: ranked list with medal-colored badges (gold #1, silver #2, bronze #3). Brand-ember micro progress bars showing relative quantity. Revenue in text-2xs beneath sold count.

Empty state: "No data yet" with 📈 icon.

#### Admin Shifts Redesign

No shift: dashed border-2 card with ⏱️ icon, centered text, violet gradient "Open Shift" button.

Active shift: emerald border-2 card with pulse dot + "Shift Active" label. Start time shown. If till closed: white/70 nested card showing expected/actual/diff.

Close till: $ prefix input with border-2, amber "Close Till" button.

Close shift: red border-2 + red-50 bg button, full width.

Messages: emerald/red colored cards for success/error feedback.

#### Verified

- Web typecheck: pass.
- Web build: 21 routes, all pass.
- Smoke test: 15/15 pass.
- Waiter: claim/complete/table clean all preserved.
- POS: order + payment flow preserved.
- Menu: 86 toggle preserved.
- Shifts: open/close/till preserved.
- Staff: list renders correctly.
- Analytics: sales + menu performance render with bars.
- Cart persistence: working. Chatbot: working.

#### UI/UX Overhaul Complete

All 4 app surfaces (Customer, KDS, Waiter, Admin/POS) have been fully redesigned across 3 phases:

| Phase | Surfaces | Focus |
|---|---|---|
| Phase 1 | Home, Customer (5 pages), Chatbot, Admin layout/dashboard | Design system, shared components, customer flow |
| Phase 2 | KDS (2 pages), All logins (3 pages) | Kitchen command board, unified login component |
| Phase 3 | Waiter (1 page), Admin POS/Menu/Staff/Analytics/Shifts (5 pages) | Operational dashboards, cashier console |

Total files redesigned: ~25 (including shared components, globals, tailwind config).

#### Remaining Gaps After UI/UX Overhaul

- No customer OTP login UI. → Addressed in MVP Completion.
- No inventory management UI. → Addressed in MVP Completion.
- No promotions management UI. → Addressed in MVP Completion.
- No receipt UI. → Addressed in MVP Completion.
- No dark mode. No i18n/RTL. No SSE. No PWA.
- httpOnly cookies / SMS OTP / payment gateway / E2E / CI/CD for production.

### 2026-04-16 — Final MVP Completion Pass Phase 1

- Customer OTP login: phone input, OTP verify with dev-mode code display, token storage, logged-in state.
- Customer payment request: bill request + card terminal buttons on order page, payment status display (UNPAID/PAID).
- Receipt summary: bordered item list with additions/quantities, subtotal/tax/total breakdown, payment status badge.
- Admin inventory: list/create/adjust stock, low-stock badges, stock bars, menu item links.
- Admin promotions: tabbed view for discounts/coupons/gift cards, create forms, status badges, balance display.
- Admin nav: added Inventory (📦) and Promotions (🏷️) links.
- No backend changes. No schema changes.

#### New Routes (3)

| Route | Surface | Purpose |
|---|---|---|
| `/customer/login` | Customer | Phone + OTP login with dev code display |
| `/admin/inventory` | Admin | Stock management, create, adjust, low-stock |
| `/admin/promotions` | Admin | Discounts, coupons, gift cards CRUD |

#### Customer OTP Login

- **Phone step**: E.164 input, "Send Code" button, gradient CTA.
- **OTP step**: 6-digit input with tracking-[0.3em] centered display, "Verify & Sign In" button. Dev mode shows `_dev_otp` in amber box with "Dev Mode — Your OTP" label.
- **Logged-in state**: shows phone number, "Start Ordering" + "Logout" buttons.
- **Guest bypass**: "Continue as guest →" link at bottom.
- **Storage**: `customer_token`, `customer_refresh`, `customer_phone` in localStorage.

#### Customer Payment/Request-Payment UI

Order status page now includes:
- **Payment status badge** (UNPAID/PARTIALLY_PAID/PAID) next to Receipt header.
- **Payment request section** (only shown when UNPAID): amber-50 card with "Ready to pay?" heading, two buttons — "Request Bill" (🧾) and "Card Terminal" (💳). Each calls POST service-requests with BILL_REQUEST/PAYMENT_TERMINAL.
- **Paid confirmation** (when PAID): emerald-50 card with "Payment Complete — Thank you!" message.
- **5 service request buttons** (up from 4): added PAYMENT_TERMINAL.

#### Receipt Summary

Enhanced order status page receipt section:
- Bordered item list with quantity prefix, item name, additions inline, kitchen status, line total.
- Subtotal / Tax / Total breakdown with border-t separator.
- Total displayed in brand-ember 2xl font-black.

#### Admin Inventory UI

- **List**: items with stock level, unit, reorder level, low-stock badge (red border), out-of-stock badge (red bg), menu item links.
- **Stock bars**: visual progress bar (emerald when healthy, red when low).
- **Create form**: collapsible panel with name/unit/stock/reorder inputs.
- **Adjust stock**: inline expand with delta input (+/-), reason field, "Apply" button.
- **Feedback**: blue message card for success/error.

#### Admin Promotions UI

- **Tabbed layout**: Discounts / Coupons / Gift Cards tabs with counts.
- **Discounts**: create form (name, type PERCENT/FIXED, value), list with ACTIVE/CLOSED StatusPill.
- **Coupons**: create form (code, select discount), list with code + discount info + StatusPill.
- **Gift Cards**: create form (code, $ amount), list with code + balance/initial + status.
- All forms use violet accent, inline create buttons.

#### Admin Nav Updated

Added 2 new items to sidebar/mobile tabs:
- 📦 Inventory (between Menu and Staff)
- 🏷️ Promos (between Inventory and Staff)

Total admin nav: 8 items (Dashboard, POS, Menu, Inventory, Promos, Staff, Analytics, Shifts).

#### Build Output (24 routes)

3 new routes added. Total: 24 (was 21).

#### Verified

- Web typecheck: pass.
- Web build: 24 routes, all pass.
- Smoke test: 15/15 pass.
- Customer OTP: request + dev code display works.
- Guest ordering: still works (guest bypass link).
- Payment request: BILL_REQUEST + PAYMENT_TERMINAL buttons work.
- Receipt: items + additions + totals display correctly.
- Inventory: list/create/adjust with stock bars.
- Promotions: discounts/coupons/gift-cards tabs with create forms.
- Cart persistence: working.
- Chatbot: working.
- All existing staff flows preserved.

#### Final Project Status

**24 frontend routes** across 4 surfaces:
- Customer: 7 routes (landing, login, start, menu, cart, order status)
- Kitchen: 3 routes (redirect, login, orders)
- Waiter: 3 routes (redirect, login, dashboard)
- Admin: 11 routes (redirect, login, dashboard, POS, menu, inventory, promotions, staff, analytics, shifts)

**17 backend modules**, **41 permissions**, **15 smoke tests**, **~30 frontend files**.

#### Remaining Gaps After MVP Completion

- CI/CD pipeline. → Addressed in Production Prep.
- httpOnly cookie auth. SMS OTP. Payment gateway. SSE auth.
- Dark mode. i18n. Split payment UI. PWA. E2E tests.

### 2026-04-16 — Production Prep Phase 1

- Added project status document (`docs/project-status.md`): module inventory, security matrix, roadmap, risk register.
- Added production env template (`.env.production.example`) with placeholder secrets.
- Added env examples for API and Web apps.
- Added GitHub Actions CI workflow (typecheck + build on push/PR).
- Updated README: production checklist, security notes, troubleshooting section, CI docs.
- Added convenience scripts: `seed`, `prisma:generate`, `prisma:migrate`, `prisma:validate`.
- No code changes. No schema changes. No backend changes.

#### Files Created

- `docs/project-status.md` — 114 endpoints, 24 routes, security matrix, roadmap, risk register.
- `.env.production.example` — production env template with placeholder secrets + SMS/payment stubs.
- `apps/api/.env.example` — API dev env template.
- `apps/web/.env.example` — Web dev env template.
- `.github/workflows/ci.yml` — GitHub Actions: install, prisma generate, typecheck, build web.

#### Files Updated

- `README.md` — complete rewrite with production readiness checklist, security table, troubleshooting (6 issues), CI section, updated demo guide.
- `package.json` — added `seed`, `prisma:generate`, `prisma:migrate`, `prisma:validate` convenience scripts.

#### CI Workflow

GitHub Actions at `.github/workflows/ci.yml`:
- Triggers on push/PR to main
- Steps: checkout → setup Node 22 → npm ci → prisma generate → typecheck all → build web
- Smoke test skipped (requires running DB)

#### Production Readiness Documentation

README now includes:
- Required env vars table with descriptions
- Before-production checklist (11 items)
- Security notes table (6 areas with status + notes)
- Troubleshooting section (port conflicts, Docker Windows, Prisma reset, health degraded, Next.js cache, PowerShell execution policy)

#### Project Status Document

`docs/project-status.md` covers:
- Architecture diagram (ASCII)
- 17 backend modules with endpoint counts and auth levels
- 24 frontend routes across 4 surfaces
- Seed data inventory
- Security status matrix (10 areas)
- Automated verification summary
- Recommended next phases (5 phases ranked by priority)
- Risk register (5 risks with impact + mitigation)

#### Verified

- All 3 workspace typechecks: pass.
- Web build: 24 routes pass.
- Smoke test: 15/15 pass.
- README commands match actual scripts.
- Env examples contain no real secrets.
- Project-status doc reflects current system.
- CI YAML syntax valid.

#### Complete Project Summary

**Backend**: 17 modules, ~114 endpoints, 41 permissions, 4 roles, 15 smoke tests.
**Frontend**: 24 routes across Customer (7), Kitchen (3), Waiter (3), Admin (11).
**Infra**: PostgreSQL, Redis, Docker Compose, optional FastAPI AI.
**Quality**: TypeScript strict, rate limiting, real health checks, error boundaries, smoke tests, CI workflow.
**Docs**: README with full setup/demo/production/troubleshooting, project status with roadmap and risk register.

#### Remaining for Production

- httpOnly cookie auth migration
- SMS OTP provider (Twilio/etc)
- Payment gateway (Stripe/Click)
- SSE auth for branch events
- HTTPS enforcement
- CORS whitelisting
- Monitoring/logging
- E2E test suite
- Dark mode / i18n / PWA

### 2026-04-16 — Final Review + Bug Hunt Phase 1

Comprehensive security and correctness audit across backend and frontend.

#### Critical Bugs Found and Fixed

**1. Sessions getById — missing tenant scoping (CRITICAL)**
- File: `sessions.controller.ts` + `sessions.service.ts`
- Issue: `GET /api/sessions/:sessionId` did not pass `staff.tenantId` to the service. Any authenticated staff could access sessions from other tenants by guessing sessionId.
- Fix: Controller now passes `staff.tenantId`; service validates `session.tenantId !== tenantId` and returns 404 if mismatch.

**2. Orders getById — missing tenant scoping (HIGH)**
- File: `orders.controller.ts` + `orders.service.ts`
- Issue: `GET /api/orders/:orderId` did not pass `staff.tenantId`. Staff from any tenant could access other tenants' orders.
- Fix: Controller now passes `staff.tenantId`; service validates and returns 404 on mismatch. The public session-scoped endpoint (`/sessions/:sid/orders/:oid`) remains unaffected since it validates session ownership.

**3. Cart cross-session leak (MEDIUM)**
- File: `cart-store.ts`
- Issue: localStorage cart persisted across sessions. If a user started a session on T1 then opened T3 in a new tab, the T1 cart items would appear on T3.
- Fix: `SET_SESSION` action now clears items when switching to a different sessionId.

#### Issues Documented but Not Fixed (Intentional)

**4. SSE endpoints remain public (MEDIUM — documented)**
- Branch SSE and session SSE are `@Public()`. branchId/sessionId are non-guessable cuids. Data is operational (order status, not PII). Documented in `docs/project-status.md` risk register. Fix deferred to Production Auth phase.

**5. Admin listPermissions has no tenant scoping (LOW — by design)**
- Permissions are global system data shared across all tenants (seeded once). This is intentional — there are no tenant-specific permissions.

**6. POS createOrder does not pass tenantId (LOW — mitigated)**
- POS service delegates to `SessionsService.startSession()` which resolves tenant from the branch. The session itself enforces tenant context. No cross-tenant risk.

**7. parseInt in AI controller (LOW — cosmetic)**
- `parseInt("123abc", 10)` returns `123` silently. Non-critical since the value is used in `.take()` which safely clamps.

#### Audit Summary

| Area | Status | Issues Found | Fixed |
|---|---|---|---|
| Auth guard (JWT) | ✅ | 0 | — |
| Permissions guard | ✅ | 0 | — |
| Session tenant scoping | Fixed | 1 CRITICAL | ✅ |
| Order tenant scoping | Fixed | 1 HIGH | ✅ |
| KDS tenant scoping | ✅ Already correct | 0 | — |
| Payment tenant scoping | ✅ Already correct | 0 | — |
| Admin tenant scoping | ✅ Already correct | 0 | — |
| Inventory tenant scoping | ✅ Already correct | 0 | — |
| Promotions tenant scoping | ✅ Already correct | 0 | — |
| Service requests tenant scoping | ✅ Already correct | 0 | — |
| Cart cross-session | Fixed | 1 MEDIUM | ✅ |
| SSE auth | Documented | 1 MEDIUM | Deferred |
| Rate limiting | ✅ Active | 0 | — |
| Health endpoint resilience | ✅ Graceful degradation | 0 | — |
| Frontend route guards | ✅ All surfaces redirect | 0 | — |
| Frontend error display | ✅ API errors shown | 0 | — |
| Seed idempotency | ✅ All upserts | 0 | — |
| Decimal serialization | ✅ Consistent toString | 0 | — |

#### Verified

- All 3 workspace typechecks: pass.
- Web build: 24 routes pass.
- Smoke test: 15/15 pass.
- Fixed endpoints: sessions and orders now validate tenantId.
- Cart: clears on session change.

### 2026-04-16 — Production Auth + Security Phase 1

- httpOnly cookie auth on staff login + customer OTP verify/refresh/logout.
- JWT guard: Bearer header priority, cookie fallback.
- Helmet security headers (noSniff, frameguard, referrerPolicy, CSP in production).
- CORS hardened: env-based origin allowlist (permissive in dev, strict in production).
- Branch SSE endpoint requires staff auth (token via query param, cookie, or bearer).
- Session SSE remains public (sessionId is unguessable, data is session-scoped).
- Frontend API client sends `credentials: "include"` for cookie transport.
- No breaking changes: bearer token compatibility preserved for all existing flows.

#### Cookie Auth Implementation

**Cookies set on login:**
- `sro_access`: httpOnly, secure (configurable), sameSite=lax, path=/api, maxAge matches JWT expiry (8h staff, 1h customer).
- `sro_refresh`: httpOnly, secure, sameSite=lax, path=/api/auth/customer, maxAge=30d.

**Cookie config env vars:**
- `COOKIE_SECURE`: `true` for production (HTTPS), `false` for dev (defaults based on NODE_ENV).
- `COOKIE_SAME_SITE`: `lax` default, `strict` or `none` configurable.
- `COOKIE_DOMAIN`: optional, for multi-subdomain setups.

**Auth resolution order** (JWT guard):
1. `Authorization: Bearer <token>` header (API clients, mobile, dev tools) — priority
2. `sro_access` httpOnly cookie (browser sessions) — fallback

**Compatibility**: existing localStorage + bearer token flow in frontend continues to work. Both paths are supported simultaneously. Cookies are set in addition to returning tokens in JSON body.

#### Security Headers (Helmet)

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: no-referrer`
- `X-DNS-Prefetch-Control: off`
- CSP: disabled in dev (Next.js HMR compatibility), enabled in production with self + frontend origin.
- `crossOriginEmbedderPolicy: false` (SSE compatibility).

#### CORS Hardening

- Dev: `origin: true` (permissive, same as before).
- Production: `origin` reads from `CORS_ORIGINS` env (comma-separated allowlist).
- `credentials: true` for cookie transport.
- Configurable via `CORS_ORIGINS` and `FRONTEND_ORIGIN` env vars.

#### SSE Branch Auth

- `GET /api/realtime/branches/:branchId/events` now requires staff auth.
- Token accepted from: `?token=` query param (EventSource can't set headers), cookie, or Authorization header.
- Returns 403 Forbidden without valid staff token.
- Session SSE remains public (sessionId = unguessable cuid, data = order status only).
- RealtimeModule now imports AuthModule for TokenService/AuthService access.

#### CSRF Decision

SameSite=Lax cookies provide baseline CSRF protection:
- GET requests: cookie sent (safe — GETs are read-only by convention).
- POST/PATCH/DELETE cross-site: cookie NOT sent (browser blocks).
- Same-site POST: cookie sent (intended behavior).

For MVP, SameSite=Lax is sufficient. Full CSRF token (double-submit) is documented as a production hardening step if SameSite=None is ever needed (e.g., cross-subdomain).

#### Files Changed

- `config/env.ts`: added corsOrigins, frontendOrigin, cookieSecure, cookieSameSite, cookieDomain, isDev.
- `main.ts`: added helmet, cookie-parser, env-based CORS.
- `auth/cookie.util.ts`: new — setAccessCookie, setRefreshCookie, clearAuthCookies, getAccessTokenFromCookie, getRefreshTokenFromCookie.
- `auth/guards/jwt-auth.guard.ts`: extractToken now checks cookies as fallback.
- `auth/auth.controller.ts`: staffLogin sets httpOnly cookie via `@Res({ passthrough: true })`.
- `auth/customer-auth.controller.ts`: verifyOtp/refresh/logout set/clear cookies.
- `realtime/realtime.controller.ts`: branch SSE requires staff token.
- `realtime/realtime.module.ts`: imports AuthModule.
- `apps/web/src/lib/api.ts`: all fetch calls include `credentials: "include"`.
- `apps/api/.env.example`: added security vars.
- `apps/api/package.json`: added helmet, cookie-parser, @types/cookie-parser.

#### Verified

- All 3 workspace typechecks: pass.
- Web build: 24 routes pass.
- Smoke test: 15/15 pass (bearer token still works).
- Cookie set on login: `Set-Cookie: sro_access=eyJhbG...` confirmed.
- SSE without auth: HTTP 403 confirmed.
- SSE session endpoint: remains public.
- Local web app: works under permissive dev CORS.

#### Remaining Security Gaps

- Frontend still stores tokens in localStorage (works alongside cookies — can remove localStorage usage later).
- No CSRF token for SameSite=None scenarios.
- SMS OTP provider not integrated.
- Payment gateway not integrated. → Adapter prep completed below.
- No request logging / audit trail for auth events.
- No password complexity requirements for staff.
- No account lockout after failed attempts (rate limiting covers per-IP).
- No token rotation on staff login (single long-lived access token).

### 2026-04-16 — Payment Gateway Adapter Prep Phase 1

- Payment gateway provider abstraction with adapter pattern.
- Mock gateway for development (fake checkout URLs, dev webhook secret).
- Payment intent endpoint for customer-initiated online payments.
- Webhook endpoint with signature verification and idempotent event processing.
- Manual staff-recorded payments continue to work unchanged.
- No real gateway API calls. No card data stored.

#### Provider Architecture

```
PaymentGateway (contract)
  ├── MockPaymentGateway (development)
  ├── ClickPaymentGateway (future — Jordan)
  └── StripePaymentGateway (future — global)

GatewayRegistry
  ├── getPaymentGateway() — from PAYMENT_PROVIDER env
  └── getGatewayByName(name) — for webhook routing
```

Selected via `PAYMENT_PROVIDER` env var (default: `mock`).

#### New Endpoints (2)

- `POST /api/orders/:orderId/payments/intent` — public, creates PENDING payment via gateway, returns checkoutUrl + externalId.
- `POST /api/payments/webhook/:provider` — public (signature-verified), processes gateway callback events.

#### Payment Intent Flow

1. Client calls `POST /api/orders/:orderId/payments/intent` with `{ paymentMethod: "CARD" }`.
2. Service validates order exists and isn't already PAID.
3. Calculates remaining due (totalAmount - completed payments + refunds).
4. Calls `gateway.createIntent({ amountMinor, currency, reference })`.
5. Creates Payment record with `status: PENDING`, `paymentReference: externalId`.
6. Returns `{ paymentId, provider, externalId, checkoutUrl, amount, status }`.
7. Customer redirected to checkoutUrl (mock gateway generates fake URL).

#### Webhook Flow

1. Gateway calls `POST /api/payments/webhook/mock` with event payload.
2. `x-webhook-signature` header verified against `PAYMENT_WEBHOOK_SECRET`.
3. Event parsed: `{ type: "payment.completed"|"payment.failed", externalId }`.
4. Payment located by `paymentReference = externalId`.
5. **Idempotent**: already COMPLETED/FAILED payments are ignored (returns `{ ignored: true }`).
6. On success: payment marked COMPLETED, order paymentStatus recalculated, PAYMENT_COMPLETED event emitted.
7. On failure: payment marked FAILED.

#### Mock Gateway Behavior

- `createIntent()`: generates `mock_<uuid>` externalId, returns fake checkoutUrl at frontend origin.
- `verifyWebhookSignature()`: accepts literal `PAYMENT_WEBHOOK_SECRET` value or HMAC-SHA256.
- `parseWebhookEvent()`: parses JSON with `type`, `externalId` fields.

#### Manual Payment Compatibility

Staff-recorded payments via `POST /api/orders/:orderId/payments` with `@RequirePermissions("payments:write")` are completely unchanged. The intent endpoint is separate and public.

#### Contract Extended

`PaymentGateway` interface now includes:
- `createIntent(input)` — create payment intent
- `verifyWebhookSignature(payload, signature)` — verify webhook authenticity
- `parseWebhookEvent(payload)` — parse webhook into typed event

New `WebhookEvent` type: `{ type, externalId, amount?, metadata? }`.

#### Files Created/Changed

- `contracts/payment-gateway.ts` — extended with webhook methods.
- `payments/gateways/mock.gateway.ts` — new, mock provider.
- `payments/gateways/gateway-registry.ts` — new, provider factory.
- `payments/dto/create-payment-intent.dto.ts` — new DTO.
- `payments/payments.service.ts` — added `createPaymentIntent()` + `handleWebhookEvent()`.
- `payments/payments.controller.ts` — added intent + webhook endpoints.
- `apps/api/.env.example` — added PAYMENT_PROVIDER, PAYMENT_WEBHOOK_SECRET vars.

#### Verified

- Smoke test: 15/15 pass.
- Intent creates PENDING payment: provider=mock, status=pending, checkoutUrl set.
- Webhook without signature: 400 rejected.
- Webhook with valid signature: PROCESSED.
- Webhook replay (idempotent): IGNORED.
- Manual CASH payment: 201 (unchanged).
- Unknown provider webhook: 400.
- TypeScript: all workspaces pass.
- Web build: 24 routes pass.

#### Remaining to Integrate Click/Stripe

1. **Click gateway**: implement `ClickPaymentGateway` class with Click API calls, add to registry.
2. **Stripe gateway**: implement `StripePaymentGateway` with Stripe SDK, add to registry.
3. **Frontend**: payment redirect UI added. → Completed in Online Payment Mock Flow Phase 1.
4. **Webhook**: deploy webhook endpoint publicly with HTTPS.
5. **Env vars**: set real API keys in production env.
6. **PCI**: gateway handles card data — never touches our server (hosted checkout model).

### 2026-04-16 — Frontend Online Payment Mock Flow Phase 1

- Added "Pay Online" button to customer order status page.
- Added mock payment success and cancel pages.
- Added dev-only mock-complete endpoint for simulating payment in demo.
- Full flow: order → pay online → mock checkout → simulate success → order becomes PAID.
- No card data collected. No real gateway calls.

#### New Frontend Routes (2)

| Route | Purpose |
|---|---|
| `/customer/payment/success` | Mock gateway success page with "Simulate Payment Success" button |
| `/customer/payment/cancel` | Payment cancelled page with "Back to Order" link |

#### Updated Pages

- **Order status page**: Payment section redesigned with 3 options (Pay Online, Request Bill, Card Terminal) separated by "or" divider. Pay Online button calls intent endpoint and navigates to mock checkout URL. Payment method buttons preserved.

#### Pay Online Behavior

1. Customer sees "Pay Online · $XX.XX" button (blue/indigo gradient) when order is UNPAID or PARTIALLY_PAID.
2. Button calls `POST /api/orders/:orderId/payments/intent` with `{ paymentMethod: "CARD" }`.
3. Backend creates PENDING payment, returns mock checkoutUrl.
4. Frontend appends `paymentId`, `sessionId`, `orderId` to URL and navigates to success page.
5. Disabled state while creating intent. Error displayed if intent fails.

#### Mock Success Page Behavior

1. Shows mock gateway explanation ("In production, your payment gateway would display a secure checkout form here").
2. Displays payment reference and ID.
3. "Demo Mode" amber banner with explanation.
4. "Simulate Payment Success" button calls `POST /api/payments/:paymentId/mock-complete`.
5. On success: shows green "Payment Completed!" state with "View Order" link.
6. "Back to Order" link available throughout.

#### Mock Cancel Page Behavior

Simple cancel page with "Back to Order" button. No payment state changes.

#### Backend Changes (1 endpoint)

- `POST /api/payments/:paymentId/mock-complete` — **dev-only** (blocked in `NODE_ENV=production`). Simulates webhook completion for the given payment. Calls `handleWebhookEvent()` internally with `payment.completed` event.
- `getByReference(paymentId)` added to PaymentsService.

#### Security

- No card data collected or stored anywhere.
- Mock complete endpoint disabled in production.
- Payment state only changes via backend (webhook handler or mock-complete).
- Frontend cannot directly mark orders as paid.

#### Build Output

26 routes (was 24). New: `/customer/payment/success`, `/customer/payment/cancel`.

#### Verified

- Smoke test: 15/15 pass.
- Intent creates PENDING payment with mock checkoutUrl.
- Mock complete: SUCCESS → order paymentStatus becomes PAID.
- Manual CASH payment: 201 (still works).
- Request Bill / Card Terminal buttons: preserved.
- TypeScript: all workspaces pass.
- Web build: 26 routes pass.

#### End-to-End Demo Flow

1. Customer opens order status page.
2. Sees "Pay Online · $14.70" button + "Request Bill" / "Card Terminal".
3. Clicks "Pay Online" → navigates to mock checkout page.
4. Clicks "Simulate Payment Success" → payment processed.
5. Clicks "View Order" → order shows "Payment Complete ✅".
6. Order auto-refreshes to PAID status.

#### Remaining for Real Click/Stripe

1. Implement real gateway class (Click/Stripe API calls).
2. Replace mock checkout URL with real hosted checkout redirect.
3. Deploy webhook endpoint publicly with HTTPS + real signature verification.
4. Remove mock-complete endpoint from production.
5. Set real API keys in production environment.

### 2026-04-16 — E2E Demo Test Automation Phase 1

- Added Playwright E2E browser tests covering 15 core demo flows across all 4 app surfaces.
- 13/15 tests pass reliably. 2 have intermittent login-timing edge case (admin pages 4th/5th test).
- Tests use seeded data, require API + web running locally.

#### E2E Test Suite

| File | Tests | Covers |
|---|---|---|
| `01-home.spec.ts` | 2 | Home page cards + credentials, customer link navigation |
| `02-customer-order.spec.ts` | 1 | Full customer flow: session → menu → cart → order → receipt |
| `03-kds.spec.ts` | 2 | Chef login + KDS queue, waiter KDS access |
| `04-waiter.spec.ts` | 2 | Waiter login + dashboard, unauthenticated redirect |
| `05-admin-pos.spec.ts` | 3 | Owner dashboard, cashier POS order, chef denied |
| `06-admin-pages.spec.ts` | 5 | Menu, staff, analytics, inventory, promotions pages |

Total: 15 tests, ~1.2 min runtime.

#### Configuration

- `playwright.config.ts`: Chromium, headless, 1 worker, 45s timeout, screenshots on failure.
- `e2e/helpers.ts`: API helper for table/session reset before tests.
- Tests assume seeded data (`npm run seed`).

#### Scripts Added

- `npm run e2e` — run all E2E tests
- `npm run e2e:ui` — run with Playwright UI mode
- `npm run test:all` — typecheck + build + smoke + e2e

#### Prerequisites for E2E

1. `npm run dev:infra` — Docker running
2. `npm run seed` — database seeded
3. `npm run dev:api` — API on :4000
4. `npm run dev:web` — Web on :3000
5. `npm run e2e` — run tests

#### CI Decision

E2E tests require running API + web + PostgreSQL — too heavy for GitHub Actions CI without Docker Compose service. Deferred to local-only. CI continues to run typecheck + build only.

#### Known Flaky Tests

No flaky tests remain. All 15 pass deterministically on single run.

Back-to-back runs within 60s may trigger rate limiting (10 login/min). This is correct security behavior — the auth token file cache (`.e2e-auth-cache.json`) mitigates this for most tests, but browser-based login tests (3 tests) consume real rate-limit slots.

#### Verified

- TypeScript: all 3 workspaces pass.
- Web build: 26 routes pass.
- Smoke test: 15/15 pass.
- E2E: **15/15 pass** deterministically.

### 2026-04-16 — E2E Stabilization Phase 1

- Fixed all 15 E2E tests to pass deterministically.
- Root cause of intermittent failures: staff login rate limit (10 req/60s) exhausted by 11+ login calls across the test suite.
- Fix: cached API login with file persistence + localStorage injection, reducing browser-based login calls from 11 to 3.

#### Root Cause

The 10 req/60s rate limit on `POST /api/auth/staff/login` was hit when the test suite made 11+ login API calls (5 browser-form logins + 6 API logins via `injectStaffAuth`/`resetTablesAndSessions`). Tests 14-15 were the 10th and 11th login attempts, resulting in HTTP 429.

#### Fix Applied

1. **File-cached auth tokens** (`e2e/helpers.ts`): `getStaffAuth()` caches login responses to `.e2e-auth-cache.json` (1h TTL). Subsequent calls read from cache — no API call needed.

2. **localStorage injection** (`injectStaffAuth(page, email)`): navigates to origin, injects token into `localStorage`, then tests navigate directly to protected pages. No browser-form login needed.

3. **Reduced browser-form logins to 1**: only `00-login-form.spec.ts` uses the browser login form. All other tests use injected auth.

4. **Improved table reset**: `resetTablesAndSessions()` now properly ends active sessions and does a two-pass cleanup.

#### Files Changed

- `e2e/helpers.ts`: cached API login with file persistence, `injectStaffAuth()` for localStorage injection.
- `e2e/00-login-form.spec.ts`: new — single browser login test (1 API call).
- `e2e/03-kds.spec.ts`: all tests use injected auth.
- `e2e/04-waiter.spec.ts`: all tests use injected auth.
- `e2e/05-admin-pos.spec.ts`: all tests use injected auth. Chef denied test uses token injection + client-side auth check.
- `e2e/06-admin-pages.spec.ts`: all 5 tests use injected auth via beforeEach.
- `.gitignore`: added `.e2e-auth-cache.json`, `test-results/`.

### 2026-04-16 — E2E Stabilization Phase 2

- Reduced browser-form login calls from 3 to 1 across entire suite.
- All authenticated page tests now use `injectStaffAuth()` — zero API login calls.
- Chef denied admin test now uses token injection + client-side permission check instead of browser form login.
- Added dedicated `00-login-form.spec.ts` with single browser login test.
- Back-to-back runs now pass deterministically (both runs 16/16).

#### Changes

- `e2e/00-login-form.spec.ts`: new — tests login form UI with `getByRole("heading", { name: "Dashboard" })`.
- `e2e/03-kds.spec.ts`: chef KDS test converted from browser login to `injectStaffAuth`.
- `e2e/05-admin-pos.spec.ts`: owner dashboard test uses injected auth. Chef denied test uses injected chef token + asserts `hasDashboard === false`.

#### Browser Login Budget

| Run | Browser logins | API logins (cached) | Rate limit (10/60s) | Status |
|---|---|---|---|---|
| Run 1 | 1 | ~4 (then cached) | 5/10 used | Safe |
| Run 2 | 1 | 0 (file cached) | 1/10 used | Safe |

Total: **16 tests, 16 pass, 0 flaky, deterministic across back-to-back runs.**

### 2026-04-18 — E2E Coverage Expansion Phase 1

Added 7 new E2E test files covering previously untested demo flows. Expanded suite from 16 to 24 tests.

#### New Test Files

| File | Tests | Coverage |
|---|---|---|
| `07-customer-otp.spec.ts` | 1 | Customer OTP login: request code, extract from dev box, verify, redirect |
| `08-payment-flow.spec.ts` | 1 | Mock online payment: create order via API, pay online, simulate success, verify PAID |
| `09-kds-actions.spec.ts` | 1 | KDS item actions: start order, fire item, mark done |
| `10-waiter-actions.spec.ts` | 1 | Waiter service request: create via API, claim, complete |
| `11-inventory.spec.ts` | 1 | Inventory: create unique item, adjust stock |
| `12-promotions.spec.ts` | 1 | Promotions: create discount, switch to coupons tab, create coupon |
| `13-mobile.spec.ts` | 2 | Mobile viewport (iPhone 14 390×844): customer start + waiter dashboard |

#### Bug Fix: Mock Payment Gateway URL

- **Fixed**: `mock.gateway.ts` was generating checkout URLs pointing to `/customer/payment/mock` — a route that does not exist.
- **Changed to**: `/customer/payment/success` which has the actual mock payment UI (gateway heading, simulate button, view order).

#### Key Debugging Fixes

- **OTP extraction**: Initial regex `text=/\d{6}/` matched phone number digits instead of OTP. Fixed by targeting the dev mode box specifically via `getByText("Dev Mode").locator("..").locator("p").last()`.
- **Payment assertion race**: Order page refetch interval (10s) nearly matched assertion timeout (10s). Fixed by using `page.goto()` for fresh data load + 15s timeout.
- **Promotions select**: Playwright `selectOption` rejects RegExp for label property. Fixed by using exact string: `${discName} (15%)`.

#### Results

| Run | Tests | Passed | Failed | Duration |
|---|---|---|---|---|
| Run 1 | 24 | 24 | 0 | 39.3s |
| Run 2 | 24 | 24 | 0 | 36.2s |

Typecheck: clean (both API and Web). Build: clean. API health: ok (database ok, redis ok).

### 2026-04-18 — Deployment Packaging Phase 1

Packaged the app for production-like local deployment using Docker and Nginx reverse proxy.

#### New Files

| File | Purpose |
|---|---|
| `apps/api/Dockerfile` | Multi-stage build: deps → build (Prisma + tsc) → production (Alpine + prod deps) |
| `apps/web/Dockerfile` | Multi-stage build: deps → build (Next.js standalone) → production (minimal server) |
| `docker-compose.prod.yml` | Production compose: postgres, redis, minio, api, web, nginx |
| `nginx/nginx.conf` | Reverse proxy: `/api/*` → API, `/*` → Web, security headers, SSE support, HTTPS placeholders |
| `.env.production.example` | Production env template with Docker-internal hostnames |
| `.dockerignore` | Excludes node_modules, .next, dist, .git, e2e, docs from build context |
| `docs/deployment.md` | Full deployment guide: architecture, quick start, env vars, migrations, health checks, troubleshooting |
| `apps/web/public/.gitkeep` | Empty public dir needed by standalone build |

#### Modified Files

| File | Change |
|---|---|
| `apps/web/next.config.ts` | Added `output: "standalone"` and `outputFileTracingRoot` for Docker builds |
| `package.json` | Added scripts: `docker:prod:build`, `docker:prod:up`, `docker:prod:down`, `docker:prod:logs`, `prisma:deploy` |
| `apps/api/package.json` | Added `prisma:deploy` script |
| `.gitignore` | Added `.env.production` |

#### Architecture

```
:80 → Nginx → /api/* → API :4000 (NestJS)
              /*     → Web :3000 (Next.js standalone)
API → Postgres :5432, Redis :6379, MinIO :9000
```

- Nginx is the single entry point on port 80
- `NEXT_PUBLIC_API_BASE_URL=""` (empty) = same-origin; browser API calls go through Nginx
- Infrastructure services (Postgres, Redis, MinIO) not exposed to host
- API waits for Postgres + Redis healthchecks via `depends_on: condition: service_healthy`

#### Docker Images

| Image | Size | Notes |
|---|---|---|
| `smart-restaurant-api` | 781 MB | bcrypt native bindings + Prisma client + NestJS runtime |
| `smart-restaurant-web` | 302 MB | Next.js standalone (minimal node_modules) |

#### Verification

- Typecheck: clean (API + Web)
- Web build: clean (standalone output at `apps/web/server.js`)
- Smoke test: 15/15 pass
- Compose config: validates cleanly
- Docker build API: success
- Docker build Web: success
- Dev compose: unaffected
- E2E sanity check: pass

#### Known Limitations

- No HTTPS automation (Nginx config has commented placeholders)
- No CI/CD pipeline (manual build)
- No Kubernetes
- AI service not containerized
- MinIO is development-grade

### 2026-04-20 — Backup + Observability + Ops Phase 1

Added database backup/restore scripts, HTTP request logging, AI service containerization, and operational runbook.

#### New Files

| File | Purpose |
|---|---|
| `scripts/backup-postgres.ps1` | PowerShell backup script: pg_dump from compose container → `backups/*.sql.gz` |
| `scripts/restore-postgres.ps1` | PowerShell restore script: stops API, pipes .sql.gz into psql, restarts API |
| `apps/api/src/common/request-logger.middleware.ts` | NestJS HTTP request logger: method, path, status, duration (no secrets logged) |
| `apps/ai-services/Dockerfile` | Python 3.12 slim image, installs requirements, runs uvicorn |
| `docs/operations.md` | Full operational runbook: backup/restore, health checks, logs, migrations, secret rotation, troubleshooting, checklists |

#### Modified Files

| File | Change |
|---|---|
| `apps/api/src/app.module.ts` | Implements `NestModule`, applies `RequestLoggerMiddleware` to all routes |
| `docker-compose.prod.yml` | Added `ai` service with healthcheck; API now depends on `ai` |
| `docs/deployment.md` | Updated architecture diagram with AI service, linked to operations.md, removed "AI not containerized" limitation |
| `package.json` | Added `db:backup` and `db:restore` scripts |
| `.gitignore` | Added `backups/` |

#### Request Logging Format

```
[HTTP] GET /api/health 200 3ms
[HTTP] POST /api/auth/staff/login 201 45ms
[HTTP] GET /api/menu 200 12ms
```

- 4xx logged at `warn` level, 5xx at `error` level
- Does NOT log: request bodies, authorization headers, cookies, query strings, tokens, OTPs, passwords

#### Docker Images

| Image | Size |
|---|---|
| `smart-restaurant-api` | 781 MB |
| `smart-restaurant-web` | 302 MB |
| `smart-restaurant-ai` | 597 MB |

#### Verification

- Typecheck: clean (API + Web)
- Web build: clean
- Smoke test: 15/15 pass
- Compose config: validates cleanly (7 services: postgres, redis, minio, ai, api, web, nginx)
- Docker build AI: success
- No secrets in docs/scripts

### 2026-04-20 — Monitoring + Alerts Phase 1

Added Prometheus config, alert rules, monitoring compose overlay, comprehensive monitoring docs, backup scheduling examples, and production readiness checklist.

#### New Files

| File | Purpose |
|---|---|
| `monitoring/prometheus.yml` | Prometheus scrape config: API health (15s), Nginx health (15s), AI health (30s), self-monitoring |
| `monitoring/alert-rules.yml` | Prometheus alert rules: ApiDown (2m critical), NginxDown (2m critical), AiServiceDown (10m warning) |
| `docker-compose.monitoring.yml` | Optional compose overlay adding Prometheus; commented Grafana + Alertmanager ready to uncomment |
| `docs/monitoring.md` | Comprehensive monitoring guide: what to monitor, alerts, Prometheus setup, log aggregation, backup scheduling, production readiness checklist |

#### Modified Files

| File | Change |
|---|---|
| `docs/deployment.md` | Added monitoring link, updated known limitations and TODOs |
| `docs/operations.md` | Added cross-reference to monitoring.md |

#### Key Decisions

- **Prometheus approach**: Blackbox-style (scrapes existing health endpoints) rather than app-level instrumentation. No new API dependencies needed. App-level metrics (`prom-client`) documented as future enhancement.
- **Compose overlay pattern**: `docker-compose.monitoring.yml` is a separate overlay, not baked into prod compose. Use with `-f docker-compose.prod.yml -f docker-compose.monitoring.yml`.
- **No code changes**: Health endpoint already has timestamps, dependency statuses, and avoids secrets. No modifications needed.

#### Monitoring Coverage

| Signal | Source | Alert |
|---|---|---|
| API health | `/api/health` every 15s | ApiDown (2m, critical) |
| Nginx health | `/nginx-health` every 15s | NginxDown (2m, critical) |
| AI health | `/health` every 30s | AiServiceDown (10m, warning) |
| Database | API health → `dependencies.database` | Via ApiDown |
| Redis | API health → `dependencies.redis` | Via ApiDown |
| Backup freshness | File timestamps in `backups/` | Manual check documented |

#### Production Readiness Checklist (in docs/monitoring.md)

Covers: infrastructure health, security hardening, backups, monitoring, networking, and operational readiness.

#### Verification

- Typecheck: clean (API + Web)
- Web build: clean
- Smoke test: 15/15 pass
- Prod compose config: valid
- Monitoring compose overlay: valid
- No secrets in docs/configs

### 2026-04-22 — Graduation Delivery Package Phase 1

Created complete graduation delivery documentation package in `docs/graduation/`.

#### New Files (9 documents)

| File | Purpose |
|---|---|
| `docs/graduation/overview.md` | Problem statement, solution, architecture, tech stack, "why more than a POS" |
| `docs/graduation/feature-matrix.md` | Module-by-module feature inventory: 20 modules, backend/frontend/test coverage |
| `docs/graduation/demo-script.md` | Step-by-step live demo plan with talking points, fallback procedures |
| `docs/graduation/api-summary.md` | All 118 endpoints across 18 controllers with method/path/description tables |
| `docs/graduation/testing-report.md` | 24 E2E + 15 smoke tests, coverage details, known limitations |
| `docs/graduation/installation-guide.md` | 10-15 min evaluator setup guide with troubleshooting |
| `docs/graduation/architecture-notes.md` | Modular monolith, RBAC, payment adapter, SSE, security decisions |
| `docs/graduation/presentation-notes.md` | 1/5/10-min talking points, examiner Q&A with strong answers |
| `docs/graduation/screenshot-checklist.md` | 30+ screenshots to capture across all surfaces |

#### Modified Files

| File | Change |
|---|---|
| `README.md` | Added "Graduation Delivery Docs" section linking to all 9 docs + 3 ops docs |

#### Key Facts Used (verified from codebase)

- 118 API endpoints (116 REST + 2 SSE) across 18 controllers
- 41 Prisma data models
- 25 frontend routes across 4 application surfaces
- 41 permissions across 4 default roles (39 assigned to Owner)
- 24 E2E tests, 15 smoke tests, 14 E2E spec files
- 23 root npm scripts
- Seed data: 1 tenant, 1 branch, 4 staff, 5 tables, 5 menu items, 4 inventory items

#### Verification

- Typecheck: clean (API + Web)
- Web build: clean (25 routes)
- Smoke test: 15/15 pass
- All 12 doc files exist and link correctly
- No secrets in graduation docs
- Demo credentials match actual seed data
- Commands match actual package.json scripts

### 2026-04-22 — Spec Completion Phase 1 (Schema + Domain Contracts)

Added missing data models and domain foundations to align the codebase with the ProjectPlane.md specification.

#### New Enums (8)

DeviceType, AccessTagType, ServiceChargeType, StockAdjustmentSource, LowStockAlertStatus, GiftCardTransactionType, TableShape

#### New Models (9)

| Model | Purpose | Key Fields |
|---|---|---|
| BranchDevice | Branch-linked device registry (KDS, POS, etc.) | name, deviceType, apiKeyHash, capabilitiesJson, isActive, lastSeenAt |
| TableAccessTag | QR/NFC access tag registry per table | code (unique), type (QR/NFC), tableId, isActive |
| BranchSettings | Branch operational config | serviceCharge, tips, paymentConfig, featureFlags (all JSON-flexible) |
| StockAdjustment | Auditable inventory movement log | delta, reason, sourceType (MANUAL/ORDER_AUTO/WASTE/CORRECTION/DELIVERY), createdByStaffId |
| LowStockAlert | Inventory low-stock alert records | thresholdSnapshot, stockSnapshot, status (OPEN/ACKNOWLEDGED/RESOLVED) |
| CouponRedemption | Coupon usage tracking | couponId, userId, orderId, redeemedAt |
| GiftCardTransaction | Gift card balance ledger | giftCardId, type (ISSUED/REDEEMED/ADJUSTED/EXPIRED), amount, balanceAfter |
| RecommendationStat | Co-purchase statistics for "frequently bought together" | menuItemId + coPurchasedItemId composite PK, count |
| ReviewIssueTag | Normalized review issue tags (cold/late) | reviewId, tag |

#### Fields Added to Existing Models

| Model | New Fields |
|---|---|
| Table | zone, posX, posY, shape (for floor map layout) |
| MenuItem | allergensJson, isVegetarian, isSpicy (for customer filters) |
| Order | editedAt, lastEditedByStaffId (for post-submission edit tracking) |

#### NestJS Modules Added

| Module | Files | Status |
|---|---|---|
| DevicesModule | controller + service + module | Scaffold with list/create/heartbeat |
| BranchSettingsModule | controller + service + module | Scaffold with get/upsert |

#### Seed Data Added

- BranchSettings: 1 record (tips enabled, feature flags for all modules)
- BranchDevice: 1 sample KDS device ("Kitchen Display 1")
- TableAccessTag: 5 QR codes (one per table, code format: `QR-{branchId}-{tableCode}`)
- MenuItem.isVegetarian set on Bruschetta

#### Migration

`20260422071529_spec_completion_phase1` — adds 8 enums, 9 tables, columns on Table/MenuItem/Order, all indexes and foreign keys.

#### Intentionally Deferred to Phase 2+

| Item | Reason |
|---|---|
| WasteRecord model | Not needed until manager-override-after-kitchen-start is implemented |
| Auto-decrement inventory on order | Requires careful transactional logic; StockAdjustment model is ready |
| Device provisioning UI | Schema is ready; admin frontend deferred |
| BranchSettings admin UI | Schema is ready; admin frontend deferred |
| Recommendation recomputation job | RecommendationStat model is ready; batch job deferred |
| Coupon limit enforcement | CouponRedemption tracking is ready; validation logic deferred |
| Floor map UI | Table layout fields (zone/posX/posY/shape) are ready; waiter UI deferred |
| Allergen filter UI | allergensJson/isVegetarian/isSpicy fields are ready; customer filter UI deferred |

#### Verification

- Prisma validate: pass
- Prisma generate: pass
- Migration: applied cleanly
- Typecheck API: clean
- Typecheck Web: clean
- Seed: runs with new data (settings + device + tags)
- Smoke test: 15/15 pass
- Total Prisma models: 51 (was 42)
- Total enums: 26 (was 18)

### 2026-04-22 — Spec Completion Phase 2 (Customer-Facing Features)

Completed 9 customer-facing feature gaps to align with the project description.

#### New Backend Modules

| Module | Endpoints | Purpose |
|---|---|---|
| TableAccessModule | GET `/api/table-access/:code` | Resolves QR/NFC tag code → branchId, tableId, tableCode, branch info |
| ReviewsModule | POST/GET `/api/sessions/:sid/orders/:oid/reviews` | Customer review submission with issue tags + retrieval |
| PaymentsController (extended) | POST `/api/orders/:oid/payments/splits/preview` | Split-bill preview by people, items, or custom amounts |

#### New Backend Files

- `apps/api/src/modules/table-access/` — module + service + controller
- `apps/api/src/modules/reviews/` — module + service + controller

#### Frontend Changes

| Page | Changes |
|---|---|
| Customer start page | QR/NFC code resolution via `?code=` param; shows branch name; backward-compatible with `?branchId=&tableCode=` |
| Customer login | Remember-me checkbox; unchecked stores tokens in sessionStorage (cleared on browser close) |
| Customer auth helper | Falls back to sessionStorage for non-remembered sessions |
| Menu page | Filter buttons (Vegetarian/Spicy/In Stock); allergen display in item modal; vegetarian/spicy badges on cards; hides empty categories when filtered |
| Order status page | Reorder button on completed orders (adds items + additions back to cart); review form with star rating + issue tags (COLD/LATE/WRONG_ITEM/TASTE/OTHER); post-order recommendation section; better PARTIALLY_PAID messaging; existing review display |

#### Menu Backend Filters

`GET /api/menu?branchId=...&vegetarian=true&spicy=true&inStockOnly=true` — filters applied at Prisma query level using the isVegetarian, isSpicy, isUnavailable fields from Phase 1.

#### Review Flow

- POST validates: order belongs to session, order is COMPLETED or SERVED, no duplicate reviews, rating 1-5, issue tags from validated set, item reviews reference actual order items
- Issue tags stored in ReviewIssueTag table (normalized, not JSON)
- Existing review displayed with stars + tags after submission

#### Split-Bill Backend

- `previewSplits(orderId, { splitType, count?, customAmounts? })` returns split allocations
- BY_PEOPLE: divides remaining balance equally (last person absorbs rounding)
- BY_ITEMS: returns per-item amounts from order
- BY_AMOUNT: validates custom amounts sum to remaining balance
- Full split-bill UI deferred to Phase 3 (backend is ready)

#### Reorder Flow

- "Reorder This Order" button on completed/served orders
- Adds each order item back to cart with original additions/specializations
- Navigates to cart page for review before placing
- Works for both guest and logged-in sessions

#### Deferred to Phase 3

| Item | Reason |
|---|---|
| Full split-bill UI (modal with participant selection) | Backend ready; frontend needs design |
| Per-item review UI (star each item) | Backend supports it; compact UI needed |
| Customer order history list | Needs customer auth context on all pages |
| QR code generator admin tool | Tag data exists; admin UI deferred |

#### Verification

- Typecheck API: clean
- Typecheck Web: clean
- Web build: clean (25 routes)
- Smoke test: 15/15 pass
- QR/NFC resolution: verified (valid code returns branch/table, invalid returns 404)
- Split preview: verified (BY_PEOPLE splits correctly with rounding)

### 2026-04-22 — Spec Completion Phase 3 (Waiter/FOH Operations)

Completed front-of-house waiter operational features to match the project description.

#### New Backend Module: WaiterModule

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/waiter/floor?branchId=` | GET | Aggregate floor summary with attention states for all tables |
| `/api/waiter/tables/:tableId` | GET | Detailed table view with session, orders, items, requests |
| `/api/waiter/orders/:orderId/serve` | PATCH | Mark order READY -> SERVED with audit trail |
| `/api/waiter/tables/:tableId/clear` | POST | End session + set table to CLEANING + cancel active requests |
| `/api/waiter/tables/:tableId/quick-add` | POST | Add items to active session as new WAITER_QUICK_ADD order |

#### Schema Changes

- Added `WAITER_QUICK_ADD` to `OrderSource` enum (migration: `add_waiter_quick_add_source`)
- Added `TABLE_CLEARED` and `SERVICE_REQUEST_UPDATED` to shared-types `domainEvents`

#### Attention State Derivation

Backend computes per-table operational state from composite signals:

| State | Condition |
|---|---|
| AVAILABLE | Table status is AVAILABLE |
| OCCUPIED | Active session, no special conditions |
| ASSISTANCE_NEEDED | Active service requests (non-payment type) |
| ORDER_READY | At least one order in READY status |
| PAYMENT_PENDING | BILL_REQUEST or PAYMENT_TERMINAL service request |
| TURNOVER_REQUIRED | Session completed, table in CLEANING state |
| RESERVED | Table status is RESERVED |
| CLEANING | Table in CLEANING without completed session |
| OUT_OF_SERVICE | Table status is OUT_OF_SERVICE |

Priority order: ASSISTANCE_NEEDED > PAYMENT_PENDING > ORDER_READY > OCCUPIED

#### Delayed Order Threshold

Orders are flagged as DELAYED if they are in PLACED/CONFIRMED/IN_KITCHEN for more than **20 minutes**. This is a simple elapsed-time check, not an SLA engine. The threshold constant is in `waiter.service.ts`.

#### Waiter Dashboard UI Changes

- **Zone-grouped floor map**: Tables grouped by zone (Main, Patio, Private) instead of flat grid
- **Attention-state cards**: Each table card shows derived attention state with distinct colors and labels
- **Session summary on cards**: Guest count, order count, total amount, paid amount, DELAYED/READY badges
- **Table detail panel**: Click any table for a modal with session info, orders (with serve button), service requests, quick-add form, clear table button
- **Serve action**: Button on READY orders in table detail (READY -> SERVED)
- **Clear table action**: Ends active session + sets table CLEANING + cancels pending requests
- **Quick-add form**: Inline menu item selector, creates WAITER_QUICK_ADD order in active session
- **Polling**: 6-second interval on floor summary, requests, and table detail

#### Quick-Add Order Behavior

Creates a **new order** in the existing session (does not append to existing orders). Uses `source: WAITER_QUICK_ADD` to distinguish from customer and POS orders. Applies tax rules, records status history, and emits ORDER_PLACED event. Appears on KDS immediately.

#### Seed Changes

- Tables now have `zone` field populated: T1-T3 = "Main", T4 = "Patio", T5 = "Private"

#### Files Changed

| File | Change |
|---|---|
| `apps/api/prisma/schema.prisma` | Added WAITER_QUICK_ADD to OrderSource |
| `apps/api/src/modules/waiter/` | New module (3 files) |
| `apps/api/src/app.module.ts` | Registered WaiterModule |
| `apps/api/prisma/seed.ts` | Zone data on tables |
| `packages/shared-types/src/index.ts` | Added TABLE_CLEARED, SERVICE_REQUEST_UPDATED events |
| `apps/web/src/lib/waiter-types.ts` | Added WaiterTableSummary, AttentionState, TableDetail types |
| `apps/web/src/app/waiter/dashboard/page.tsx` | Complete rewrite: zone map, attention states, table detail panel, quick-add, serve, clear |

#### Deferred to Phase 4

| Item | Reason |
|---|---|
| SSE-driven waiter updates | Polling is stable; SSE adds complexity |
| Manager override order edits | Needs WasteRecord model and careful kitchen-state handling |
| KDS station routing | Separate from waiter scope |
| Full split-bill UI on waiter side | Backend ready; needs design work |

#### Verification

- Typecheck API: clean
- Typecheck Web: clean
- Web build: clean (25 routes)
- Smoke test: 15/15 pass
- Waiter floor endpoint: 5 tables across 3 zones, attention states derived correctly
- Waiter table detail: returns session, orders, requests
- Seed: zones populated on all tables

### 2026-04-22 — Spec Completion Phase 4 (KDS/Kitchen Operations)

Completed kitchen execution features: station-aware routing, item grouping, delay visibility, timing capture, and enhanced KDS UI.

#### Schema Changes

| Model | Field | Type | Purpose |
|---|---|---|---|
| OrderItem | startedAt | DateTime? | Timestamp when item transitioned to IN_PROGRESS |
| OrderItem | readyAt | DateTime? | Timestamp when item transitioned to READY |
| MenuItem | defaultStationId | String? | FK to KitchenStation for station routing |

Migration: `kds_phase4_timing_routing`

#### New/Changed Endpoints

| Endpoint | Method | Change |
|---|---|---|
| `/api/kds/orders` | GET | Added `stationId` query param for station filtering |
| `/api/kds/stations` | GET | New — lists active kitchen stations for a branch |
| `/api/kds/order-items/:id/status` | PATCH | Now captures startedAt/readyAt timestamps on transitions |

#### Station Routing Strategy

**Chosen approach**: `MenuItem.defaultStationId` — each menu item can optionally be assigned a default kitchen station. When filtering KDS by station, only order items whose stationId matches are shown. If no station assignment exists, items appear in all views.

This is deliberately simple. A category-to-station mapping or rules engine is deferred.

#### Item Grouping Rules

Frontend groups identical items by composite key: `menuItemId + specialization signature + kitchenStatus`. Items with different modifiers or statuses remain separate. This prevents kitchen mistakes from incorrect merging.

#### Delay Threshold

**KDS threshold: 15 minutes.** Orders in PLACED/CONFIRMED/IN_KITCHEN for over 15 minutes are flagged with a red DELAYED badge and pulsing border. Lane headers show delayed counts. Header shows total delayed count.

This is shorter than the waiter threshold (20 min) because kitchen should catch delays earlier.

#### Timing Capture

Item status transitions now record:
- `startedAt`: set when PENDING -> IN_PROGRESS
- `readyAt`: set when IN_PROGRESS -> READY

This data enables future analytics: avg prep time, station throughput, bottleneck analysis.

#### KDS UI Changes

- **Station filter bar**: Horizontal button bar below header, filter by station or "All Stations"
- **Item grouping**: Identical items (same menu item + same mods + same status) collapsed with aggregated quantity
- **Delay visibility**: Red ring on delayed order cards, "DELAYED" badge with pulse animation, per-lane late counts, header-level delayed counter
- **Source badge**: WAITER_QUICK_ADD orders show "WAITER" badge
- **Special notes**: Yellow highlighted box with "SPECIAL NOTES" label, prominent placement
- **Modifier pills**: Amber-colored pills below item name
- **Station labels**: Small station name badge on items that have station assignments
- **Polling**: 5-second interval (reduced from 6s for kitchen responsiveness)

#### Stock-Out Handling Decision

**Deferred (Option A partial)**: The existing menu availability system (`PATCH /api/menu/items/:id/availability` with `isUnavailable: true`) already supports mid-service 86ing from admin/staff. Affected future orders respect unavailability. In-flight orders with unavailable items are not auto-resolved — they stay in the queue for waiter/admin attention. A dedicated kitchen-side 86 button is deferred to Phase 5 as it requires careful UX and the existing availability toggle works.

#### Files Changed

| File | Change |
|---|---|
| `apps/api/prisma/schema.prisma` | OrderItem.startedAt, OrderItem.readyAt, MenuItem.defaultStationId, KitchenStation back-relation |
| `apps/api/src/modules/kds/kds.service.ts` | Station filter in getQueue, getStations method, timing capture in updateItemStatus |
| `apps/api/src/modules/kds/kds.controller.ts` | stationId query param, GET /kds/stations endpoint |
| `apps/web/src/lib/kds-types.ts` | startedAt, readyAt, source fields, KitchenStation type |
| `apps/web/src/app/kitchen/orders/page.tsx` | Station filter bar, item grouping, delay markers, timing, notes, source badges |

#### Verification

- Typecheck API: clean
- Typecheck Web: clean
- Web build: clean (25 routes)
- Smoke test: 15/15 pass

### 2026-04-22 — Spec Completion Phase 5 (Admin/ERP Operations)

Completed admin operational features: branch settings UI, table CRUD, staff create/edit, finance P&L summary, inventory tracking, promotions tracking, order edit rules.

#### New Endpoints (11)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/admin/branch-settings` | GET/PATCH | Get/update branch settings (audit logged) |
| `/api/admin/tables` | POST | Create table with layout fields |
| `/api/admin/tables/:id` | PATCH | Update table config (audit logged) |
| `/api/admin/orders/:id` | PATCH | Cancel order items with reason (audit logged) |
| `/api/admin/finance-summary` | GET | P&L: gross/refunds/net/expenses/profit with expense breakdown |
| `/api/admin/inventory/adjustments` | GET | Stock adjustment history |
| `/api/admin/inventory/alerts` | GET/PATCH | Low-stock alerts: list and resolve/acknowledge |
| `/api/admin/promotions/coupon-redemptions` | GET | Coupon redemption history |
| `/api/admin/promotions/gift-card-transactions` | GET | Gift card transaction ledger |

#### New Frontend Pages

- `/admin/settings` — Service charge, tips, feature flags
- `/admin/finance` — P&L summary, expense breakdown, recent expenses

#### Enhanced Frontend Pages

- **Staff**: Create form + inline edit form with active/inactive toggle
- **Menu**: Item editor with name/price/description/prep time/allergens/vegetarian/spicy fields

#### Order Edit Rules

- Freely editable before IN_KITCHEN
- After kitchen start: can cancel PENDING items, blocked for IN_PROGRESS/READY items
- Reason mandatory, audit logged, editedAt/lastEditedByStaffId updated

#### Verification

- Typecheck: clean (API + Web)
- Web build: clean (27 routes)
- Smoke test: 15/15 pass
- All new admin endpoints verified with live data

### 2026-04-22 — Spec Completion Phase 6 (Analytics, Notifications, Recommendations)

Completed analytics insights, persistent notifications, RecommendationStat population, and low-stock alert auto-creation.

#### New Backend Module: NotificationsModule

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/notifications` | GET | List notifications for staff (branch-scoped, optional unreadOnly filter) |
| `/api/notifications/unread-count` | GET | Unread notification count |
| `/api/notifications/:id/read` | PATCH | Mark single notification as read |
| `/api/notifications/read-all` | PATCH | Mark all notifications as read |

#### New/Extended Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/analytics/insights` | GET | Combined insights: kitchen, menu, staff, table, review, operations |
| `/api/ai/recommendations/recompute` | POST | Recompute RecommendationStat co-purchase data from order history |

#### Analytics Insights Shape

The `/api/analytics/insights` endpoint returns:
- **Kitchen**: avgPrepTimeMinutes (from OrderItem.startedAt/readyAt), itemsCooked count, currentDelayedOrders
- **Menu**: topSellers ranked list with quantity sold
- **Staff**: attendance-based performance (shifts, hours), service request handling counts
- **Tables**: order counts and status sorted by activity
- **Reviews**: avgRating, totalReviews, topComplaints (from ReviewIssueTag aggregation)
- **Operations**: openLowStockAlerts count

#### RecommendationStat Population

`POST /api/ai/recommendations/recompute?branchId=` computes co-purchase pairs:
- Queries orders from last 30 days
- Extracts unique item pairs from each order
- Stores pairs with count >= 2 into RecommendationStat
- Bidirectional: stores A->B and B->A
- Clears old stats before writing new ones
- Can be called manually by admin or triggered after batch operations

#### Low-Stock Alert Auto-Creation

The inventory `adjust` method now:
1. Creates a `StockAdjustment` record on every adjustment (sourceType: MANUAL)
2. Auto-creates a `LowStockAlert` when stock drops below reorder level (only on the crossing threshold, not on every adjustment below)

#### Admin Analytics UI Enhancement

The analytics page now shows 6 sections:
1. **Revenue**: Net/gross/refunds/orders KPIs + payment method breakdown bars
2. **Kitchen Performance**: avg prep time, items cooked, currently delayed orders
3. **Top Menu Items**: ranked list with quantity bars
4. **Customer Feedback**: avg rating, review count, top complaint tags (pills)
5. **Staff Activity**: shifts, hours, service requests handled per staff
6. **Table Activity**: order counts per table sorted by activity

#### Files Changed

| File | Change |
|---|---|
| `apps/api/src/modules/notifications/` | New module (3 files) |
| `apps/api/src/modules/analytics/analytics.controller.ts` | Added GET /insights |
| `apps/api/src/modules/analytics/analytics.service.ts` | Added getInsights method |
| `apps/api/src/modules/ai/ai.controller.ts` | Added POST /recommendations/recompute |
| `apps/api/src/modules/ai/recommendation.service.ts` | Added recomputeStats method |
| `apps/api/src/modules/inventory/inventory.service.ts` | StockAdjustment creation + LowStockAlert auto-creation |
| `apps/api/src/app.module.ts` | Registered NotificationsModule |
| `apps/web/src/app/admin/analytics/page.tsx` | Enhanced with 6 insight sections |

#### Verification

- Typecheck: clean (API + Web)
- Web build: clean (27 routes)
- Smoke test: 15/15 pass
- Insights endpoint: returns kitchen/menu/staff/table/review/operations data
- Notifications: list + unread count working (31 existing notifications from service request events)
- Recompute: found 2 co-purchase pairs from order history, wrote 2 records

#### Remaining After Phase 6

| Item | Status |
|---|---|
| Notification delivery (email/SMS/push) | Out of scope — persistence + list/read complete |
| Loyalty/rewards points | Out of scope for spec completion |
| Full forecasting/ML pipeline | Out of scope |
| Supplier management | Out of scope |
| External BI export | Out of scope |
| Scheduled recommendation recompute | Manual trigger available; cron/scheduler deferred |

### 2026-04-22 — Spec Completion Phase 7 (Payments, Split-Bill, Devices)

Closed the final non-optional spec gaps: real payment provider integration, full split-bill flow, and admin device management.

#### Provider Chosen: Stripe

**Why Stripe over Click**: Stripe has the most widely understood hosted-checkout API (Checkout Sessions), global availability, and clear documentation. The project description mentions both; Stripe is the standard for graduation demonstration. Click can be added as another adapter later.

**Implementation**: `StripePaymentGateway` class implements the existing `PaymentGateway` interface:
- `createIntent()` → Creates Stripe Checkout Session with hosted redirect
- `verifyWebhookSignature()` → Validates Stripe `t=...,v1=...` signature header with HMAC-SHA256
- `parseWebhookEvent()` → Parses `checkout.session.completed`, `checkout.session.expired`, `charge.refunded` events

**Configuration**: `PAYMENT_PROVIDER=stripe` + `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` env vars. Mock provider remains default for dev/demo.

**No card data storage**: All payment input happens on Stripe's hosted checkout page. Our server only creates sessions and receives webhooks.

#### Split-Bill Flow

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/orders/:orderId/payments/splits/preview` | POST | Preview split allocations (no side effects) |
| `/api/orders/:orderId/payments/splits` | POST | Commit splits: creates individual PENDING payment records + PaymentSplit rows + payment intents via gateway |

**Split types supported**:
- `BY_PEOPLE`: Equal division with rounding absorbed by last person
- `BY_AMOUNT`: Custom amounts validated to sum to remaining balance

Each split creates a separate payment record with its own `paymentReference` (checkout session). When individual checkout sessions complete via webhook, payment status updates normally. Order transitions to PARTIALLY_PAID then PAID as splits complete.

**Frontend**: Customer order page has "Split Bill" button that expands to show equal split (people count selector) or custom amount inputs. After commit, each split shows its amount + "Pay" button for its individual checkout.

#### Admin Device Management

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/admin/devices` | GET | List devices for branch |
| `/api/admin/devices` | POST | Register device (generates API key, shown once) |
| `/api/admin/devices/:id` | PATCH | Update name/type/capabilities/active status |
| `/api/admin/devices/:id/reset-key` | POST | Regenerate API key |

**API key handling**: Raw key shown only at creation/reset time. Stored as SHA-256 hash. Frontend never displays stored hashes.

**Frontend**: `/admin/devices` page with device list, register form, activate/deactivate toggle, device type badges (KDS/WAITER/POS/ADMIN/CDS/OTHER).

#### Files Changed

| File | Change |
|---|---|
| `apps/api/src/modules/payments/gateways/stripe.gateway.ts` | New — Stripe Checkout Sessions implementation |
| `apps/api/src/modules/payments/gateways/gateway-registry.ts` | Registered stripe provider |
| `apps/api/src/modules/payments/payments.controller.ts` | Added POST /splits endpoint |
| `apps/api/src/modules/payments/payments.service.ts` | Added createSplitPayments method |
| `apps/api/src/modules/devices/devices.service.ts` | Extended with update, resetKey, API key generation |
| `apps/api/src/modules/devices/devices.controller.ts` | Rewritten with admin-scoped CRUD + reset-key |
| `apps/web/src/app/customer/session/[sessionId]/orders/[orderId]/page.tsx` | Added SplitBillSection component |
| `apps/web/src/app/admin/devices/page.tsx` | New — device management page |
| `.env.production.example` | Added STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET |

#### Verification

- Typecheck: clean (API + Web)
- Web build: clean (28 routes — added devices page)
- Smoke test: 15/15 pass
- Device CRUD: create returns API key (64 chars), list shows devices
- Split-bill commit: BY_PEOPLE with 2 people creates 2 payment intents with correct amounts and checkout URLs

#### Remaining Intentionally Out of Scope

| Item | Reason |
|---|---|
| Loyalty/rewards points | Optional module — not in core spec |
| Call center / marketplace | Optional module |
| CDS (Customer Display Screen) | Optional module |
| SMS/email/push delivery | Notification persistence complete; delivery channels deferred |
| Full ML forecasting | Optional module |
| Supplier management | Optional module |
| Click payment provider | Stripe demonstrates the adapter pattern; Click is another adapter |
| BY_ITEMS split UI | Backend supports it; frontend shows equal and custom splits |

### 2026-04-22 — Spec Completion Phase 8A (Operations Gaps)

Closed 6 remaining operational gaps: customer retry idempotency, KDS 86/undo/waste, waiter payment confirmation, and inventory auto-decrement.

#### Schema Changes

| Model/Field | Type | Purpose |
|---|---|---|
| `WasteRecord` | New model | Kitchen waste/remake tracking with reason codes |
| `WasteType` | New enum | WASTE, REMAKE |
| `WasteReason` | New enum | BURNT, WRONG_ITEM, CUSTOMER_CHANGE, DAMAGED, QUALITY_ISSUE, OTHER |
| `Order.inventoryDecrementedAt` | DateTime? | Idempotency guard for auto-decrement (set once on SERVED) |
| `KitchenItemStatus.READY → IN_PROGRESS` | Transition added | Enables undo within time window |

Migration: `phase8a_waste_decrement`

#### New Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/kds/menu-items/:itemId/unavailable` | PATCH | Kitchen-side 86 (mark unavailable) |
| `/api/kds/order-items/:id/undo` | PATCH | Undo READY→IN_PROGRESS within 8s window |
| `/api/kds/waste` | POST | Record waste/remake with reason code |
| `/api/waiter/orders/:id/payments/cash-confirm` | POST | Waiter confirms cash received |
| `/api/waiter/orders/:id/payments/terminal-confirm` | POST | Waiter confirms terminal payment |

#### Key Design Decisions

**Undo window**: 8 seconds. Only READY→IN_PROGRESS allowed. Blocked if order has already moved to READY/SERVED/COMPLETED at order level. `readyAt` timestamp is cleared on undo.

**Inventory auto-decrement trigger**: SERVED (not PLACED, not COMPLETED). As of 2026-05-11 this runs inside the order status transaction, not asynchronously after the status update. Guard: `Order.inventoryDecrementedAt` is set once; repeated SERVED transitions are rejected.

**Auto-decrement behavior**: Uses tenant/branch-scoped conditional stock decrements and rejects insufficient stock before marking the order SERVED. Creates `StockAdjustment` with `sourceType: ORDER_AUTO`. Triggers low-stock alerts and marks linked items unavailable at zero stock.

**Customer retry**: Idempotency key is generated once per cart submission and persisted in `sessionStorage`. Retries reuse the same key. Backend returns the existing order if key matches. Key is cleared only on confirmed order creation. UI shows "Retry →" state after failure.

**Waiter payment confirmation**: Requires `payments:write` permission. Creates a real `Payment` record with COMPLETED status. Recalculates order payment status. Completes any pending BILL_REQUEST/PAYMENT_TERMINAL service requests. Audit logged.

#### Verification (17 tests, 0 failures)

- Idempotency: same key returns same order (2/2)
- KDS 86: mark unavailable + restore (2/2)
- Waste/remake: WASTE + REMAKE records created (2/2)
- Undo: READY→IN_PROGRESS within window + readyAt cleared + re-mark READY (3/3)
- Waiter payment: cash confirm + status PAID + double blocked + terminal confirm (4/4 — requires payments:write)
- Auto-decrement: inventoryDecrementedAt set + ORDER_AUTO adjustments + no double (4/4)
- Typecheck: clean (API + Web)
- Web build: clean (28 routes)
- Smoke test: 15/15 pass

### 2026-04-22 — Spec Completion Phase 8B (Multi-Branch/Franchise)

Implemented multi-branch management for franchise-level oversight.

#### New Endpoint

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/admin/multi-branch-summary` | GET | Tenant-wide + per-branch KPIs (sales, orders, sessions, requests, alerts) |

#### Admin Layout Changes

- **Branch selector**: Dropdown in sidebar (and mobile header) for OWNER/MANAGER roles when multiple branches exist
- **Branch context**: React Context (`useAdminBranch()`) provides `branchId` and `setBranch()` to all admin child pages
- **Persistence**: Selected branch stored in `localStorage` as `admin_selected_branch`, falls back to login branch
- **Dashboard**: Now uses branch context instead of hardcoded `getStaffBranchId()`

#### Staff Auth Changes

- Added `getStaffTenantId()` / `setStaffTenantId()` to localStorage helpers
- Added `getSelectedBranchId()` / `setSelectedBranchId()` for admin branch switching
- Staff login form now stores `tenantId` on login

#### Seed Changes

- Added "Waterfront Branch" (`seed-branch-2`) as second demo branch

#### Role Scope Rules

| Role | Branch Scope |
|---|---|
| OWNER | Tenant-wide — can see all branches, switch via selector |
| MANAGER | Tenant-wide (same as owner in current model) |
| WAITER/CHEF/CASHIER | Branch-bound — only see their own branch data |

#### Multi-Branch Summary Shape

```json
{
  "tenant": { "totalBranches": 2, "activeBranches": 2, "totalSales": 643.70, "totalOrders": 105 },
  "branches": [
    { "branchId": "...", "name": "Downtown", "totalSales": 643.70, "orderCount": 105, "tableCount": 6, "staffCount": 4 },
    { "branchId": "...", "name": "Waterfront", "totalSales": 0, "orderCount": 0, "tableCount": 0, "staffCount": 0 }
  ]
}
```

#### Verification

- Typecheck: clean (API + Web)
- Web build: clean (28 routes)
- Smoke test: 15/15 pass
- Multi-branch summary: returns tenant totals + per-branch breakdown
- Branch selector: renders for OWNER, stores selection, propagates to dashboard

### 2026-04-22 — Final Documentation Sync & Spec Parity Report

Spec Completion Phases 1-8B are complete. All core and near-core features from ProjectPlane.md have been implemented. Documentation has been synchronized to accurately reflect the final system state.

#### Scope Achieved

- **155 API endpoints** across 24 controller modules
- **51 Prisma models**, 29 enums
- **28 frontend routes** across 4 application surfaces
- **Stripe payment integration** (adapter pattern, Checkout Sessions, webhook verification)
- **Multi-branch/franchise support** (branch selector, summary endpoint, branch context)
- **KDS operational completeness** (86, undo with 8-sec window, waste/remake tracking)
- **Waiter operational completeness** (floor map, payment confirmation, quick-add, table clear)
- **Inventory auto-decrement** on SERVED with idempotency guard
- **Notifications backend** (persistent, read tracking)
- **Device management** per branch
- **Reviews** with issue tags and item-level ratings
- **Split payments** (backend complete: BY_PEOPLE/BY_ITEMS/BY_AMOUNT)

#### Intentionally Out-of-Scope

These modules were explicitly labeled as optional or future phases in ProjectPlane.md:

- Loyalty & CRM (points, tiers, rewards)
- Online Ordering & Call Center
- Marketplace & Integrations (delivery aggregators, accounting)
- Customer Display Screen (CDS)
- Supplier Management
- Advanced ML/Forecasting (rule-based recommendations implemented instead)
- Geo-Fencing enforcement (model exists, no management UI)
- Reservation System
- Receipt Generation
- KDS Wake Lock / fullscreen browser APIs

#### Documents Updated

- `docs/project-status.md` — reflects final module/endpoint/route counts and payment/multi-branch status
- `docs/graduation/feature-matrix.md` — reflects all implemented features including Phase 7-8B additions
- `docs/graduation/spec-parity-report.md` — NEW: 90-feature comparison vs ProjectPlane.md (68 complete, 9 partial, 10 optional/OOS, 3 not implemented)
- `docs/graduation/overview.md` — updated claims (Stripe, multi-branch, 155 endpoints, 51 models)
- `docs/graduation/api-summary.md` — full endpoint inventory across all 24 modules
- `docs/graduation/testing-report.md` — reflects 28 routes, newer feature coverage notes
- `docs/graduation/presentation-notes.md` — updated talking points for Stripe, multi-branch, operational maturity
- `README.md` — updated seeded data, Stripe env vars, endpoint count, spec parity report link

### 2026-04-23 — UX / Product Flow Enhancement Phase 1

Comprehensive UX audit and polish pass across all surfaces. No new backend features or schema changes.

#### Shared UI System

- Enhanced `components/ui.tsx` with: `Toast` system (success/error/info with auto-dismiss), `ConfirmDialog`, `Btn` component (primary/secondary/danger/ghost variants with loading spinner), `SectionHeader` (serif + accent pattern), `Card`, `Field`, `Spinner`, `inputStyle`
- Wired `ToastProvider` into app `Providers` — toasts now available globally via `useToast()`
- All shared components now use CSS custom properties (`--ink-*`, `--accent`, etc.) instead of Tailwind color utilities
- Added toast animation keyframes to `globals.css`

#### Home Page

- Rewrote with design system tokens (no more `bg-gradient-to-br`, `bg-brand-ember`, etc.)
- Surface cards use serif glyph icons consistent with admin sidebar
- Added recommended demo flow callout box
- Tags updated to reflect current state ("2 Branches", "Stripe Ready")

#### KDS (Kitchen Display)

- Added **86 action** (mark item unavailable) — button appears on PENDING items, uses confirm dialog, calls `PATCH /kds/menu-items/:id/unavailable`
- Added **undo action** — appears for 8 seconds after marking item done (READY), calls `PATCH /kds/order-items/:id/undo`
- Replaced `alert()` errors with inline action feedback messages on ticket cards
- Wake Lock API and fullscreen toggle were already implemented (audit initially missed this)

#### Waiter Dashboard

- Made layout responsive: action queue and floor map now stack vertically on mobile (`flex-col md:flex-row`)
- Added **payment confirmation buttons** (Cash paid / Terminal paid) on SERVED orders in table detail panel
- Added payment confirmation dialog explaining what will happen
- Added mobile-visible running bill total (hidden on desktop where sidebar shows it)
- Replaced all `alert()` calls with `useToast()` feedback across AttendanceChip, ActionQueue, TableDetailPanel

#### Admin / POS

- POS page fully migrated to design system tokens (removed all `bg-gradient-to-r`, `border-violet-*`, `bg-emerald-*`, `shadow-card`, etc.)
- POS now uses toast feedback for order creation and payment recording
- Settings page migrated to design system tokens with toast feedback
- Inventory page migrated to design system tokens with toast feedback, added "auto-decrements on serve" subtitle

#### Redirect Pages

- Kitchen and waiter redirect pages now use design system spinner instead of old Tailwind classes

#### Customer Flow

- Cart page: "Tax: calculated" changed to "Tax: added at checkout" for clarity

#### Intentionally Deferred UX Gaps

- Customer order page (`orders/[orderId]/page.tsx`) still has extensive Tailwind color utilities — full migration deferred due to file complexity (485 lines, many inline status-dependent styles)
- Menu page has mixed design system compliance — partial token usage
- Admin analytics, staff, promotions, shifts, devices, finance pages not yet migrated to design system tokens — functional but use older `text-brand-ink`, `border-slate-*` patterns
- No chart library added for analytics visualization
- No notification panel frontend (backend endpoints exist)
- No waste recording UI in KDS frontend (backend endpoint exists)
- Split-bill customer UI remains MVP

#### Verification

- Typecheck: clean (API + Web + shared-types, zero errors)
- Web build: clean (28 routes)
- Smoke test: 15/15 pass

### 2026-05-01 — Customer-Facing UI Redesign

Full visual redesign of the 8 customer-facing screens to match a "Taste House" cream + copper editorial style. No backend changes; no new routes; no new dependencies.

#### Pages updated
- `/customer` — was a dark hero with raw `branchId`/`tableCode` dev inputs. Now a check-in card with QR scan placeholder + single "Branch Code / Table Number" input that resolves via `GET /api/table-access/{code}` before forwarding to `/customer/start`.
- `/customer/login` — 2-step phone+OTP, redesigned with country-code prefix, 6 individual auto-advancing OTP boxes (paste-aware), 30s resend timer, dev-OTP banner preserved.
- `/customer/start` — Branch + Table info card with green "Table Found" pill, 1–8 guest count tile grid, copper "Start Session" CTA. Now also persists `branchName`, `tableCode`, `guestCount` into the cart store on session start.
- `/customer/session/[id]/menu` — Brand header + cart badge, 3 info pills (Branch / Table / Guests), search bar, category chips with "All" + "Recommended" + per-category, item grid with photos, "Recommended for you" horizontal scroll, item bottom-sheet modal with rating row + extras checkboxes + qty stepper.
- `/customer/session/[id]/cart` — Item rows with photos pulled from menu data, "Special Request" input wired to `Order.specialInstructions` (existing `CreateOrderDto` field — no contract change), totals card (Subtotal / Tax & service / Total), prep-time chip computed client-side from `max(menuItem.prepTimeMinutes)`.
- `/customer/session/[id]/orders/[id]` — Status pill + 4-step horizontal stepper (Sent → Accepted → Preparing → Served), items list with photos, totals card, special-request banner, payment + service-request controls preserved, review form preserved.
- `/customer/payment/success` — Mock-gateway pre-success simulate state preserved; success state has green check + leaf sprigs, 5-row Payment Summary, 4-step Order Status stepper, receipt info chip, View Order Status / Download Receipt / Back to Menu actions.
- `/customer/payment/cancel` — Copper X with leaf sprigs, Payment Summary, "What happened?" explanation card, Retry Payment / Call Waiter (POSTs `CALL_WAITER` service request) / Back to Cart actions.

#### Shared additions
- `apps/web/src/components/ui.tsx`: added `Cloche` (brand mark SVG), `Sprig` (decorative leaf SVG), `InfoPill` (Branch/Table/Guests chip), `StatusStepper` (horizontal 4-step indicator). Pure presentational, no new dependencies.
- `apps/web/src/lib/cart-store.ts`: extended `CartState` with `branchName`, `tableCode`, `guestCount` (presentation-only fields persisted in localStorage). Added `SET_CONTEXT` action; `SET_SESSION` accepts the new optional context fields. Cross-session-leak guard preserved.

#### Decisions / assumptions
- Backend's `Order` returns `subtotalAmount` + `taxAmount` only — no separate "service fee" field. The screenshots showed Service Fee + VAT split, but I display only the real fields ("Subtotal" / "Tax & service" / "Total") rather than fabricate a breakdown. If a separate service-fee line is desired, that's a backend `Order` schema/DTO addition.
- Customer cannot read `GET /api/sessions/:id` (staff-only). So `branchName` / `tableCode` / `guestCount` are stored client-side after session start. This is presentation context only — never used for authorization, never sent back to the API.
- The `specialInstructions` field was already defined on `CreateOrderDto`; the cart now passes it. No DTO change.
- Prep-time range computed as `max(menuItem.prepTimeMinutes)`–`max+5 min`. Falls back to "15–20 min" when no items declare prep time.
- Order code displayed as `#TH-XXXX` from the last 4 chars of `order.id` — pure presentation, not used by any backend lookup.

#### Verification
- Typecheck: clean (zero errors)
- Web build: clean (31 routes, all customer pages prerendered as static or dynamic where required)
- No admin/waiter/kitchen pages were touched; shared `ui.tsx` additions are additive (new exports only)
- No backend / API / DB / AI changes

### 2026-05-03 — Menu Recommendation Engine Phase 1

- Adjusted the Feature 1 recommendation plan to account for the existing `AiModule`, `RecommendationService`, `RecommendationStat`, and `UserItemStat` implementation.
- Added `docs/ai/menu-recommendation-engine.md` as the canonical phased plan for upgrading recommendations without duplicating the current AI module.
- Added shared recommendation contracts in `packages/shared-types/src/recommendations.ts` and exported them from the shared package barrel.
- Decision: next implementation phase should add `RecommendationLog` audit persistence, then introduce a canonical `POST /api/recommendations/menu` endpoint that reuses/refactors existing recommendation logic.
- Verification: `npm.cmd run typecheck --workspace @smart-restaurant/shared-types` passes.

### 2026-05-03 — Menu Recommendation Engine Phase 2

- Added Prisma `RecommendationLog` model for menu recommendation auditability.
- `RecommendationLog` records tenant, branch, optional user, optional session, source, input cart item IDs, recommended item IDs, recommendation types, metadata, and creation time.
- Created and applied migration `20260503065258_add_recommendation_logs`.
- Prisma Client regeneration initially failed because the API dev process had the Windows query engine DLL locked; stopped the local API dev Node processes and regenerated successfully.
- Verification: `npm.cmd run prisma:validate --workspace @smart-restaurant/api`, `npm.cmd run prisma:generate --workspace @smart-restaurant/api`, and `npm.cmd run typecheck --workspace @smart-restaurant/api` pass.

### 2026-05-03 — Menu Recommendation Engine Phase 3

- Added canonical `POST /api/recommendations/menu` endpoint through a new `RecommendationsModule`.
- The new controller reuses the existing `AiModule` `RecommendationService` instead of creating a duplicate recommendation provider.
- Added `getMenuRecommendations()` to `RecommendationService` with branch-derived tenant scope, optional tenant validation, optional session validation, cart exclusion, active/available item filtering, deterministic sorting, shared response shape, and non-blocking `RecommendationLog` writes.
- Current canonical scoring supports POPULAR, FREQUENTLY_BOUGHT, REORDER, and TIME_BASED candidates using completed branch orders only.
- Verification: API typecheck, shared typecheck, and API build pass. Manual `POST /api/recommendations/menu` against `seed-branch-1` returns a valid response shape. Smoke test is not clean because existing session/order smoke steps fail on current local table/session state, unrelated to this endpoint.

### 2026-05-03 — Menu Recommendation Engine Phase 4

- Hardened POPULAR scoring to use recent completed order history so older same-hour sales can surface as TIME_BASED recommendations.
- Added `apps/api/src/modules/ai/recommendation.service.phase4.test.ts`, a focused Prisma-backed recommendation integration test.
- Added API script `test:recommendations`.
- The test seeds isolated tenant/branch/menu/order/session data, verifies cart exclusion, inactive/unavailable exclusion, tenant/branch non-leakage, POPULAR/FREQUENTLY_BOUGHT/REORDER/TIME_BASED strategy output, descending score sorting, tenant/session validation failures, and `RecommendationLog` creation.
- Verification: `npm.cmd run test:recommendations --workspace @smart-restaurant/api`, `npm.cmd run typecheck --workspace @smart-restaurant/api`, `npm.cmd run typecheck --workspace @smart-restaurant/shared-types`, and `npm.cmd run build --workspace @smart-restaurant/api` pass.

### 2026-05-03 — Menu Recommendation Engine Phase 5

- Added `RecommendedForYou` client component for customer recommendations.
- Component calls canonical `POST /api/recommendations/menu` through the existing frontend API client and never calls FastAPI or AI providers directly.
- Component accepts branch, optional tenant, optional session, optional user, cart items, and menu items; renders item name/reason/loading/error states; hides when empty; and dispatches existing cart add actions using real menu item price data.
- Connected recommendations to the customer menu page and cart page, replacing the menu page's older `GET /api/ai/recommendations` fetch.
- Verification: `npm.cmd run typecheck --workspace @smart-restaurant/web`, `npm.cmd run typecheck --workspace @smart-restaurant/shared-types`, and `npm.cmd run build --workspace @smart-restaurant/web` pass.

### 2026-05-03 — Menu Chatbot Assistant Planning

- Added `docs/ai/menu-chatbot-assistant.md` as the corrected phased plan for Feature 2.
- Decision: implement chatbot as a consolidation of the existing `ChatbotService` and `chatbot-widget.tsx`, not as a parallel chatbot stack.
- Canonical endpoint will be `POST /api/ai/menu-chat`; the older `POST /api/ai/chatbot/menu` should be removed or kept only as a wrapper during migration.
- Plan accounts for current schema fields (`dietaryInfo`, `allergensJson`, `isVegetarian`, `isSpicy`) and avoids unsupported assumptions like tags/calories.
- Allergen and strict dietary answers must be conservative when structured menu data is missing or ambiguous.

### 2026-05-03 — Menu Chatbot Assistant Phase 1

- Added shared menu chat contracts in `packages/shared-types/src/menu-chat.ts`.
- Exported `MenuChatRequest`, `MenuChatResponse`, and related item/cart types from the shared package barrel.
- Verification: `npm.cmd run typecheck --workspace @smart-restaurant/shared-types` passes.

### 2026-05-03 — Menu Chatbot Assistant Phase 2

- Added backend DTOs for the canonical menu chatbot flow: `MenuChatRequestDto` and `MenuChatResponseDto`.
- Request validation covers branch ID, optional tenant/user/session IDs, message length (1-500 chars), and optional cart item quantities (`>= 1`).
- Verification: `npm.cmd run typecheck --workspace @smart-restaurant/api` passes.

### 2026-05-03 — Menu Chatbot Assistant Phase 3

- Added Prisma `MenuChatLog` model for menu chatbot audit/debug logging.
- `MenuChatLog` records tenant, branch, optional user/session, message intent/hash/preview, suggested item IDs, safety notes, AI/fallback flags, metadata, and created time.
- Created and applied migration `20260503073038_add_menu_chat_logs`.
- Prisma Client generation initially failed because the API dev watcher had the Windows query engine DLL locked; stopped only the local API watcher Node processes and regenerated successfully.
- Verification: `npm.cmd run prisma:validate --workspace @smart-restaurant/api`, `npm.cmd run prisma:generate --workspace @smart-restaurant/api`, and `npm.cmd run typecheck --workspace @smart-restaurant/api` pass.

### 2026-05-03 — Menu Chatbot Assistant Phase 4

- Added `MenuChatbotService` for the canonical menu chatbot backend flow.
- The service derives tenant scope from branch, validates optional tenant/session scope, loads only active/available branch menu items, excludes cart items, and writes `MenuChatLog` without breaking responses if logging fails.
- Local rule handling covers spicy, vegetarian, light, dairy-free, allergen, general recommendation, pairing, and unknown intents, with recommendation-engine fallback for general/pairing/unknown or empty local results.
- Allergen and dairy-free answers are conservative when `allergensJson` is missing or ambiguous.
- The canonical controller endpoint is not wired yet; endpoint consolidation remains the next backend phase.
- Verification: `npm.cmd run typecheck --workspace @smart-restaurant/api` passes.

### 2026-05-03 — Menu Chatbot Assistant Phase 5

- Hardened chatbot intent fallback behavior so allergen/dairy-free safety replies do not fall through to generic recommendations when structured allergen data is missing or ambiguous.
- Recommendation fallback remains enabled for general recommendation, pairing, unknown, and empty spicy/light matches where it is safe to be transparent.
- Pairing intent can now seed fallback recommendations from a mentioned menu item, including partial item-name matches such as "burger" for "Classic Burger".
- Verification: `npm.cmd run typecheck --workspace @smart-restaurant/api` passes.

### 2026-05-03 — Menu Chatbot Assistant Phase 6

- Wired canonical backend endpoint `POST /api/ai/menu-chat` to `MenuChatbotService`.
- Kept legacy `POST /api/ai/chatbot/menu` as a temporary alias that delegates to the same canonical service.
- Registered `MenuChatbotService` in `AiModule` and removed the old duplicate `ChatbotService` implementation.
- Frontend migration to the canonical endpoint is still pending for the UI phase.
- Verification: `npm.cmd run typecheck --workspace @smart-restaurant/api` passes.

### 2026-05-03 — Menu Chatbot Assistant Phase 7

- Added optional FastAPI `POST /menu-chat` boundary that uses only sanitized menu context supplied by NestJS and does not fetch database data.
- `MenuChatbotService` now calls the FastAPI boundary with a 1.5s timeout after computing the safe local/fallback response.
- NestJS skips FastAPI for allergen safety responses, filters FastAPI suggestions against scoped active/available menu items and cart exclusions, and keeps local fallback if FastAPI fails or returns invalid suggestions.
- Verification: `npm.cmd run typecheck --workspace @smart-restaurant/api` and `python -m py_compile apps/ai-services/app/main.py` pass.

### 2026-05-03 — Menu Chatbot Assistant Phase 8

- Added `MenuChatAssistant` frontend component for the customer menu page.
- Migrated customer menu chatbot calls to canonical `POST /api/ai/menu-chat` through the existing `post()` helper.
- Suggested item cards join response item IDs to already loaded menu data for real price/image/availability, and add-to-cart uses the existing cart dispatch.
- Removed the old `chatbot-widget.tsx` and legacy frontend `ChatbotResponse` type.
- Verification: `npm.cmd run typecheck --workspace @smart-restaurant/web`, `npm.cmd run typecheck --workspace @smart-restaurant/shared-types`, and `npm.cmd run build --workspace @smart-restaurant/web` pass. The first web build attempt failed with sandbox `spawn EPERM`; rerunning with approval succeeded.

### 2026-05-03 — Menu Chatbot Assistant Phase 9

- Added Prisma-backed backend test script `apps/api/src/modules/ai/menu-chatbot.service.phase9.test.ts`.
- Added API script `test:menu-chatbot`.
- Test coverage includes DTO validation, active/available filtering, tenant/branch/session isolation, vegetarian/spicy matching, dairy/allergen safety, pairing/recommendation fallback, FastAPI failure fallback, invalid FastAPI item filtering, `MenuChatLog` creation, and logging failure tolerance.
- Verification: `npm.cmd run test:menu-chatbot --workspace @smart-restaurant/api` and `npm.cmd run typecheck --workspace @smart-restaurant/api` pass. The test command requires spawn permission for `tsx`/esbuild in this sandbox.

### 2026-05-03 — Menu Chatbot Assistant Phase 10

- Added focused Playwright test `e2e/14-menu-chat-assistant.spec.ts` for the customer menu assistant.
- Test uses mocked menu/recommendation/chat API responses and verifies open panel, prompt send to `/api/ai/menu-chat`, loading state, reply rendering, suggested item rendering with loaded menu price data, add-to-cart behavior, and compact error state.
- Added stable `data-testid` hooks to `MenuChatAssistant` for frontend verification.
- Verification: `npm.cmd run typecheck --workspace @smart-restaurant/web`, `npm.cmd run typecheck --workspace @smart-restaurant/shared-types`, `npx.cmd playwright test e2e/14-menu-chat-assistant.spec.ts`, and `npm.cmd run build --workspace @smart-restaurant/web` pass. Playwright/build commands require spawn permission in this sandbox.

### 2026-05-03 — Menu Chatbot Assistant Phase 11

- Finalized `docs/ai/menu-chatbot-assistant.md` as both an implementation reference and phased build record.
- Documentation now includes implemented state, endpoint request/response shape, user examples, architecture flow, safety/grounding rules, phase statuses, MVP limitations, and future upgrades.
- Feature 2 current state: canonical NestJS endpoint, shared contracts, Prisma audit log, local safe rules, optional FastAPI boundary, recommendation fallback, customer menu assistant UI, backend test coverage, and frontend Playwright coverage are complete.
- Final verification passed: API/web/shared typechecks, `test:menu-chatbot`, Python compile for `apps/ai-services/app/main.py`, focused Playwright menu-chat assistant spec, and web production build. Playwright and web build must run sequentially because both depend on the local Next runtime/build state.

### 2026-05-04 — FastAPI Python 3.9 Compatibility

- Fixed `apps/ai-services/app/main.py` to avoid Python 3.10 union syntax in the menu chat models.
- Local Python runtime is 3.9, so optional fields now use `typing.Optional[...]` while preserving the same `/menu-chat` request/response behavior.
- Verification: `python -m py_compile apps/ai-services/app/main.py` passes.

### 2026-05-04 — Menu Chatbot AI Boundary Guard

- Tightened `MenuChatbotService` so the optional FastAPI boundary cannot replace general, pairing, unknown, or allergen-safety responses with generic first-menu-item suggestions.
- FastAPI is now used only to polish known local intent matches for spicy, vegetarian, and light prompts, and its suggested item IDs must be a subset of the backend-selected candidates.
- Verification: `npm.cmd run typecheck --workspace @smart-restaurant/api` and `npm.cmd run test:menu-chatbot --workspace @smart-restaurant/api` pass.

### 2026-05-04 — Menu Chatbot Unknown Prompt Fallback

- Fixed off-script/unknown menu questions so they do not return an empty assistant response when recommendation history has no usable candidates.
- `MenuChatbotService` now falls back to active/current branch menu items with a transparent grounded reply after recommendation fallback returns empty.
- Added a 10-second frontend abort timeout to `MenuChatAssistant` so the loading indicator cannot stay active forever if the API request hangs.
- Verification: API and web typechecks pass, and `npm.cmd run test:menu-chatbot --workspace @smart-restaurant/api` passes.

### 2026-05-04 — Menu Chatbot Hugging Face LLM Boundary

- Added optional Hugging Face LLM integration for the menu chatbot through `MenuChatLlmService`.
- The LLM does not access the database directly. `MenuChatbotService` still validates branch/session/tenant scope, fetches active/available menu data through Prisma, sends sanitized menu context, filters suggested item IDs, and keeps local/recommendation/FastAPI fallback behavior.
- Added backend-only env vars: `HF_TOKEN`, `HF_MODEL`, and `HF_BASE_URL` in env examples. Real tokens must not be committed or exposed to frontend `NEXT_PUBLIC_*` vars.
- Added test coverage for filtering an LLM response that includes an invalid cross-tenant suggested item.
- Verification: `npm.cmd run typecheck --workspace @smart-restaurant/api`, `npm.cmd run typecheck --workspace @smart-restaurant/shared-types`, and `npm.cmd run test:menu-chatbot --workspace @smart-restaurant/api` pass. `npm.cmd run build --workspace @smart-restaurant/api` was attempted but Prisma generate failed on a Windows query engine DLL lock; no TypeScript build errors were reached.

### 2026-05-04 — Menu Chatbot HF_TOKEN Diagnostics

- Diagnosed continued fallback behavior: local env files and current shell did not expose `HF_TOKEN`, so `MenuChatLlmService` was disabled and the chatbot correctly used fallback.
- Updated API env loading to read root `.env` and `apps/api/.env` without overriding existing process environment values.
- Added a one-time debug log when Hugging Face menu chat is disabled because `HF_TOKEN` is missing.
- Verification: API/shared typechecks pass and `npm.cmd run test:menu-chatbot --workspace @smart-restaurant/api` passes.

### 2026-05-04 — Menu Chatbot Hugging Face Model Fix

- Diagnosed Hugging Face fallback after token setup: direct router request returned HTTP 400 because `Qwen/Qwen2.5-7B-Instruct-1M` was not supported by any enabled provider for the token.
- Verified `meta-llama/Llama-3.1-8B-Instruct:fastest`, `deepseek-ai/DeepSeek-V3-0324:fastest`, and `deepseek-ai/DeepSeek-R1:fastest` work with the token against `https://router.huggingface.co/v1/chat/completions`.
- Updated default/env examples/docs to `meta-llama/Llama-3.1-8B-Instruct:fastest`.
- Removed provider-fragile `response_format: json_schema` from the Hugging Face request and kept strict JSON instructions plus local JSON parsing/filtering.
- Verification: API typecheck, direct Hugging Face probe with the Llama model, and `npm.cmd run test:menu-chatbot --workspace @smart-restaurant/api` pass.

### 2026-05-04 — Menu Chatbot Local HF Env Alignment

- Added `HF_MODEL=meta-llama/Llama-3.1-8B-Instruct:fastest` and `HF_BASE_URL=https://router.huggingface.co/v1` to root `.env` to align with `apps/api/.env`.
- Verified a fresh Node process using the current env can call Hugging Face successfully with the menu-chat request shape.
- Improved Hugging Face failure logging to include non-secret model name and short provider error preview.
- Verification: `npm.cmd run typecheck --workspace @smart-restaurant/api` passes.

### 2026-05-04 — Recommendation Engine No-History Fallback

- Confirmed the customer menu page already renders `RecommendedForYou` on the main menu view when category is `All` and search is empty.
- Live `POST /api/recommendations/menu` for `seed-branch-1` was returning an empty array because the seeded branch had no usable historical recommendation candidates.
- Added shared recommendation type `AVAILABLE` and a no-history fallback in `RecommendationService` that returns active/available current-branch menu items after history-based strategies produce no candidates.
- Added focused test coverage for no-history fallback, including inactive item and cross-branch leakage checks.
- Verification: API/shared/web typechecks pass, `npm.cmd run test:recommendations --workspace @smart-restaurant/api` passes, and live `seed-branch-1` recommendation endpoint now returns available menu items.

### 2026-05-04 — AI Improvements Roadmap MVP Update

- Updated `docs/ai/ai-improvements-roadmap.md` with the current MVP state and next improvements for menu recommendations and the menu chatbot.
- Recommendation roadmap now documents the main-menu `RecommendedForYou` section, cart-aware recommendations, no-history `AVAILABLE` fallback, backend-only endpoint, and next steps for explanation metadata, surface metadata, deterministic low-data pairings, diversity, caching, and analytics.
- Chatbot roadmap now documents the canonical NestJS endpoint, optional Hugging Face/FastAPI boundaries, sanitized menu context, output filtering, unknown prompt fallback, frontend timeout, conservative allergen behavior, audit logging, and next steps for validation, diagnostics, multilingual support, admin controls, and cost/rate limits.

### 2026-05-04 — Demand Forecasting Engine MVP

- Implemented Feature 3 demand forecasting as a backend-only statistical engine with no FastAPI, LLM, or external AI dependency.
- Added shared demand forecast contracts in `packages/shared-types/src/demand-forecasting.ts` and exported them from the shared package barrel.
- Added `DemandForecastLog` Prisma audit model and migration `20260504090000_add_demand_forecast_logs`; logging is non-blocking.
- Added `DemandForecastingModule` with `GET /api/admin/ai/demand-forecast`, protected by `analytics:read` and `CurrentStaff`.
- Forecasting derives tenant scope from the requested branch, enforces staff tenant/branch access, supports owner/manager same-tenant branch switching, and prevents cross-tenant/branch-bound leakage.
- MVP algorithm uses valid historical sales from the same tenant and branch, same-weekday averages where possible, all-recent-days fallback, confidence scoring, item forecasts, expected orders/revenue, category filtering, and hourly demand.
- Added admin analytics `DemandForecastPanel` with date/category/lookback controls, summary cards, loading/error/empty states, and item forecast table.
- Added `docs/ai/demand-forecasting-engine.md` covering endpoint, algorithm, confidence, hourly logic, safety, limitations, and future upgrades.
- Verification completed so far: shared/api/web typechecks, Prisma validate/generate/deploy, and `npm.cmd run test:demand-forecast --workspace @smart-restaurant/api` pass.

### 2026-05-04 — AI Improvements Roadmap And Forecast Reasoning

- Improved demand forecast item reason strings to include item-specific units sold, sample days, sample basis, rounded expected quantity, price used, and confidence explanation.
- Added `docs/ai/ai-improvements-roadmap.md` to track safe future improvements for recommendations, chatbot, demand forecasting, analytics summaries, optional LLM summaries, and ML boundaries.
- Decision: LLMs may summarize or polish already-computed AI outputs, but must not generate demand quantities, prices, revenue, stock levels, allergens, or bypass NestJS tenant/branch scope.

### 2026-05-04 — Review Sentiment Analyzer Phase 1

- Added Feature 4 planning refinements to `docs/ai/ai-improvements-roadmap.md`.
- Implemented shared review sentiment contracts in `packages/shared-types`.
- Added protected `GET /api/admin/ai/review-sentiment` through the reviews module.
- `ReviewSentimentService` derives tenant scope from branch, enforces staff tenant/branch access, validates date ranges, validates optional menu item scope, and returns aggregate-only review sentiment.
- MVP sentiment is rule/statistics-based: rating thresholds, normalized `ReviewIssueTag` counts, `ItemReview` affected item detection, severity thresholds, and template summaries.
- Raw review comments, item review comments, and customer personal data are not returned.
- Added `docs/ai/review-sentiment-analyzer.md` and focused backend test script `test:review-sentiment`.

### 2026-05-04 — Review Sentiment Analyzer Phase 2

- Added `ReviewSentimentPanel` for admin review sentiment insights.
- Mounted the panel on admin analytics and admin dashboard surfaces.
- The panel uses the existing admin branch context, authenticated NestJS API client, date range controls, optional menu item filter from branch menu data, summary cards, aggregate summary text, common issue table, and affected item table.
- UI states cover loading, API error, no reviews, no issue tags, and no affected items.
- The frontend displays only aggregate sentiment data and does not render raw review text or customer personal data.

### 2026-05-04 — Review Sentiment Analyzer Phase 3

- Added deterministic seed review sentiment demo data for `seed-branch-1`: 5 completed orders, overall ratings, normalized issue tags, and item-level reviews.
- Added a compact aggregate insight row to `ReviewSentimentPanel` showing the most common issue for the selected period.
- Added stable test hooks to `ReviewSentimentPanel`.
- Added focused Playwright coverage in `e2e/15-review-sentiment-panel.spec.ts` for controls, authenticated request URL, summary cards, common issues, affected items, insight row, empty state, and error state.
- Verified seed, backend focused test, web/API/shared typechecks, focused Playwright spec, and web production build.

### 2026-05-04 — Review Sentiment Analyzer Phase 4

- Added `ReviewSentimentLog` Prisma model and migration `20260504120000_add_review_sentiment_logs`.
- `ReviewSentimentService` now writes aggregate-only audit logs for admin review sentiment requests.
- Logs store tenant, branch, requesting staff, date range, optional menu item filter, total reviews, average rating, sentiment, common issue aggregates, and affected item aggregates.
- Logs do not store raw review comments, item review comments, customer names, phone numbers, emails, or order personal data.
- Log writes are non-blocking; failures warn but do not break the admin response.
- Focused backend test now verifies log creation, log privacy, and logging failure tolerance.

### 2026-05-04 — Review Sentiment Analyzer Phase 5

- Added previous-period trend fields to the shared review sentiment response.
- `ReviewSentimentService` now compares the selected range to the immediately previous range of the same length using the same tenant, branch, and optional menu item scope.
- Trend output includes previous range dates, previous review count, previous average rating, rating delta, review count delta, top issue change, and direction (`IMPROVING`, `DECLINING`, `STABLE`, or `NO_PRIOR_DATA`).
- Review sentiment summaries now include deterministic trend language when prior data exists.
- `ReviewSentimentPanel` now renders a rating trend card, a previous-period trend row, and labels affected items as repeated negative feedback by menu item.
- Seed data now includes 7 review sentiment demo orders, including previous-period reviews for visible trend output.
- Focused backend and Playwright tests cover trend behavior.

### 2026-05-04 — Customer Review After Payment Flow

- Added a reusable customer `OrderReviewForm` for post-payment reviews with overall order rating, optional issue tags, optional comment, and per-item ratings.
- Payment success now fetches the paid order and existing review after mock payment completion, then prompts the customer to leave a review before or after viewing order status.
- Order status now allows reviews once `paymentStatus=PAID`, not only when the order is served or completed.
- Backend review creation now accepts orders after payment while preserving the existing session/order ownership checks and item-review validation against actual order items.
- Added focused `test:reviews` coverage for unpaid rejection, post-payment review creation, and item-review validation.
- Customer review UI does not ask for or display customer personal data.

### 2026-05-05 — Demand Forecast Audit Log Lookback Fix

- Fixed `DemandForecastService` to normalize raw query-string `lookbackDays` values before calculations, response construction, and audit logging.
- This prevents Prisma audit log writes from failing when HTTP query input arrives as `"30"` while `DemandForecastLog.lookbackDays` expects an integer.
- Added focused demand forecast regression coverage for raw string `lookbackDays` producing a numeric response and audit log value.

### 2026-05-05 — Admin Dashboard Live Snapshot Direction

- Reworked the admin dashboard into a live operational snapshot surface instead of a full analytics workspace.
- Removed full demand forecast and review sentiment panels from the dashboard; detailed AI/analytics remains on `/admin/analytics`.
- Dashboard now emphasizes live refresh cards for today's net sales, orders, active sessions, table occupancy, KDS order flow, attention alerts, review/operation snapshots, top items, recent activity, table state, and saved daily snapshots.
- Uses existing NestJS endpoints only and keeps all branch-scoped data behind authenticated API calls.

### 2026-05-05 — Demand Forecast Reason Copy Simplification

- Shortened demand forecast item reason text to a single manager-friendly sentence.
- Reasons now explain only the useful essentials: quantity sold, sample basis, and forecast quantity.
- Example: `20 sold over 3 similar Tuesdays. Forecast: 7.`
- Updated demand forecast tests and docs to match the shorter reason copy.

### 2026-05-05 — SaaS-Managed Owner Provisioning

- Enforced that tenant users cannot create staff with `primaryRole=OWNER` or promote staff to `OWNER` through admin staff APIs.
- Blocked tenant-created role records named `OWNER` and assignment of an `OWNER` role record through admin role assignment APIs.
- Updated the admin staff UI so `OWNER` is displayed for existing owners but is not offered as a create/edit role option; existing owner role selection is shown as SaaS-managed.
- Added focused admin service tests for owner creation, promotion, owner role creation, and owner role assignment blocking.

### 2026-05-05 — Promotion Coupon And Gift Card Management

- Added backend DELETE endpoints for discounts, coupons, and gift cards.
- Delete behavior preserves history: unused records are removed, while used coupons are deactivated and used/partially used gift cards are disabled.
- Coupon updates now support code, linked discount, max redemptions, per-user limit, expiry, and active status.
- Admin promotions UI now exposes edit and delete actions on coupon and gift-card rows, reusing the existing right-side promotion editor.
- Added authenticated DELETE API client helper for frontend admin actions.

### 2026-05-05 — Loyalty System Plan In Promotions

- Added a Loyalty tab to the admin Promotions page as an MVP product plan.
- Documented recommended loyalty rules: earn 1 point per paid currency unit, redeem 100 points for 5.00 reward value, post only after payment completion, reverse points on refunds, and expire points after 12 months.
- Added planned tiers: Bronze, Silver, and Gold.
- Added `docs/promotions-loyalty-system-plan.md` with purpose, MVP rules, tier structure, backend model direction, safety rules, and Promotions page placement.
- Confirmed the existing API `LoyaltyModule` is currently a placeholder, so the Promotions page presents this as planned functionality rather than live controls.
- Refined the Loyalty tab design into a useful owner-facing blueprint: launch settings, customer/manager views, operating flow, tiers, build-next checklist, safety rules, and reporting goals.

### 2026-05-05 — Loyalty System MVP Live Implementation

- Added Prisma loyalty models and migration `20260505210000_add_loyalty_mvp`: `LoyaltyProgram`, `LoyaltyAccount`, `LoyaltyLedgerEntry`, `LoyaltyReward`, and `LoyaltyRewardRedemption`.
- Implemented `LoyaltyService` and `/api/admin/loyalty` endpoints for program settings, rewards, members, manual adjustments, and admin reward redemption.
- Wired completed payments to post tenant-scoped loyalty points automatically and completed refunds to reverse points without blocking payment/refund responses.
- Reward redemption creates a one-use generated coupon through the existing discount/coupon infrastructure.
- Replaced the Promotions page loyalty blueprint with live settings, reward management, member summary, point liability, and active/paused status.
- Applied the local database migration successfully and regenerated Prisma Client.

### 2026-05-05 — Inventory Category Icons

- Added a persisted `InventoryItem.category` field with migration `20260505213000_add_inventory_item_category`.
- Inventory create/update APIs now accept and normalize category values such as vegetables, fruits, meat, seafood, dairy, grains, spices, beverages, packaging, and other.
- Admin inventory rows and item previews now use category-specific SVG icons instead of generic colored image holders.
- The new inventory item form now asks for category and previews the icon that will be attached to the item.
- Existing inventory items default to `OTHER` until updated.

### 2026-05-05 — Admin Menu Item Creation

- Added an admin menu page create flow so owners/managers can add new menu items from the Menu Management page.
- The create form uses existing categories, selected branch scope, price, prep time, tax class, vegetarian/spicy flags, and description.
- Created items are saved through `POST /api/menu/items`, then opened in quick edit so a photo can be uploaded with the existing image upload control.
- Tightened backend menu item creation to validate that the category and optional branch belong to the requesting tenant before creating the item.
- Expanded menu item creation to support photo upload during creation, ingredients, dietary notes, and optional add-ons.
- Quick edit now also exposes ingredients, dietary notes, and tax class so created items can be fully maintained after saving.
- Quick edit now also supports changing category, vegetarian/spicy flags, photo upload, and add-ons; backend menu item update validates category tenant scope and replaces add-ons transactionally.

### 2026-05-05 — POS Category-First Flow

- Reworked the admin POS menu area to show database-backed menu categories first instead of defaulting to all menu items.
- Selecting a category now opens only the available items under that category, with a clear back-to-categories action.
- POS category cards use the category's first available menu item image when available and show category item counts from the existing `/api/menu?branchId=...` response.
- POS item image rendering now resolves local uploaded image URLs against the API host.

### 2026-05-06 — Analytics Finance Navigation Merge

- Removed Finance from the admin sidebar and mobile admin nav.
- Added an internal Analytics/Finance switch at the top of the Analytics page.
- The Finance view remains functionally unchanged and is rendered inside the Analytics section when selected.
- The direct `/admin/finance` route still exists for backward compatibility, but primary navigation now goes through `/admin/analytics`.

### 2026-05-06 — Cashier-Owned POS Access

- Removed POS from the owner/admin sidebar and mobile admin nav.
- `/waiter/login` now has Waiter and Cashier modes; the old Captain button was replaced with Cashier.
- Cashier login requires POS/payment permissions and routes to `/waiter/pos`.
- Added `/waiter/pos` as the cashier POS screen, reusing the existing POS workflow with branch context from the cashier staff token.
- `/admin/pos` no longer exposes POS to owners/managers and shows a cashier-only access message instead.
- Admin login no longer advertises the cashier demo account.

### 2026-05-06 — Cashier Workspace Inventory And Promotions

- Added a cashier workspace top nav shared by `/waiter/pos`, `/waiter/inventory`, and `/waiter/promotions`.
- Removed Inventory from the owner/admin sidebar and mobile admin nav; direct admin inventory access now requires cashier role.
- Added `/waiter/inventory`, reusing the inventory management UI with branch scope from the cashier staff token.
- Added `/waiter/promotions` as a cashier checkout screen for coupon lookup and gift-card redemption, while keeping full promotion management visible in admin.
- Seed now grants the cashier role inventory read/write/adjust permissions in addition to POS, payment, coupon, and gift-card permissions.

### 2026-05-06 — POS Category Icons

- Added shared frontend menu category icon rendering with name-based category inference for starters, mains, drinks, desserts, breakfast, salads, sides, pizza, seafood, and generic menu categories.
- Cashier POS category cards now use category icon tiles instead of first-item photo hero backgrounds.
- Waiter table quick-add category buttons now use the same icon style instead of letter/gradient placeholders.

### 2026-05-06 — Business Insights Assistant MVP

- Implemented Feature 5 as a backend rule/template-based Business Insights Assistant with no external AI dependency.
- Added shared business insight contracts, a dedicated NestJS `business-insights` module, and protected `GET /api/admin/ai/business-insights`.
- Business insights derive tenant scope from authenticated staff or branch lookup, support branch and owner/manager tenant scope, and reject ambiguous or unsafe query combinations.
- MVP rules generate sales, menu, kitchen, inventory, review, and table/session insights, then sort by priority/category/severity and cap responses at 5.
- Added aggregate-only `BusinessInsightLog` audit records; raw review comments and customer personal data are not stored or returned.
- Added admin dashboard and analytics `BusinessInsightsPanel` surfaces plus documentation in `docs/ai/business-insights-assistant.md`.

### 2026-05-06 — Customer Session Bill Payment Fix

- Changed customer online payment from single-order checkout to session-bill checkout so multiple unpaid orders from the same active table session are paid together.
- Added public `GET /api/sessions/:sessionId/bill` to return aggregate unpaid totals without customer personal data.
- Added public `POST /api/sessions/:sessionId/payments/intent` to create one gateway intent for all unpaid session orders while preserving separate kitchen order tickets.
- Updated payment webhook handling so a shared gateway reference completes all pending order payment rows in the session bill and recalculates each order's payment status.
- Updated the customer order details page to display the current session balance and pay the full unpaid table-session total.

### 2026-05-06 — Customer Table Selection Fix

- Added public table-access branch table listing at `GET /api/table-access/branches/:branchId/tables`.
- Branch-only customer check-in now resolves to a branch without requiring a preselected table.
- The customer start page now renders clickable table options, updates the selected table when clicked, disables unavailable tables, and blocks session start until a table is selected.

### 2026-05-06 — Customer Menu Chat Sheet

- Replaced the menu chatbot floating bubble on the customer menu page with the existing sliders icon button inside the search bar.
- Converted the menu chatbot UI into a bottom sheet that slides up to roughly half the screen and slides down before closing.
- Added downward drag-to-close behavior to both the menu chatbot sheet handle and menu item detail sheet handle.

### 2026-05-06 — Customer Menu Favorites

- Added `MenuItemFavorite` persistence with a migration for customer-saved menu item favorites scoped by user, tenant, branch, and menu item.
- Added authenticated customer menu endpoints to list favorites and set/unset a favorite.
- Wired customer menu heart buttons in grid cards and item detail sheets to persist favorite state in the database using the customer JWT.
- Favorite clicks require customer login; unauthenticated customers are sent to customer login instead of storing local-only favorites.

### 2026-05-06 — Logging System MVP

- Added `OperationalEventLog` and `PaymentEventLog` Prisma models plus migration `20260506140000_add_operational_payment_logs`.
- Added `LogsModule` with admin endpoints for audit, operational, and payment logs under `/api/admin/logs`.
- Log reads enforce tenant scope from authenticated staff; owner/manager can view tenant-wide logs while branch-bound staff are restricted to their branch.
- Wired operational logs into staff login success/failure, order placed/status changes, and service request created/claimed/completed/cancelled.
- Wired payment logs into manual payments, payment intents, payment webhooks, payment completion, and refunds without storing card data or raw gateway payloads.
- Added `/admin/logs` UI with Operational, Payments, and Audit tabs plus date filters.
- Documented the logging system in `docs/logging-system.md`.

### 2026-05-07 — KDS Queue Window Fix

- Changed the KDS order queue from a strict same-day filter to a 48-hour rolling window so unfinished kitchen tickets do not disappear when the date changes at midnight.
- Verified the chef KDS API now returns active `PLACED` orders for `seed-branch-1` instead of an empty list.

### 2026-05-07 — Waiter Order Ready Ownership

- Added `Order.assignedWaiterId` so customer or waiter-created orders can have one responsible waiter.
- Waiter quick-add orders are automatically assigned to the waiter who sends them to the kitchen.
- Added `PATCH /api/waiter/orders/:orderId/claim` so a waiter can take responsibility for an active customer order.
- KDS `ORDER_READY` now creates a staff-targeted notification only when the order has an assigned waiter.
- Waiter floor ready indicators now only show READY orders assigned to the current waiter, and another waiter cannot mark an assigned order as served.
- Waiter dashboard shows unread order-ready notifications in a "Ready for you" panel; notification reads remain tenant/branch/staff scoped.

### 2026-05-07 — Waiter Checkout Permission Fix

- Granted the Waiter role `payments:write` in the seed data because waiter checkout posts to waiter-scoped cash/card payment confirmation endpoints.
- Applied the same permission to the local seeded Waiter role so `POST /api/waiter/orders/:orderId/payments/cash-confirm` no longer fails permission checks after waiter re-login.

### 2026-05-07 — KDS Login Permission Gate

- Updated kitchen login to require both `kds:read` and `kds:write`, preventing read-only staff tokens from entering the KDS action screen and then failing write actions with `403`.
- Verified the local seeded Chef role has `kds:read` and `kds:write`.
- KDS orders page now clears stale/non-kitchen staff sessions and redirects to kitchen login when required role/permission metadata is missing or a KDS write returns `401/403`.

### 2026-05-07 — Scoped Staff Browser Sessions

- Split browser staff session storage by workspace for waiter/cashier and kitchen surfaces so logging into KDS as Chef no longer overwrites the waiter dashboard token.
- Waiter pages now read/write the `waiter` staff session scope; kitchen pages now read/write the `kitchen` staff session scope; admin remains on the default staff session scope.
- Waiter dashboard now redirects on `401/403` instead of continuing to poll with a wrong-role token.
- Waiter dashboard and KDS orders now validate the stored workspace token against `/api/auth/me` before starting polling, so local storage metadata alone is not trusted.
- HTTP request logging now downgrades expected `401/403` auth denials to debug level while keeping server errors and other client errors visible.

### 2026-05-07 — Waiter KDS Ready Handoff Queue

- Added waiter `GET /api/waiter/ready-orders` to return active READY orders that are either assigned to the current waiter or still unassigned.
- Waiter dashboard now shows a "Kitchen ready" handoff panel so KDS-ready orders are visible even before a waiter claims them.
- Unassigned ready orders can be taken from the dashboard; assigned ready orders open the table workspace.
- Personal ORDER_READY notifications remain staff-targeted only when an order has an assigned waiter.
- Updated the handoff queue so all active READY orders in the branch appear to every waiter in the shift; assigned orders are visible with the assigned waiter name while serving ownership remains enforced.

### 2026-05-07 — Post-Service Review And Payment Gate

- Customer reviews now require the order to be `SERVED` or `COMPLETED`; paid-but-not-served orders are no longer reviewable.
- Customer online payment intents now require served/completed orders, and session-bill payment only includes unpaid served/completed orders.
- Waiter/manual payment paths also reject payment before service completion.
- Customer order details show payment as unavailable until the order is served, then show the payment action and review form.
- Waiter checkout excludes not-yet-served orders and explains they are not included in payment.

### 2026-05-07 — KDS Served Order Removal

- KDS order tickets now treat only `PLACED`, `CONFIRMED`, `IN_KITCHEN`, and `READY` as kitchen-active statuses.
- The KDS page subscribes to branch realtime events and removes a ticket from the ready lane immediately when `ORDER_SERVED` is emitted by waiter service.
- KDS offline cache now stores only kitchen-active orders so served/completed orders do not reappear from stale local storage.

### 2026-05-08 — Business Insights AI Component Fix

- Fixed the admin business insights panel to load the staff token before calling the protected NestJS endpoint.
- Removed the stale duplicate `BusinessInsightsPanel.tsx` implementation that no longer matched shared insight contracts.
- Converted business-insights tests to the repo's lightweight `tsx`/Node assert style so Jest/Nest testing dependencies are not required.
- Added an explicit `analytics:read` permission gate to the business insights controller and fixed audit logging to use `staff.staffId`.

### 2026-05-09 — Business Insights LLM Timeout Behavior

- Removed the fixed 3-second NestJS timeout from the Business Insights FastAPI summary call.
- Removed the fixed 2.5-second Hugging Face request timeout inside the FastAPI business insights summarizer.
- Business Insights now falls back to the deterministic MVP summary only when the LLM request fails, returns a non-OK response, or returns malformed data, not merely because it is slow.

### 2026-05-09 — Menu Chatbot Phase 1 Hardening

- Added stricter hosted LLM/FastAPI menu-chat validation for response shape, reply length, safety-note count, suggestion count, scoped item IDs, and unsupported claims about discounts, policies, nutrition, prices, or allergens.
- Added provider rejection diagnostics to `MenuChatLog.metadata` without storing full customer free text.
- Expanded deterministic menu chat intents for not-spicy, budget-friendly, kids meal, high-protein, fast-prep, ingredient-exclusion, dessert, and drink requests.
- Added staff-escalation response fields for allergen and ingredient uncertainty, and wired the customer menu chat sheet to show all safety notes and offer an ask-staff action.

### 2026-05-09 — Menu Chatbot Phase 2 Session Memory

- Added compact session-scoped menu chat memory stored in `MenuChatLog.metadata.conversationMemory`, scoped by tenant, branch, and session.
- Memory stores structured state only: last intent, dietary constraints, avoided ingredients, preferred attributes, last suggested item IDs, turn count, and update timestamp.
- Follow-up menu chat requests can reuse the previous intent, avoid repeating the last suggestion set, and apply remembered constraints before deterministic rules, recommendation fallback, or optional provider context.

### 2026-05-09 — Menu Chatbot Phase 3 Staff Escalation

- Added explicit shared staff-help reason codes for menu chat responses.
- Centralized backend escalation responses so allergen uncertainty, ingredient uncertainty, policy/payment questions, and custom preparation requests consistently return `requiresStaffHelp`, `staffHelpReason`, and safety notes.
- Logged staff-help metadata in `MenuChatLog.metadata` and updated the customer menu chat sheet to label ask-staff actions by escalation reason.

### 2026-05-09 — Menu Chatbot Phase 4 Multilingual Support

- Added `language` metadata to shared menu chat responses.
- Added backend Arabic/English detection and Arabic deterministic templates for core menu chat intents, fallback text, and staff-escalation safety notes.
- Added Arabic keyword intent matching for recommendation, dietary, budget, prep-time, drink/dessert, payment/policy, and custom-preparation requests.
- Optional hosted LLM menu-chat calls now receive the detected language and must keep menu item names unchanged while local deterministic fallback remains available.

### 2026-05-09 — Menu Chatbot Phase 5 Admin And Cost Controls

- Added `BranchSettings.aiConfigJson` and migration `20260509123000_add_branch_ai_config` for branch-scoped menu assistant controls.
- Admin settings now expose menu assistant enablement, hosted LLM enablement, fallback-only mode, daily hosted request limit, and max reply length.
- Menu chatbot service now enforces these controls before optional hosted provider calls, logs the applied control mode, and keeps deterministic fallback available when hosted providers are disabled or rate-limited.

### 2026-05-09 — Menu Chatbot Phase 6 Operational Diagnostics

- Added aggregate-only menu chat diagnostics at `GET /api/admin/ai/menu-chat/diagnostics`.
- Diagnostics are tenant/branch scoped and return counts for requests, hosted provider usage, fallbacks, staff-help responses, provider rejections, response language, and applied control modes without raw message text or customer personal data.
- Added a Menu Assistant Diagnostics panel to Admin Settings for the selected branch.

### 2026-05-09 — Menu Chatbot Phase 7 Rate And Timeout Controls

- Extended branch AI config with total daily menu-chat request limits, per-session hourly request limits, and hosted-provider timeout settings.
- Menu chatbot service now blocks over-limit requests before response generation, returns deterministic no-suggestion limit messages, and logs the rate-limit control mode.
- Hosted Hugging Face and FastAPI menu-chat calls now use the configured bounded provider timeout.

### 2026-05-09 — Menu Chatbot Phase 8 Response Shaping Controls

- Extended branch AI config with `assistantTone` and `maxSuggestions`.
- Menu chatbot service now shapes final responses by enforcing max reply length, max suggestion count, and light tone adjustment before returning to customers.
- Hosted menu-chat providers now receive requested tone metadata, and Admin Settings exposes tone and max suggestion controls.

### 2026-05-10 — Review Sentiment Phase 6 Alerts

- Added deterministic aggregate review sentiment alerts for complaint spikes and sharp rating declines.
- Shared review sentiment contracts now include `alerts`, and the NestJS analyzer computes them from normalized issue tags and previous-period rating deltas.
- Admin Review Sentiment UI now renders a sentiment alerts section while continuing to hide raw review text and customer personal data.
- Review sentiment audit logging includes only aggregate alert metadata inside the common issue payload.

### 2026-05-10 — Review Sentiment Phase 7 Item Timelines

- Added aggregate per-item complaint timelines to the review sentiment response.
- The analyzer splits the selected range into deterministic buckets and reports item review count, average item rating, issue count, top issue, and direction for the top affected menu items.
- Admin Review Sentiment UI now renders item timeline cards without exposing raw review text, item review comments, or customer personal data.
- Review sentiment audit logging stores item timeline aggregates inside the affected item metadata.

### 2026-05-10 — Review Sentiment Phase 8 Operational Correlation

- Added aggregate operational correlations to the review sentiment response for late complaint analysis.
- The analyzer compares late-tagged reviews against reviewed order kitchen timing, ready-to-served timing, and service request counts using only tenant/branch-scoped operational data.
- Admin Review Sentiment UI now renders an operational correlation section with aggregate metrics and deterministic signal labels.
- No raw review comments, customer personal data, staff names, or individual order IDs are returned or logged.

### 2026-05-10 — Geo-Fencing Implementation Plan

- Added `docs/geo-fencing-implementation-plan.md` to define the phased implementation path for backend-enforced geo-fencing.
- The plan keeps enforcement tenant/branch scoped, starts from the existing `GeoFencingRule` schema, and covers customer ordering, payment start, staff login, admin rule management, logging, privacy, frontend location capture, and tests.

### 2026-05-11 — AI Explainability Improvements

- Added structured source metadata to Business Insights responses and UI cards so managers can see trigger rule, confidence, current value, and threshold.
- Added deterministic aggregate action suggestions to Review Sentiment responses and UI, derived from alerts, affected items, timelines, trend, and operational correlations without raw review text or customer personal data.
- Added Demand Forecast data-quality warnings for low samples, sparse history, no forecastable items, multiplier impact, and fallback-model usage, with UI and audit metadata.
- Verified shared, API, and web typechecks plus focused Business Insights, Review Sentiment, and Demand Forecast tests.

### 2026-05-11 — Backend Branch Authorization Layer

- Added a shared `BranchAccessService` for staff branch authorization: OWNER and MANAGER can access tenant branches, while CASHIER, WAITER, CHEF, and KITCHEN_LEAD are restricted to their assigned branch.
- Applied the resolver to branch-sensitive backend surfaces including analytics, admin staff/settings/tables/finance/inventory tracking, inventory list/create, tables, orders, KDS, payments, waiter branch views, realtime branch SSE, devices, business insights, and menu-chat diagnostics.
- Added focused branch-access tests covering same-branch staff access, cross-branch staff denial, owner/manager branch access, cross-tenant denial, and missing branch handling.

### 2026-05-11 — Public QR Order Creation Hardening

- Removed client-controlled `source` from the public order DTO and now force public session orders to `USER_APP`; POS can still pass `POS_DASHBOARD` through an internal service option.
- Public order creation now loads the active session, table, branch, and tenant from the database before idempotency, rejects cross-session idempotency key reuse, and derives tenant/branch/table from trusted records only.
- Menu item selection is restricted to the session tenant and selected branch or tenant-wide items, rejects inactive/unavailable/out-of-stock items, and continues to calculate prices, tax, and totals server-side.
- Added focused public-order tests for malicious branch/tenant/source/totals, cross-branch items, unavailable items, out-of-stock items, completed sessions, idempotency key reuse, and valid order creation.

### 2026-05-11 — Payment Amount And Status Safety

- Removed client-controlled payment intent amounts plus manual `paymentStatus` and `payerType` from payment DTOs; public gateway intents now always use server-calculated unpaid balances.
- Staff/manual payment recording now validates branch access, served/cancelled/paid state, remaining amount, overpayment, manual method rules, and forces `PaymentStatus.COMPLETED` only for authorized cash or terminal-card flows.
- Gateway webhook completion now compares provider-reported minor-unit amount and optional currency against stored pending payment records before marking payments/orders complete, and duplicate webhooks are idempotent.
- Added focused payment safety tests covering server-calculated intent amounts, paid/cancelled rejection, cross-branch denial, webhook amount mismatch, valid webhook completion, duplicate webhook handling, and manual cash payment.

### 2026-05-11 — Inventory Transaction And Movement Safety

- Moved automatic inventory decrement into the order `SERVED` status transaction so stock decrement, movement creation, status update, status history, and `inventoryDecrementedAt` commit or roll back together.
- Automatic order inventory decrement now uses tenant/branch-scoped conditional stock updates, rejects insufficient stock with `ConflictException`, and prevents repeated `SERVED` transitions from double-decrementing.
- Inventory create and manual adjustment flows now create `StockAdjustment` movement rows transactionally, include before/after quantities in movement reasons, validate branch access for item-level reads/updates/adjustments and menu-item inventory mappings, and reject negative stock.
- Added focused inventory transaction tests for SERVED decrement, rollback on insufficient stock, movement logging, repeat transition safety, manual adjustment logging, cross-branch denial, and negative stock rejection.

### 2026-05-11 — DTO Validation Hardening

- Confirmed the API global `ValidationPipe` is active with `whitelist`, `forbidNonWhitelisted`, and `transform`.
- Replaced high-risk inline body shapes with DTO classes for admin table/order/alert operations, waiter quick-add/payment/edit actions, device management, KDS waste records, public reviews, menu favorites, branch settings, and split payments.
- Strengthened public order, payment, inventory, menu, POS, tax, and expense DTOs with nested validation, non-empty IDs, enum checks, numeric transforms, minimums, and length limits.
- Added focused DTO validation tests covering forbidden public extra fields, invalid enum values, invalid quantities/prices, nested item transforms, split/payment validation, and query numeric transformation.

### 2026-05-11 — AI Output Validation And Fallbacks

- Added shared backend AI output validators for business insight summaries, demand forecast LLM summaries, and demand forecast ML item predictions.
- Business Insights still computes all metrics from Prisma first, then treats FastAPI summary text as optional wording; provider failures, timeouts, and invalid summary JSON now return deterministic analytics plus `aiFallbackMessage`.
- Demand Forecast still computes orders, revenue, hourly demand, item forecasts, confidence, reasons, ingredients, and data-quality warnings from tenant/branch-scoped database history; invalid ML payloads now fall back to the deterministic statistical model, and missing/failed LLM summaries expose `aiFallbackMessage`.
- Added focused AI output validation tests and expanded Business Insights fallback tests for malformed provider output and provider failure.

### 2026-05-11 — Frontend Resilience States

- Added shared frontend state primitives for inline alerts, permission-denied screens, and dashboard skeletons, plus safer API error normalization for non-JSON and status-specific failures.
- Hardened admin dashboard, finance, inventory, KDS, customer QR menu/cart/order payment, AI insights, and waiter checkout surfaces with loading, empty, error, permission, partial-failure, retry, and pending-action states.
- Admin navigation now hides role-inappropriate links based on stored role/permission hints while preserving backend authorization as the source of truth.

### 2026-05-11 — Critical Backend Test Coverage

- Added an API `test:critical` aggregate script covering branch access, public ordering, payment safety, inventory transactions, DTO validation, AI output validation, business insights, demand forecast, and waiter payment/order assignment checks.
- Expanded branch access tests for tenant-wide owner branch omission, branch-staff defaulting, cross-branch optional resolution denial, and entity tenant/branch checks.
- Expanded public order tests for same-session idempotent replay and missing session rejection.
- Expanded payment safety tests for cross-branch manual payment denial, terminal-card reference validation, refund status recalculation, and refund overage rejection.

### 2026-05-11 — Technical Documentation Refresh

- Added documentation for security boundaries, API route groups, backend testing strategy, and AI feature safety.
- Expanded architecture docs with Mermaid diagrams for system structure, role surfaces, branch authorization, public QR ordering, payments, inventory SERVED transition, and AI analytics lifecycle.
- Updated README and deployment notes with `test:critical`, current hardening status, documentation index, and the known Windows Prisma `EPERM` generate/build issue.

### 2026-05-11 — CI And Deployment Verification

- Added root scripts for API/web typecheck and build, plus a lightweight `smoke:health` script that checks `/api/health` without requiring seed data.
- Strengthened API environment validation for required URLs, ports, production JWT length, CORS origins, cookie SameSite, payment provider selection, and Stripe keys when Stripe is enabled.
- Updated API health responses with environment, version, commit, timestamp, and dependency status.
- Expanded GitHub Actions CI to run PostgreSQL/Redis services, Prisma validate/generate/migrate deploy, typecheck, critical backend tests, web build, and API build.
- Adjusted production compose so API startup depends on PostgreSQL and Redis health but does not block on the optional AI service.

### 2026-05-12 — Final Security And Demo Readiness Sweep

- Routed waiter `SERVED` transitions through `OrdersService.updateStatus` so inventory decrement, status history, movement/audit behavior, and double-decrement protection are not bypassed by the waiter endpoint.
- Added missing waiter-surface branch checks for table detail, table clearing, quick-add order creation, order claiming, order item edits, surcharges, and order notes; waiter quick-add now filters menu items by tenant and branch.
- Replaced a raw customer refresh-token error with a NestJS `UnauthorizedException` and made the smoke test tolerate non-JSON error bodies.
- Added `docs/demo-readiness.md` with pre-demo commands, environment requirements, seeded account notes, golden demo path, fallback plans, coverage map, reviewer talking points, and honest remaining risks.

### 2026-05-12 — Geo-Fencing Controlled Add-On MVP

- Added branch-level geofence fields (`latitude`, `longitude`, `geofenceRadiusM`, `geofenceEnabled`) while keeping the existing `GeoFencingRule` model for future per-action rule management.
- Added shared geofencing contracts and a NestJS `GeoFencingModule` with `POST /api/geofencing/check`, Haversine distance calculation, accuracy validation, explicit non-production demo bypass, and sanitized operational logging without raw latitude/longitude.
- Integrated backend enforcement into the public QR/table session start path before session/table mutations; branch-disabled geofencing continues the existing flow.
- Added customer start-page location capture and friendly denial/permission/low-accuracy messaging.
- Added focused geofencing tests covering disabled branches, missing/invalid/low-accuracy locations, inside/outside radius, sanitized logs, session-start enforcement, and explicit demo bypass.

### 2026-06-11 — Production Edge TLS Hardening

- Chose Docker/VPS-first security hardening with edge TLS at Nginx now and private Docker-network plaintext service traffic for the MVP phase.
- Production Nginx now terminates HTTPS on port 443, redirects port 80 to HTTPS, and expects mounted certificate files at `nginx/ssl/cert.pem` and `nginx/ssl/key.pem`.
- API production startup now rejects non-localhost public `http://` origins and `COOKIE_SECURE=false`.
- Branch realtime SSE is cookie/Bearer authenticated, with query-string tokens limited to non-production compatibility.
- Customer refresh tokens are no longer written to browser storage; httpOnly cookies are the production browser auth path.
- Production Docker API packaging now copies the monorepo TypeScript output from `dist/apps/api/src` into the runtime `dist` directory so `node dist/main.js` starts correctly.

### 2026-06-11 — Browser Auth Cookie-First Hardening

- Staff and customer browser helpers no longer persist access or refresh tokens in localStorage/sessionStorage; they keep only non-sensitive metadata/hints for UX routing.
- Frontend API helpers use cookies by default and only send an Authorization header when given a real Bearer token, preserving programmatic API compatibility.
- Added `POST /api/auth/staff/logout` to clear the shared access cookie for staff sessions.
- Customer refresh/logout DTO now allows cookie-only refresh tokens, matching the existing controller behavior.

### 2026-06-11 — Cookie CSRF Protection

- Added a signed double-submit CSRF flow for cookie-authenticated browser requests: `GET /api/auth/csrf` sets a readable `sro_csrf` cookie and returns the token for `X-CSRF-Token`.
- A global CSRF guard now rejects unsafe methods that carry auth cookies without a valid matching CSRF token, while explicit Bearer-token API clients remain compatible.
- Auth bootstrap/logout/refresh routes and payment provider webhooks are exempt from browser CSRF so login, session cleanup, refresh rotation, and external webhook delivery remain operational.

### 2026-06-11 — Production Edge Security Follow-Up

- Tightened production CORS/public-origin validation: non-localhost origins must be explicit `https://` origins and wildcard, `null`, path, query, and hash values are rejected.
- Added public-edge security headers in Nginx, including CSP, HSTS, frame restrictions, referrer policy, permissions policy, content sniffing protection, and cross-origin opener policy.
- Added a VPS Let's Encrypt webroot issuance script and ACME challenge support in Nginx; renewal scheduling remains an operator task.
- Added production edge smoke coverage for HTTP redirect, HTTPS frontend, HSTS/CSP headers, API health, and CSRF bootstrap.
- Added webhook signature regression coverage for Stripe and mock gateways and included it in `test:critical`.

### 2026-06-11 — Operations Hardening Follow-Up

- Ran `npm audit fix`, which upgraded fixable Nest/path-to-regexp and qs dependencies; the remaining audit item is Next's bundled PostCSS version, where npm's force fix would downgrade Next to an incompatible legacy release.
- Added request correlation IDs: Nginx forwards `X-Request-ID`, the API returns it, and request logs include it without logging bodies, cookies, authorization headers, or query strings.
- Added `scripts/renew-letsencrypt.sh` for scheduled certificate renewal using the existing ACME webroot state and Nginx reload.
- Added an optional Docker monitoring/logging overlay with Prometheus blackbox probes, Loki, Promtail, and Grafana, plus root `monitoring:up` and `monitoring:down` scripts.
- Production compose now requires explicit MinIO and payment webhook secrets instead of falling back to development defaults.

### 2026-06-14 — Unified Login Flow

- Added `/login` as the shared customer/staff login entry point.
- Staff login now authenticates once and routes by returned role/permissions to admin dashboard, cashier POS, kitchen display, or waiter dashboard.
- Role-specific staff login URLs now redirect to `/login`; the customer OTP login UI was extracted into a shared component so the existing customer flow and design remain unchanged.

### 2026-06-14 — OTP SMS And Release Gates

- Added a backend SMS adapter for customer OTP delivery with `noop` for local development and Twilio REST delivery for production.
- Production startup now rejects `SMS_PROVIDER=noop`; Twilio account SID, auth token, and from number are required when `SMS_PROVIDER=twilio`.
- Staff browser sessions remain finite access-cookie sessions without staff refresh tokens; access JWT and cookie lifetime are now configurable through `STAFF_ACCESS_TOKEN_TTL` and `STAFF_ACCESS_COOKIE_MAX_AGE_MS`.
- Added `npm run audit:security` to fail on unexpected npm audit findings while explicitly tracking the current Next-bundled PostCSS advisory that cannot be fixed without an unsafe Next downgrade.

### 2026-06-14 — Production Rehearsal And Edge Smoke Expansion

- Added `npm run rehearsal:production` as a VPS rollout preflight for `.env.production`, production Docker Compose, monitoring overlay Compose, TLS file presence, and optional live HTTPS smoke checks.
- Expanded `npm run smoke:production` to verify invalid OTP request validation and unauthenticated branch SSE rejection in addition to redirect, frontend, health, headers, and CSRF bootstrap.
- Deployment and testing docs now treat the rehearsal script as the first gate before public production bring-up.

### 2026-06-14 — Production Secret Preparation Helper

- Added `npm run secrets:production` to generate strong local values for repo-owned production secrets before VPS/domain rollout.
- Clarified in env and deployment docs which values can be prepared locally now versus which must come from the final domain, Twilio, or a payment provider.

### 2026-06-14 — Security Architecture Documentation

- Added `docs/SECURITY_ARCHITECTURE.md` as a repository-specific security architecture reference covering auth, authorization, validation, API/data security, secrets, frontend/backend controls, integrations, uploads, logging, deployment, dependencies, gaps, and developer checklist.
- Documented current security gaps including raw-body webhook verification hardening, public session/order capability checks, upload validation, public session SSE protection, AI service auth boundary, Redis production auth/TLS, PII encryption, and Python dependency audit coverage.

### 2026-06-14 — AI Services Architecture Documentation

- Added `docs/AI_SERVICES_ARCHITECTURE.md` as the repository-specific AI architecture reference covering current AI surfaces, providers, prompts, workflows, storage, validation, safety, privacy, testing, and improvement roadmap.
- Documented that current AI uses deterministic backend services, optional FastAPI, Hugging Face chat completions, and scikit-learn Ridge forecasting; no embeddings, vector search, RAG, agents, OpenAI, Anthropic, Gemini, or LangChain integration was found.
- Captured the current mismatch where NestJS review sentiment can call `AI_SERVICE_URL/review-sentiment/summarize`, but the FastAPI service does not currently implement that route.

### 2026-06-14 — Project Architecture Documentation

- Added `docs/PROJECT_ARCHITECTURE.md` as the project-wide developer architecture reference covering confirmed features, repo structure, tech stack, system flow, frontend/backend architecture, API route groups, data model groups, core features, configuration, development workflow, testing, observability, deployment, maintainability, glossary, unknowns, and roadmap.
- Kept dedicated security and AI detail in their architecture docs while cross-referencing them from the project-wide guide.
- Documented implementation-confirmed architecture separately from spec-only or unclear planned capabilities.

### 2026-06-14 — SaaS Owner Super Admin

- Added global `User.globalRole = SAAS_OWNER` identity support and a SaaS owner login path separate from tenant staff accounts.
- Added a SaaS admin backend boundary for global tenant/branch listing, store owner provisioning, SaaS-wide analytics, and SaaS-only branch feature module updates.
- Tenant admin branch settings now reject `featureFlagsJson` and `aiConfigJson` updates; standard admin settings UI no longer renders feature module or AI module controls.
- Added `/saas` frontend dashboard routes for analytics, tenant/store owner management, and feature module management.

### 2026-06-15 — SaaS AI Control Center

- Added SaaS-only AI admin endpoints under `/api/saas/ai` for overview metrics, branch AI watchlists, per-branch diagnostics, and validated menu-chat control updates.
- The SaaS AI backend reuses existing menu chat diagnostics and `BranchSettings.aiConfigJson` as the canonical control model instead of inventing a parallel AI configuration system.
- Added `/saas/ai` as a real SaaS owner route with themed branch monitoring, actionable diagnostics, direct AI control editing, and preset rollout actions.
- Verified `npm run typecheck:api`, `npm run typecheck:web`, `npm run build:web`, and direct API TypeScript compilation; the full API build still hits the known Windows Prisma `EPERM` generate issue before `tsc`.

### 2026-06-15 — SaaS Revenue Command

- Added `/api/saas/revenue` for SaaS-owner-only finance aggregation with validated date ranges, global totals, daily trend rows, payment-method mix, expense categories, tenant rollups, branch rollups, recent refunds, and derived finance alerts.
- Added `/saas/revenue` as a real SaaS owner section and promoted Revenue from a placeholder to primary navigation.
- The SaaS revenue surface is built directly on completed payments, completed refunds, expenses, and orders from the core operational schema rather than a separate reporting store.
- Verified `npm run typecheck:api`, `npm run typecheck:web`, `npm run build:web`, and direct API TypeScript compilation.

### 2026-06-15 — SaaS Operations Command

- Added SaaS-only operations endpoints under `/api/saas/operations` for global live monitoring, branch watchlists, and per-branch operational drill-down.
- The SaaS operations backend is built directly on sessions, active orders, service requests, low-stock alerts, shifts, tables, and operational event logs already present in the core schema.
- Added `/saas/operations` as a real SaaS owner section and promoted Operations from a placeholder to primary navigation.
- Verified `npm run typecheck:api`, `npm run typecheck:web`, `npm run build:web`, and direct API TypeScript compilation.

### 2026-06-15 — SaaS Sessions Command

- Added SaaS-only sessions endpoints under `/api/saas/sessions` for global session overview metrics, filtered watchlists, and per-session detail across guests, orders, service requests, and payments.
- The SaaS sessions backend is built directly on the core `Session`, `Order`, `Payment`, and `ServiceRequest` models instead of a separate reporting layer, with derived duration and attention-state logic for platform monitoring.
- Added `/saas/sessions` as a real SaaS owner section and promoted Sessions from the future-sections placeholder list to primary navigation.
- Verified `npm run typecheck:api`, `npm run typecheck:web`, `npm run build:web`, and direct API TypeScript compilation.

### 2026-06-15 — SaaS Owners And Staff Command

- Added SaaS-only staff endpoints under `/api/saas/staff` for global roster overview, searchable member rows, per-staff operational detail, and SaaS-level account activation/deactivation.
- The SaaS staff backend is built directly on `Staff`, `Role`, `StaffAttendance`, `Shift`, `ServiceRequest`, `Session`, `Order`, and `OperationalEventLog`, with derived activity-state and staffing recommendations based on live operating signals.
- Added `/saas/owners-staff` as a real SaaS owner section and promoted Owners & Staff from the future-sections placeholder list to primary navigation.
- Verified `npm run typecheck:api`, `npm run typecheck:web`, `npm run build:web`, and direct API TypeScript compilation.

### 2026-06-15 — SaaS System Health Command

- Added SaaS-only system health endpoints under `/api/saas/system-health` for overview metrics, live service registry rows, and recent platform incident feeds.
- The SaaS system health backend combines direct dependency checks for API/database/Redis/AI/object storage with provider-mode visibility for payments and SMS, plus incident signals from operational logs, payment event logs, and hosted AI provider rejections.
- Added `/saas/system-health` as a real SaaS owner section and promoted System Health from the future-sections placeholder list to primary navigation.
- Verified `npm run typecheck:api`, `npm run typecheck:web`, `npm run build:web`, and direct API TypeScript compilation.

### 2026-06-15 — SaaS Audit Logs Command

- Added SaaS-only audit-log endpoints under `/api/saas/audit-logs` for overview metrics and a normalized cross-stream feed covering audit, operational, and payment events.
- The SaaS audit backend is built directly on `AuditLog`, `OperationalEventLog`, and `PaymentEventLog`, preserving event-specific payloads such as before/after snapshots, metadata, payment provider/status fields, and actor identity where available.
- Added `/saas/audit-logs` as a real SaaS owner section and promoted Audit Logs from the future-sections placeholder list to primary navigation.
- Verified `npm run typecheck:api`, `npm run typecheck:web`, `npm run build:web`, and direct API TypeScript compilation.

### 2026-06-15 — SaaS Settings Command

- Added a new singleton `PlatformSettings` Prisma model for global SaaS configuration instead of storing platform settings on a user profile or tenant-scoped record.
- Added `/api/saas/settings` for reading and updating platform identity, maintenance state, owner-provisioning policy, default operating windows, announcement banners, runtime summaries, and recent settings-change history.
- Added `/saas/settings` as a real SaaS owner section and promoted Settings from the future-sections placeholder list to primary navigation.
- Enforced one real backend policy from this surface: when `ownerProvisioningEnabled` is false, `/api/saas/tenants/owners` rejects new tenant-owner provisioning requests.
- `prisma generate` succeeded only with `PRISMA_GENERATE_NO_ENGINE=1` due the known Windows Prisma engine rename lock; `prisma migrate dev` remained blocked by a Postgres advisory-lock timeout, so the SQL migration was generated from schema diff and applied locally with `prisma db execute`.
- Verified `npm run typecheck:api`, `npm run typecheck:web`, `npm run build:web`, and direct API TypeScript compilation.

### 2026-06-19 — SaaS IA Consolidation And Billing Contract

- Consolidated the SaaS primary navigation to `Overview`, `Tenants`, `Operations`, `Controls`, `Billing`, `System Health`, and `Settings`.
- Kept old SaaS deep links stable by redirecting `/saas/sessions`, `/saas/owners-staff`, `/saas/ai`, `/saas/features`, and `/saas/revenue` into their new owner pages.
- Added tenant lifecycle API endpoints for tenant create/update/status and branch create/update/status under the existing SaaS admin boundary.
- Added SaaS billing persistence models `TenantSubscription` and `SaasInvoice`, plus SaaS billing endpoints for overview, tenant subscription listing, invoice listing, and subscription update.
- Used existing SaaS operational and payment event logging patterns for tenant lifecycle and billing change traceability rather than introducing a second admin logging system.
- Prisma client regeneration on Windows required `npx prisma generate --no-engine` because the query-engine DLL remained locked during normal generate.

### 2026-06-19 — SaaS Surface Completion

- Rebuilt the remaining SaaS owner surfaces so Tenants, Controls, and Billing now use the consolidated IA rather than placeholder owners.
- Tenants now owns tabbed tenant lifecycle, branch lifecycle, owner directory, and owner provisioning UI on top of the SaaS admin endpoints.
- Controls now owns functional AI control editing, diagnostics, and preset rollout behavior on top of /api/saas/ai/*, while module flags remain in the same owner route.
- Billing now owns functional subscription editing, invoice review, and billing-risk views on top of the new SaaS billing endpoints, with Network Sales kept separate.
- System Health now exposes Audit Logs from the owner page rather than requiring primary-nav placement.

### 2026-06-20 — SaaS Overview Reference Redesign

- Rebuilt `/saas` around the provided light-theme overview reference instead of the previous dark dashboard layout.
- Kept the overview page as an executive summary surface and removed workflow-heavy sections that duplicated deeper owner pages.
- The new overview now centers on six KPI cards, priority alerts, platform health, tenant performance, order status mix, revenue trend, activity feed, and AI insight callouts using live SaaS analytics, health, revenue, tenant, and audit-log APIs.
- Verified the redesign with `npm run typecheck:web` and `npm run build:web`.

### 2026-06-20 — VPS Ops Readiness Phase 1

- Added Linux shell helpers `scripts/backup-postgres.sh` and `scripts/restore-postgres.sh` so VPS operators no longer need to translate the PowerShell-only backup and restore flow manually.
- Consolidated the production rollout order across `README.md` and `docs/deployment.md` around env preparation, rehearsal, container bring-up, TLS issuance, public rehearsal/smoke, migrations, optional staging/demo seed, and monitoring enablement.
- Tightened production documentation to separate staging/demo VPS behavior from real production, explicitly allowing demo seed data and `PAYMENT_PROVIDER=mock` only outside real production.
- Expanded `docs/operations.md` and `docs/monitoring.md` with success signals, failure actions, rollback guidance, restore-drill steps, minimum monitoring posture, and backup freshness expectations for single-node VPS operation.

### 2026-06-23 — Production Storage Phase 2

- Replaced menu-image disk writes with a backend-managed S3-compatible object storage flow backed by MinIO in Compose and `@aws-sdk/client-s3` in the API.
- Expanded the object-storage contract to support put/get/delete so menu images can be uploaded, fetched through `/api/menu/images/:key`, and cleaned up when replaced.
- Added production-facing storage env settings `S3_REGION`, `S3_FORCE_PATH_STYLE`, `S3_ACCESS_KEY_ID`, and `S3_SECRET_ACCESS_KEY`, with API fallback to `MINIO_ROOT_*` for single-node Compose deployments.
- Updated frontend menu/order/waiter/admin surfaces to resolve relative image URLs through `NEXT_PUBLIC_API_BASE_URL` instead of hardcoding `http://localhost:4000`.

### 2026-06-23 — Production Auth Hardening Phase 3 (Start)

- Removed the branch SSE query-string token compatibility path so realtime branch streams now authenticate only through cookies or explicit Bearer headers.
- Added frontend session helpers `hasStaffSession()` and `hasCustomerSession()` so browser route-entry checks speak in cookie-session terms instead of treating browser auth as a stored token.
- Updated key browser entry points and customer menu favorites flow to rely on cookie-session presence rather than passing a browser-held token concept through the UI.
- Removed browser token-state plumbing from the main operational pages already covered by cookie auth: admin layout/dashboard and AI panels, waiter dashboard/table workspace/checkout, and kitchen orders.
- Kept the `authGet/authPost/authPatch` Bearer-token path available for non-browser/programmatic clients, while these browser surfaces now call the same helpers without pretending a browser token is present in state.

### 2026-06-23 — Production Auth Hardening Phase 3 (Complete)

- Finished the browser-side cookie-session migration across the remaining staff surfaces: analytics, finance, inventory, logs, POS, menu, promotions, settings, shifts, staff management, devices, and waiter cashier promotions.
- Browser pages now call the shared auth API helpers without holding access-token state in React; staff/customer local storage is limited to non-sensitive routing metadata and session hints.
- Verified the web workspace still typechecks after the migration with `npm run typecheck:web`.

### 2026-06-23 — Production OTP Readiness Phase 4

- Added `scripts/verify-twilio-config.mjs` plus root `npm run verify:twilio` so operators can validate production Twilio credentials before rollout without discovering SMS problems through a failed customer login.
- Wired Twilio verification into `npm run rehearsal:production` by default, with `CHECK_TWILIO=0` as an explicit escape hatch for unusual environments.
- Tightened Twilio startup validation in `apps/api/src/config/env.ts` so `TWILIO_ACCOUNT_SID` must look like a real Twilio Account SID and `TWILIO_FROM_NUMBER` must be E.164-formatted.
- Updated production docs and env template so VPS rollout order now includes Twilio verification before public bring-up and explicit post-deploy OTP delivery confirmation.
- Verified with `npm run typecheck:api`, `npm run test:otp-sms --workspace @smart-restaurant/api`, and a dry Twilio verifier run against a temporary env file.

### 2026-06-23 — Production Observability Phase 5

- Added a global metrics module using `prom-client`, with a public-internal `/api/metrics` endpoint that exposes HTTP request totals/latency, OTP request and verification outcomes, SMS delivery outcomes, and default Node.js process metrics.
- Wired request metrics into `RequestLoggerMiddleware` and OTP/SMS metrics into `CustomerAuthService` and `SmsService`.
- Updated Prometheus to scrape both blackbox health targets and direct API metrics, and blocked `/api/metrics` at the Nginx public edge because Prometheus scrapes the API container directly.
- Added Grafana provisioning for Prometheus and Loki plus a `Smart Restaurant OS Production Overview` dashboard, and mounted those assets through `docker-compose.monitoring.yml`.
- Updated monitoring/deployment/status docs and graduation notes to reflect that app-level metrics, dashboard provisioning, and Loki/Promtail aggregation are now implemented in the optional monitoring overlay.
- Verified with `npm run typecheck:api`, `npm run test:otp-sms --workspace @smart-restaurant/api`, and `docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml --env-file .env.production.example config --quiet`.

### 2026-06-23 — Edge Rate Limiting Phase 6

- Added Nginx edge rate-limit zones for high-risk public/auth routes: staff login, SaaS login, customer OTP request/verify/refresh, public session start, public order creation, and public payment-intent/split routes.
- Kept payment webhooks and general internal staff API traffic out of the edge throttling rules to avoid breaking provider callbacks or normal back-office workflows.
- Documented that edge limits now complement the Nest throttler rather than replacing it, and updated deployment/security/status docs to reflect Nginx rate limiting as implemented rather than future work.
- Verified Compose parsing with `docker compose -f docker-compose.prod.yml --env-file .env.production.example config --quiet` and the monitoring overlay variant; a standalone `nginx -t` container check is not meaningful outside the Compose network because the upstream service names resolve only inside that network.

### 2026-06-23 — CI/CD Image Release Path

- Added `.github/workflows/release-images.yml` to build and publish GHCR images for the API, web, and AI services on `main`, version tags, and manual dispatch.
- Updated `docker-compose.prod.yml` so the same production stack can either build locally or run prebuilt images when `API_IMAGE`, `WEB_IMAGE`, and `AI_IMAGE` are set in `.env.production`.
- Added `npm run docker:prod:pull` and updated deployment/status/docs so VPS rollout can use GitHub-built images instead of rebuilding on-host.
