# Architecture Notes

Technical decisions, trade-offs, and design rationale for the Smart Restaurant OS.

---

## Modular Monolith

The backend is a **modular monolith** — a single NestJS application organized into 18 domain modules (auth, orders, KDS, payments, etc.) that communicate through direct service imports rather than network calls.

**Why not microservices?**
- A graduation project with one developer does not benefit from the deployment complexity of microservices.
- All modules share the same database, which simplifies transactions (e.g., placing an order atomically creates OrderItems and updates Table status).
- The module boundaries are clean enough that extracting a module into a separate service later (e.g., payments) would be straightforward.

**Module structure**: Each module follows a consistent pattern:
```
modules/orders/
  orders.module.ts      ← NestJS module declaration
  orders.controller.ts  ← HTTP routes
  orders.service.ts     ← Business logic
  dto/                  ← Request/response validation
```

---

## Multi-Tenant Architecture

The system is designed for multi-tenancy from day one:

- **Tenant** → has many **Branches** → each branch has **Tables**, **Staff**, **Menu**, etc.
- Every staff JWT token contains `tenantId` and `branchId`.
- Every database query that touches tenant-scoped data filters by `tenantId`.

**Scoping approach**: The API extracts tenant context from the authenticated user's JWT and passes it through to service methods. This is enforced at the controller level — services receive `tenantId` as a parameter rather than reading it from a global context.

**Why this matters**: In a production deployment, multiple restaurant groups could share the same infrastructure without seeing each other's data.

---

## Authentication Design

### Staff Auth

- JWT tokens with 8-hour expiry
- httpOnly cookie (primary) with Bearer token header fallback
- The cookie approach prevents XSS token theft; the header fallback supports programmatic access
- Rate limited: 10 login attempts per minute per IP

### Customer Auth

- Phone-based OTP (One-Time Password)
- In development, the OTP is displayed in the UI (gated behind `NODE_ENV=development`)
- Tokens: short-lived access token + 30-day refresh token with rotation
- Refresh token rotation: each refresh invalidates the old token and issues a new one

### RBAC (Role-Based Access Control)

- 41 granular permissions (e.g., `menu:read`, `orders:write`, `kds:write`)
- Permissions are assigned to roles, roles are assigned to staff
- Route guards use `@RequirePermission('kds:write')` decorators
- 4 default roles: Owner (all 39), Waiter (13), Chef (4), Cashier (18)
- Custom roles can be created via the admin API

---

## API Design

### RESTful Conventions

- Global `/api` prefix on all routes
- Consistent HTTP verb usage: GET (read), POST (create), PATCH (update), DELETE (remove)
- Global `ValidationPipe` with whitelist + transform + forbidNonWhitelisted
- Structured error responses with status code, message, and error type

### Idempotency

Order creation requires an `idempotencyKey`. If the same key is submitted twice, the second request returns the existing order instead of creating a duplicate. This prevents double-orders from network retries or user double-clicks.

### Tenant Scoping

Every query that touches business data includes a `WHERE tenantId = ?` clause. This is enforced at the service level — controllers extract `tenantId` from the JWT and pass it to services explicitly.

---

## Realtime Design

The system uses **Server-Sent Events (SSE)** for real-time updates:

- `/api/realtime/branches/:branchId/events` — branch-wide events (new orders, table status changes)
- `/api/realtime/sessions/:sessionId/events` — session-specific events (order status updates)

**Why SSE instead of WebSockets?**
- SSE is simpler: unidirectional (server → client), works over standard HTTP, auto-reconnects
- The restaurant use case is mostly server-push (order updates, KDS notifications)
- SSE works through Nginx without special configuration (unlike WebSocket upgrade)
- NestJS has built-in SSE support via `@Sse()` decorator

**Nginx configuration**: The reverse proxy is configured with `proxy_buffering off` and long `proxy_read_timeout` to support SSE streams.

---

## Payment Gateway Adapter

The payment system uses an **adapter pattern** that abstracts the payment provider:

```
PaymentsController → PaymentsService → GatewayRegistry → PaymentGateway (interface)
                                                              ↓
                                                      MockPaymentGateway
                                                      (future: StripeGateway, ClickGateway)
```

**Interface**: `PaymentGateway` defines three methods:
- `createIntent(input)` → returns checkout URL + external ID
- `verifyWebhookSignature(payload, signature)` → boolean
- `parseWebhookEvent(payload)` → structured event

**Current implementation**: `MockPaymentGateway` generates a fake checkout URL pointing to `/customer/payment/success`, where a "Simulate Payment Success" button triggers the mock completion endpoint.

