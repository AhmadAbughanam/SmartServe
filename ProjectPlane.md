1. System Overview

Smart Restaurant Ordering & Management Ecosystem (Global RMS) — POS, ERP, KDS, Smart Dining & ERD

This project is a smart, end-to-end restaurant ordering and management ecosystem designed to digitize and automate the entire dining experience—from customer ordering to kitchen operations and business management—using a unified, real-time system.

It is designed as a Smart Restaurant Operating System (not just a POS) that unifies digital dining, real-time operational execution, and data-driven decision-making into one scalable platform.

⸻

Key System Characteristics
	•	Unified Backend + Logical Database: All applications operate on a single backend and one logical normalized database to ensure real-time synchronization and consistent reporting.
	•	API-Only Access (No Direct DB): Frontends never touch the database directly. All operations occur through the backend API layer.
	•	Session-Based Dining: Each table operates using dining sessions that track visits, guests, orders, payments, and table turnover.
	•	Real-Time Updates Everywhere: Order, kitchen status, service requests, payment confirmation, and table state changes are instantly reflected across all apps via realtime channels (WebSockets/SSE).
	•	Multi-Tenant + Branch-Scoped: Designed as a SaaS platform supporting multiple tenants, each with multiple branches. Every operational entity is tenant-owned and branch-scoped.
	•	Scalable & Modular: Features can be enabled via modules / feature flags (e.g., Inventory, Loyalty, Online Ordering, Integrations).
	•	Secure & Compliant: Strong authentication, RBAC permissions, audit logging, encryption, and regional compliance (Jordan first).
	•	Data-Driven Intelligence: Captures customer behavior, order history, kitchen metrics, and staff performance to enable analytics and AI-powered recommendations.

⸻

Smart Restaurant OS Capabilities (Beyond POS)

The system is designed not only as a POS replacement, but as a smart restaurant operating system capable of:
	•	Personalized food recommendations + menu chatbot assistance
	•	Demand forecasting and inventory optimization (module)
	•	Staff performance analysis and shift productivity
	•	Multi-branch and franchise-level management
	•	AI-assisted decision making for menu, pricing, and business strategies
	•	Optional expansion modules:
	•	Loyalty & CRM
	•	Promotions & gift cards
	•	Online ordering & call center
	•	Marketplace & integrations

⸻

Abstract Summary

A smart, real-time restaurant ecosystem that connects customers, kitchen staff, waiters, cashiers, and management through a unified digital platform to optimize operations, enhance customer experience, and drive data-driven growth.

The goal of the project is to eliminate inefficiencies in traditional restaurant workflows, reduce human error, improve customer experience & satisfaction, and provide restaurant owners with actionable insights for better decision-making.

⸻

System Applications (Core)

The system is made of four tightly integrated applications operating on one unified backend:
	1.	Customer Ordering Application (web/mobile web, QR/NFC-based)
	2.	Kitchen Display System (KDS) (tablet/web kiosk style)
	3.	Waiter / Staff Dashboard (mobile-responsive web) (+ optional Customer Display Screen “CDS”)
	4.	Admin Dashboard (ERP + POS Console) (web management + cashier operations)

⸻

1.1 High-Level Architecture

Architecture Style (Canonical)

Four frontends:
	1.	User Ordering App (mobile/web, QR/NFC)
	2.	Kitchen App (KDS)
	3.	Waiter Dashboard
	4.	Admin Dashboard (ERP + POS)

All frontends talk to:
	•	Backend API Layer (REST + real-time events via WebSockets/SSE)
	•	One logical database (normalized, tenant + branch-scoped)

Important: Apps never touch the DB directly. The “shared DB” is at the backend level only.

⸻

Core Problem the Project Solves

Traditional restaurants suffer from:
	•	Manual order taking and communication errors
	•	Delays between customer orders and kitchen execution
	•	Lack of real-time order visibility
	•	Poor tracking of sales, expenses, and staff performance
	•	Limited customer personalization and retention insights

This project addresses these issues by introducing a fully digital, QR/NFC-based, real-time restaurant ecosystem with unified operations.

⸻

Backend Architecture (Logical)
	•	API Gateway / Backend Services
	•	Auth + RBAC “Role-Based Access Control.”
	•	Sessions & Tables
	•	Menu & Catalog
	•	Orders & Kitchen
	•	Payments
	•	POS & Shifts
	•	Inventory (module)
	•	CRM/Loyalty (module)
	•	Reporting & Analytics
	•	Integrations (module)
	•	Realtime Event Bus
			Order events, KDS events, service requests, payment events, table state events
	•	Database
			Tenant isolation + branch scoping enforced at data layer
				a multi-tenant architecture strategy ensuring each customer (tenant) in a shared system has separate, secure, and private access to their data, 
⸻

1.2 Cloud & Infra

Cloud-Hosted SaaS Model
	•	Cloud-hosted deployment (SaaS)
	•	Multi-tenant runtime isolation
	•	Feature enablement via modules/feature flags
	•	Regional configurations

Device & Endpoint Model (Branch-Level)

The system supports registering and managing branch devices:
	
Devices are linked to a branch and assigned capabilities/roles to ensure they only access allowed operations.

⸻

1.3 Data Sharing Model

Multi-Tenant Logical Schema

One multi-tenant logical schema, with isolation rules:
	•	Tenant ownership (TenantID)
	•	Branch scoping (BranchID)

