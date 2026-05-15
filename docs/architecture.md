# Architecture Notes

This scaffold follows the direction stated in the extracted documentation:

- Next.js for a unified frontend surface
- NestJS for the backend REST API
- PostgreSQL for the primary relational datastore
- Redis for cache, session, and initial event support
- MinIO-compatible object storage for logs, reports, and AI artifacts
- Python AI microservices for assistive intelligence features

## Early Architectural Assumptions

1. The MVP uses one web codebase with role-based areas instead of four disconnected frontend repos.
2. The backend should start as a modular monolith with clear bounded contexts and a single logical database.
3. Tenant and branch scoping are first-class concerns and should be represented in API contracts and persistence from the start.
4. Infrastructure services run in Docker; application services run locally during active development.
5. AI remains an internal capability behind backend-controlled access paths for auditability and tenant isolation.
6. External integrations are adapter-driven: payments, notifications, storage, and AI providers should not leak directly into business modules.

## Suggested Backend Module Roadmap

- `auth`
- `tenancy`
- `roles`
- `branches`
- `tables`
- `sessions`
- `menu`
- `orders`
- `kds`
- `payments`
- `pos`
- `shifts`
- `service-requests`
- `reporting`
- `analytics`
- `realtime`
- `audit`
- `notifications`
- `inventory`
- `loyalty`
- `integrations`

## Diagram Alignment

The supplied diagrams add these concrete environment decisions:

- frontend surfaces:
  `customer`, `staff`, and `admin` are distinct user-facing areas, even if they live in one Next.js app initially
- backend services:
  `api-gateway`, `authentication`, `menu-pricing`, `orders`, `payments`, `analytics`, and `realtime`
- integrations:
  payment gateways, notification services, object storage, and AI modules
- realtime model:
  websocket delivery on top of an internal event layer

For the current scaffold, Redis is the pragmatic first event layer. If you later need stronger delivery guarantees or consumer groups, replace that slice with a dedicated broker.

## Updated Architectural Interpretation

The new requirements tighten the design in these ways:

- one logical normalized schema is the source of truth for reporting and synchronization
- all frontends use backend APIs only and never access the database directly
- dining is session-based, not just order-based
- waiter and kitchen operations are first-class domains, not side-features of admin POS
- optional modules such as inventory, loyalty, marketplace, and online ordering must remain feature-flagged
- phase one should optimize for correctness and auditability before decomposition into more services

## Current System Architecture

```mermaid
flowchart TB
  subgraph Web["apps/web - Next.js"]
    Customer["Customer QR ordering"]
    Waiter["Waiter workspace"]
    Kitchen["Kitchen Display System"]
    Admin["Admin / owner dashboard"]
  end

  subgraph API["apps/api - NestJS modular monolith"]
    Auth["Auth / roles / permissions"]
    BranchAccess["BranchAccessService"]
    Sessions["Tables + sessions"]
    Orders["Orders + KDS"]
    Payments["Payments + refunds"]
    Inventory["Inventory + stock movements"]
    Analytics["Analytics + AI orchestration"]
    Realtime["Realtime / SSE"]
  end

  subgraph Data["Data services"]
    Postgres[(PostgreSQL + Prisma)]
    Redis[(Redis)]
    Minio[(MinIO / object storage)]
  end

  subgraph External["Optional providers"]
    Gateway["Payment gateway adapter"]
    AI["FastAPI / hosted AI providers"]
    Notify["Notification provider"]
  end

  Customer --> API
  Waiter --> API
  Kitchen --> API
  Admin --> API
  API --> Postgres
  API --> Redis
  API --> Minio
  Payments --> Gateway
  Analytics --> AI
  API --> Notify
  Auth --> BranchAccess
  Orders --> BranchAccess
  Payments --> BranchAccess
  Inventory --> BranchAccess
  Analytics --> BranchAccess
```

## Role And Surface Map

