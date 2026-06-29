# Menu Recommendations

The recommendation system is now a hybrid backend-controlled engine.

## Runtime Shape

- Frontend calls `POST /api/recommendations/menu`
- NestJS generates safe candidate items from branch-scoped menu and order data
- NestJS can return pure deterministic results or call FastAPI for reranking
- The UI contract stays the same in both cases

## Deterministic Strategies

The backend candidate pool is built from:

- popular items
- frequently bought together
- reorder history
- time-based suggestions
- available-item fallback

This logic lives in [recommendation.service.ts](/C:/Users/support/Desktop/WS/GP/apps/api/src/modules/ai/recommendation.service.ts).

## ML Reranking

When branch AI controls permit it, NestJS calls `POST /recommendations/menu/infer` on the internal FastAPI service.

The FastAPI service currently uses a lightweight `GradientBoostingRegressor`-based scorer over features such as:

- rule score
- historical sales count
- co-purchase count
- reorder signal
- time-of-day signal
- impression, add-to-cart, and purchase counts
- cart context
- user-context flag

## Engine Modes

Per-branch recommendation controls support:

- `rules`
- `shadow`
- `ml`

In `shadow` mode the deterministic result is still returned to the frontend, but AI ranking metadata can be logged for comparison.

## Request Contract

Endpoint:

- `POST /api/recommendations/menu`

Request shape:

```ts
{
  tenantId?: string;
  branchId: string;
  userId?: string;
  sessionId?: string;
  cartItems: Array<{ menuItemId: string; quantity: number }>;
  limit?: number;
  surface?: "menu_home" | "cart" | "item_detail" | "checkout";
  trigger?: "empty_cart" | "cart_aware" | "no_history_fallback";
}
```

## Response Contract

```ts
{
  recommendations: Array<{
    menuItemId: string;
    name: string;
    reason: string;
    score: number;
    type: "POPULAR" | "FREQUENTLY_BOUGHT" | "REORDER" | "TIME_BASED" | "AVAILABLE";
    metadata: {
      strategySource: string;
      historicalSalesCount?: number;
      coPurchaseCount?: number;
      timeOfDaySignal?: string;
      reorderSignal?: number;
      scoreContributionPerStrategy?: Record<string, number>;
      engine?: "RULES" | "ML";
      modelVersion?: string;
      confidence?: number;
      explanations?: string[];
    };
  }>;
}
```

## Fallback Behavior

Fallbacks happen in this order:

- deterministic strategies remain available even if FastAPI is down
- if ML confidence is below the branch threshold, the backend returns rule output
- if no strategy produces results, the backend falls back to available items from the branch menu

## Telemetry

Frontend telemetry uses:

- `POST /api/recommendations/telemetry`

Tracked interactions include:

- `IMPRESSION`
- `ADD_TO_CART`
- `PURCHASED`

Telemetry is stored in recommendation log and interaction tables for later evaluation and model improvement.

## UI Locations

The current recommendation UI is rendered in:

- [customer menu page](/C:/Users/support/Desktop/WS/GP/apps/web/src/app/customer/session/[sessionId]/menu/page.tsx)
- [customer cart page](/C:/Users/support/Desktop/WS/GP/apps/web/src/app/customer/session/[sessionId]/cart/page.tsx)

The shared component is [RecommendedForYou.tsx](/C:/Users/support/Desktop/WS/GP/apps/web/src/components/recommendations/RecommendedForYou.tsx).
