# Project Context

## Product Identity

The product is a Smart Restaurant Operating System, not just a POS. It is intended to unify customer ordering, waiter operations, kitchen execution, admin control, analytics, and assistive AI under one multi-tenant platform.

It is also explicitly a Global RMS model with one unified backend, one logical normalized database, and four tightly integrated applications.

## Primary Actors

- Customer
- Waiter / Staff
- Kitchen Staff
- Restaurant Owner / Admin
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
- Frontend clients must not call AI services directly.
- Payment, notification, storage, and AI integrations should be abstracted behind contracts.
- Realtime updates should be event-based and suitable for order lifecycle, kitchen updates, and customer status sync.
- All critical operational actions should be auditable.
- Session-based dining is a foundational domain concept.

## Current Repository State

- Monorepo scaffold exists.
- `apps/web` contains customer, waiter, kitchen, and admin route surfaces with shared loading, empty, error, permission, and inline alert UI primitives for demo-safe frontend failure handling.
- `apps/api` contains a NestJS modular-monolith API with implemented operational modules, provider contracts, and MVP loyalty infrastructure.
- Geo-fencing is implemented as a controlled backend add-on for public QR/table session start. Branch-level settings drive enforcement, the frontend only forwards browser coordinates, and operational logs do not store raw latitude/longitude.
- `apps/ai-services` contains a FastAPI shell.
- Docker Compose includes PostgreSQL, Redis, and MinIO.
- Shared TypeScript contracts exist for roles, scopes, status values, health payloads, and domain events.
- Prisma is now the canonical place for the initial data model draft.

## Current Unknowns

- Final payment provider choice
- Final auth provider choice beyond JWT + refresh tokens
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