```mermaid
flowchart LR
  Owner["OWNER"] --> Admin
  Manager["MANAGER"] --> Admin
  Cashier["CASHIER"] --> POS["POS / finance / payments"]
  WaiterRole["WAITER"] --> Waiter
  Chef["CHEF"] --> Kitchen
  KitchenLead["KITCHEN_LEAD"] --> Kitchen
  CustomerRole["Customer / guest"] --> Customer

  Admin["Admin dashboard"]
  POS["POS and checkout"]
  Waiter["Waiter floor/table workspace"]
  Kitchen["KDS queue"]
  Customer["Public QR ordering"]
```

Frontend route restrictions improve UX, but backend guards and services enforce access.

## Branch Authorization Flow

```mermaid
sequenceDiagram
  participant Client
  participant Controller
  participant Service
  participant BranchAccess
  participant DB as PostgreSQL

  Client->>Controller: Request with staff token + branchId/entityId
  Controller->>Service: Authenticated staff context
  Service->>DB: Load target branch/entity
  Service->>BranchAccess: assertUserCanAccessBranch/entity
  BranchAccess->>DB: Verify branch tenant
  alt missing branch/entity
    BranchAccess-->>Service: NotFoundException
  else cross tenant or branch
    BranchAccess-->>Service: ForbiddenException
  else allowed
    BranchAccess-->>Service: OK
    Service->>DB: Query/mutate with tenantId + branchId
    Service-->>Controller: Scoped result
  end
```

## Public QR Order Lifecycle

```mermaid
sequenceDiagram
  participant Guest
  participant Web as Customer UI
  participant API
  participant DB as PostgreSQL
  participant KDS

  Guest->>Web: Scan QR / open table session
  Web->>API: Create order with sessionId and item selections
  API->>DB: Load active session, table, branch, tenant
  API->>DB: Load branch-scoped menu items and inventory links
  API->>API: Recalculate prices, tax, totals, source
  alt invalid session/item/stock
    API-->>Web: 400/404/409
  else valid
    API->>DB: Create order + items
    API->>KDS: Emit ORDER_PLACED
    API-->>Web: Trusted order response
  end
```

## Payment Lifecycle

```mermaid
sequenceDiagram
  participant Client
  participant API
  participant DB as PostgreSQL
  participant Gateway

  Client->>API: Request payment intent / manual payment
  API->>DB: Load order/session/table scope
  API->>API: Calculate unpaid amount
  alt already paid or cancelled
    API-->>Client: ConflictException
  else gateway payment
    API->>Gateway: Create intent with server amount
    Gateway-->>API: Provider reference
    API->>DB: Store pending payment
    API-->>Client: Checkout reference
    Gateway->>API: Webhook event
    API->>DB: Load pending payment(s)
    API->>API: Compare provider amount/currency
    API->>DB: Mark payment/order paid only if verified
  else authorized cash/manual
    API->>DB: Create completed manual payment
    API->>DB: Recalculate order paymentStatus
  end
```

## Inventory Served Transition Lifecycle

```mermaid
sequenceDiagram
  participant Staff
  participant OrdersService
  participant DB as PostgreSQL

  Staff->>OrdersService: Mark order SERVED
  OrdersService->>DB: Transaction begins
  OrdersService->>DB: Load order with tenantId + branchId
  OrdersService->>OrdersService: Validate branch access and status transition
  OrdersService->>DB: Conditional decrement where stock is sufficient
  alt insufficient stock or repeated transition
    OrdersService->>DB: Rollback
    OrdersService-->>Staff: Conflict/BadRequest
  else success
    OrdersService->>DB: Create StockAdjustment movement rows
    OrdersService->>DB: Update order status/history/inventoryDecrementedAt
    OrdersService->>DB: Commit
    OrdersService-->>Staff: Served order
  end
```

## AI Analytics Lifecycle

```mermaid
flowchart LR
  Request["Admin requests AI analytics"] --> Access["Validate tenant/branch access"]
  Access --> Metrics["Compute real metrics from Prisma"]
  Metrics --> Prompt["Build scoped AI input"]
  Prompt --> Provider["Optional AI provider"]
  Provider --> Validate["Validate AI output"]
  Validate --> Response["Return computed analytics + validated AI wording"]
  Provider -->|failure / timeout / malformed| Fallback["Fallback summary message"]
  Fallback --> Response
```
