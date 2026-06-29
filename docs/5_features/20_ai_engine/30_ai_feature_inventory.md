# AI Feature Inventory

This document summarizes the AI and AI-adjacent features currently implemented in the project, how they are built, their fallback paths, their request and response shapes, and where they appear in the UI.

## System Rules

These rules apply across all AI features:

- the browser never calls FastAPI directly
- NestJS owns tenant scope, branch scope, auth, validation, and fallbacks
- FastAPI is an internal inference boundary only
- optional hosted LLM usage is backend-only
- invalid or low-confidence AI output is rejected before it reaches the UI

## 1. Menu Chat Assistant

### Purpose

Lets customers ask grounded menu questions such as spicy, vegetarian, budget-friendly, fast-prep, or allergen-sensitive requests.

### Backend Path

- Frontend route call: `POST /api/ai/menu-chat`
- NestJS service: [menu-chatbot.service.ts](/C:/Users/support/Desktop/WS/GP/apps/api/src/modules/ai/menu-chatbot.service.ts)
- Optional FastAPI helper: `POST /menu-chat`
- Optional hosted LLM helper: [menu-chat-llm.service.ts](/C:/Users/support/Desktop/WS/GP/apps/api/src/modules/ai/menu-chat-llm.service.ts)

### How It Is Implemented

- Intent detection is rule-based in NestJS.
- The backend loads scoped menu items and session context.
- The backend can use:
  - deterministic response generation
  - FastAPI menu matching helper
  - hosted LLM helper when branch controls allow it
- The backend can also reuse recommendation logic as a fallback source for suggested items.

### Built With

- NestJS
- Prisma
- optional FastAPI
- optional Hugging Face chat-completions API

### Branch Controls

Current branch AI controls for menu chat include:

- `menuChatEnabled`
- `hostedLlmEnabled`
- `fallbackOnly`
- request limits
- provider timeout
- max response length
- max suggestions
- assistant tone

### Request Shape

```ts
{
  branchId: string;
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  message: string;
  cartItems?: Array<{
    menuItemId: string;
    quantity: number;
  }>;
}
```

### Response Shape

```ts
{
  reply: string;
  suggestedItems: Array<{
    menuItemId: string;
    name: string;
    reason: string;
  }>;
  safetyNotes?: string[];
  requiresStaffHelp?: boolean;
  staffHelpReason?:
    | "ALLERGEN_UNCERTAIN"
    | "INGREDIENT_UNCERTAIN"
    | "POLICY_OR_PAYMENT"
    | "CUSTOM_PREPARATION"
    | "NO_SAFE_MENU_MATCH";
  language?: "en" | "ar";
}
```

### Fallbacks

- If the branch is invalid, the assistant returns a safe empty response.
- If hosted usage is disabled or limited, the backend uses deterministic rules.
- If provider calls fail or time out, the backend falls back to deterministic behavior.
- If allergen or ingredient certainty is not possible, the response can require staff help instead of guessing.
- If the frontend request itself fails, the UI shows a lightweight unavailable message and the user can continue browsing manually.

### UI Location

- [MenuChatAssistant.tsx](/C:/Users/support/Desktop/WS/GP/apps/web/src/components/ai/MenuChatAssistant.tsx)
- rendered in [customer menu page](/C:/Users/support/Desktop/WS/GP/apps/web/src/app/customer/session/[sessionId]/menu/page.tsx)

## 2. Menu Recommendations

### Purpose

Suggests branch-safe menu items to customers using purchase history, cart context, and branch-level recommendation telemetry.

### Backend Path

- Frontend route call: `POST /api/recommendations/menu`
- Telemetry route: `POST /api/recommendations/telemetry`
- NestJS service: [recommendation.service.ts](/C:/Users/support/Desktop/WS/GP/apps/api/src/modules/ai/recommendation.service.ts)
- FastAPI inference: `POST /recommendations/menu/infer`

### How It Is Implemented

Candidate generation in NestJS is deterministic:

- popular items
- frequently bought together
- reorder history
- time-based items
- available-item fallback

Optional reranking in FastAPI uses a lightweight ML scorer over features such as:

- rule score
- historical sales count
- co-purchase count
- reorder signal
- time signal
- impression, add-to-cart, and purchase counts
- cart size and user-context flags

### Built With

- NestJS
- Prisma
- FastAPI
- scikit-learn `GradientBoostingRegressor`

### Engine Controls

Per-branch controls exist for:

- `recommendationsEngine`
- `recommendationsConfidenceThreshold`
- `recommendationsTimeoutMs`
- `recommendationsFallbackEnabled`
- `recommendationsModelFamily`
- optional `recommendationsModelVersionPin`

