# API Backend Architecture

The backend codebase is located in `apps/api`.

## Runtime and Entry Point

- The application is bootstrapped in `apps/api/src/main.ts`.
- A global prefix `/api` is set for all routes.
- A global `ValidationPipe` is configured with `whitelist`, `transform`, and `forbidNonWhitelisted` to ensure security and data integrity.
- Middleware such as Helmet, cookie parser, CORS, and a static file server for `/uploads` are enabled.
- The root module `apps/api/src/app.module.ts` imports all domain-specific modules and attaches a `RequestLoggerMiddleware`.

## Module Shape

The backend follows conventional NestJS module structure:

- `*.controller.ts`: Handles HTTP route definitions.
- `*.service.ts`: Contains business logic and data access layers.
- `dto/*.dto.ts`: Defines validated Data Transfer Objects for requests.
- **Guards and Decorators:** Located in `modules/auth`, these enforce public/private routes, roles, permissions, branch access, and CSRF protection.
- **Database Access:** Centralized through `PrismaService`.

## Cross-Cutting Services

- `AuthModule`: A global module providing JWT, CSRF, and permission guards, along with services for token management, staff/customer authentication, SMS, and branch access control.
- `BranchAccessService`: Ensures that staff operations are correctly scoped to their designated tenant and branch.
- `RealtimeService`: An in-process event bus using RxJS for Server-Sent Events (SSE).
- `RequestLoggerMiddleware`: Implements request logging with unique request IDs.
- **Provider Contracts:** Located in `apps/api/src/contracts`, these define interfaces for external services like `PaymentGateway`, `NotificationChannel`, `ObjectStorage`, `EventBus`, and `AiProvider`.
- AI-related modules currently include menu chat, recommendations, demand forecasting, business insights, review sentiment, and SaaS AI controls/diagnostics.

## API Documentation

The backend exposes numerous routes across its controller modules. The definitive source for current routes is the controller code under `apps/api/src/modules/**`.

Important AI-related public or staff-facing routes include:

- `POST /api/ai/menu-chat`
- `POST /api/recommendations/menu`
- `POST /api/recommendations/telemetry`
- `GET /api/admin/ai/demand-forecast`
- `GET /api/admin/ai/business-insights`
- `GET /api/admin/ai/review-sentiment`
- `GET /api/saas/ai/overview`
- `GET /api/saas/ai/branches`
- `GET /api/saas/ai/branches/:branchId`
