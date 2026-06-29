# Project Context

## Product Identity

The product is a Smart Restaurant Operating System, not just a POS. It is intended to unify customer ordering, waiter operations, kitchen execution, admin control, analytics, and assistive AI under one multi-tenant platform.

It is also explicitly a Global RMS model with one unified backend, one logical normalized database, and four tightly integrated applications.

## Primary Actors

- Customer
- Waiter / Staff
- Kitchen Staff
- Restaurant Owner / Admin
- SaaS Owner / Super Admin
- External Payment Gateway
- Notification Service
- AI Engine

## Functional Direction

The current project direction includes:

- QR or NFC table entry
- session-based ordering
- live order status tracking
- waiter-assisted service flow
- kitchen display workflow
- payment initiation and confirmation
- admin management for menu, staff, branches, tables, settings, and analytics
- SaaS owner management for global tenant visibility, store owner provisioning, SaaS analytics, and branch feature-module control
- AI recommendation, forecasting, anomaly detection, and chatbot support
- cashier/POS and shift workflows
- service requests and table-state coordination
- optional inventory, promotions, loyalty, and integrations modules

## Architectural Direction

- Frontend:
  one Next.js codebase with role-focused areas
- Backend:
  one NestJS modular-monolith API with explicit domain and provider boundaries
- Data:
  one logical normalized PostgreSQL schema with tenant ownership and branch scoping, Redis for cache and realtime/event support, object storage for logs/reports/AI artifacts
- AI:
  Python microservices behind backend-controlled access
- Infra:
  Docker for local infra services first

## Non-Negotiable Design Rules

- Every operational record must be tenant-scoped and, where relevant, branch-scoped.
- SaaS owner access is global and intentionally outside tenant staff rosters; it must be guarded separately from tenant/branch staff authorization.
- Frontend clients must not call AI services directly.
- Payment, notification, storage, and AI integrations should be abstracted behind contracts.
- Realtime updates should be event-based and suitable for order lifecycle, kitchen updates, and customer status sync.
- All critical operational actions should be auditable.
- Session-based dining is a foundational domain concept.

## Current Repository State

- Monorepo scaffold exists.
- `apps/web` contains customer, waiter, kitchen, admin, and SaaS owner route surfaces with shared loading, empty, error, permission, and inline alert UI primitives for demo-safe frontend failure handling. Login entry is unified at `/login` for customers/staff; SaaS owner access is at `/saas/login`.
- `apps/api` contains a NestJS modular-monolith API with implemented operational modules, provider contracts, MVP loyalty infrastructure, and a SaaS admin boundary guarded by `User.globalRole = SAAS_OWNER`.
- Tenant admins cannot modify branch feature modules or AI module settings; those settings are controlled through the SaaS owner API/UI.
- The SaaS owner surface now includes a dedicated `/saas/ai` AI Control Center backed by SaaS-only AI endpoints for global branch monitoring, per-branch menu-chat diagnostics, validated AI control edits, and rollout presets built on `BranchSettings.aiConfigJson`.
- The SaaS owner surface now uses a consolidated primary IA: `/saas`, `/saas/tenants`, `/saas/operations`, `/saas/controls`, `/saas/billing`, `/saas/system-health`, and `/saas/settings`.
- Legacy SaaS routes remain valid as compatibility entry points: `/saas/sessions` redirects into `Operations`, `/saas/owners-staff` redirects into `Tenants`, `/saas/ai` and `/saas/features` redirect into `Controls`, and `/saas/revenue` redirects into `Billing`.
- `Billing` now owns SaaS-commercial concerns and keeps tenant restaurant-sales analytics explicitly labeled as `Network Sales` rather than SaaS revenue.
- The SaaS backend now also exposes tenant lifecycle endpoints and SaaS billing endpoints, with `TenantSubscription` and `SaasInvoice` as the billing persistence model.
- The SaaS owner surface now also includes `/saas/system-health`, backed by SaaS-only health endpoints for dependency checks, provider/config status visibility, recent platform incident feeds, and branch-level fault pressure summaries.
- The SaaS owner surface now also includes `/saas/audit-logs`, backed by SaaS-only audit-log endpoints for cross-tenant audit, operational, and payment event investigation with normalized feed drill-down and actor/branch concentration summaries.
- The SaaS owner surface now also includes `/saas/settings`, backed by a platform-level singleton settings model for global SaaS identity, maintenance posture, provisioning policy, announcement banners, runtime configuration visibility, and saved settings history.
- Customer OTP delivery uses a backend SMS adapter. Local development can use the noop/dev OTP path; production defaults to Twilio and requires provider credentials.
- Menu image uploads now use a backend-managed S3-compatible storage path backed by MinIO in Compose; the API stores object references as `/api/menu/images/:key` and serves the bytes back through NestJS.
- Geo-fencing is implemented as a controlled backend add-on for public QR/table session start. Branch-level settings drive enforcement, the frontend only forwards browser coordinates, and operational logs do not store raw latitude/longitude.
- `apps/ai-services` contains the FastAPI AI boundary, including menu-chat, demand-forecasting, business-insight summarization, review-sentiment summarization, and the new model-backed inference endpoints for recommendations, business insights, and review sentiment.
- Docker Compose includes PostgreSQL, Redis, and MinIO.
- Production Compose can either build locally or pull GHCR-published API/web/AI images through the same service definitions, so a single-node VPS can move from manual builds toward pull-based CD without changing runtime topology.
- Shared TypeScript contracts exist for roles, scopes, status values, health payloads, and domain events.
- Prisma is now the canonical place for the initial data model draft.

## Current Unknowns

- Final payment provider choice
- Final staff refresh-token policy beyond finite JWT access cookies
- Whether staff UX remains one app area or becomes more separated
- Exact rollout order for deeper optional module upgrades such as loyalty expiry jobs, customer-facing loyalty wallets, and integrations
- Rollout timing for full geo-fencing admin UI, staff check-in enforcement, waiter action enforcement, and payment-start enforcement

## Near-Term Build Priorities

1. Validate the Prisma model against implementation realities and the final readable ERD source.
2. Add tenancy, branches, users, staff, roles, permissions, and auth foundations.
3. Build the operational core: tables, sessions, menu, orders, kitchen statuses, payments, and service requests.
4. Add realtime infrastructure for customer, waiter, kitchen, and admin monitoring.
5. Add provider implementations for payments, notifications, AI, and storage.
6. Put optional capabilities behind feature-flagged modules rather than mixing them into the core transaction path.

## Decision Heuristics

- Favor explicit domain language over generic naming.
- Favor module boundaries over convenience imports.
- Favor auditability over opaque automation.
- Favor one coherent MVP path over prematurely splitting into many deployables.