Supported engine modes:

- `rules`
- `shadow`
- `ml`

### Request Shape

```ts
{
  tenantId?: string;
  branchId: string;
  userId?: string;
  sessionId?: string;
  cartItems: Array<{
    menuItemId: string;
    quantity: number;
  }>;
  limit?: number;
  surface?: "menu_home" | "cart" | "item_detail" | "checkout";
  trigger?: "empty_cart" | "cart_aware" | "no_history_fallback";
}
```

### Response Shape

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

### Fallbacks

- If FastAPI is unavailable, recommendations still work through deterministic strategies.
- If AI confidence is below the branch threshold, NestJS returns the deterministic ranking.
- If no strategy yields candidates, NestJS returns a branch-safe available-item fallback set.
- Telemetry failures are silent and do not block UI rendering or add-to-cart behavior.

### UI Location

- [RecommendedForYou.tsx](/C:/Users/support/Desktop/WS/GP/apps/web/src/components/recommendations/RecommendedForYou.tsx)
- rendered in:
  - [customer menu page](/C:/Users/support/Desktop/WS/GP/apps/web/src/app/customer/session/[sessionId]/menu/page.tsx)
  - [customer cart page](/C:/Users/support/Desktop/WS/GP/apps/web/src/app/customer/session/[sessionId]/cart/page.tsx)

## 3. Demand Forecasting

### Purpose

Predicts branch-level future order demand, revenue, item volume, hourly load, and ingredient demand for a selected date.

### Backend Path

- Frontend route call: `GET /api/admin/ai/demand-forecast`
- NestJS service: [demand-forecast.service.ts](/C:/Users/support/Desktop/WS/GP/apps/api/src/modules/demand-forecasting/demand-forecast.service.ts)
- FastAPI inference: `POST /forecast/demand`
- Optional hosted summary helper: [demand-forecast-llm.service.ts](/C:/Users/support/Desktop/WS/GP/apps/api/src/modules/demand-forecasting/demand-forecast-llm.service.ts)

### How It Is Implemented

- NestJS loads branch-scoped historical order data and menu/inventory mappings.
- NestJS chooses history windows and same-weekday sampling rules.
- FastAPI trains a Ridge regression model per item.
- NestJS validates ML output and computes:
  - expected orders
  - expected revenue
  - hourly demand
  - ingredient quantities
  - data-quality warnings
- A hosted LLM can optionally generate a narrative summary from the structured forecast.

### Built With

- NestJS
- Prisma
- FastAPI
- pandas
- numpy
- scikit-learn `Ridge`
- optional Hugging Face hosted summary path

### Request Shape

```ts
{
  branchId: string;
  date: string;
  categoryId?: string;
  kitchenStationId?: string;
  lookbackDays?: number;
  weatherAdjustment?: number;
  eventAdjustment?: number;
}
```

### Response Shape

```ts
{
  branchId: string;
  forecastDate: string;
  lookbackDays: number;
  expectedOrders: number;
  expectedRevenue: number;
  summaryText?: string;
  llmSummary?: string;
  aiFallbackMessage?: string;
  items: Array<{
    menuItemId: string;
    name: string;
    categoryName: string;
    expectedQuantity: number;
    expectedRevenue: number;
    confidence: "LOW" | "MEDIUM" | "HIGH";
    reason: string;
    sampleMode?: "SAME_WEEKDAY" | "RECENT_DAYS";
    quantitySold?: number;
    sampleDays?: number;
    sameWeekdaySalesDays?: number;
    priceUsed?: number;
    confidenceReason?: string;
  }>;
  hourlyDemand: Array<{
    hour: number;
    expectedOrders: number;
  }>;
  ingredients: Array<{
    inventoryItemId: string;
    name: string;
    unit: string;
    expectedQuantity: number;
  }>;
  dataQualityWarnings: Array<{
    code:
      | "LOW_SAMPLE_SIZE"
      | "SPARSE_HISTORY"
      | "NO_FORECASTABLE_ITEMS"
      | "ADJUSTMENT_FACTOR_APPLIED"
      | "FALLBACK_MODEL_USED";
    severity: "LOW" | "MEDIUM" | "HIGH";
    message: string;
  }>;
}
```

### Fallbacks

- If FastAPI ML fails, NestJS falls back to deterministic statistical forecasting.
- If the hosted summary fails, the forecast still returns with `summaryText` and may include `aiFallbackMessage`.
- Sparse or weak data is surfaced through `dataQualityWarnings` rather than hidden.

### UI Location

