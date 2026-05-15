# Geo-Fencing

## Purpose

Geo-fencing is a controlled add-on that restricts selected branch actions to users who are physically near the correct restaurant branch. It is a policy and friction control, not strong identity proof.

## MVP Scope

The MVP protects customer QR/table session start:

- `POST /api/sessions/start`
- `POST /api/geofencing/check` for preflight UX only

The frontend never decides whether a user is inside the branch geofence. It only collects browser geolocation and sends it to the API. The backend calculates distance with the Haversine formula and enforces the result before a session is created.

## Enforcement Point

`SessionsService.startSession` enforces geo-fencing when called by the public QR/customer flow with `enforceGeoFence: true`. The check happens after the table and branch are resolved but before session creation and table status mutation. Staff/POS starts are not blocked by the customer QR geofence path.

## Branch Configuration

Branch records now support:

- `latitude`
- `longitude`
- `geofenceRadiusM`
- `geofenceEnabled`

If `geofenceEnabled=false`, the existing flow continues normally. If it is enabled, branch coordinates must be present and the customer location must be inside `geofenceRadiusM`.

The existing `GeoFencingRule` schema remains for future per-action rule management.

## Customer QR/Table Flow

1. Customer opens `/customer/start` from a QR/NFC code or branch/table URL.
2. Frontend calls `/api/geofencing/check` without coordinates.
3. If skipped, the session starts normally.
4. If location is required, the browser requests geolocation permission.
5. Frontend sends `latitude`, `longitude`, and `accuracyMeters` to `/api/sessions/start`.
6. Backend allows or rejects before creating the session.

Customer messages:

- Allowed: "Location confirmed. Welcome!"
- Denied: "You appear to be outside this restaurant's ordering area. Please scan the QR code while inside the branch."
- Permission denied: "This branch requires location verification to start a table session. Please enable location permission and try again."
- Low accuracy: "We could not confirm your location accurately. Please try again closer to the branch."

## Privacy Behavior

Raw customer latitude and longitude are not written to operational logs. Geofence logs store only:

- result
- distance
- radius
- action
- branchId through log scope
- sessionId/userId when available
- accuracy
- timestamp from the log record

## Demo Bypass Rules

Environment flags:

```env
GEOFENCING_ENABLED=true
GEOFENCING_DEMO_BYPASS=false
GEOFENCING_DEFAULT_RADIUS_M=100
GEOFENCING_MAX_ACCURACY_M=1000
```

`GEOFENCING_DEMO_BYPASS=true` allows geofence-protected actions only when `NODE_ENV` is not `production`. Production examples keep it disabled.

## Production Risks

- Browser geolocation can be inaccurate indoors.
- GPS can be spoofed.
- Missing branch coordinates make enabled geofencing unavailable.
- Location permission prompts can add customer friction.
- The current MVP has branch-level settings, not full admin rule management UI.

## Future Upgrades

- Admin UI for branch geofence settings.
- Per-action rule CRUD using `GeoFencingRule`.
- Staff check-in and waiter action enforcement.
- Better diagnostics for accuracy failures.
- Optional multiple allowed zones per branch.
