# Web Frontend Architecture

The frontend codebase is located in `apps/web`.

## Framework and Routing

- Uses Next.js App Router under `apps/web/src/app`.
- The root layout is defined in `apps/web/src/app/layout.tsx`.
- The root of the application `/` redirects to the `/login` page.
- Route groups are organized by user surface:
  - `/customer`
  - `/kitchen`
  - `/waiter`
  - `/admin`
  - `/login`

## Main Pages

Key pages in the application include:

- `apps/web/src/app/login/page.tsx`: Unified login for both staff and customers.
- `apps/web/src/app/customer/start/page.tsx`: Entry point for customers, typically via QR code, to start a session.
- `apps/web/src/app/customer/session/[sessionId]/menu/page.tsx`: The menu page for a customer session.
- `apps/web/src/app/customer/session/[sessionId]/cart/page.tsx`: The cart and checkout page.
- `apps/web/src/app/customer/session/[sessionId]/orders/[orderId]/page.tsx`: Page for tracking order status and payment.
- `apps/web/src/app/kitchen/orders/page.tsx`: The Kitchen Display System (KDS) queue.
- `apps/web/src/app/waiter/dashboard/page.tsx`: The main workspace for waiters.
- `apps/web/src/app/admin/dashboard/page.tsx`: The overview dashboard for admins.
- `apps/web/src/app/admin/pos/page.tsx`: The Point of Sale (POS) console.
- `apps/web/src/app/admin/menu/page.tsx`: Menu management interface.
- `apps/web/src/app/admin/inventory/page.tsx`: Inventory management interface.
- `apps/web/src/app/admin/analytics/page.tsx`: Analytics and AI-powered panels.

## Components and Utilities

- `apps/web/srcsrc/components/admin`: Components for the admin dashboard, navigation, and panels.
- `apps/web/src/components/customer`: Customer-facing components for ordering.
- `apps/web/src/components/ai`: The menu chat assistant component.
- `apps/web/src/components/recommendations`: UI for menu recommendations.
- `apps/web/src/components/ui`: Shared UI primitives such as alerts, cards, spinners, and toasts.
- `apps/web/src/lib/api.ts`: The API client which handles JSON parsing, cookie-based credentials, CSRF token fetching and retrying, authentication helpers, and an upload helper.
- `apps/web/src/lib/providers.tsx`: Providers for React Query, cart context, and toasts.
- `apps/web/src/lib/staff-auth.ts`: Helpers for staff cookie-based authentication hints and non-sensitive metadata.
- `apps/web/src/lib/customer-auth.ts`: Helpers for customer cookie-based authentication hints and phone metadata.
- `apps/web/src/lib/cart-store.tsx`: The reducer and context for the customer's cart.

## State, Forms, Loading, and Errors

- **Server State:** Managed using TanStack React Query.
- **Cart State:** Managed using React context and a reducer.
- **Forms:** Primarily handled with component-local React state.
- **API Errors:** Normalized by the `getApiErrorMessage()` function in `apps/web/src/lib/api.ts`.
- **UI States:** Many pages use shared primitives from `components/ui` for loading, error, and empty states.

## Backend Communication

The frontend exclusively communicates with the NestJS backend, never directly with the database or other services. The `NEXT_PUBLIC_API_BASE_URL` environment variable configures the API's origin, which defaults to `http://localhost:4000`. The API client is configured to send credentials (`credentials: "include"`) for httpOnly cookies and includes the `X-CSRF-Token` header for unsafe browser methods.
