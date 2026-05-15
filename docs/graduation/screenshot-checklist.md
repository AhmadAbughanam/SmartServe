# Screenshot Checklist

Screenshots to capture for the graduation report and presentation slides.

Recommended resolution: 1920x1080 (desktop) and 390x844 (mobile).

---

## Customer Surfaces

- [ ] **Home page** — `http://localhost:3000` — Shows all surface cards and demo credentials
- [ ] **Customer start** — `http://localhost:3000/customer/start?branchId=seed-branch-1&tableCode=T1` — Table confirmation, "Start Ordering" button
- [ ] **Menu browsing** — Category tabs (Starters, Main Courses, Drinks) with item cards
- [ ] **Item detail** — Classic Burger with additions (Extra Cheese, Bacon)
- [ ] **Cart** — Items in cart with quantities, subtotal, and "Place Order" button
- [ ] **Order confirmation** — Order placed with status pill, timeline, receipt breakdown
- [ ] **Payment page** — Mock Payment Gateway with "Simulate Payment Success" button
- [ ] **Payment complete** — Green "Payment Complete" banner on order page
- [ ] **Customer OTP login** — Phone number input, dev OTP display, verification code input
- [ ] **Mobile viewport** — Customer menu on 390x844 viewport (iPhone 14 size)

## Kitchen Display System

- [ ] **KDS queue** — Three columns: NEW / COOKING / READY with order cards
- [ ] **KDS with active order** — Order in COOKING state with item status buttons
- [ ] **KDS login** — Kitchen login page

## Waiter Dashboard

- [ ] **Waiter dashboard** — Table grid with status indicators + service request panel
- [ ] **Service request** — Pending request with "Claim" button
- [ ] **Waiter login** — Waiter login page

## Admin Panel

- [ ] **Admin dashboard** — KPI cards (revenue, orders, avg ticket) + charts
- [ ] **Menu management** — Category list with item cards, edit/availability controls
- [ ] **Staff management** — Staff list with roles and actions
- [ ] **Analytics** — Sales/order charts and data tables
- [ ] **POS** — POS order creation interface
- [ ] **Shifts** — Shift management with attendance tracking
- [ ] **Inventory** — Inventory items with stock levels and adjustment form
- [ ] **Promotions** — Discounts tab with list + create form, coupons tab
- [ ] **Admin login** — Admin login page

## Technical / Infrastructure

- [ ] **Health check** — Terminal showing `curl /api/health` JSON response
- [ ] **Smoke test** — Terminal showing 15/15 smoke test pass
- [ ] **E2E test** — Terminal showing 24/24 E2E test pass
- [ ] **Docker containers** — `docker ps` showing running containers
- [ ] **API request logs** — Terminal showing HTTP request log lines

## Architecture Diagrams (Create Manually)

- [ ] **System architecture** — Nginx → API + Web → DB/Redis/AI (from overview.md)
- [ ] **Module dependency** — How NestJS modules connect
- [ ] **Payment adapter** — Interface pattern diagram
- [ ] **Auth flow** — JWT + cookie + OTP flow diagram

---

## Tips

1. Use the seeded demo data — it provides realistic content for screenshots
2. Place an order before capturing KDS screenshots so there's content to show
3. Capture both empty states and populated states where relevant
4. For mobile screenshots, use browser DevTools device emulation (iPhone 14: 390x844)
5. Redact any real secrets if using modified `.env` files in screenshots
