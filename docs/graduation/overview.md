# Project Overview

## Title

**Smart Restaurant Operating System** — A Multi-Tenant, Full-Stack Platform for Modern Restaurant Operations

## Problem Statement

Traditional restaurants rely on fragmented tools for ordering, kitchen management, payments, and analytics. Staff use paper tickets, separate POS terminals, and manual inventory tracking. This leads to delayed orders, communication breakdowns between front-of-house and kitchen, inaccurate stock counts, and limited business insight.

Small and medium restaurant businesses lack affordable, integrated solutions that cover the entire dining lifecycle — from the moment a customer scans a table QR code to final payment and post-service analytics.

## Proposed Solution

A unified operating system that connects every participant in the restaurant workflow through a single real-time platform:

- **Customers** scan a QR code, browse the menu, customize items, and place orders from their phone — no app install required. They can pay via Stripe, request cash/terminal payment, leave reviews, and track order status in real time.
- **Kitchen staff** see orders in real time on a Kitchen Display System (KDS), manage item preparation status, mark items unavailable (86), undo actions within a time window, and record waste/remakes with reason codes.
- **Waiters** manage table assignments via a live floor map, respond to service requests, confirm payments (cash and terminal), quick-add items to orders, and clear tables when sessions end.
- **Managers/Owners** access a full admin panel for menu management, staff/role configuration, analytics, inventory (with auto-decrement on serving), promotions, device management, finance tracking, and multi-branch oversight with a branch selector.

The system is designed as a multi-tenant platform where a single deployment serves multiple restaurant groups, each with their own branches, staff, and data — fully isolated by tenant.

## Target Users

| User | Interface | Primary Tasks |
|---|---|---|
| Restaurant customers | Mobile web (QR scan) | Browse menu, order, pay (Stripe or cash), request service, review |
| Kitchen chefs | KDS screen | View queue, start/fire/complete items, 86 items, undo, record waste |
| Waiters | Waiter dashboard | Manage tables, claim service requests, serve, confirm payments, quick-add |
| Cashiers | POS terminal | Process orders, handle payments, manage tills |
| Owners/Managers | Admin panel | Menu, staff, analytics, inventory, promotions, devices, multi-branch |

## System Applications

The frontend provides four distinct application surfaces within a single deployment:

1. **Customer Ordering App** — QR-code-initiated, mobile-first ordering with real-time tracking, Stripe payment, and post-order reviews
2. **Kitchen Display System (KDS)** — Live order queue with item-level status control, 86, undo, waste tracking, and kitchen station awareness
3. **Waiter Dashboard** — Floor map with attention states, service request management, payment confirmation, and table lifecycle control
4. **Admin/POS Panel** — Full back-office: dashboard, menu editor, staff management, POS, analytics, inventory, promotions, shifts/tills, device management, finance, and multi-branch oversight

## High-Level Architecture

```
                  +------------+
    :80           |   Nginx    |
    --------------| (reverse   |
                  |  proxy)    |
                  +-----+------+
                        |
           +------------+------------+
           |                         |
     +-----+-----+            +-----+------+
     |   Web     |            |    API     |
     |  Next.js  |            |   NestJS   |
     |  :3000    |            |   :4000    |
     +-----------+            +------+-----+
                                     |
                +------------+-------+------------+
                |            |                    |
          +-----+-----+  +--+--+           +-----+-----+
          | PostgreSQL |  |Redis|           |   AI      |
          |  :5432     |  |:6379|           |  FastAPI  |
          +------------+  +-----+           |  :8000    |
                                            +-----------+
```

- **Frontend**: Next.js 15 with React 19, TailwindCSS with custom design system (CSS custom properties, editorial typography), React Query for data fetching
- **Backend API**: NestJS 11 modular monolith with 24 controller modules, 155 API endpoints, global validation, rate limiting, and RBAC
- **Database**: PostgreSQL 16 with Prisma ORM, 51 data models, 29 enums, tenant-scoped queries
- **Cache/Sessions**: Redis 7 for rate limiting and session management
- **AI Services**: FastAPI (Python) for menu recommendations and chatbot (optional)
- **Reverse Proxy**: Nginx for unified entry point, security headers, SSE support
- **Payments**: Stripe gateway (adapter pattern — mock gateway available for development)

## Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend Framework | Next.js | 15 |
| UI Library | React | 19 |
| Styling | TailwindCSS + CSS Custom Properties | 3.4 |
| State/Fetching | React Query (TanStack) | 5.x |
| Backend Framework | NestJS | 11 |
| ORM | Prisma | 6.x |
| Database | PostgreSQL | 16 |
| Cache | Redis | 7 |
| AI Services | FastAPI + scikit-learn | 0.115+ |
| Language | TypeScript / Python | 5.6 / 3.12 |
| Containerization | Docker Compose | v2 |
| Reverse Proxy | Nginx | Alpine |
| Payment Gateway | Stripe (adapter pattern) | Checkout Sessions |
| Testing | Playwright (E2E), custom smoke suite | 1.59 |
| Monitoring | Prometheus (optional config) | 2.53 |

## Why This Is More Than a POS

A Point-of-Sale system handles transactions at a counter. This platform covers the **entire restaurant lifecycle**:

| Capability | Traditional POS | This System |
|---|---|---|
| Customer self-ordering | No | QR-code mobile ordering |
| Kitchen display system | Separate product | Integrated real-time KDS with 86, undo, waste |
| Waiter service requests | Manual/verbal | Digital request queue with claim/complete |
| Multi-tenant isolation | No | Full tenant + branch scoping |
| Multi-branch management | No | Branch selector, cross-branch summary |
| Real-time updates | No | Server-Sent Events (SSE) |
| AI recommendations | No | Menu suggestions, chatbot |
| Inventory tracking | Basic or none | Full stock management with auto-decrement |
| Promotions/coupons | Basic | Discounts, coupons, gift cards with tracking |
| Role-based access | Limited | 41 granular permissions across 4+ roles |
| Analytics | Basic reports | Dashboard, sales trends, menu performance, staff metrics |
| Payment gateway | Single provider | Stripe + adapter pattern for provider flexibility |
| Device management | N/A | Register and manage KDS/POS/WAITER devices per branch |
| Production deployment | N/A | Docker Compose with Nginx, health checks, backups, monitoring |

The system bridges front-of-house customer experience with back-of-house operations into a single, coherent platform.
