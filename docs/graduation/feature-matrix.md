# Feature Matrix

Complete inventory of implemented modules, their frontend/backend support, test coverage, and known limitations.

Last updated: 2026-04-22

## Module Summary

| Module | Backend | Frontend | E2E Tested | Smoke Tested | Status |
|---|---|---|---|---|---|
| Auth (Staff) | Yes | Yes | Yes | Yes | Complete |
| Auth (Customer OTP) | Yes | Yes | Yes | Yes | Complete (dev OTP display) |
| Customer Ordering | Yes | Yes | Yes | No | Complete |
| Tables & Sessions | Yes | Yes (admin + waiter) | Yes | Yes | Complete |
| Menu Management | Yes | Yes | Yes | Yes | Complete |
| Orders | Yes | Yes | Yes | Yes | Complete |
| Kitchen Display (KDS) | Yes | Yes | Yes | Yes | Complete (86, undo, waste) |
| Waiter Dashboard | Yes | Yes | Yes | No | Complete (floor, serve, clear, quick-add) |
| Payments | Yes | Yes | Yes | No | Complete (Stripe + mock gateway) |
| Split Payments | Yes | Partial | No | No | Backend complete, customer MVP UI |
| POS & Shifts/Tills | Yes | Yes | Yes | No | Complete |
| Service Requests | Yes | Yes | Yes | Yes | Complete |
| Admin Operations | Yes | Yes | Yes | Yes | Complete |
| Analytics | Yes | Yes | Yes | Yes | Complete |
| Inventory | Yes | Yes | Yes | No | Complete (auto-decrement on SERVED) |
| Promotions & Coupons | Yes | Yes | Yes | No | Complete |
| Gift Cards | Yes | Partial | No | No | Backend complete, list view in admin |
| AI Recommendations | Yes | Yes | No | Yes | Complete (rule-based) |
| AI Chatbot | Yes | Yes | No | No | Complete |
| Realtime (SSE) | Yes | Yes | No | No | Complete |
| Notifications | Yes | No | No | No | Backend complete |
| Reviews | Yes | Yes | No | No | Complete |
| Devices | Yes | Yes | No | No | Complete |
| Branch Settings | Yes | Yes | No | No | Complete |
| Multi-Branch | Yes | Yes | No | No | Complete (summary + selector) |
| Waste/Remake Tracking | Yes | No | No | No | Backend complete |
| Table Access (QR/NFC) | Yes | Yes | No | No | Complete |
| Monitoring/Ops | Config | Docs | No | No | Config + docs only |

## Detailed Feature Breakdown

### Authentication & Authorization

| Feature | Backend | Frontend | Notes |
|---|---|---|---|
| Staff email/password login | Yes | Yes | Rate limited: 10 req/min |
| Customer phone OTP login | Yes | Yes | Dev mode shows OTP in UI |
| JWT token generation | Yes | -- | 8h expiry for staff |
| Customer refresh tokens | Yes | Yes | 30-day rotation |
| httpOnly cookie auth | Yes | Yes | With Bearer token fallback |
| Role-based access control (RBAC) | Yes | Yes | 41 permissions, 4 default roles |
| Permission-based route guards | Yes | -- | Decorator-based |
| **Limitation** | -- | -- | Real SMS provider not integrated |

### Customer Ordering

| Feature | Backend | Frontend | Notes |
|---|---|---|---|
| QR code / NFC tag -> session start | Yes | Yes | URL-based with table-access resolution |
| Menu browsing by category | Yes | Yes | With item details, dietary flags, filters |
| Item customization (additions) | Yes | Yes | Extra Cheese, Bacon, Mushrooms |
| Cart with quantity management | -- | Yes | localStorage-persisted, session-scoped |
| Order placement | Yes | Yes | Idempotency key (sessionStorage-persisted) |
| Order status tracking | Yes | Yes | Real-time polling via React Query |
| Service requests (call waiter, water) | Yes | Yes | CALL_WAITER, WATER, CUTLERY, BILL_REQUEST |
| Order reviews | Yes | Yes | Star ratings + issue tags |
| Payment (online) | Yes | Yes | Stripe Checkout or mock gateway |
| Payment (cancel) | -- | Yes | Cancel page with return flow |
| **Limitation** | -- | -- | Split-bill UI is customer MVP (backend supports full BY_ITEMS/BY_PEOPLE/BY_AMOUNT) |

