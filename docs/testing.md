# Testing Guide

The backend currently uses focused TypeScript test scripts rather than a Jest or Vitest runner.

## Test Style

- Test files live near the module they protect.
- Tests run with `tsx`.
- Assertions use `node:assert/strict`.
- Some tests are unit-style with mocks; others are hybrid tests that seed and clean real Prisma records.
- External providers are mocked or bypassed where possible.

Example:

```bash
npm run test:branch-access --workspace @smart-restaurant/api
```

## Critical Test Script

Run the aggregate critical suite from the repo root:

```bash
npm run test:critical
```

Or from the API workspace:

```bash
npm run test:critical --workspace @smart-restaurant/api
```

The aggregate suite currently runs:

| Script | Protects |
|---|---|
| `test:branch-access` | Tenant/branch role isolation and `BranchAccessService` behavior |
| `test:public-order` | Public QR order creation safety, server-side pricing, session-derived scope |
| `test:payment-safety` | Server-calculated payment amounts, manual payment rules, webhooks, refunds |
| `test:inventory-transactions` | Served-time stock decrement, rollback, movement logging, negative stock rejection |
| `test:dto-validation` | Global ValidationPipe behavior and high-risk DTO validation |
| `test:ai-output-validation` | AI JSON/schema validation helpers |
| `test:business-insights` | Computed metrics first, AI fallback behavior, logging resilience |
| `test:demand-forecast` | Forecast confidence, reasons, data-quality warnings, fallback model behavior |
| `test:waiter-order-assignment` | Waiter/KDS order assignment and served workflow signals |
| `test:waiter-payment-permissions` | Waiter payment route permission metadata |

## Other Focused API Tests

```bash
npm run test:recommendations --workspace @smart-restaurant/api
npm run test:menu-chatbot --workspace @smart-restaurant/api
npm run test:review-sentiment --workspace @smart-restaurant/api
npm run test:reviews --workspace @smart-restaurant/api
npm run test:admin --workspace @smart-restaurant/api
npm run test:service-requests --workspace @smart-restaurant/api
```

## Verification Before Demo

Recommended minimum:

```bash
npm run typecheck
npm run test:critical
npm run build --workspace @smart-restaurant/web
npm run smoke
```

If the API build is needed:

```bash
npm run build --workspace @smart-restaurant/api
```

Known local issue: on Windows, Prisma generate can fail with `EPERM` while renaming `query_engine-windows.dll.node` if a Node/API process or watcher is holding the generated client open. See [deployment.md](deployment.md#known-windows-prisma-eperm-issue).

## Test Data Strategy

Prisma-backed tests create IDs with a run-specific prefix and clean records in dependency order. Keep new tests deterministic:

- Generate unique IDs per run.
- Clean all tenant-scoped records created by the test.
- Avoid relying on seeded demo data unless the test explicitly targets seed behavior.
- Mock external AI/payment providers.
- Avoid concurrency tests unless they can be deterministic on local PostgreSQL.

## Remaining Gaps

- Provider-specific payment webhook signature tests should be added once the final payment gateway is selected.
- Controller-level authorization tests are still lighter than service-level tests.
- Frontend automated tests are not configured yet.
- Full e2e flows exist through Playwright, but critical backend business rules are intentionally covered by focused API scripts first.
