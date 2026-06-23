# Authentication

Authentication is handled by the `auth` module in the `apps/api` service. The system uses a combination of JWTs, httpOnly cookies, and CSRF protection.

## Staff Authentication

-   **Method:** Email and password.
-   **Endpoint:** `POST /api/auth/staff/login`
-   **Process:**
    1.  The user provides their email and password.
    2.  The backend verifies the credentials and hashes the password using bcrypt.
    3.  If successful, the backend returns a JWT access token and sets it in an httpOnly cookie (`sro_access`).
-   **Sessions:** Staff sessions are finite, as refresh tokens are not implemented for staff.

## Customer Authentication

-   **Method:** Phone number and a one-time password (OTP).
-   **Endpoints:**
    -   `POST /api/auth/customer/otp/request`
    -   `POST /api/auth/customer/otp/verify`
    -   `POST /api/auth/customer/refresh`
-   **Process:**
    1.  The customer requests an OTP to their phone number.
    2.  In development, the OTP is logged to the console. In production, it is sent via Twilio.
    3.  The customer submits the OTP to verify their identity.
    4.  Upon successful verification, the customer receives a JWT access token and a refresh token.
-   **Refresh Tokens:** Refresh tokens are used to obtain new access tokens without requiring the user to log in again. They are stored in the database and rotated on each use.

## Cookies, Sessions, and CSRF

-   **Cookies:** The application uses httpOnly cookies to store access and refresh tokens, which helps to mitigate XSS attacks.
-   **CSRF Protection:** The application uses a signed double-submit cookie pattern to protect against Cross-Site Request Forgery (CSRF) attacks. The frontend automatically fetches a CSRF token and includes it in the headers of unsafe requests.
