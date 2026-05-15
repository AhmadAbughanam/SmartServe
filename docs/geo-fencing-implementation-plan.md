# Geo-Fencing Implementation Plan

## Purpose

Geo-fencing will restrict selected branch actions to customers or staff who are physically near the branch. The first implementation should use it as a backend-enforced security and operations policy, not as a frontend-only check.

The existing Prisma schema already has `GeoFencingRule` and `GeoFenceAppliesTo`. The missing work is rule management, location capture, server-side distance validation, enforcement in the correct flows, audit/log visibility, and admin UI.

## Current State

- `GeoFencingRule` exists in Prisma with `tenantId`, `branchId`, `enabled`, `allowedRadiusMeters`, `centerLatitude`, `centerLongitude`, `appliesTo`, and `createdAt`.
- `GeoFenceAppliesTo` currently supports `CUSTOMER_ORDERING`, `PAYMENT_START`, and `STAFF_LOGIN`.
- Documentation marks geo-fencing as out of scope or incomplete.
- There are no management endpoints, no admin UI, and no enforcement in customer ordering, payment start, or staff login flows.

## Design Principles

- Enforce on the backend. Browser location checks are advisory only.
- Keep every rule tenant-scoped and branch-scoped.
- Never trust `tenantId` or `branchId` supplied by the client when authenticated staff context can provide it.
- Do not store raw continuous location history. Store only sanitized enforcement metadata when needed for logs.
- Treat geolocation as optional until the branch explicitly enables a rule.
- Fail closed only when an enabled rule applies and the client does not provide usable location data.
- Keep payment-provider logic untouched; geo-fencing gates payment initiation before gateway calls.

## User Flows To Protect

### Customer Ordering

Protected action:

```http
POST /api/sessions/:sessionId/orders
```

Behavior:

- If no enabled `CUSTOMER_ORDERING` rule exists for the session branch, allow existing behavior.
- If a rule exists, require a client location payload.
- Validate the customer is within `allowedRadiusMeters` of the rule center.
- Reject the order before inventory, order, kitchen, or realtime side effects occur.

### Payment Start

Protected actions:

```http
POST /api/orders/:orderId/payments/intent
POST /api/sessions/:sessionId/payments/intent
```

Behavior:

- If no enabled `PAYMENT_START` rule exists for the order/session branch, allow existing behavior.
- If a rule exists, require location.
- Validate before creating a gateway intent or payment row.
- Keep webhook handling unchanged because webhooks are provider-originated and must not depend on customer browser location.

### Staff Login

Protected action:

```http
POST /api/auth/staff/login
```

Behavior:

- Resolve the staff member after credential verification but before issuing a token.
- Check enabled `STAFF_LOGIN` rules for the staff member's branch.
- Reject login when location is missing, invalid, or outside the allowed radius.
- Log failed/successful enforcement metadata through operational logs without storing exact user coordinates unless explicitly needed for debugging and retention rules exist.

## Location Payload Contract

Add a shared request shape where location-gated endpoints need it:

```ts
type ClientLocationInput = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  capturedAt?: string;
};
```

Validation rules:

- `latitude` must be between `-90` and `90`.
- `longitude` must be between `-180` and `180`.
- `accuracyMeters` should be positive when provided.
- Reject stale `capturedAt` values, for example older than 2 minutes.
- Optionally reject low-accuracy readings when `accuracyMeters` is larger than the rule radius or a configured maximum.

## Backend Implementation Phases

### Phase 1: Domain Service

Create a backend module such as:

```txt
apps/api/src/modules/geo-fencing
```

Core service responsibilities:

- Fetch enabled rules by `tenantId`, `branchId`, and `appliesTo`.
- Validate location DTOs.
- Calculate distance using a Haversine helper.
- Return a structured result:

```ts
type GeoFenceDecision = {
  required: boolean;
  allowed: boolean;
  reason: "NO_RULE" | "INSIDE_RADIUS" | "MISSING_LOCATION" | "INVALID_LOCATION" | "STALE_LOCATION" | "LOW_ACCURACY" | "OUTSIDE_RADIUS";
  distanceMeters?: number;
  allowedRadiusMeters?: number;
};
```

