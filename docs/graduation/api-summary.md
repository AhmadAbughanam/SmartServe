# API Summary

The backend exposes **155 endpoints** (153 REST + 2 SSE) across **24 controller modules**, all prefixed with `/api`.

---

## Authentication (8 endpoints)

### Staff Auth — `/api/auth`

| Method | Path | Description |
|---|---|---|
| POST | `/auth/staff/login` | Email/password login (rate limited: 10/min) |
| GET | `/auth/me` | Current staff profile (requires token) |
| GET | `/auth/admin-only` | Admin permission check |

### Customer Auth — `/api/auth/customer`

| Method | Path | Description |
|---|---|---|
| POST | `/auth/customer/otp/request` | Request OTP (rate limited: 5/min) |
| POST | `/auth/customer/otp/verify` | Verify OTP, receive tokens |
| POST | `/auth/customer/refresh` | Refresh access token |
| POST | `/auth/customer/logout` | Invalidate refresh token |
| GET | `/auth/customer/me` | Current customer profile |

---

## Tables & Sessions (8 endpoints)

### Tables — `/api/tables`

| Method | Path | Description |
|---|---|---|
| GET | `/branches/:branchId/tables` | List all tables for a branch |
| GET | `/tables/:tableId` | Get table details |
| PATCH | `/tables/:tableId/status` | Update table status |

### Table Access — `/api/table-access`

| Method | Path | Description |
|---|---|---|
| GET | `/table-access/:code` | Resolve QR/NFC tag code to table details |

### Sessions — `/api/sessions`

| Method | Path | Description |
|---|---|---|
| POST | `/sessions/start` | Start customer session (guest) |
| POST | `/sessions/staff/start` | Start session (staff-initiated) |
| GET | `/sessions/:sessionId` | Get session details |
| POST | `/sessions/:sessionId/end` | End session |

---

## Menu (6 endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/menu` | List categories with items (public, by branchId) |
| GET | `/menu/items/:itemId` | Item details with additions |
| POST | `/menu/categories` | Create category |
| POST | `/menu/items` | Create menu item |
| PATCH | `/menu/items/:itemId` | Update menu item |
| PATCH | `/menu/items/:itemId/availability` | Toggle availability |

---

## Orders (4 endpoints)

| Method | Path | Description |
|---|---|---|
| POST | `/sessions/:sessionId/orders` | Place order (with idempotency key) |
| GET | `/orders/:orderId` | Get order by ID |
| GET | `/sessions/:sessionId/orders/:orderId` | Get order within session context |
| PATCH | `/orders/:orderId/status` | Update order status (triggers auto-inventory-decrement on SERVED) |

---

## Kitchen Display System (9 endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/kds/orders` | KDS queue (filtered by branch, status, station) |
| GET | `/kds/stations` | List kitchen stations |
| GET | `/kds/orders/:orderId` | Single order detail |
| PATCH | `/kds/orders/:orderId/start` | Start cooking order |
| PATCH | `/kds/orders/:orderId/ready` | Mark order ready |
| PATCH | `/kds/order-items/:orderItemId/status` | Update individual item status |
| PATCH | `/kds/menu-items/:itemId/unavailable` | Mark item unavailable (86) |
| PATCH | `/kds/order-items/:orderItemId/undo` | Undo item status (8-second window) |
| POST | `/kds/waste` | Record waste/remake with reason code |

---

## Waiter (7 endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/waiter/floor` | Floor summary with table attention states |
| GET | `/waiter/tables/:tableId` | Detailed table view (session, orders, requests) |
| PATCH | `/waiter/orders/:orderId/serve` | Mark order as SERVED |
| POST | `/waiter/tables/:tableId/clear` | End session, set table to CLEANING |
| POST | `/waiter/tables/:tableId/quick-add` | Quick-add menu items to active session |
| POST | `/waiter/orders/:orderId/payments/cash-confirm` | Confirm cash payment |
| POST | `/waiter/orders/:orderId/payments/terminal-confirm` | Confirm terminal/card payment |

---

## Payments (9 endpoints)

| Method | Path | Description |
|---|---|---|
| POST | `/orders/:orderId/payments` | Record payment (CASH/CARD) |
| POST | `/orders/:orderId/payments/intent` | Create Stripe Checkout Session or mock intent |
| POST | `/payments/webhook/:provider` | Receive payment webhook (HMAC-SHA256 verified) |
| GET | `/orders/:orderId/payments` | List payments for order |
| GET | `/payments/:paymentId` | Get payment details |
| POST | `/payments/:paymentId/refunds` | Record refund |
| POST | `/orders/:orderId/payments/splits/preview` | Preview split allocations (BY_PEOPLE/BY_ITEMS/BY_AMOUNT) |
| POST | `/orders/:orderId/payments/splits` | Create split payments |
| POST | `/payments/:paymentId/mock-complete` | Simulate payment success (dev only) |