Core entities (examples):
	•	tenants, branches, devices
	•	tables, qr_tags/nfc_tags, sessions, session_participants
	•	menu_categories, menu_items, modifiers/addons, allergens, availability
	•	orders, order_items, order_status_history
	•	payments, payment_splits, tips
	•	service_requests, notifications
	•	users, staff, roles, permissions, attendance, shifts, tills
	•	discounts/promotions, coupons, gift_cards (module)
	•	inventory_items, ingredients, stock_adjustments, low_stock_alerts (module)
	•	expenses, audit_logs
	•	analytics_snapshots, reports, KPIs

Key rule: Every operational entity is branch-scoped via BranchID for multi-branch support, and tenant-scoped for isolation.

⸻

2. App-by-App Detailed Feature Expansion

⸻

2.1 Customer Ordering App (Smart Dining + AI)

A mobile-friendly web application that allows customers to:
	•	Trigger: Scan QR code or NFC tag → opens app and auto-selects table
	•	First time: Register or continue as guest
	•	Returning: login (phone + OTP) and optionally “Remember me”
	•	Browse menu by categories with recommendations (preferences + history + top sellers/trends)
	•	Ask chatbot for menu recommendations
	•	View item details and customize with modifiers/additions + notes
	•	Place orders directly to kitchen (real-time)
	•	Track order status live with timestamps
	•	Pay digitally (card/wallet), request cash/terminal, or split bills
	•	Submit reviews after completion (stars + tags like cold/late)

Features

Table Selection
	•	Scan QR/NFC → sends table_code + branch_id to backend
	•	Backend validates and creates/joins a session

Auth & Profile
	•	Register/login via phone + OTP
	•	“Remember me” → long-lived refresh token
	•	Guest mode supported (minimal identity)
	•	Session tracks guest count, orders, and payments

Menu Browsing
	•	Categories → items with recommended ordering
	•	Filters: veg, spicy, popular, recommended, in-stock only
	•	Item details:
	•	name, price, image
	•	description, ingredients, allergens
	•	prep time estimate
	•	add-ons/specializations/modifiers

Menu Chatbot
	•	Helps users choose based on preferences and menu data
	•	Must fallback safely if unavailable

Cart & Order
	•	Add items with:
	•	Quantity
	•	Modifiers/additions
	•	Special notes
	•	Multiple orders under same session
	•	Offline-friendly:
	•	If network shaky, queue locally and retry without duplicating (idempotency)

Order Tracking
	•	Live status timeline:
	•	Placed → Confirmed → In Kitchen → Ready → Served → Completed
	•	Service requests:
	•	Call waiter, water/cutlery, bill/payment request

Order Completion
	•	Reorder
	•	Dessert flow recommendation

Reviews
	•	Rate items/order after completion
	•	Optional issue tags (“cold”, “late”, etc.)

Payment
	•	Pay now (card/wallet integration)
	•	Request cash payment or payment terminal
	•	Split bills:
	•	by items, amount, or people
	•	Tips (if enabled by admin settings)

Loyalty & Rewards (Module)
	•	Points per order
	•	Coupons/promo codes
	•	Redeem at checkout

⸻

2.2 Kitchen App (KDS — Kitchen Display System)

A dedicated kitchen display system used by chefs and kitchen staff to:
	•	View incoming and active orders in real time
	•	Track prep time and delays
	•	Update order progress and notify FOH immediately
	•	Mark items unavailable (86) which instantly updates customer menu availability
	•	Record kitchen metrics for analytics and performance insights

Core Functionality
	•	Order Routing: Automatically routes specific items to prep stations (grill/fry/dessert) based on routing rules (configurable).
(A branch can run single-station by configuration, but routing is supported.)
	•	Prioritization & Timing: Displays orders based on timing to align dishes for a table
	•	Real-Time Status Updates: New → In Progress → Ready (+ delayed)
	•	Data Analytics: Ticket times and prep speeds recorded for bottleneck analysis

Features

Order Queue
Grouped by:
	•	Status: New, In Progress, Ready, Delayed
	•	Area/Station: Grill, Fry, Dessert (via routing)

Order card shows:
	•	Table/order number
	•	Source icon (dine-in vs pickup/delivery packaging)
	•	Time since placed
	•	Items with quantities, notes, specializations

Item Display Rules (Kitchen Accuracy)
	•	Group identical items as “3x” instead of duplicates (unless modifiers differ)
	•	Modifiers/notes must be visually prominent (critical for error reduction)

Status Actions
	•	Accept/Start
	•	Mark item unavailable (86)
	•	Mark order/item Ready
	•	Optional per-item done tracking
	•	Undo for destructive actions within 5–10 seconds (optional, recommended)

Insights
	•	Avg prep time today
	•	Orders per hour/time range
	•	Delayed orders count
	•	Station load (optional)

Advanced
	•	Load balancing highlight
	•	Waste/remake tracking with reason codes

Web-Specific Technical Requirements (Non-Negotiable)
	1.	Wake Lock API to prevent screen sleeping
	2.	Fullscreen/Kiosk mode control
	3.	Offline tolerance: cache active tickets in local storage so brief Wi-Fi loss doesn’t blank the screen; sync on reconnect

⸻

2.3 Waiter Dashboard (FOH Operations)

A mobile-responsive web interface designed for front-of-house staff to bridge KDS and customer app/POS.

Purpose:
	•	Aggregate real-time notifications
	•	Manage table states and service flow
	•	Allow rapid interventions without returning to POS

Core Capabilities
	•	Live notifications: order ready, service requests, payment pending, table state changes
	•	Live floor map with real-time color/state logic
	•	“Serve” confirmation with timestamp
	•	Quick-add items/notes (permission-controlled) with immediate sync to KDS and customer bill
	•	Attendance: check-in/out + shift start/end (optional)
	•	Escalation for delayed orders (optional)

Live Floor Map & Status Monitoring