- [DemandForecastPanel.tsx](/C:/Users/support/Desktop/WS/GP/apps/web/src/components/admin/ai/DemandForecastPanel.tsx)
- rendered in:
  - [admin analytics page](/C:/Users/support/Desktop/WS/GP/apps/web/src/app/admin/analytics/page.tsx)
  - [admin dashboard page](/C:/Users/support/Desktop/WS/GP/apps/web/src/app/admin/dashboard/page.tsx)

## 4. Business Insights

### Purpose

Surfaces branch or tenant operational alerts such as low-stock pressure, pending service traffic, prep-time issues, refund spikes, review weakness, and branch comparisons.

### Backend Path

- Frontend route call: `GET /api/admin/ai/business-insights`
- NestJS service: [business-insights.service.ts](/C:/Users/support/Desktop/WS/GP/apps/api/src/modules/business-insights/business-insights.service.ts)
- FastAPI inference: `POST /business-insights/infer`
- FastAPI summary helper: `POST /business-insights/summarize`

### How It Is Implemented

- NestJS computes deterministic insight candidates from canonical data.
- Insight candidates include source metadata and trigger rules.
- FastAPI can rerank and reprioritize these candidates.
- A hosted summary helper can turn the structured insights into a concise manager-friendly summary.

### Built With

- NestJS
- Prisma
- FastAPI
- scikit-learn `IsolationForest`
- optional Hugging Face summary generation

### Engine Controls

- `businessInsightsEngine`
- `businessInsightsConfidenceThreshold`
- `businessInsightsTimeoutMs`
- `businessInsightsFallbackEnabled`
- `businessInsightsModelFamily`
- optional `businessInsightsModelVersionPin`

Supported engine modes:

- `rules`
- `shadow`
- `ml`

### Request Shape

Browser request:

```ts
{
  branchId?: string;
  from?: string;
  to?: string;
}
```

### Response Shape

```ts
{
  insights: Array<{
    id: string;
    category: "SALES" | "MENU" | "KITCHEN" | "INVENTORY" | "REVIEWS" | "OPERATIONS";
    priority: "HIGH" | "MEDIUM" | "LOW";
    title: string;
    description: string;
    recommendedAction?: string;
    metricValue?: string;
    sourceMetadata?: {
      sourceMetrics: string[];
      currentValue?: string | number;
      previousValue?: string | number;
      threshold?: string | number;
      triggerRule: string;
      confidence: "LOW" | "MEDIUM" | "HIGH";
      affectedBranchIds?: string[];
      engine?: "RULES" | "ML";
      modelVersion?: string;
      explanation?: string;
    };
  }>;
  generatedAt: string;
  scope: "BRANCH" | "TENANT";
  branchId?: string;
  from: string;
  to: string;
  summary: string;
  aiFallbackMessage?: string;
  engine?: "RULES" | "ML";
  modelVersion?: string;
  confidence?: "LOW" | "MEDIUM" | "HIGH";
}
```

### Fallbacks

- Deterministic insight generation is always available.
- If FastAPI inference fails or confidence is too low, NestJS returns deterministic insights.
- In `shadow` mode, deterministic insights are returned to the UI while AI rankings are kept as comparison metadata.
- If summary generation fails, insights still render and `aiFallbackMessage` can be shown.

### UI Location

- [business-insights-panel.tsx](/C:/Users/support/Desktop/WS/GP/apps/web/src/components/admin/ai/business-insights-panel.tsx)
- rendered in:
  - [admin analytics page](/C:/Users/support/Desktop/WS/GP/apps/web/src/app/admin/analytics/page.tsx)
  - [admin dashboard page](/C:/Users/support/Desktop/WS/GP/apps/web/src/app/admin/dashboard/page.tsx)

## 5. Review Sentiment

### Purpose

Analyzes review health for a branch or menu item over a time window and surfaces sentiment, common issues, affected items, trend changes, alerts, item complaint timelines, and suggested actions.

### Backend Path

- Frontend route call: `GET /api/admin/ai/review-sentiment`
- NestJS service: [review-sentiment.service.ts](/C:/Users/support/Desktop/WS/GP/apps/api/src/modules/reviews/review-sentiment.service.ts)
- FastAPI inference: `POST /review-sentiment/infer`
- FastAPI summary helper: `POST /review-sentiment/summarize`

### How It Is Implemented

- NestJS builds the authoritative review dataset and operational joins.
- NestJS computes deterministic baseline analytics.
- FastAPI can classify sentiment and reshape issue and affected-item outputs.
- NestJS validates the ML payload and either accepts it or falls back to the deterministic baseline.
- A summary helper can generate a polished narrative without changing the structured response contract.

### Built With

- NestJS
- Prisma
- FastAPI
- scikit-learn `TfidfVectorizer`
- scikit-learn `LogisticRegression`
- optional hosted summary path

