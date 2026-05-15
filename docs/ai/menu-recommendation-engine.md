# Menu Recommendation Engine

## Adjusted Build Plan

The repository already has a rule-based recommendation surface in `apps/api/src/modules/ai`, backed by `RecommendationStat` and `UserItemStat`. Feature 1 should upgrade and consolidate that existing implementation instead of creating a parallel recommendation stack.

## Phase 1: Shared Contract

- Add shared menu recommendation request and response types in `packages/shared-types`.
- Export the contract from the shared package barrel.
- Keep the contract suitable for both the current NestJS implementation and a future FastAPI ranking service.

## Phase 2: Audit Model

- Add a `RecommendationLog` Prisma model for persistent recommendation auditability.
- Use JSON fields if array columns become awkward for the current Prisma/PostgreSQL setup.
- Log input cart IDs, output item IDs, recommendation types, scores, reasons, algorithm version, tenant, branch, user, and session.

Status: complete. Migration `20260503065258_add_recommendation_logs` adds `RecommendationLog` with tenant, branch, optional user, optional session, cart item IDs, recommended item IDs, recommendation types, metadata, and audit indexes.

## Phase 3: Canonical API Endpoint

- Add one canonical endpoint: `POST /api/recommendations/menu`.
- Reuse or refactor the existing `AiModule` recommendation service logic rather than duplicating it.
- Derive `tenantId` from trusted branch or session data where possible. If a request supplies `tenantId`, verify the branch belongs to it.

Status: complete. `RecommendationsModule` exposes `POST /api/recommendations/menu` and injects the existing `RecommendationService` exported by `AiModule`. The service derives tenant scope from branch, validates optional tenant/session scope, returns the shared recommendation response shape, and writes `RecommendationLog` records without breaking the request if logging fails.

## Phase 4: Rule-Based Scoring

- `POPULAR`: branch-scoped completed order history.
- `FREQUENTLY_BOUGHT`: co-purchases with current cart items.
- `REORDER`: previous customer items from the same tenant and branch.
- `TIME_BASED`: items historically sold during the current local hour/day.
- Merge duplicate candidates, sum score boosts, retain the strongest explanation, and sort descending.

Status: complete. `RecommendationService.getMenuRecommendations()` implements all four rule-based strategies. Phase 4 verification is covered by `npm.cmd run test:recommendations --workspace @smart-restaurant/api`, which creates isolated Prisma data and checks tenant/branch isolation, cart exclusion, inactive/unavailable filtering, strategy types, score sorting, tenant/session validation, and `RecommendationLog` creation.

## Phase 5: Frontend Integration

- Add `RecommendedForYou` to the customer cart flow.
- Call the NestJS API only.
- Hide the component when no recommendations are returned.
- Show item name, reason, and an add-to-cart action only when existing cart data can safely reconstruct the item.

Status: complete. `apps/web/src/components/recommendations/RecommendedForYou.tsx` calls `POST /api/recommendations/menu` through the existing API client and is connected to the customer menu and cart pages. It sends branch/session/cart context, accepts tenant/user context when available, handles loading/error/empty states, renders recommendation names and reasons, and adds recommended items to the existing cart without calling `apps/ai-services`.

## Safety Rules

- Every recommendation query must include tenant scope and branch scope.
- Do not recommend inactive or unavailable items.
- Do not recommend items already in the cart.
- Do not call `apps/ai-services` from the frontend.
- Do not invent menu items or expose unnecessary customer data.

## MVP Limitations

- Rule-based only.
- No ML personalization.
- No vector search.
- No LLM reasoning.
- Recommendation quality depends on order history volume.

## Future Upgrades

- Redis caching for branch popularity.
- Feature flags per tenant.
- A/B testing by recommendation strategy.
- FastAPI ML ranking service behind the NestJS API.
- Seasonal and time-aware ranking improvements.