The dashboard shall render a map reflecting restaurant layout and update table states in real time:
	•	Vacant: empty table, available
	•	Occupied: active session, no alerts
	•	Assistance Needed: triggered by customer service request
	•	Order Ready: triggered by KDS ready status
	•	Payment Pending: customer requested cash/terminal or in payment flow
	•	Dirty/Turnover: payment confirmed; requires clearing/cleaning

Unified Notification Feed (“Smart Feed”)

Aggregates events from:
	•	Kitchen: “order ready”
	•	Customer: service requests (water, napkins, bill, etc.)

Task Management:
	•	Acknowledge/Claim: waiter marks task “In Progress” to prevent duplication
	•	Dismiss/Complete: removes from global feed on completion

Table Detail & Order Management
	•	Clicking a table shows current status, session and orders
	•	Quick-add POS items (if allowed)
	•	Sync logic: waiter-added items immediately reflect in:
			Customer bill view
			KDS queue

Payment & Turnover
	•	Real-time payment confirmation display
	•	Manual update allowed for cash/terminal confirmation (permission-controlled)
	•	Close/Clear table resets status to Vacant and ends session when payment is complete

⸻

2.4 Admin Dashboard (ERP + POS Console)

A web-based management system used by restaurant owners/managers/cashiers to:
	•	Manage tables, menus, categories, pricing, tax categories
	•	Control item availability and stock status
	•	Manage staff, roles, permissions
	•	Track orders, payments, sales, expenses
	•	Monitor table occupancy and performance
	•	Run POS operations (walk-ins/phone orders)
	•	Generate analytics and operational insights
	•	Manage shifts and cash drawer reconciliation
	•	Maintain audit logs for sensitive actions
	•	Configure system settings and payment providers

Core Modules

Auth / RBAC
	•	Secure login
	•	Roles: Owner, Manager, Cashier, Kitchen Lead, Waiter
	•	Sensitive actions require permissions

Operations Dashboard
	•	Today’s sales, orders, insights
	•	Table occupancy / live state view
	•	Branch selector (multi-branch)

Table Management
	•	View table list + layout config
	•	Table status: available/occupied/reserved/needs cleaning (plus state machine used by waiter dashboard)

Menu & Category Management
	•	CRUD categories/items
	•	Price, availability, prep time, allergens, tax category
	•	Publish/unpublish control

Staff Management
	•	CRUD staff accounts
	•	Assign roles and permissions
	•	Staff performance insights

Orders & POS
	•	View active orders
	•	Create order for walk-ins / phone reservations
	•	Apply discounts/refunds (permission-controlled)

Sales & Expenses
	•	Record expenses (rent, utilities, ingredients)
	•	P&L view

Shift & Cash Drawer Management
	•	Open/close shifts
	•	Cash drawer reconciliation (expected vs actual)

Inventory (Module)
	•	Ingredients/stock levels/reorder thresholds
	•	Low-stock alerts
	•	Optional auto-decrement based on sales

Promotions & Loyalty (Module)
	•	Coupons/promo codes
	•	Loyalty points and redemption
	•	Gift cards (optional)

Audit Logs
	•	Track who changed: menu items, prices, discounts, refunds, roles, availability (86), shift close, payment confirmations

Settings
	•	Service charge rules
	•	Tips configuration
	•	Payment providers/terminals
	•	Module enablement (feature flags)

Analytics & Insights (Data-Driven Management)
	•	Customer behavior: visits, repeat rate, favorites
	•	Menu performance: best sellers, customization trends, low-traffic items
	•	Kitchen metrics: prep times, delays, bottlenecks
	•	Staff performance: service speed, task handling, shift stats
	•	Table insights: occupancy patterns, turnover rate, problem tables

⸻

Optional Platform Modules (Feature-Flagged)
	•	Online Ordering & Call Center: take external and phone orders; route to branch policy (nearest/selected)
	•	Marketplace & Integrations: delivery aggregators, accounting software, external loyalty platforms via controlled APIs
	•	Customer Display Screen (CDS): customer-facing display (exact behavior TBD)

⸻


3. Full Database Schema (Final Version)

 (PK = Primary Key, FK = Foreign Key).

3.1 Core Entities

Tenants
	•	TenantID (PK)
	•	Name
	•	OwnerName (nullable)
	•	OwnerPhone (nullable)
	•	OwnerEmail (nullable)
	•	CreatedAt
	•	IsActive

Branches
	•	BranchID (PK)
	•	TenantID (FK → Tenants)
	•	Name
	•	Location
	•	IsActive

Tables
	•	TableID (PK)
	•	BranchID (FK → Branches)
	•	TableCode (unique per branch, matches QR)
	•	Capacity
	•	Status (AVAILABLE, OCCUPIED, RESERVED, CLEANING, OUT_OF_SERVICE)
	•	LocationDescription(floor/zone)
	•	LastOccupiedTime
	•	TotalOrders (denormalized counter)
	•	LastSessionID (FK → Sessions, nullable)
	
Constraints / Indexes
	UNIQUE (BranchID, TableCode)
	Index: (BranchID, Status)

Users (Customers)
	•	UserID (PK)
	•	TenantID (FK → Tenants) (optional if allow cross-tenant users; recommended if tenant-specific)
	•	Name
	•	Phone
	•	Email (nullable)
	•	PasswordHash (nullable if using OTP only)
	•	PreferencesJSON (e.g., {dietary, spicy_level, favorite_categories})
	•	LastVisitAt
	•	CreatedAt
	•	IsBlocked

Index: Phone, Email

Staff
	•	StaffID (PK)
	•	TenantID (FK → Tenants)
	•	BranchID (FK → Branches)
	•	Name
	•	Phone
	•	Email
	•	Role (e.g., ADMIN, MANAGER, CASHIER, WAITER, CHEF)
	•	PasswordHash
	•	IsActive
	•	CreatedAt