### Kitchen Display System (KDS)

| Feature | Backend | Frontend | Notes |
|---|---|---|---|
| Live order queue | Yes | Yes | Multi-lane layout: NEW / COOKING / READY |
| Start order cooking | Yes | Yes | PATCH status transition |
| Fire individual items | Yes | Yes | Per-item status control |
| Mark order ready | Yes | Yes | Moves to READY column |
| Mark item unavailable (86) | Yes | Yes | Kitchen-side, updates customer menu |
| Undo item status | Yes | Yes | 8-second window, READY -> IN_PROGRESS |
| Waste/remake recording | Yes | -- | Backend API with reason codes |
| Kitchen stations | Yes | Yes | Station listing endpoint |
| Auto-refresh | Yes | Yes | Polling interval |
| **Limitation** | -- | -- | No drag-and-drop (button-based). Waste UI not in frontend |

### Waiter Dashboard

| Feature | Backend | Frontend | Notes |
|---|---|---|---|
| Floor overview with table status | Yes | Yes | Circle dot map with attention states |
| Service request queue | Yes | Yes | Claim and complete workflow |
| Order visibility per table | Yes | Yes | Detailed table view |
| Mark order served | Yes | Yes | SERVED status transition |
| Clear table / end session | Yes | Yes | Sets table to CLEANING |
| Quick-add items | Yes | Yes | Add items to active session |
| Confirm cash payment | Yes | Yes | Creates Payment + audit log |
| Confirm terminal payment | Yes | Yes | Creates Payment + audit log |
| **Limitation** | -- | -- | Floor map is schematic (not drag-to-arrange layout editor) |

### Payments

| Feature | Backend | Frontend | Notes |
|---|---|---|---|
| Payment recording (CASH/CARD) | Yes | Yes | Via POS, admin, or waiter |
| Online payment intent | Yes | Yes | Creates Stripe Checkout Session or mock |
| Stripe gateway | Yes | -- | Checkout Sessions, webhook, signature verify |
| Mock payment gateway | Yes | Yes | Simulates external checkout (dev) |
| Payment status tracking | Yes | Yes | PENDING -> COMPLETED |
| Refund recording | Yes | -- | Backend API with audit logging |
| Webhook with signature verify | Yes | -- | HMAC-SHA256 (Stripe + mock) |
| Split payment preview | Yes | -- | BY_PEOPLE, BY_ITEMS, BY_AMOUNT |
| Split payment creation | Yes | -- | Creates multiple Payment records |
| Waiter payment confirmation | Yes | Yes | Cash and terminal confirm endpoints |
| **Note** | -- | -- | Stripe ready; activate with env vars. Mock used for dev/demo |

### POS, Shifts & Tills

| Feature | Backend | Frontend | Notes |
|---|---|---|---|
| POS order creation | Yes | Yes | Staff-initiated orders |
| Active POS orders | Yes | Yes | Real-time view |
| Shift open/close | Yes | Yes | Owner/manager operation |
| Staff attendance check-in/out | Yes | Yes | Per-shift tracking |
| Till close with cash count | Yes | Yes | End-of-shift reconciliation |

### Admin Operations

| Feature | Backend | Frontend | Notes |
|---|---|---|---|
| Dashboard with KPIs | Yes | Yes | Revenue, orders, avg ticket, sessions, profit |
| Menu category/item CRUD | Yes | Yes | With availability toggle |
| Staff CRUD + role assignment | Yes | Yes | Create, edit, assign roles |
| Role + permission management | Yes | Yes | Custom roles with granular perms |
| Branch management | Yes | Yes | Create, update branches |
| Branch selector (multi-branch) | Yes | Yes | Dropdown for OWNER/MANAGER |
| Multi-branch summary | Yes | -- | Tenant-wide totals + per-branch KPIs |
| Tax rule management | Yes | -- | Backend API available |
| Expense tracking | Yes | Yes | Finance page in admin |
| Audit logging | Yes | -- | Backend API with filtering |
| Table management | Yes | -- | Create/update tables via admin API |
| Order editing | Yes | -- | Admin-level order modification |
| Finance summary | Yes | Yes | Revenue, expenses, profit overview |
| Branch settings | Yes | Yes | Per-branch configuration |
| Device management | Yes | Yes | KDS/POS/WAITER device provisioning |