---

## POS (2 endpoints)

| Method | Path | Description |
|---|---|---|
| POST | `/pos/orders` | Create POS order (staff-initiated) |
| GET | `/pos/orders/active` | List active POS orders |

---

## Shifts & Tills (9 endpoints)

| Method | Path | Description |
|---|---|---|
| POST | `/shifts/open` | Open shift |
| POST | `/shifts/:shiftId/close` | Close shift |
| GET | `/shifts/open` | Get current open shift |
| GET | `/shifts` | List all shifts |
| POST | `/shifts/attendance/check-in` | Staff check-in |
| POST | `/shifts/attendance/check-out` | Staff check-out |
| GET | `/shifts/attendance/me` | My attendance status |
| POST | `/shifts/:shiftId/till/close` | Close till with cash count |
| GET | `/shifts/:shiftId/till` | Get till status |

---

## Service Requests (7 endpoints)

| Method | Path | Description |
|---|---|---|
| POST | `/sessions/:sessionId/service-requests` | Create request (CALL_WAITER, WATER, etc.) |
| GET | `/sessions/:sessionId/service-requests` | List requests for session |
| GET | `/service-requests` | List all requests (staff, by branch) |
| GET | `/service-requests/:requestId` | Get request details |
| PATCH | `/service-requests/:requestId/claim` | Waiter claims request |
| PATCH | `/service-requests/:requestId/complete` | Mark request complete |
| PATCH | `/service-requests/:requestId/cancel` | Cancel request |

---

## Admin (33 endpoints)

### Tenant & Branch

| Method | Path | Description |
|---|---|---|
| GET | `/admin/tenant` | Tenant details |
| GET | `/admin/branches` | List branches |
| GET | `/admin/branches/:branchId` | Branch details |
| POST | `/admin/branches` | Create branch |
| PATCH | `/admin/branches/:branchId` | Update branch |
| GET | `/admin/multi-branch-summary` | Tenant-wide totals + per-branch KPIs |

### Staff & Roles

| Method | Path | Description |
|---|---|---|
| GET | `/admin/staff` | List staff |
| GET | `/admin/staff/:staffId` | Staff details |
| POST | `/admin/staff` | Create staff |
| PATCH | `/admin/staff/:staffId` | Update staff |
| POST | `/admin/staff/:staffId/roles` | Assign roles |
| GET | `/admin/roles` | List roles |
| GET | `/admin/permissions` | List all permissions |
| POST | `/admin/roles` | Create role |
| POST | `/admin/roles/:roleId/permissions` | Set role permissions |

### Tax, Expenses & Finance

| Method | Path | Description |
|---|---|---|
| GET | `/admin/tax-rules` | List tax rules |
| POST | `/admin/tax-rules` | Create tax rule |
| PATCH | `/admin/tax-rules/:taxRuleId` | Update tax rule |
| POST | `/admin/expenses` | Record expense |
| GET | `/admin/expenses` | List expenses |
| GET | `/admin/expenses/:expenseId` | Expense details |
| GET | `/admin/finance-summary` | Revenue, expenses, profit overview |

### Tables & Orders

| Method | Path | Description |
|---|---|---|
| POST | `/admin/tables` | Create table |
| PATCH | `/admin/tables/:tableId` | Update table |
| PATCH | `/admin/orders/:orderId` | Edit order (admin-level) |

### Inventory & Promotions Tracking

| Method | Path | Description |
|---|---|---|
| GET | `/admin/inventory/adjustments` | Stock adjustment history |
| GET | `/admin/inventory/alerts` | Low-stock alert list |
| PATCH | `/admin/inventory/alerts/:alertId` | Acknowledge/dismiss alert |
| GET | `/admin/promotions/coupon-redemptions` | Coupon redemption history |
| GET | `/admin/promotions/gift-card-transactions` | Gift card transaction history |

### Audit & Settings

| Method | Path | Description |
|---|---|---|
| GET | `/admin/audit-logs` | View audit trail (filterable) |
| GET | `/admin/branch-settings` | Get branch settings |
| PATCH | `/admin/branch-settings` | Update branch settings |

---

## Analytics (10 endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/analytics/dashboard` | Dashboard KPIs |
| GET | `/analytics/sales` | Sales analytics |
| GET | `/analytics/orders` | Order analytics |
| GET | `/analytics/menu-performance` | Menu item rankings |
| GET | `/analytics/tables` | Table utilization |
| GET | `/analytics/staff` | Staff performance |
| GET | `/analytics/expenses` | Expense summary |
| GET | `/analytics/insights` | AI/ML insights |
| POST | `/analytics/snapshots/daily` | Generate daily snapshot |
| GET | `/analytics/snapshots/daily` | Retrieve daily snapshots |