Index: (BranchID, Role)

Roles
	•	RoleID (PK)
	•	TenantID (FK → Tenants)
	•	RoleName (OWNER, MANAGER, CASHIER, WAITER, CHEF, KITCHEN_LEAD, etc.)
	•	IsActive

Indexes: (TenantID, RoleName) UNIQUE

Permissions
	•	PermissionID (PK)
	•	Code (e.g., MENU_EDIT, DISCOUNT_APPLY, REFUND, SHIFT_CLOSE, PAYMENT_CONFIRM, 86_ITEM, etc.)
	•	Description (nullable)

Indexes: Code UNIQUE

RolePermissions
	•	RoleID (FK → Roles)
	•	PermissionID (FK → Permissions)

PK: (RoleID, PermissionID)

StaffRoles

(If a staff member can have multiple roles)
	•	StaffID (FK → Staff)
	•	RoleID (FK → Roles)

PK: (StaffID, RoleID)

3.2 Sessions & Table Usage

Sessions

Represents a dining session at a table:
	•	SessionID (PK)
	•	TenantID (FK → Tenants)
	•	BranchID (FK → Branches)
	•	TableID (FK → Tables)
	•	UserID (FK → Users, nullable) (guest supported)
	•	StartTime
	•	EndTime (nullable)
	•	Status (ACTIVE, COMPLETED, CANCELLED)
	•	GuestCount
	•	CreatedByStaffID (FK → Staff, nullable)
	•	Notes (nullable)

Indexes: (TableID, Status), (BranchID, StartTime)
All orders, payments, and recommendations can be tied back to a session for stats like table turnover time.  

SessionParticipants (optional but recommended for split “by people”)
	•	ParticipantID (PK)
	•	SessionID (FK → Sessions)
	•	DisplayName (nullable) (e.g., “Seat 1”)
	•	UserID (FK → Users, nullable)

Indexes: SessionID

3.3 Orders & Items

Orders
	•	OrderID (PK)
	•	TenantID (FK → Tenants)
	•	BranchID (FK → Branches)
	•	SessionID (FK → Sessions)
	•	UserID (FK → Users, nullable)
	•	OrderDateTime
	•	OrderStatus (PLACED, CONFIRMED, IN_KITCHEN, READY, SERVED, COMPLETED, CANCELLED)
	•	SubtotalAmount (no tax/service)
	•	TaxAmount
	•	ServiceChargeAmount
	•	DiscountAmount
	•	TotalAmount (snapshot final)
	•	PaymentStatus (UNPAID, PARTIALLY_PAID, PAID, REFUNDED)
	•	SpecialInstructions
	•	Source (USER_APP, POS_DASHBOARD)

Indexes: (BranchID, OrderDateTime), OrderStatus, SessionID

Order_Items
	•	OrderItemID (PK)
	•	OrderID (FK → Orders)
	•	TenantID (FK → Tenants)
	•	BranchID (FK → Branches)
	•	MenuItemID (FK → MenuItems)
	•	Quantity
	•	ItemBasePrice (price at order time)
	•	LineDiscountAmount
	•	LineTotal (after discounts + tax)
	•	SpecializationsJSON (additions, notes)
	•	KitchenStatus (PENDING, IN_PROGRESS, READY, CANCELLED)
	•	StationID (nullable, for routing)

Indexes: (OrderID), (MenuItemID)


3.4 Payments 

Payments
	•	PaymentID (PK)
	•	TenantID (FK → Tenants)
	•	BranchID (FK → Branches)
	•	OrderID (FK → Orders)
	•	SessionID (FK → Sessions)
	•	PaymentMethod (CASH, CARD, WALLET, MIXED)
	•	PaymentReference (gateway transaction id)
	•	PaymentDate
	•	PaymentStatus (PENDING, COMPLETED, FAILED, REFUNDED)
	•	PayerType (CUSTOMER, STAFF_ADJUSTMENT)
	•	TipAmount (nullable)
	•	Indexes: (OrderID), (PaymentStatus)

PaymentSplits (optional - supports your split-bill feature)
	•	SplitID (PK)
	•	PaymentID (FK → Payments)
	•	SplitType (BY_AMOUNT, BY_ITEMS, BY_PEOPLE)
	•	ParticipantID (FK → SessionParticipants, nullable)
	•	Amount

Indexes: PaymentID

TaxRules
	•	TaxRuleID (PK)
	•	TenantID (FK → Tenants)
	•	BranchID (FK → Branches)
	•	TaxClass (FOOD, BEVERAGE, etc.)
	•	RatePercent
	•	IsActive
	•	CreatedAt



3.5 Menu & Categories & Inventory

Categories
	•	CategoryID (PK)
	•	TenantID (FK → Tenants)
	•	BranchID (FK → Branches, nullable for global tenant menu)
	•	ParentCategoryID (self referencing -FK, nullable)
	•	Name
	•	Description
	•	DisplayOrder
	•	IsActive

Menu_Items
	•	MenuItemID (PK)
	•	TenantID (FK → Tenants)
	•	BranchID (FK → Branches, nullable for global items)
	•	CategoryID (FK → Categories)
	•	Name
	•	Description
	•	Ingredients
	•	Price
	•	IsActive
	•	IsUnavailable
	•	DietaryInfo
	•	PrepTimeMinutes
	•	ImageURL
	•	CreatedAt, UpdatedAt

	Indexes: (BranchID, CategoryID), (IsActive, IsUnavailable)