### Analytics

| Feature | Backend | Frontend | Notes |
|---|---|---|---|
| Dashboard overview | Yes | Yes | KPI cards |
| Sales analytics | Yes | Yes | Revenue trends |
| Order analytics | Yes | Yes | Volume, status distribution |
| Menu performance | Yes | Yes | Item popularity ranking |
| Table analytics | Yes | -- | API available |
| Staff performance | Yes | -- | API available |
| Expense summary | Yes | Yes | Category breakdown |
| AI/ML insights | Yes | -- | API available |
| Daily snapshots | Yes | -- | Aggregation endpoint |

### Inventory

| Feature | Backend | Frontend | Notes |
|---|---|---|---|
| Inventory item CRUD | Yes | Yes | Name, unit, stock level, reorder point |
| Stock adjustment (+/-) | Yes | Yes | With reason tracking |
| Low-stock alerts | Yes | Yes | Based on reorder level |
| Menu-item <-> inventory mapping | Yes | -- | API available |
| Auto-decrement on SERVED | Yes | -- | Idempotent (inventoryDecrementedAt guard) |
| Auto-86 on zero stock | Yes | -- | Triggers ITEM_86ED event |

### Promotions

| Feature | Backend | Frontend | Notes |
|---|---|---|---|
| Discount CRUD (% / fixed) | Yes | Yes | With active/inactive toggle |
| Coupon CRUD | Yes | Yes | Code-based, linked to discounts |
| Coupon validation | Yes | -- | API available |
| Coupon redemption tracking | Yes | -- | CouponRedemption model |
| Gift card CRUD | Yes | Partial | List view only |
| Gift card redemption | Yes | -- | API available |
| Gift card transactions | Yes | -- | GiftCardTransaction model |

### AI Services

| Feature | Backend | Frontend | Notes |
|---|---|---|---|
| Menu recommendations | Yes | Yes | Popular items based on order history |
| Cart-based suggestions | Yes | -- | API available |
| Customer preferences | Yes | -- | API available |
| Menu chatbot | Yes | Yes | Conversational menu assistant widget |
| Recommendation stat recompute | Yes | -- | RecommendationStat model |
| **Limitation** | -- | -- | Uses rule-based logic; no ML models trained |

### Notifications

| Feature | Backend | Frontend | Notes |
|---|---|---|---|
| Persistent notifications | Yes | -- | Staff-scoped, stored in DB |
| Unread count | Yes | -- | API endpoint |
| Mark read (single/all) | Yes | -- | API endpoints |
| **Limitation** | -- | -- | No frontend notification UI (backend complete) |

### Reviews

| Feature | Backend | Frontend | Notes |
|---|---|---|---|
| Order review with star rating | Yes | Yes | After order completion |
| Item-level ratings | Yes | Yes | Per-item within review |
| Issue tags | Yes | Yes | ReviewIssueTag model (cold, late, etc.) |

### Device Management

| Feature | Backend | Frontend | Notes |
|---|---|---|---|
| Register branch device | Yes | Yes | KDS, POS, WAITER, CUSTOMER_DISPLAY types |
| Update device config | Yes | Yes | Capabilities, name, active status |
| Reset device API key | Yes | Yes | Security rotation |
| List branch devices | Yes | Yes | Admin devices page |

### Realtime

| Feature | Backend | Frontend | Notes |
|---|---|---|---|
| Branch event stream (SSE) | Yes | Yes | Order/table/session events |
| Session event stream (SSE) | Yes | -- | Per-session events |
| **Limitation** | -- | -- | SSE requires staff auth in production. Some surfaces use polling |

### Infrastructure & Ops

| Feature | Status | Notes |
|---|---|---|
| Docker production images | Complete | API, Web, AI multi-stage builds |
| Docker Compose production | Complete | 7 services + optional monitoring |
| Nginx reverse proxy | Complete | API/Web routing, security headers, SSE |
| Postgres backup/restore | Complete | Scripts for backup and restore |
| Health checks | Complete | All services have Docker healthchecks |
| Prometheus monitoring | Config only | Optional compose overlay |
| Operations runbook | Complete | Backup, restore, secrets, troubleshooting |
| GitHub Actions CI | Complete | Typecheck + build on push/PR |
| **Limitation** | -- | No HTTPS/TLS certificates, no CD pipeline |