---

## Inventory (9 endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/inventory/items` | List inventory items |
| GET | `/inventory/items/:itemId` | Item details |
| POST | `/inventory/items` | Create item |
| PATCH | `/inventory/items/:itemId` | Update item |
| POST | `/inventory/items/:itemId/adjust` | Adjust stock (+/-) |
| GET | `/inventory/low-stock` | Low-stock alerts |
| GET | `/inventory/menu-items/:menuItemId/map` | Item-to-menu mappings |
| POST | `/inventory/menu-items/:menuItemId/map` | Create mapping |
| DELETE | `/inventory/menu-items/:menuItemId/map/:inventoryItemId` | Remove mapping |

---

## Promotions (14 endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/promotions/discounts` | List discounts |
| GET | `/promotions/discounts/:discountId` | Discount details |
| POST | `/promotions/discounts` | Create discount |
| PATCH | `/promotions/discounts/:discountId` | Update discount |
| GET | `/promotions/coupons` | List coupons |
| GET | `/promotions/coupons/:couponId` | Coupon details |
| POST | `/promotions/coupons` | Create coupon |
| PATCH | `/promotions/coupons/:couponId` | Update coupon |
| POST | `/promotions/coupons/validate` | Validate coupon code |
| GET | `/promotions/gift-cards` | List gift cards |
| GET | `/promotions/gift-cards/:giftCardId` | Gift card details |
| POST | `/promotions/gift-cards` | Create gift card |
| PATCH | `/promotions/gift-cards/:giftCardId` | Update gift card |
| POST | `/promotions/gift-cards/:giftCardId/redeem` | Redeem gift card |

---

## Notifications (4 endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/notifications` | List notifications (staff-scoped) |
| GET | `/notifications/unread-count` | Get unread count |
| PATCH | `/notifications/:id/read` | Mark notification as read |
| PATCH | `/notifications/read-all` | Mark all notifications as read |

---

## Reviews (2 endpoints)

| Method | Path | Description |
|---|---|---|
| POST | `/sessions/:sessionId/orders/:orderId/reviews` | Create order review with issue tags and item ratings |
| GET | `/sessions/:sessionId/orders/:orderId/reviews` | Retrieve review for order |

---

## Devices (4 endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/admin/devices` | List branch devices |
| POST | `/admin/devices` | Register device (KDS/POS/WAITER/CUSTOMER_DISPLAY) |
| PATCH | `/admin/devices/:deviceId` | Update device config |
| POST | `/admin/devices/:deviceId/reset-key` | Reset device API key |

---

## Branch Settings (2 endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/admin/branch-settings` | Get per-branch configuration |
| PATCH | `/admin/branch-settings` | Update per-branch configuration |

---

## AI Services (5 endpoints)

| Method | Path | Description |
|---|---|---|
| GET | `/ai/recommendations` | Popular item recommendations |
| POST | `/ai/recommendations/cart` | Suggestions based on cart |
| GET | `/ai/recommendations/customer` | Personalized suggestions |
| POST | `/ai/chatbot/menu` | Conversational menu assistant |
| POST | `/ai/recommendations/recompute` | Recompute recommendation stats |

---

## Realtime (2 SSE streams)

| Method | Path | Description |
|---|---|---|
| GET (SSE) | `/realtime/branches/:branchId/events` | Branch-wide event stream |
| GET (SSE) | `/realtime/sessions/:sessionId/events` | Session-specific event stream |

---

## Health (1 endpoint)

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Service + dependency health check |

---

## Cross-Cutting Concerns

| Concern | Implementation |
|---|---|
| Authentication | JWT Bearer token + httpOnly cookie |
| Authorization | Role + permission decorators on each route |
| Validation | Global ValidationPipe (whitelist, transform, forbidNonWhitelisted) |
| Rate limiting | ThrottlerModule (100/min global, stricter on auth) |
| CORS | Configurable origins, credentials enabled |
| Security headers | Helmet (CSP, X-Frame-Options, etc.) |
| Request logging | Custom middleware (method, path, status, duration) |
| Tenant scoping | All queries filtered by tenantId from JWT |
| Error handling | NestJS exception filters, structured error responses |
| Payment gateway | Adapter pattern: Stripe (production) + Mock (development) |
| Inventory auto-decrement | Triggered on SERVED status with idempotency guard |
| Audit logging | All sensitive actions logged with before/after JSON |