Menu_Item_Additions (for optional extras / specializations)
	•	AdditionID (PK)
	•	MenuItemID (FK)
	•	Name
	•	PriceImpact (+)
	•	IsRequired
	•	MaxSelectable
	•	IsActive


In Order_Items.SpecializationsJSON,  store resolved additions with their applied prices – this preserves history.

Inventory_Items (optional but important for out-of-stock)
	•	InventoryItemID (PK)
	•	TenantID (FK → Tenants)
	•	BranchID (FK → Branches)
	•	Name
	•	Unit (kg, l, pcs)
	•	CurrentStock
	•	ReorderLevel
	•	IsActive

Indexes: (BranchID, Name)

MenuItem_Inventory_Map (optional)
	•	MenuItemID (FK → MenuItems)
	•	InventoryItemID (FK → InventoryItems)
	•	QtyPerItem

PK: (MenuItemID, InventoryItemID)

This enables automatic decrement of stock when orders are completed.

3.6 Reviews & Preferences

Reviews
	•	ReviewID (PK)
	•	TenantID (FK → Tenants)
	•	BranchID (FK → Branches)
	•	OrderID (FK → Orders)
	•	UserID (FK → Users, nullable)
	•	OverallRating (1–5)
	•	Comment (nullable)
	•	CreatedAt

Item_Reviews
	•	ItemReviewID (PK)
	•	ReviewID (FK)
	•	MenuItemID (FK)
	•	Rating (1–5)
	•	Comment (optional)

3.7 Notifications

Notifications
	•	NotificationID (PK)
	•	TenantID (FK → Tenants)
	•	BranchID (FK → Branches)
	•	UserID (FK → Users, nullable)
	•	StaffID (FK → Staff, nullable)
	•	Type (ORDER_STATUS, PROMO, SYSTEM)
	•	Title
	•	Body
	•	IsRead
	•	CreatedAt

Indexes: UserID, StaffID, (BranchID, CreatedAt)

3.8 Expenses & Finance

Expenses
	•	ExpenseID (PK)
	•	BranchID (FK)
	•	Category (rent, utilities, ingredients, marketing, etc.)
	•	Amount
	•	ExpenseDate
	•	Description
	•	CreatedByStaffID
	•	ReceiptURL (optional)

3.9 Analytics Snapshot / Aggregation

To reduce heavy queries, periodically store aggregates:
AnalyticsDailyBranch
	•	Date (PK part)
	•	TenantID (PK part)
	•	BranchID (PK part)
	•	TotalSales
	•	TotalOrders
	•	AverageOrderValue
	•	AveragePrepTime
	•	Covers
	•	CancelledOrders
	•	TopItemID (nullable)
	•	NotesJSON (nullable)

PK: (TenantID, BranchID, Date)
⸻

3.10 Service Requests (Customer → Waiter Flow)

ServiceRequests
	•	RequestID (PK)
	•	TenantID (FK → Tenants.TenantID)
	•	BranchID (FK → Branches.BranchID)
	•	SessionID (FK → Sessions.SessionID)
	•	TableID (FK → Tables.TableID)
	•	Type (CALL_WAITER, WATER, CUTLERY, BILL_REQUEST, …)
	•	Status (NEW, CLAIMED, COMPLETED, CANCELLED)
	•	CreatedAt
	•	ClaimedByStaffID (FK → Staff.StaffID, nullable)
	•	CompletedAt (nullable)

Indexes
	•	(BranchID, Status, CreatedAt)
	•	(SessionID, CreatedAt)

⸻

3.11 POS Shifts & Tills (Cashier Reconciliation)

Shifts (employee shift attendance/operation window)
	•	ShiftID (PK)
	•	TenantID (FK → Tenants.TenantID)
	•	BranchID (FK → Branches.BranchID)
	•	StaffID (FK → Staff.StaffID) (shift owner)
	•	StartTime
	•	EndTime (nullable)
	•	Status (OPEN, CLOSED)

Indexes
	•	(BranchID, Status, StartTime)
	•	(StaffID, StartTime)

Tills (cash drawer settlement for a shift)
	•	TillID (PK)
	•	ShiftID (FK → Shifts.ShiftID)
	•	ExpectedCash
	•	ActualCash
	•	Difference
	•	ClosedByStaffID (FK → Staff.StaffID)
	•	ClosedAt

Indexes
	•	(ShiftID)

⸻

3.12 Audit Logs

AuditLogs
	•	AuditID (PK)
	•	TenantID (FK → Tenants.TenantID)
	•	BranchID (FK → Branches.BranchID)
	•	ActorStaffID (FK → Staff.StaffID)
	•	ActionCode (MENU_EDIT, DISCOUNT_APPLY, REFUND, SHIFT_CLOSE, PAYMENT_CONFIRM, ITEM_86, …)
	•	EntityType (TABLE, SESSION, ORDER, MENU_ITEM, PAYMENT, ROLE, …)
	•	EntityID (string/int)
	•	Timestamp
	•	BeforeJSON (nullable)
	•	AfterJSON (nullable)

Indexes
	•	(BranchID, Timestamp)
	•	(ActorStaffID, Timestamp)
	•	(EntityType, EntityID)

⸻

3.13 OTP Logs & Refresh Tokens

OtpRequests
	•	OtpID (PK)
	•	Phone
	•	CodeHash
	•	ExpiresAt
	•	VerifiedAt (nullable)
	•	Attempts

Indexes
	•	(Phone, ExpiresAt)

RefreshTokens
	•	TokenID (PK)
	•	UserID (FK → Users.UserID)
	•	DeviceInfo (nullable)
	•	ExpiresAt
	•	RevokedAt (nullable)

Indexes
	•	(UserID, ExpiresAt)

