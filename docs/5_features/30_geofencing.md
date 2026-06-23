# Geo-Fencing

Geo-fencing is a feature that restricts certain actions to users who are physically near a restaurant branch. This is primarily a policy and friction control, not a strong identity verification method.

## Scope

In the current implementation, geo-fencing is used to protect the start of a customer's QR/table session.

-   **Endpoint:** `POST /api/sessions/start`
-   **Preflight Check:** `POST /api/geofencing/check` can be used by the frontend for a preflight check.

The frontend is responsible for collecting the user's geolocation data from the browser and sending it to the backend. The backend then calculates the distance using the Haversine formula and enforces the geo-fence.

## Branch Configuration

The `Branch` model includes the following fields to support geo-fencing:

-   `latitude`
-   `longitude`
-   `geofenceRadiusM`
-   `geofenceEnabled`

If `geofenceEnabled` is set to `false` for a branch, the check is bypassed.

## Customer Flow

1.  The customer scans a QR code or navigates to a table-specific URL.
2.  The frontend prompts the user for location permission.
3.  The frontend sends the user's latitude, longitude, and accuracy to the `/api/sessions/start` endpoint.
4.  The backend validates the location against the branch's configured geo-fence and either allows or denies the session start.

## Privacy

Raw customer latitude and longitude are not written to operational logs. The geo-fence logs only store the result of the check, the distance, radius, accuracy, and other non-personally identifiable information.