**Webhook security**: Even the mock gateway uses HMAC-SHA256 signature verification, so the webhook handling code is production-ready.

**Switching providers**: Set `PAYMENT_PROVIDER=stripe` in the environment. The `GatewayRegistry` factory will instantiate the corresponding gateway class. No changes to controllers or services needed.

---

## AI Service Design

The AI service is a **separate FastAPI (Python) application** that runs independently:

- Communicates with the API via HTTP
- Currently provides: menu recommendations, cart-based suggestions, and a menu chatbot
- Uses rule-based logic (order frequency analysis) rather than trained ML models
- The API falls back gracefully when the AI service is unavailable (`health.ai = "unavailable"`)

**Why separate?**
- Python has a richer ML/NLP ecosystem than Node.js
- The AI service can be scaled, updated, or replaced independently
- In the current MVP, it's optional — all core features work without it

---

## Frontend Architecture

### Single App, Multiple Surfaces

One Next.js application serves all four user interfaces:
- `/customer/*` — customer-facing ordering
- `/kitchen/*` — KDS for kitchen staff
- `/waiter/*` — waiter dashboard
- `/admin/*` — admin panel + POS

**Why one app instead of four?**
- Shared component library (StatusPill, KpiCard, LoadingScreen, etc.)
- Shared API client and auth utilities
- Single build + deployment
- Shared TailwindCSS theme and design tokens

### Data Fetching

All data fetching uses **React Query (TanStack Query)** for:
- Automatic caching and deduplication
- Background refetching (polling intervals for KDS, order status)
- Optimistic updates where appropriate

### Client-Side State

- Staff auth: localStorage (`staff_token`, `staff_branch_id`, `staff_name`, `staff_role`)
- Customer auth: localStorage (customer token, refresh token, phone)
- Cart: localStorage with session-scoped isolation

### Standalone Output

The Next.js build uses `output: "standalone"` which creates a self-contained production bundle. This reduces the Docker image to 302 MB (vs. a full `node_modules` copy).

---

## Deployment Architecture

### Docker Compose (Production)

```
nginx:80 → api:4000 (NestJS)
          → web:3000 (Next.js standalone)

api → postgres:5432, redis:6379, ai:8000, minio:9000
```

- **Nginx** is the single entry point. Routes `/api/*` to the API, everything else to the Web app.
- **Services are not exposed to the host** (except Nginx port 80). Postgres, Redis, MinIO, and AI communicate only within the Docker network.
- **Health checks** on every service. API waits for Postgres + Redis + AI before starting.
- **Multi-stage Docker builds** keep images lean (deps → build → production).

### Environment Configuration

- `NEXT_PUBLIC_API_BASE_URL=""` (empty) → browser API calls go through Nginx (same-origin)
- All secrets via environment variables, never baked into images
- `.env.production.example` documents every variable with safe defaults

---

## Security Decisions

| Decision | Rationale |
|---|---|
| httpOnly cookies for auth | Prevents XSS token theft; Bearer header fallback for API clients |
| Rate limiting on auth endpoints | Prevents brute-force: 10 staff logins/min, 5 OTP requests/min |
| Helmet security headers | CSP, X-Frame-Options, X-Content-Type-Options in production |
| CORS whitelist | Open in dev, explicit origins in production |
| Tenant scoping on all queries | Prevents cross-tenant data leakage |
| No card data storage | PCI-compliant by design — payment handled by external gateway |
| Request logging without secrets | Logs method/path/status/duration only; no bodies, headers, or tokens |
| Dev OTP display gated | `_dev_otp` only returned when `NODE_ENV=development` |
| Webhook signature verification | Even mock gateway uses HMAC-SHA256 |

---

## Known Production Gaps

| Gap | Impact | Mitigation |
|---|---|---|
| No real SMS provider | Customer OTP only works in dev mode | Adapter pattern ready; plug in Twilio/etc. |
| No real payment gateway | Online payment uses mock | Adapter pattern ready; plug in Stripe/Click |
| No HTTPS/TLS | Traffic unencrypted | Nginx config has HTTPS placeholders |
| No CI/CD pipeline | Manual builds | GitHub Actions workflow for typecheck/build exists |
| Monitoring config-only | Prometheus not deployed | Config files ready; documented in monitoring.md |
| No log aggregation | Logs in Docker stdout | Loki/ELK documented as future enhancement |
| SSE auth optional | Branch events publicly accessible in dev | Production should require staff auth |