⸻

3.14 Discounts & Promotions (Module Placeholders)

Discounts
	•	DiscountID (PK)
	•	TenantID (FK → Tenants.TenantID)
	•	BranchID (FK → Branches.BranchID, nullable) (null = tenant-wide)
	•	Name
	•	Type (PERCENT, FIXED)
	•	Value
	•	StartAt (nullable)
	•	EndAt (nullable)
	•	IsActive

Indexes
	•	(TenantID, BranchID, IsActive)

Coupons
	•	CouponID (PK)
	•	TenantID (FK → Tenants.TenantID)
	•	Code (UNIQUE per tenant)
	•	DiscountID (FK → Discounts.DiscountID)
	•	MaxRedemptions (nullable)
	•	PerUserLimit (nullable)
	•	ExpiresAt (nullable)
	•	IsActive

Constraints / Indexes
	•	UNIQUE (TenantID, Code)

GiftCards
	•	GiftCardID (PK)
	•	TenantID (FK → Tenants.TenantID)
	•	Code (UNIQUE per tenant)
	•	InitialAmount
	•	BalanceAmount
	•	Status (ACTIVE, REDEEMED, DISABLED, EXPIRED)
	•	ExpiresAt (nullable)
	•	CreatedAt

Constraints / Indexes
	•	UNIQUE (TenantID, Code)

(Optional application tracking tables if later: CouponRedemptions, GiftCardTransactions.)

⸻

3.15 Attendance & Staff Performance

StaffAttendance
	•	AttendanceID (PK)
	•	TenantID (FK → Tenants.TenantID)
	•	BranchID (FK → Branches.BranchID)
	•	StaffID (FK → Staff.StaffID)
	•	CheckIn
	•	CheckOut (nullable)
	•	ShiftID (FK → Shifts.ShiftID, nullable) (optional link)

Indexes
	•	(StaffID, CheckIn)
	•	(BranchID, CheckIn)

⸻

3.16 GeoFencing (Optional Security Feature)

GeoFencingRules
	•	RuleID (PK)
	•	TenantID (FK → Tenants.TenantID)
	•	BranchID (FK → Branches.BranchID)
	•	Enabled
	•	AllowedRadiusMeters
	•	CenterLatitude
	•	CenterLongitude
	•	AppliesTo (CUSTOMER_ORDERING, PAYMENT_START, …)
	•	CreatedAt

Indexes
	•	(BranchID, Enabled)



Tax Logic – Where Calculated & Stored
	•	Configuration:
	•	Table: TaxRules
	•	TaxRuleID, BranchID, TaxClass, RatePercent, IsActive
	•	Calculation:
	•	Done in backend service when order is confirmed.
	•	For each Order_Item, determine TaxClass via Menu_Items.
	•	Compute per-line tax and total tax.
	•	Storage:
	•	Store:
	•	Order_Items.LineTaxAmount
	•	Orders.TaxAmount
	•	Orders.TotalAmount
	•	Orders.TaxSnapshotJSON (optional, to preserve rule details).

This aligns with typical POS behavior where taxes are fixed at the time of order/payment for auditability.  

⸻

Sessions, Last Order, Last Visit, Preferences
	Sessions: as above (Sessions table).
	Last order:
	•	Either query Orders where UserID = ? ordered by OrderDateTime DESC LIMIT 1
	•	Or keep Users.LastOrderID for speed.
	Last visit:
	•	Users.LastVisitAt updated when a session completes.
	Preferences:
	•	Stored in Users.PreferencesJSON + optionally User_Preferences table.
	•	Also, separate User_Item_Stats:

User_Item_Stats
	•	UserID
	•	MenuItemID
	•	TimesOrdered
	•	LastOrderedAt
	•	AvgRating

This fuels personalized recommendations.

⸻

Indexing, Constraints, Security Rules
	Indexes
	•	All FKs: Orders.SessionID, Orders.UserID, Orders.BranchID, etc.
	•	Time-series queries: (BranchID, OrderDateTime), (BranchID, ExpenseDate)
	•	Lookups: Menu_Items.CategoryID, TableID + Status.
	Constraints
	•	CHECK constraints for status fields (OrderStatus values, etc.)
	•	UNIQUE(BranchID, TableCode) for tables.
	•	Foreign key constraints with cascading rules (usually ON DELETE RESTRICT for critical entities).
	Row-Level Security (RLS)
	•	At DB or app level, ensure:
	•	Staff can only access rows of their BranchID (unless role=GLOBAL).
	•	Customers only see their orders and sessions.

⸻


4. API Layer Design (High Level)

API structure (high level)
	•	Public API: Customer app (menu, sessions, order creation, payment intent)
	•	Staff API: Waiter/Kitchen/Admin (orders, tables,  stock, attendance)
	•	Internal events: OrderPlaced, OrderAccepted, Item86d (out-of-stock), PaymentCaptured…

Real-time updates (must-have)
	•	WebSockets for Kitchen + Waiter + Admin live monitoring
	•	SSE (Server-Sent Events) can be simpler for Customer “order status timeline”
	•	Event bus (Redis Streams / RabbitMQ / cloud queue) to decouple updates

You can group endpoints by module:

Auth
	•	POST /auth/login (user, staff)
	•	POST /auth/register
	•	POST /auth/refresh
	•	POST /auth/logout

Tables & Sessions
	•	GET /branches
	•	GET /branches/{id}/tables
	•	POST /sessions/start (body: tableCode, guestCount)
	•	POST /sessions/{id}/end
	•	GET /sessions/{id} (with current orders, payments)

