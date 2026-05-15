# Presentation Notes

Talking points for graduation evaluation at different time scales, plus likely examiner questions.

---

## 1-Minute Pitch

> "I built a Smart Restaurant Operating System — a full-stack platform that connects customers, kitchen staff, waiters, and restaurant managers through a single real-time system.
>
> A customer scans a QR code at their table, browses the menu, customizes their order, and pays via Stripe — all from their phone, no app install needed. That order instantly appears on the kitchen display, where the chef manages preparation, can 86 items, undo mistakes, and record waste. Waiters see digital service requests, confirm payments, and manage tables from a live floor map. And the owner has a complete back-office with analytics, inventory that auto-decrements when orders are served, promotions, device management, and multi-branch oversight.
>
> The technical scope includes 155 API endpoints, 51 database models, 28 frontend routes, role-based access with 41 permissions, Stripe payment integration, Docker deployment, and 24 end-to-end tests. It's built with Next.js, NestJS, PostgreSQL, and Redis as a multi-tenant system designed for real restaurant operations."

---

## 5-Minute Walkthrough

**Minute 1 — Problem and Solution** (no screen)
- Restaurants use fragmented tools: paper tickets, separate POS, manual inventory
- This system unifies the entire dining lifecycle into one platform
- Four user surfaces: Customer, Kitchen, Waiter, Admin

**Minute 2 — Customer Demo** (live)
- Show QR-code start -> menu browsing -> item customization -> cart -> order placement
- Show order tracking page with real-time status
- "This replaces paper menus and verbal ordering"

**Minute 3 — Kitchen + Waiter** (live)
- Show order appearing on KDS -> chef starts cooking -> marks ready
- Show 86 item (mark unavailable) and undo capability
- Show waiter dashboard with floor map and service request claim
- Show waiter confirming cash payment
- "Real-time communication between front-of-house and kitchen"

**Minute 4 — Admin Panel** (live)
- Show dashboard KPIs with profit calculation
- Show branch selector for multi-branch management
- Quick peek at analytics, inventory, promotions, device management
- "The owner's command center for the entire operation"

**Minute 5 — Technical Highlights** (terminal + architecture)
- Show health check response with dependency statuses
- Mention: 155 endpoints, 51 models, 28 routes, 24 E2E tests, Docker deployment
- Stripe adapter pattern: mock for dev, Stripe for production — same interface
- "Multi-tenant, role-based, production-ready architecture"

---

## 10-Minute Technical Explanation

### Structure (2 min)
- Monorepo with three apps: `web` (Next.js), `api` (NestJS), `ai-services` (FastAPI)
- Modular monolith backend: 24 domain modules with consistent structure
- 51 Prisma models and 29 enums covering the complete restaurant domain

### Key Design Decisions (3 min)
- **Multi-tenant**: Tenant -> Branch scoping on every query via JWT context
- **RBAC**: 41 permissions, decorator-based route guards, custom roles
- **Payment adapter**: Interface pattern with Stripe gateway + mock gateway; swappable without touching business logic
- **Realtime**: SSE for KDS and order updates — simpler than WebSockets for server-push scenarios
- **Auth**: httpOnly cookies + Bearer token fallback; customer OTP with refresh token rotation
- **Inventory auto-decrement**: Idempotent (inventoryDecrementedAt guard field) — triggers on SERVED, never double-decrements

### Operational Completeness (2 min)
- **KDS**: 86 items from kitchen side, undo within 8-second window, waste/remake tracking with reason codes
- **Waiter**: Floor map with attention states, payment confirmation (cash + terminal), quick-add items, table lifecycle control
- **Split payments**: Backend supports BY_PEOPLE, BY_ITEMS, BY_AMOUNT with preview endpoint
- **Multi-branch**: Branch selector in admin, multi-branch summary for franchise-level overview, device management per branch
- **Notifications**: Persistent notifications with read tracking (backend infrastructure)

### Frontend Architecture (1.5 min)
- Single Next.js app serving 4 surfaces with shared components
- React Query for data fetching with automatic caching and background refetch
- Custom design system: CSS custom properties (ink ladder, accent colors), editorial serif typography (Playfair Display), mono for data
- Standalone build for Docker: lean images via multi-stage builds

### Testing and Quality (1.5 min)
- TypeScript throughout (zero errors on typecheck)
- 16-point API smoke test validating auth, table session start, ordering, KDS, analytics
- 24 Playwright E2E tests covering customer ordering, OTP login, payments, KDS actions, waiter flows, inventory, promotions, mobile viewport
- Functional audits: Customer (13 flows), Waiter (20 flows), KDS (15 flows), Admin (61 tests) — all passing
- Cached auth tokens to avoid rate limit exhaustion across test runs

---

## Likely Examiner Questions and Answers