### Engine Controls

- `reviewSentimentEngine`
- `reviewSentimentConfidenceThreshold`
- `reviewSentimentTimeoutMs`
- `reviewSentimentFallbackEnabled`
- `reviewSentimentModelFamily`
- optional `reviewSentimentModelVersionPin`

Supported engine modes:

- `rules`
- `shadow`
- `ml`

### Request Shape

```ts
{
  branchId: string;
  from: string;
  to: string;
  menuItemId?: string;
}
```

### Response Shape

```ts
{
  branchId: string;
  from: string;
  to: string;
  totalReviews: number;
  averageRating: number;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MIXED";
  summary: string;
  aiFallbackMessage?: string;
  commonIssues: Array<{
    issue: string;
    count: number;
    severity: "LOW" | "MEDIUM" | "HIGH";
  }>;
  affectedItems: Array<{
    menuItemId: string;
    name: string;
    averageRating: number;
    issueCount: number;
    topIssue?: string;
  }>;
  trend: {
    previousFrom: string;
    previousTo: string;
    previousTotalReviews: number;
    previousAverageRating: number;
    averageRatingDelta: number;
    reviewCountDelta: number;
    currentTopIssue?: string;
    previousTopIssue?: string;
    topIssueChanged: boolean;
    direction: "IMPROVING" | "DECLINING" | "STABLE" | "NO_PRIOR_DATA";
  };
  alerts: Array<{
    type: "ISSUE_SPIKE" | "RATING_DECLINE";
    severity: "MEDIUM" | "HIGH";
    message: string;
    issue?: string;
    currentCount?: number;
    previousCount?: number;
    countDelta?: number;
    ratingDelta?: number;
  }>;
  itemTimelines: Array<{
    menuItemId: string;
    name: string;
    totalIssueCount: number;
    direction: "IMPROVING" | "WORSENING" | "STABLE" | "INSUFFICIENT_DATA";
    points: Array<{
      from: string;
      to: string;
      reviewCount: number;
      averageRating: number;
      issueCount: number;
      topIssue?: string;
    }>;
  }>;
  operationalCorrelations: {
    reviewedOrderCount: number;
    lateIssueReviewCount: number;
    averageKitchenMinutes: number | null;
    lateReviewsAverageKitchenMinutes: number | null;
    averageReadyToServedMinutes: number | null;
    lateReviewsAverageReadyToServedMinutes: number | null;
    serviceRequestCount: number;
    lateReviewsServiceRequestCount: number;
    signal: "KITCHEN_DELAY" | "SERVICE_DELAY" | "BOTH" | "NONE" | "INSUFFICIENT_DATA";
    summary: string;
  };
  actionSuggestions: Array<{
    id: string;
    title: string;
    action: string;
    reason: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    relatedIssue?: string;
    menuItemId?: string;
    menuItemName?: string;
  }>;
  engine?: "RULES" | "ML";
  modelVersion?: string;
  confidence?: number;
}
```

### Fallbacks

- Deterministic review analytics always exist as the baseline.
- If FastAPI inference fails or confidence is too low, the backend returns the deterministic baseline.
- In `shadow` mode, the deterministic baseline remains the public response while AI output is kept for comparison and logging.
- If the summary helper fails, the structured review analytics still render and `aiFallbackMessage` can be shown.

### UI Location

- [ReviewSentimentPanel.tsx](/C:/Users/support/Desktop/WS/GP/apps/web/src/components/admin/ai/ReviewSentimentPanel.tsx)
- rendered in [admin analytics page](/C:/Users/support/Desktop/WS/GP/apps/web/src/app/admin/analytics/page.tsx)

## 6. SaaS AI Controls And Diagnostics

### Purpose

Gives the SaaS owner visibility into branch AI usage, fallback rates, and provider rejection pressure, and allows editing branch AI controls.

### Backend Path

- `GET /api/saas/ai/overview`
- `GET /api/saas/ai/branches`
- `GET /api/saas/ai/branches/:branchId`
- branch AI control DTOs and persistence in SaaS admin services

### Current UI Coverage

The current SaaS UI focuses on:

- menu-chat toggles
- hosted/fallback controls
- diagnostics
- preset application

The backend already supports per-feature engine settings for recommendations, business insights, and review sentiment through `BranchSettings.aiConfigJson`, even though the current SaaS UI does not yet expose all of those engine fields.

### UI Location

- [ControlsOwnerContent.tsx](/C:/Users/support/Desktop/WS/GP/apps/web/src/app/saas/internal/ControlsOwnerContent.tsx)
- rendered through [saas controls page](/C:/Users/support/Desktop/WS/GP/apps/web/src/app/saas/controls/page.tsx)
