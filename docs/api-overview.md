# API Overview

The backend is a NestJS modular monolith under `apps/api`. This is a high-level map of route groups and their responsibilities. It is intentionally not an exhaustive endpoint reference.

## Base URL

Local development:

```text
http://localhost:4000/api
```

The frontend uses `NEXT_PUBLIC_API_BASE_URL` to reach the API. Production Docker can also route `/api/*` through Nginx.

## Route Groups

| Group | Controller Prefix | Purpose |
|---|---|---|
| Auth | `/api/auth` | Staff login, token/session identity, current user |
| Customer auth | `/api/auth/customer` | Customer OTP-style auth flows |
| Admin | `/api/admin` | Branches, staff, tables, alerts, finance summary, audit logs, admin operations |
| Branch settings | `/api/branches/:branchId/settings` and admin settings routes | Branch configuration and AI controls |
| Tables | `/api/tables` | Staff/admin table reads and updates |
| Sessions | `/api/sessions` | Table session lifecycle and public session order/payment/service-request flows |
| Orders | `/api/orders`, `/api/sessions/:sessionId/orders` | Staff order queries/status updates and public customer order creation |
| KDS | `/api/kds` | Kitchen order queues, stations, item/order kitchen status updates |
| Waiter | `/api/waiter` | Waiter table floor, quick-add orders, service, checkout, payment shortcuts |
| Payments | `/api/orders/:orderId/payments`, `/api/sessions/:sessionId/payments`, webhook routes | Payment intents, manual payments, splits, refunds, status derivation |
| Inventory | `/api/inventory` | Inventory items, stock adjustments, low-stock alerts, menu item mappings |
| Analytics | `/api/analytics` | Dashboard, sales, menu performance, snapshots, insights |
| AI | `/api/ai`, `/api/admin/ai/*` | Recommendations, menu chat diagnostics, business insights, demand forecast |
| Reviews | Review route controllers | Public reviews and review sentiment analytics |
| Promotions/Loyalty | `/api/promotions`, `/api/admin/loyalty` | Promotions, coupons, gift cards, loyalty capabilities |
| Devices | `/api/admin/devices` | Device registration and management |
| Shifts | `/api/shifts` | Staff shifts, attendance, tills |
| Service requests | service request controllers | Customer and waiter service request workflows |
| Realtime | `/api/realtime` | Branch-scoped SSE event streams |
| Logs | `/api/admin/logs` | Admin log access |

## Authentication And Authorization

Most staff/admin routes require JWT staff auth plus permission metadata such as `orders:read`, `payments:write`, `inventory:read`, or `analytics:read`.

Branch-sensitive service methods should also call `BranchAccessService` or use a service that already does. Frontend permissions are not trusted.

## Public Customer Routes

Public QR/session routes are intentionally narrow:

- Public order creation derives tenant, branch, and table from the active session.
- Public payment intent creation derives amount due from the order/session.
- Public inputs must not contain privileged fields such as `tenantId`, `branchId`, `status`, `source`, `price`, `amount`, or `total`.

## Error Conventions

Business errors should use NestJS exceptions:

| Exception | Meaning |
|---|---|
| `BadRequestException` | Malformed input or invalid business combination |
| `ForbiddenException` | Authenticated user lacks tenant/branch/permission access |
| `NotFoundException` | Missing or inaccessible record |
| `ConflictException` | Invalid state such as already paid, unavailable item, insufficient stock |
| `InternalServerErrorException` | Unexpected provider/system failure |

## Maintainability Notes

- Keep API route docs high-level and generated/manual endpoint references separate.
- When adding a branch-sensitive route, document which trusted record supplies `tenantId` and `branchId`.
- When adding a provider integration, keep provider-specific logic behind a contract or adapter.
