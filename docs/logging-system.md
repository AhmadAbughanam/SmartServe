# Logging System MVP

## Purpose

The logging system gives owners, managers, and developers a traceable history of important business and operational events without storing customer personal data.

## Log Layers

### Audit Logs

Existing `AuditLog` records are used for accountability around staff/admin business changes.

Examples:
- menu changes
- inventory adjustments
- order edits
- refunds
- shift/till closures
- admin AI requests

Audit logs remain staff/action/entity focused.

### Operational Event Logs

`OperationalEventLog` records restaurant workflow events.

MVP events:
- `STAFF_LOGIN_SUCCEEDED`
- `STAFF_LOGIN_FAILED`
- `ORDER_PLACED`
- `ORDER_UPDATED`
- `ORDER_READY`
- `ORDER_SERVED`
- `SERVICE_REQUEST_CREATED`
- `SERVICE_REQUEST_CLAIMED`
- `SERVICE_REQUEST_COMPLETED`
- `SERVICE_REQUEST_CANCELLED`

These logs are scoped by `tenantId` and `branchId`, with optional `sessionId`, `tableId`, `orderId`, and `actorStaffId`.

### Payment Event Logs

`PaymentEventLog` records sanitized money-flow events.

MVP events:
- `PAYMENT_CREATED`
- `PAYMENT_INTENT_CREATED`
- `PAYMENT_WEBHOOK_RECEIVED`
- `PAYMENT_COMPLETED`
- `REFUND_CREATED`

These logs store amounts, statuses, provider references, and scoped IDs. They must not store card data or raw gateway payloads.

## Admin API

All endpoints are staff-authenticated and require `audit:read`.

```http
GET /api/admin/logs/audit
GET /api/admin/logs/operational
GET /api/admin/logs/payments
```

Query parameters:

```ts
{
  branchId?: string;
  from?: string;
  to?: string;
  eventType?: string;
  entityType?: string;
  actionCode?: string;
  severity?: "INFO" | "WARN" | "ERROR";
}
```

Date ranges default to the last 7 days and are capped at 180 days.

## Scope Rules

- `OWNER` and `MANAGER` can view tenant-wide logs or filter by branch.
- Branch-bound staff can only view their own branch logs.
- Logs never trust `tenantId` from query parameters.

## Frontend

The admin UI exposes logs at:

```txt
/admin/logs
```

The page includes tabs for operational, payment, and audit logs with basic date filters.

## Privacy

The MVP stores only operational metadata:
- IDs
- event names
- status
- amount for payment events
- branch/session/order references

It does not store:
- card data
- raw payment payloads
- raw customer messages
- raw customer personal data

## Future Enhancements

- Add log retention settings.
- Add export to CSV.
- Add severity dashboards.
- Add OpenTelemetry traces for API calls.
- Add structured app logs with `nestjs-pino`.
- Add correlation IDs across API, realtime events, and payment webhooks.
- Add log detail drawer in the admin UI.
- Add searchable metadata filters.
