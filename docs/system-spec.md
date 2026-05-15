# System Specification

## Overview

Global RMS is a Smart Restaurant Ordering and Management Ecosystem. It is not just a POS replacement. It combines smart dining, KDS, waiter operations, ERP/POS management, analytics, and assistive AI into one unified platform.

## Core Characteristics

- unified backend with one logical normalized database
- API-only access from all frontends
- session-based dining tied to tables
- realtime synchronization across customer, kitchen, waiter, and admin surfaces
- multi-tenant and multi-branch scoping
- modular feature enablement through modules and feature flags
- secure operations with RBAC, audit logging, and compliance-focused design
- data collection for analytics, recommendations, forecasting, and performance analysis

## Core Applications

1. Customer Ordering App
2. Kitchen Display System
3. Waiter / Staff Dashboard
4. Admin Dashboard with ERP and POS capabilities

## Backend Domains

- auth and identity
- roles and permissions
- tables and dining sessions
- menu and catalog
- orders and kitchen flow
- payments, refunds, splits, and tills
- staff shifts and attendance
- service requests and notifications
- analytics and reporting
- inventory and stock management
- promotions, coupons, loyalty, and gift cards
- integrations and feature-flagged modules
- realtime event bus

## Core Business Lifecycles

### Table Lifecycle

`AVAILABLE -> RESERVED -> OCCUPIED -> CLEANING -> AVAILABLE`

### Order Lifecycle

`PLACED -> CONFIRMED -> IN_KITCHEN -> READY -> SERVED -> COMPLETED`

Cancellation is allowed only under controlled conditions and must be logged.

### Payment Lifecycle

`PENDING -> COMPLETED | FAILED | REFUNDED`

Order payment state is derived from one or more payment records.

## Realtime Expectations

- Kitchen, waiter, and admin need websocket-grade live updates.
- Customer order timelines can be served by SSE if simpler.
- Event types include order, kitchen, service-request, payment, and table-state changes.

## Data Model Direction

The single logical schema centers on:

- tenants and branches
- tables and sessions
- users and staff
- roles, permissions, and auditability
- menu, categories, modifiers, and availability
- orders, order items, status history, and payments
- service requests and notifications
- expenses, analytics snapshots, attendance, shifts, and tills
- inventory, discounts, coupons, and gift cards
- OTP and refresh token flows for customer auth

## AI Scope

AI is assistive only. It should support:

- menu recommendations
- chatbot assistance
- demand forecasting
- anomaly detection
- management insights

AI must remain tenant-isolated and accessed through backend-controlled APIs.

## MVP Technical Posture

- modular monolith backend first
- one Postgres database
- Redis for cache and event support
- MinIO for object storage needs
- Next.js frontend surfaces
- FastAPI AI boundary

## Notable Rules

- all critical actions must be auditable
- card data must never be stored locally
- branch scoping is mandatory for operational entities
- idempotency is required for order and payment retry paths
- offline tolerance is required for KDS and selected staff flows