Important implementation detail:

- Put the Haversine calculation in a small pure utility and cover it with unit tests.
- Keep rule lookup in the service so business modules do not query `GeoFencingRule` directly.

### Phase 2: Admin Rule Management API

Add staff-protected endpoints, likely under admin:

```http
GET /api/admin/geo-fencing?branchId=...
POST /api/admin/geo-fencing
PATCH /api/admin/geo-fencing/:ruleId
DELETE /api/admin/geo-fencing/:ruleId
```

Suggested permissions:

- `geo-fencing:read`
- `geo-fencing:write`

Access rules:

- `OWNER` and `MANAGER` can manage rules for branches in their tenant.
- Branch-bound staff can only see their own branch if they have read permission.
- Writes should be restricted to owner/manager roles or equivalent permission.

Validation:

- `branchId` must belong to the authenticated tenant.
- `allowedRadiusMeters` should have a sane range, for example `10` to `5000`.
- `centerLatitude` and `centerLongitude` must be valid coordinates.
- `appliesTo` must be one of the enum values.
- Prefer one rule per `branchId + appliesTo`; if multiple rules are allowed later, define how they combine before enabling that.

Schema recommendation:

- Add a unique constraint on `(branchId, appliesTo)` if the intended behavior is one active configurable rule per flow.
- Add `updatedAt` and possibly `updatedByStaffId` if admin rule edits need stronger auditability.

### Phase 3: Enforcement Integration

Integrate the service at the start of each protected action.

Customer ordering:

- Update the order creation DTO to accept `location?: ClientLocationInput`.
- In `OrdersService`, resolve the session's tenant and branch.
- Call `geoFencingService.enforce({ tenantId, branchId, appliesTo: "CUSTOMER_ORDERING", location })`.
- Throw a clear `ForbiddenException` or `BadRequestException` before any transaction that creates order data.

Payment start:

- Update payment intent DTOs to accept `location?: ClientLocationInput`.
- Check `PAYMENT_START` after resolving the order/session branch and before provider calls.
- Ensure payment split preview endpoints are not blocked unless they start payment.

Staff login:

- Update `StaffLoginDto` to include optional `location`.
- After password is verified and staff branch is known, check `STAFF_LOGIN`.
- Reject before token signing.

### Phase 4: Logging And Audit

Log administrative rule changes in `AuditLog`:

- `GEOFENCE_RULE_CREATED`
- `GEOFENCE_RULE_UPDATED`
- `GEOFENCE_RULE_DELETED`
- `GEOFENCE_RULE_ENABLED`
- `GEOFENCE_RULE_DISABLED`

Log enforcement decisions in `OperationalEventLog` where useful:

- `GEOFENCE_CHECK_ALLOWED`
- `GEOFENCE_CHECK_DENIED`

Recommended metadata:

```json
{
  "appliesTo": "CUSTOMER_ORDERING",
  "reason": "OUTSIDE_RADIUS",
  "distanceMeters": 842,
  "allowedRadiusMeters": 150,
  "accuracyMeters": 25
}
```

Do not log exact customer/staff latitude and longitude by default.

### Phase 5: Admin UI

Add a Geo-Fencing section in Admin Settings or Branch Settings.

Expected controls:

- Branch selector, reusing existing admin branch context.
- Rule cards for Customer Ordering, Payment Start, and Staff Login.
- Enable/disable toggle per rule.
- Radius numeric input in meters.
- Latitude and longitude inputs.
- "Use branch location" helper if branch coordinates are later added.
- Validation messages for invalid coordinates or radius.

Useful display:

- Status badge: Enabled or Disabled.
- Last updated timestamp if schema adds `updatedAt`.
- Warning that browser location can be inaccurate indoors and should not be used as the only fraud control.

Avoid adding a map dependency in the first pass. Text inputs are enough for MVP and keep local development simple.

### Phase 6: Customer And Staff Frontend

Browser location capture:

