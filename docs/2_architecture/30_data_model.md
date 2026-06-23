# Data Model and Database Architecture

The data layer uses PostgreSQL with Prisma. The schema file is located at `apps/api/prisma/schema.prisma`, migrations are in `apps/api/prisma/migrations`, and seed data is defined in `apps/api/prisma/seed.ts`.

## Model Groups

| Model/Table/Collection | Purpose | Important Fields | Relationships | Main Files | Notes |
| --- | --- | --- | --- | --- | --- |
| `Tenant`, `Branch`, `BranchSettings` | Multi-tenant and branch hierarchy/settings | tenant/branch IDs, names, branch timezone, settings, AI config, geofence fields | Branch belongs to tenant; many operational rows link to tenant/branch | `schema.prisma`, admin/settings modules | Tenant and branch scope are foundational. |
| `Table`, `TableAccessTag`, `GeoFencingRule` | Physical table access and location controls | table code/status/capacity/location, QR/NFC tag, geofence radius/center | Tables belong to branch; sessions attach to tables | tables, table-access, geofencing modules | Branch table code uniqueness exists in schema. |
| `User`, `Staff`, `Role`, `Permission`, `RolePermission`, `StaffRoleAssignment` | Customer/staff identity and authorization | phone/email/password hash, role codes, permission codes | Staff/user belong to tenant/branch; staff has role assignments | auth, roles, admin modules | Staff permissions drive admin/KDS/waiter access. |
| `OtpRequest`, `RefreshToken` | Customer OTP auth and refresh lifecycle | phone, code hash, expiry, attempts, token hashes | Otp by phone; refresh token by user | auth module | Staff refresh-token policy is intentionally limited/unclear. |
| `Session`, `SessionParticipant` | Dining sessions | table/tenant/branch/user, status, start/end, guest count | Session owns orders, service requests, payments through orders | sessions module | One of the central workflow concepts. |
| `Category`, `MenuItem`, `MenuItemAddition`, `MenuItemFavorite` | Menu catalog | names, prices, active/unavailable flags, tax class, allergens, image URL | Menu items belong to tenant/category/optional branch | menu module | Item price is snapshotted into order items. |
| `KitchenStation` | KDS station routing | station name, branch, enabled/order | Menu items can reference default station | kds/menu modules | Supports station filters. |
| `Order`, `OrderItem`, `OrderStatusHistory` | Ordering and kitchen lifecycle | status, source, totals, tax/service/discount, item status, specializations | Orders belong to session/user/branch; items link menu items | orders, kds, waiter, pos modules | Backend recalculates trusted totals. |
| `Payment`, `PaymentSplit`, `Refund` | Payments, splits, refunds | method/status/provider/reference/amount, split type, refund status | Payments attach to orders/session/tenant/branch | payments, waiter modules | Gateway completion requires webhook verification. |
| `TaxRule` | Tax calculation configuration | tax class/rate/active branch | Used by menu/order total logic | admin/orders modules | Tax snapshots/logic are backend-owned. |
| `InventoryItem`, `MenuItemInventoryMap`, `StockAdjustment`, `LowStockAlert` | Inventory and stock movements | current stock/reorder level/unit, mapping qty, adjustment source | Inventory belongs to branch; menu maps to inventory | inventory/orders/kds/admin modules | Served-time decrement creates adjustments. |
| `ServiceRequest`, `Notification` | Customer-to-staff requests and notifications | request type/status, claimed/completed staff, notification read state | Session/table/branch/staff/user links | service-requests, notifications modules | Supports waiter workflow. |
| `Shift`, `Till`, `StaffAttendance` | Staff shift and cash drawer | start/end/status, expected/actual cash, check-in/out | Staff/branch/tenant links | shifts module | POS/cashier operations. |
| `Expense`, `AnalyticsDailyBranch` | Finance and aggregate analytics | amount/category/date, daily sales/orders/prep/covers | Branch/tenant links | admin/analytics modules | Snapshot generation endpoint exists. |
| `Discount`, `Coupon`, `CouponRedemption`, `GiftCard`, `GiftCardTransaction` | Promotions and stored-value flows | code, type/value, balance, status, redemption records | Tenant/branch/user/order links | promotions/admin modules | Loyalty is separate but related. |
| `LoyaltyProgram`, `LoyaltyAccount`, `LoyaltyLedgerEntry`, `LoyaltyReward`, `LoyaltyRewardRedemption` | Loyalty program and points | points, reward cost/value, ledger entries | Tenant/user/order links | loyalty module | Admin loyalty operations confirmed. |
| `AuditLog`, `OperationalEventLog`, `PaymentEventLog` | Audit and observability logs | action/entity/before/after, request IDs, payment metadata | Tenant/branch/staff links | logs, services | Important for accountability. |
| `BranchDevice` | Device registration | device type/name/key hash | Tenant/branch | devices module | Admin device operations. |
| `Review`, `ItemReview`, `ReviewIssueTag` | Customer reviews and sentiment signals | ratings, comments, issue tags | Order/user/menu item links | reviews module | Aggregates feed sentiment analytics. |
| `UserItemStat`, `RecommendationStat`, `RecommendationLog`, `RecommendationInteraction`, `MenuChatLog`, `DemandForecastLog`, `DemandForecastAccuracy`, `ReviewSentimentLog`, `BusinessInsightLog`, `ScheduledBusinessSummary` | Recommendation/AI/analytics persistence | strategy counts, logs, forecast accuracy, summaries | Tenant/branch/user/session/order links | AI/recommendation/analytics modules | See AI doc. |
| `WasteRecord` | Kitchen waste/remake tracking | type, quantity, reason code, station/order/item | Tenant/branch/menu/staff links | KDS module | Created through KDS waste endpoint. |

## How Data Moves

1.  Controllers receive validated DTOs.
2.  Services load branch and tenant context through Prisma.
3.  Services perform business validation and execute transactional writes where necessary.
4.  Prisma handles the writing of relational data, relying on the schema's indexes and foreign keys.
5.  Real-time events are emitted after state changes, where implemented.
