# Security Architecture

This document describes the security-relevant behavior currently implemented in the Smart Restaurant OS repository. It is based on the current source code, configuration, schema, and deployment files.

## Project Security Overview

Smart Restaurant OS is a multi-tenant, multi-branch restaurant operations platform. The main security model is:

- all business data belongs to a `Tenant`
- most operational data is also scoped to a `Branch`
- browser and API clients access data only through the NestJS API in `apps/api`
- staff actions are authenticated with JWT access tokens and authorized with role and permission checks
- customer flows support public QR/table access and optional OTP authentication
- AI, payments, SMS, storage, and realtime behavior are mediated by backend modules and provider contracts

The primary assets that need protection are:

- tenant and branch operational data: tables, sessions, orders, payments, inventory, KDS state, service requests, analytics, logs
- staff accounts, roles, permissions, and password hashes
- customer phone numbers, refresh tokens, OTP records, preferences, order history, reviews, loyalty data
- payment records, refunds, webhook events, payment references, gift cards, coupons
- operational audit trails and payment event logs
- secrets such as `JWT_SECRET`, database URLs, Stripe keys, Twilio credentials, webhook secrets, and MinIO/Grafana passwords
- AI inputs/outputs and aggregate analytics logs

## Authentication

Authentication is implemented in `apps/api/src/modules/auth`. Global authentication is wired in `apps/api/src/modules/auth/auth.module.ts` through three global guards: `JwtAuthGuard`, `CsrfGuard`, and `PermissionsGuard`. `JwtAuthGuard` reads a token from `Authorization: Bearer <token>` first, then from the httpOnly `sro_access` cookie. It verifies the token with `TokenService` and attaches either `request.staff` or `request.customer`.

## Authorization and Access Control

Authorization is implemented with `apps/api/src/modules/auth/guards/permissions.guard.ts`, `@RequirePermissions` and `@RequireRoles` decorators, and the `apps/api/src/modules/auth/branch-access.service.ts` for service-level tenant/branch filters.
The `PermissionsGuard` enforces `@RequireRoles(...)` and `@RequirePermissions(...)`. If a route has no role or permission decorator, authentication is still required unless it is marked `@Public()`.
Branch authorization is centralized in `BranchAccessService`.

## Input Validation and Sanitization

Global request validation is configured in `apps/api/src/main.ts` using a `ValidationPipe` with strict rules. DTO validation uses `class-validator` and `class-transformer` throughout the API.
No use of `dangerouslySetInnerHTML` was found in `apps/web/src`. The backend does not perform broad HTML sanitization of free-text fields; instead, DTOs enforce length and type constraints.

## Data Security

The canonical database schema is `apps/api/prisma/schema.prisma`. Prisma ORM is used for all database access, which helps prevent SQL injection vulnerabilities. Staff passwords and OTP codes are hashed using bcrypt. Customer refresh tokens are opaque database IDs that are rotated and revoked.

## Secrets and Environment Variables

Environment loading and validation are implemented in `apps/api/src/config/env.ts`. Production validation enforces strong secrets and secure configurations. Real `.env` and `.env.production` files exist locally but are not committed to the repository.
