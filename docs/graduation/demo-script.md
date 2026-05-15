# Live Demo Script

Step-by-step guide for demonstrating the Smart Restaurant OS during a graduation evaluation.

**Estimated time**: 10-15 minutes for full walkthrough, 5 minutes for highlights only.

---

## Pre-Demo Setup

### 1. Start Infrastructure

```bash
npm run dev:infra
```

Wait for Docker containers to be healthy (~10 seconds).

### 2. Start Backend

```bash
npm run dev:api
```

Wait for "Nest application successfully started" message.

### 3. Start Frontend

```bash
npm run dev:web
```

Wait for "Ready" message.

### 4. Verify Health

```bash
curl http://localhost:4000/api/health
```

Expected: `{"service":"api","status":"degraded",...}` (degraded is normal — AI service is optional).

### 5. Keep Two Browser Windows Ready

- **Window 1**: Customer/Kitchen/Waiter flows
- **Window 2**: Admin panel

---

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| Owner/Admin | owner@demo.com | password123 |
| Waiter | waiter@demo.com | password123 |
| Chef | chef@demo.com | password123 |
| Cashier | cashier@demo.com | password123 |

---

## Act 1: Customer Ordering (3 minutes)

### Step 1 — Home Page

**Navigate to**: `http://localhost:3000`

**Say**: "This is the Smart Restaurant OS home page. It shows all four application surfaces and demo credentials. In production, customers would scan a QR code on their table."

### Step 2 — Customer Start

**Navigate to**: `http://localhost:3000/customer/start?branchId=seed-branch-1&tableCode=T1`

**Say**: "The customer arrives at Table T1 by scanning the QR code. They see the table code and can start a session."

**Action**: Click **"Start Ordering"** (or "Start Session")

### Step 3 — Browse Menu

**Say**: "The menu loads with categories — Starters, Main Courses, Drinks. Each item shows the name, price, and dietary information."

**Action**: Tap on **"Classic Burger"** to see details and additions (Extra Cheese +$1.50, Bacon +$2.00).

### Step 4 — Add to Cart

**Action**: Add **Classic Burger** with Extra Cheese to cart. Add a **Cola**. Show the cart badge updating.

**Say**: "The customer can customize items and build their cart. The cart persists in localStorage and is scoped to this session."

### Step 5 — Place Order

**Action**: Open cart, review items, tap **"Place Order"**.

**Say**: "The order is placed with an idempotency key to prevent duplicates. The customer sees an order confirmation with real-time status tracking."

---

## Act 2: Kitchen Display System (2 minutes)

### Step 6 — KDS View

**Navigate to**: `http://localhost:3000/kitchen/login`

**Action**: Log in as `chef@demo.com` / `password123`. Navigate to KDS.

**Say**: "The chef sees the Kitchen Display System. Orders appear in three columns: NEW, COOKING, and READY."

### Step 7 — Process the Order

**Action**: Find the order just placed. Click **"Start"** to move it to COOKING. Click individual item status buttons to fire items. Click **"Ready"** when done.

**Say**: "The chef can start the entire order or fire individual items. This maps to real kitchen workflow where appetizers might fire before entrees."

---

## Act 3: Waiter Dashboard (1-2 minutes)

### Step 8 — Waiter View

**Navigate to**: `http://localhost:3000/waiter/login`

**Action**: Log in as `waiter@demo.com` / `password123`.

**Say**: "The waiter sees all tables with their status — Occupied, Available, Cleaning — and any pending service requests."

### Step 9 — Service Request

**Go back to the customer browser tab**.

**Action**: On the customer order page, tap **"Call Waiter"** or **"Water"**.

**Switch to waiter tab**: Show the service request appearing. Click **"Claim"** then **"Complete"**.

**Say**: "Customers can digitally request service without flagging down a waiter. The waiter claims and resolves requests from their dashboard."

---

## Act 4: Admin Panel (3-4 minutes)

### Step 10 — Admin Dashboard

**Navigate to**: `http://localhost:3000/admin/login`

**Action**: Log in as `owner@demo.com` / `password123`.

**Say**: "The admin dashboard shows KPIs — total revenue, order count, average ticket size, top-selling items. This is the operational command center."

### Step 11 — Menu Management

**Navigate to**: Admin sidebar → **Menu**

**Say**: "The owner can manage categories and menu items. Each item has a name, price, category, preparation time, and availability toggle."

**Action**: Toggle an item's availability off, then back on.

### Step 12 — Staff Management

**Navigate to**: Admin sidebar → **Staff**

**Say**: "Staff accounts are managed here. Each staff member has roles with granular permissions — the system supports 41 individual permissions across custom roles."

### Step 13 — Analytics

**Navigate to**: Admin sidebar → **Analytics**

**Say**: "Analytics provides sales trends, order volume, and menu performance data. This helps owners make data-driven decisions about staffing and menu optimization."

### Step 14 — Inventory

**Navigate to**: Admin sidebar → **Inventory**

**Action**: Show inventory items with stock levels. Adjust stock for an item (+10 or -5).

**Say**: "Inventory tracks stock levels with reorder alerts. Items can be mapped to menu items for automatic availability tracking."

### Step 15 — Promotions

**Navigate to**: Admin sidebar → **Promotions**

**Action**: Create a quick test discount (e.g., "Demo 10%" at 10%). Switch to Coupons tab and create a coupon code.

**Say**: "The promotions module supports percentage and fixed discounts, coupon codes linked to discounts, and gift cards."

---

## Act 5: Payment Flow (1-2 minutes)

### Step 16 — Mock Payment

**Go back to customer browser tab**. Navigate to the order detail page.

**Action**: Click **"Pay Online"**. The mock payment gateway page appears.

**Say**: "The system uses a payment gateway adapter pattern. In demo mode, this shows a mock checkout page. In production, this would redirect to Stripe, Click, or another provider."

**Action**: Click **"Simulate Payment Success"**. Show the "Payment Completed!" confirmation. Click **"View Order"** — the order now shows "Payment Complete".

**Say**: "The payment flow includes webhook signature verification for security. The adapter pattern means switching payment providers requires no code changes in the ordering flow."

---

## Act 6: Technical Highlights (1 minute)

### Step 17 — Health Check

**In terminal**: `curl http://localhost:4000/api/health`

**Say**: "Every service has health checks. The API reports database, Redis, and AI service status. Docker containers have built-in healthchecks for automated recovery."

### Step 18 — Quick Stats

**Say**: "To summarize the technical scope:
- 118 API endpoints across 18 controller modules
- 41 Prisma data models
- 25 frontend routes across 4 application surfaces
- 41 granular permissions with role-based access
- 24 end-to-end tests, 15 API smoke tests
- Production Docker packaging with Nginx, backup scripts, and monitoring configuration"

---

## Fallback Plan

### If the API won't start

- Check Docker: `docker ps` — ensure postgres and redis containers are running
- Check ports: `netstat -ano | findstr :4000` — kill any conflicting process
- Re-seed: `npm run seed`

### If the frontend shows errors

- Clear Next.js cache: `rm -rf apps/web/.next` then `npm run dev:web`
- Check that API is running: `curl http://localhost:4000/api/health`

### If a demo flow fails mid-way

- Tables in dirty state? Run the smoke test: `npm run smoke` — it resets table T5
- Skip to the next act; each act is independent
- Explain: "This is a development environment demonstrating the feature. In production, this would [describe expected behavior]."

### If asked about something not implemented

Use this framework: "That's a great question. The current implementation covers [what exists]. For production, the architecture supports [future capability] through [specific design decision — adapter pattern, modular structure, etc.]."