Menu
	•	GET /menu (branch, category filters)
	•	GET /menu/{id}
	•	Staff-only:
	•	POST /menu
	•	PUT /menu/{id}
	•	PATCH /menu/{id}/availability

Orders
	•	POST /sessions/{id}/orders
	•	GET /orders/{id}
	•	PATCH /orders/{id}/status (staff/kitchen)
	•	PATCH /orders/{id} (edit items – controlled conditions)
	•	WebSocket channel: /ws/orders/{sessionID}

Payments
	•	POST /orders/{id}/payments
	•	GET /orders/{id}/payments
	•	POST /payments/{id}/refund

Kitchen
	•	GET /kitchen/orders?status=NEW|IN_PROGRESS
	•	PATCH /kitchen/orders/{id}/status
	•	PATCH /kitchen/order-items/{id}/status

Analytics
	•	GET /analytics/dashboard?branchId=...
	•	GET /analytics/kitchen
	•	GET /analytics/menu-performance

⸻

5. Business Logic Rules

5.1 Table Lifecycle
	1.	AVAILABLE
	2.	→ RESERVED (by manager / system)
	3.	→ OCCUPIED (session started)
	4.	→ NEEDS_CLEANING (session ended, order settled)
	5.	→ AVAILABLE (after staff marks cleaned)

Rules:
	•	New session can only start if table is AVAILABLE or RESERVED (with validation).
	•	Sessions linked to table enforce only 1 active session per table.

5.2 Order Lifecycle
	1.	PLACED (user or POS)
	2.	CONFIRMED (optional if staff must approve)
	3.	IN_KITCHEN
	4.	READY
	5.	SERVED (for dine-in)
	6.	COMPLETED (bill fully paid)
	7.	CANCELLED (if cancelled before served)
	

Rules:
	•	Cannot edit order after status ≥ READY unless authorized and logged.
	•	If items removed after IN_KITCHEN, must record OrderEvent reason and maybe waste.

5.3 Payment Lifecycle

Payment:
	•	PENDING → COMPLETED or FAILED.
	•	Order PaymentStatus:
	•	UNPAID (no completed payments)
	•	PARTIALLY_PAID (sum(payments) < order total)
	•	PAID (sum(payments) >= total)
	•	REFUNDED (refund sum ≥ paid sum)

Split payments:
	•	Multiple Payment rows for one OrderID.

Partial refunds:
	•	Refunds rows referencing PaymentID with amount ≤ payment.

5.4 Staff Accountability & Permissions
	•	Role-based actions:
	CASHIER:
	•	create POS orders
	•	take payments
	WAITER:
	•	view assigned tables
	•	start/end sessions
	•	mark served
	CHEF:
	•	update kitchen statuses
	MANAGER/ Admin:
	•	discounts > X%
	•	refunds
	•	menu changes
	•	manage branches, staff, global settings
	•	All critical actions (discounts, refunds, cancellations, menu price changes) must be logged in an Audit_Log table.

⸻

6. Revenue, Analytics & Insights

6.1 KPIs to Track

Common and recommended restaurant KPIs include:  
	Sales
	•	Total sales
	•	Sales by hour/day/week/month
	•	Sales by branch
	Order Metrics
	•	Number of orders
	•	Average order value (AOV)
	•	Average items per order
	Table Metrics
	•	Table turnover rate (sessions per table per shift) —> identifying if a table has problems
	•	Average session duration
	Menu Metrics
	•	Item popularity
	•	breakdown (Most and least per category)
	•	Contribution margin per item (link to COGS)
	•	Category performance
	Kitchen Metrics
	•	Average prep time overall and per category
	•	Time from IN_KITCHEN → READY
	•	Delayed orders (exceeding SLA)
	Customer Metrics
	•	Returning customer rate
	•	Visit frequency
	•	Average rating
	Staff Metrics
	•	Sales per staff, orders handled
	•	Discounts given
	•	Refunds initiated

6.2 What Managers See
	Dashboard:
	•	High-level cards: Today vs Yesterday vs Last Week
	•	Heatmaps of peak hours
	•	Top items / worst items
	•	Wastage due to errors/remakes
	Reports:
	•	Branch comparison
	•	Staff performance
	•	Promo effectiveness
	•	Customer segmentation (new vs returning)

6.3 Kitchen Insights → Speed & Waste Reduction
	Track time from:
	•	PLACED → IN_KITCHEN
	•	IN_KITCHEN → READY
	•	READY → SERVED
	Identify:
	•	Bottleneck categories (e.g., grill items always slow)
	•	Peak-time performance
	•	Waste data:
	•	Items remade, reasons → show patterns (e.g., undercooked steak issues).

⸻

7. Security, Privacy & Compliance

7.1 User Authentication
	•	Use JWT access token + refresh token model.
	•	Store refresh tokens securely (HTTP-only cookie for web; secure storage on mobile).
	Passwords:
	•	Hashed with strong algorithm (bcrypt/argon2).
	•	Rate limiting for login / registration.
	•	Email/phone verification for contact info.

7.2 Staff Permissions
	•	Role-based access control (RBAC).
	•	Optional row-level access (staff limited to their branch).
	•	Forced strong passwords + periodic rotation for privileged roles.
	•	Session timeouts for dashboard & kitchen.

7.3 Payment Security
	•	DO NOT store card numbers or CVV in your DB.
	•	Use PCI DSS–compliant processors (Stripe, Adyen, etc.).  
	Only store:
	•	Payment reference
	•	Last 4 digits (if needed)
	•	Card brand (optional)
	•	Always use HTTPS, TLS 1.2+.
	•	Follow PCI DSS best practices:
	•	Secure network, firewalls
	•	Regularly patch systems
	•	Restricted access to payment data
	•	Logging & monitoring