- Use `navigator.geolocation.getCurrentPosition`.
- Request location only when the backend says a rule is required, or when submitting a protected action if rule state is already loaded.
- Send the latest location with order creation and payment-start requests.
- Show clear errors when location permission is denied, unavailable, or outside the allowed branch radius.

Recommended UX:

- Customer order button: request location just before order submission.
- Customer payment button: request location just before payment start.
- Staff login: request location after credentials are entered, before submit, only if staff login geo-fencing is enabled. If rule state cannot be known before login, submit credentials with location when available and let backend decide.

Client-side checks can improve messaging, but they must not decide access.

## API Error Shape

Use stable error codes so frontend messages are predictable:

```json
{
  "message": "Location is required for this branch action.",
  "code": "GEOFENCE_LOCATION_REQUIRED",
  "details": {
    "appliesTo": "CUSTOMER_ORDERING"
  }
}
```

Suggested codes:

- `GEOFENCE_LOCATION_REQUIRED`
- `GEOFENCE_INVALID_LOCATION`
- `GEOFENCE_LOCATION_STALE`
- `GEOFENCE_LOCATION_LOW_ACCURACY`
- `GEOFENCE_OUTSIDE_RADIUS`

## Testing Plan

Backend unit tests:

- Haversine helper returns expected distances for known coordinate pairs.
- Missing rule allows action.
- Enabled rule denies missing location.
- Enabled rule denies invalid latitude/longitude.
- Enabled rule denies stale location.
- Enabled rule denies outside radius.
- Enabled rule allows inside radius.

Backend integration tests:

- Customer order outside radius creates no order and emits no kitchen event.
- Customer order inside radius follows existing order flow.
- Payment start outside radius creates no gateway intent.
- Staff login outside radius rejects before JWT issuance.
- Admin rule CRUD enforces tenant and branch scope.

Frontend tests:

- Admin can create and edit a rule.
- Customer sees a permission/location error when geolocation is denied.
- Order submission includes location when geolocation succeeds.
- Staff login handles geo-fence denial cleanly.

Smoke test additions:

- Seed one disabled rule and verify old flow remains unaffected.
- Enable a small-radius rule and verify outside-radius request is rejected.

## Seed Data

Add optional seed rules only in disabled state:

- Downtown Branch `CUSTOMER_ORDERING`, radius `150`, disabled.
- Downtown Branch `PAYMENT_START`, radius `150`, disabled.
- Downtown Branch `STAFF_LOGIN`, radius `250`, disabled.

Disabled seed rules let the admin UI demonstrate configuration without breaking existing demo flows.

## Security And Privacy Notes

- Geolocation is not strong identity proof. GPS can be spoofed, and indoor accuracy can be poor.
- Use geo-fencing as a friction and policy control, not as the only anti-fraud measure.
- Do not store continuous location trails.
- Avoid exact coordinate logging for customer and staff checks.
- Keep all enforcement tenant/branch scoped.
- Do not add direct frontend database or AI-service access.

## Rollout Order

1. Add `GeoFencingModule`, location DTOs, decision type, Haversine utility, and unit tests.
2. Add admin rule CRUD endpoints, permissions, seed permission updates, and audit logs.
3. Enforce `CUSTOMER_ORDERING` in order creation.
4. Enforce `PAYMENT_START` in payment intent creation.
5. Enforce `STAFF_LOGIN` during staff login.
6. Add Admin Settings UI for rule management.
7. Add customer and staff geolocation capture and error handling.
8. Add integration, Playwright, and smoke coverage.
9. Update `docs/project-status.md`, graduation docs, `context.md`, and `memory.md` after implementation.

## Open Questions

- Should each branch have one rule per `appliesTo`, or should multiple overlapping allowed zones be supported?
- Should branch records gain canonical `latitude` and `longitude` fields so rules can default from branch location?
- Should staff login geo-fencing apply to owners/managers, or only branch operational roles?
- What is the minimum acceptable GPS accuracy for indoor restaurant use?
- Should geo-fencing be feature-flagged at the branch settings level in addition to rule `enabled`?