### "Why did you choose a modular monolith instead of microservices?"

> "Microservices add deployment complexity — separate CI/CD pipelines, inter-service communication, distributed transactions — that don't benefit a project with one developer. The modular monolith gives me clean domain boundaries that could be extracted into services later if needed. For example, the payments module communicates through a well-defined adapter interface that would translate directly to an API contract."

### "How does multi-tenancy work?"

> "Every staff user's JWT token contains their tenantId and branchId. When they make an API request, the controller extracts these from the token and passes them to the service layer. Every database query includes a WHERE tenantId clause. This means multiple restaurant groups could share the same deployment without seeing each other's data. Owners can also switch between branches using the admin branch selector, which propagates through React Context."

### "How does the payment system work?"

> "Payments use an adapter pattern. The PaymentsController calls a provider-agnostic service, which delegates to whatever gateway is configured — currently Stripe or a mock gateway. Stripe integration uses Checkout Sessions for PCI compliance: no card data ever touches our server. The gateway selection is controlled by an environment variable. For development, the mock gateway simulates the full flow. For production, you set PAYMENT_PROVIDER=stripe with your Stripe keys. The same code path handles both."

### "How would you deploy this to production?"

> "I have a Docker Compose production configuration with Nginx as the entry point, multi-stage builds for lean images, health checks on every service, and backup scripts. For a real production deployment, I'd add HTTPS via Let's Encrypt, configure Stripe with live API keys, integrate an SMS provider for customer OTP, and set up the CD portion of the CI/CD pipeline. The architecture supports all of these — they're configuration changes, not structural changes."

### "Why Server-Sent Events instead of WebSockets?"

> "The restaurant use case is predominantly server-push: the kitchen gets notified of new orders, the customer gets order status updates. SSE handles this natively over HTTP, auto-reconnects on network drops, and works through Nginx without special proxy configuration. WebSockets would only be needed if I had client-to-server streaming, which I don't. Some surfaces also use React Query polling for simplicity, which provides a good user experience with automatic background refetch."

### "What about security?"

> "Auth tokens are in httpOnly cookies to prevent XSS theft, with a Bearer header fallback for programmatic access. Login endpoints are rate-limited to prevent brute force. The OTP dev display is gated behind NODE_ENV. Payment card data is never stored — Stripe handles all card data via Checkout Sessions, which is PCI-DSS compliant. All database queries are tenant-scoped. The API uses Helmet for security headers and CORS whitelisting. All sensitive operations are logged in an audit trail."

### "How does inventory auto-decrement work?"

> "When an order transitions to SERVED status, the system automatically decrements linked inventory items based on the MenuItemInventoryMap table. Each mapping specifies how much of each ingredient is consumed per menu item. To prevent double-decrement — say, if the status update is retried — the Order model has an inventoryDecrementedAt timestamp field that acts as an idempotency guard. If it's already set, the decrement is skipped. If stock hits zero, the item is automatically marked unavailable (86'd) and an event is emitted."

### "What would you do differently if you started over?"

> "I'd invest in database seeding earlier — having realistic demo data makes testing and evaluation much smoother. I'd also set up E2E tests from the beginning rather than adding them after the backend and frontend were complete. And I'd consider using tRPC or a similar typed API layer to reduce the API surface code, though the explicit NestJS controllers are good for demonstrating REST API design."

### "What features did you intentionally leave out?"

> "The ProjectPlane spec defines several optional modules that I chose to exclude: loyalty/CRM, online ordering/call center, marketplace integrations, and a customer display screen. These are all labeled as feature-flagged modules in the original spec. I also didn't implement advanced ML-based forecasting — the recommendation engine uses rule-based logic (order frequency, co-purchase patterns) rather than trained models. The architecture supports adding all of these, but they weren't core to demonstrating a working restaurant operating system."

---

## Known Limitations (Be Transparent)

When asked about limitations, honesty builds credibility:

1. **Dev-only OTP** — No SMS provider integrated; OTP code is shown in the UI in development
2. **Stripe not activated** — Stripe adapter is complete and tested with mock; live keys needed for real transactions
3. **No HTTPS** — Nginx config has commented TLS placeholders but no certificate automation
4. **Rule-based AI** — Recommendations use order frequency, not trained ML models
5. **Single-browser tested** — E2E tests run on Chromium only
6. **Some surfaces use polling** — SSE infrastructure exists but some frontends rely on React Query polling
7. **Split-bill frontend is MVP** — Backend supports full BY_ITEMS/BY_PEOPLE/BY_AMOUNT; frontend is simpler
8. **Notification UI not built** — Backend endpoints exist; no frontend notification panel
9. **Waste recording UI not built** — Backend endpoint exists; no frontend waste form in KDS
10. **KDS lacks Wake Lock / fullscreen** — Browser APIs not implemented
