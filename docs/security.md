# Security Model

This document summarizes the implemented security boundaries and the remaining hardening work for Smart Restaurant OS.

## Scope Model

The application is multi-tenant and multi-branch.

- `tenantId` is the top-level ownership boundary.
- `branchId` scopes operational records such as tables, sessions, orders, inventory, payments, KDS queues, analytics slices, devices, and realtime streams.
- Public customer routes derive tenant and branch context from trusted database records such as table sessions. Public clients must not be treated as a source of truth for tenant, branch, price, total, source, or payment state.

## Branch Authorization

Backend branch isolation is centralized through `BranchAccessService`.

Current role assumption:

| Role | Branch Behavior |
|---|---|
| `OWNER` | May access tenant branches after tenant ownership is verified |
| `MANAGER` | May access tenant branches after tenant ownership is verified |
| `CASHIER`, `WAITER`, `CHEF`, `KITCHEN_LEAD` | Restricted to assigned branch |

Important service behavior:

- Missing branch records throw `NotFoundException`.
- Cross-tenant access throws `ForbiddenException`.
- Staff without tenant-wide access cannot resolve or access another branch.
- Entity access validates both `tenantId` and `branchId`.

Frontend role checks are UX hints only. The backend remains the authorization source of truth.

## Public QR Ordering

Public order creation is intentionally stricter than authenticated staff APIs.

Implemented rules:

- Active session is loaded from the database.
- Tenant, branch, and table are derived from the session/table/branch records.
- Client-provided `tenantId`, `branchId`, `tableId`, `source`, status, prices, and totals are rejected by DTO validation or ignored by the service.
- Public order source is forced server-side.
- Menu items must belong to the same tenant and branch, or be explicitly tenant-wide according to the current menu model.
- Unavailable and out-of-stock items are rejected.
- Prices, tax, subtotal, and total are calculated server-side.
- Idempotency keys are session-scoped; reuse from a different session is rejected.

Known limitation:

- Public order creation checks stock but does not reserve inventory. Inventory is decremented later when an order transitions to `SERVED`.

## Payment Safety

Payment flows do not trust frontend payment amounts or completion state.

Implemented rules:

- Payment intent creation loads the order/session/table from the database.
- Amount due is calculated from order totals, completed payments, and completed refunds.
- Already-paid and cancelled orders are rejected.
- Public payment intents use server-calculated amount only.
- Manual staff payments validate branch access and order eligibility.
- Manual card/terminal payment requires an explicit reference.
- Cash/manual flows are separate from gateway confirmation flows.
- Gateway webhook completion compares provider-reported amount and currency with stored pending payment records before marking records complete.
- Duplicate webhook events are idempotent.
- Refunds recalculate order payment status.

Current provider note:

- The payment provider contract exists, but production provider configuration is still a deployment concern. Do not claim PCI scope beyond the fact that card data is not stored by this app.

## Inventory Safety

Inventory mutation is branch-scoped, transactional, and auditable.

Implemented rules:

- `SERVED` order transition validates branch access, stock availability, decrements inventory, creates movement records, updates status/history, and commits in one transaction.
- If stock is insufficient, the transaction rolls back and the order remains unserved.
- Repeating `SERVED` transition does not double-decrement inventory.
- Manual adjustments validate item branch access.
- Negative stock is rejected.
- Stock-changing actions create `StockAdjustment` audit/movement rows.

Known limitation:

- No reservation system exists yet between order placement and served-time decrement.

## DTO Validation

The API global `ValidationPipe` is configured with:

```ts
new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
})
```

DTO hardening covers public order/payment inputs, inventory, menu, POS, tax, expense, KDS, waiter, device, review, branch settings, and split payment payloads.

## AI Safety

AI features are assistive. They should not be the source of truth for business metrics.

Implemented rules:

- Business metrics are computed from tenant/branch-scoped database records first.
- AI wording is optional and validated before use.
- Invalid AI JSON or provider failures return computed analytics with fallback messages.
- Demand forecasts expose confidence, reasons, and data-quality warnings.

## Production Hardening Checklist

- Use strong `JWT_SECRET`.
- Use HTTPS and set secure cookie options.
- Restrict CORS to trusted origins.
- Configure real payment provider secrets and webhook signing secrets.
- Keep AI provider credentials server-side only.
- Use managed PostgreSQL and Redis with backups.
- Add log aggregation and alerting.
- Review rate limits for public QR, auth, payment, and webhook routes.
- Add provider-specific webhook signature tests when the final provider is selected.
- Keep demo seed accounts out of production.