7.4 Data Privacy
	•	Clearly define what customer data is collected and why.
	Allow customers to:
	•	View their data
	•	Request deletion (where required)
	•	Encrypt sensitive data at rest:
	•	PII fields (phone, email) with DB-level or app-level encryption.
	Backups:
	•	Encrypted
	•	Regular backup & tested restore plan.

⸻

8. Real-World Restaurant Edge Cases

8.1 Split Payments
	•	Design Payments to allow multiple rows per order.
	The front-end flow:
	   User or cashier selects:
	•	Split by items
	•	Split equally
	•	Custom amounts
	•	Order PaymentStatus becomes PARTIALLY_PAID until fully covered.

8.2 Partial Refunds
	•	Use Refunds table.
	•	Allow staff to select items or a specific amount.
	•	Enforce:
	•	Total refunds ≤ total payments.
	•	Adjust reports by using net revenue (sales – refunds).

8.3 Order Edits After Submission

Rules:
	•	Allow edits if OrderStatus < IN_KITCHEN OR if item KitchenStatus = PENDING.
	If kitchen already started, editing:
	•	Requires manager role
	•	Triggers OrderEvent with reason
	•	May create waste record if item was already in progress.

8.4 Out-of-Stock Logic
	•	Menu_Items.IsOutOfStock or inventory-based triggers:
	•	When CurrentStock < threshold, mark as out-of-stock.
	For user app:
	•	Hide out-of-stock or mark clearly as unavailable.
	•	For kitchen:
	If stock runs out mid-service, allow substitute suggestion:
	•	Show list of similar items or “remove from order” with explanation.

8.5 Network Failure Handling
	User App:
	•	Local caching of menu.
	If request fails:
	•	Retry
	•	Show clear error (“We lost connection, your order might not have gone through – tap to retry or contact staff.”).
	Kitchen / POS:
	   If fully cloud-based, use offline mode:
	•	Queue operations locally (orders, status changes)
	•	Sync when connection returns.
	•	For high reliability, branches can use:
	•	Local edge server that syncs with cloud (future step).

8.6 Offline Mode Behavior
	Minimum offline features:
	•	View cached menu
	•	Create “pending orders” that will sync later (only safe for POS, not for customer app unless clearly indicated).
	•	Ensure no duplicate orders:
	•	Use client-generated UUIDs & idempotent order creation.

⸻

9. AI & Recommendation Engine Design

9.1 Data Sources
	•	Orders & order_items
	•	Sessions
	•	Users
	•	Reviews
	•	Time & context (day of week, time of day, branch)

9.2 Recommendation Use Cases
	User Ordering App
	•	“You usually order…”
	•	“Frequently ordered with this item”
	•	“Popular at this time”
	Dashboard
	•	Menu optimization:
	•	Items with low sales but high rating
	•	Items with high returns / refunds
	Kitchen & Inventory
	•	Demand forecasting (items per time slot)
	•	Suggest reorder quantities

9.3 Recommendation Techniques

Start simple, then evolve:
	1.	Rule-based / heuristics
	•	Top sellers by branch/category
	•	Recently ordered by user
	2.	Association rules (market basket)
	•	“Customers who ordered X also ordered Y”
	3.	Collaborative filtering
	•	Similar users recommending items based on behavior
	4.	Time-series forecasting
	•	Predict demand per item/day/hour using e.g. Prophet or basic models.

9.4 How “Item and Category and Quantity → recommends”
	•	Build a Recommendation_Stats table:
	•	MenuItemID, CoPurchasedItemID, Count
	•	CategoryID, aggregated.
	•	For each new cart, compute:
	•	For each item in cart, look up top CoPurchasedItemID and suggest.
	•	For last order from last session:
	•	Keep quickly accessible via:
	•	Users.LastOrderID OR
	•	Query Orders by UserID and OrderDateTime.

⸻

10. Scalability Roadmap
	1.	Phase 1 – MVP / Single Branch
	•	Modular monolith backend
	•	Single Postgres DB
	•	Redis for session & caching
	•	Minimal analytics computed on the fly
	2.	Phase 2 – Multi-Branch
	•	Proper branch scoping
	•	Analytics aggregation tables (daily branch stats)
	•	Role-based access extended
	3.	Phase 3 – High Load
	•	Read replicas for DB
	•	Split out:
	•	Analytics service
	•	Notification service
	•	Payment service
	•	Use event-driven architecture:
	•	ORDER_PLACED, ORDER_UPDATED, PAYMENT_COMPLETED on message bus
	4.	Phase 4 – Enterprise
	•	Full microservices
	•	Separate DBs per bounded context if needed
	•	Multi-tenant (multiple restaurant brands)
	•	Advanced AI models for demand & staffing

⸻

11. Identified Risks & How to Solve Them
	1.	Single DB Bottleneck
	•	Mitigation: Indexing, read replicas, caching, later microservices.
	2.	Network Dependency
	•	Mitigation: Local caching, retry strategies, offline mode, optional local edge servers.
	3.	Data Consistency during Offline
	•	Mitigation: Idempotent APIs, UUIDs, conflict resolution rules.
	4.	Security & PCI DSS
	•	Mitigation: Use external PCI-compliant processors, never store card data, follow PCI’s 12 requirements for network, encryption, access control, logging.  
	5.	Staff Misuse (fraud, unauthorized discounts)
	•	Mitigation:
	•	Strong permissions
	•	Audit logs
	•	Alerts for unusual patterns (e.g., many refunds).
	6.	Bad UX Causing Abandoned Orders
	•	Mitigation:
	•	Guest checkout
	•	Fast scan → menu → cart flow
	•	Clear status & error messages.

⸻