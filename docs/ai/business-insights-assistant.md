# Business Insights Assistant MVP

## Purpose

The Business Insights Assistant turns operational restaurant data into short, manager-facing recommendations. It answers what matters, why it matters, and what action should be taken.

The MVP is rule/template-based inside the NestJS API. It does not call external AI and does not perform actions automatically.

## Where It Appears

- Admin dashboard: compact 3-card priority insight panel.
- Admin analytics page: detailed insight cards with date and scope controls.
- Future reports page: daily or weekly summary.
- Future franchise view: tenant-wide and branch comparison summaries.

## Endpoint

```http
GET /api/admin/ai/business-insights
```

The controller route is `admin/ai/business-insights`; the global API prefix supplies `/api`.

## Query Parameters

```ts
{
  branchId?: string;
  scope?: "BRANCH" | "TENANT";
  from: string;
  to: string;
}
```

Rules:

- `from` and `to` are required ISO date-only strings: `YYYY-MM-DD`.
- `from` must be before or equal to `to`.
- Date ranges are capped at 180 days.
- Default scope is `BRANCH`.
- `BRANCH` scope requires `branchId`.
- `TENANT` scope rejects `branchId` to avoid ambiguous requests.
- Tenant scope requires `OWNER` or `MANAGER`.
- Branch-bound staff cannot query another branch.

## Response Shape

```ts
{
  scope: "BRANCH" | "TENANT";
  branchId?: string;
  from: string;
  to: string;
  generatedAt: string;
  summary: string;
  insights: Array<{
    id: string;
    title: string;
    description: string;
    category: "SALES" | "MENU" | "KITCHEN" | "INVENTORY" | "STAFF" | "REVIEWS" | "TABLES";
    priority: "LOW" | "MEDIUM" | "HIGH";
    metric?: {
      label: string;
      value: string | number;
      comparison?: string;
    };
    recommendedAction: string;
    sourceMetadata?: {
      sourceMetrics: string[];
      currentValue?: string | number;
      previousValue?: string | number;
      threshold?: string | number;
      triggerRule: string;
      confidence: "LOW" | "MEDIUM" | "HIGH";
      affectedBranchIds?: string[];
    };
  }>;
}
```

## MVP Data Sources

- Sales: completed payments minus completed refunds.
- Orders: non-cancelled orders in the selected period.
- Menu: order items, active menu items, item quantity, and item revenue.
- Kitchen: order item `startedAt` and `readyAt` prep samples.
- Inventory: open low-stock alerts and active items below reorder level.
- Reviews: aggregate ratings and normalized review issue tags.
- Tables: completed sessions with start and end timestamps.

## Rule-Based Insight Logic

- Sales trend: compares selected revenue with the previous period of equal length; generates when absolute change is at least 10%.
- Top seller: identifies the top item by quantity when meaningful sales exist.
- Low performer: identifies active items with zero or very low sales.
- Kitchen delay: generates when average prep time is greater than 20 minutes.
- Inventory warning: generates when low-stock alerts, below-reorder items, or stockouts exist.
- Review insight: generates for low rating, mixed sentiment, or repeated complaint signals.
- Table/session insight: generates when average completed session duration is greater than 90 minutes.

Insights are sorted by priority, then category importance, then severity, and capped at 5.

Each generated insight includes deterministic source metadata so managers can see why the card exists. The metadata exposes source metric names, the current value, threshold, trigger rule, confidence, and affected branch IDs when scoped to a branch. It does not expose raw customer data.

## Summary Template Logic

The summary is deterministic:

- It mentions branch or tenant scope.
- It highlights a sales-positive signal when present.
- It highlights the strongest high-priority risk when present.
- If no insight is generated, it returns: `No major operational issues were detected for this period.`

## Tenant And Branch Safety

The endpoint never accepts `tenantId` from query parameters.

For branch scope, the API finds the branch by `branchId`, derives `tenantId`, and validates staff access against the authenticated staff context.

For tenant scope, the API uses `staff.tenantId` and queries only active branches in that tenant. Branch-bound roles cannot use tenant scope.

## Privacy Behavior

The response and audit log contain aggregate metrics only. They do not include:

- customer names
- phone numbers
- emails
- raw review comments
- item review comments
- order personal data

## Frontend Placement

`BusinessInsightsPanel` is mounted on:

- `apps/web/src/app/admin/dashboard/page.tsx` as a compact live dashboard block.
- `apps/web/src/app/admin/analytics/page.tsx` as detailed insight cards with date and scope controls.

Frontend calls NestJS only through the existing authenticated API helper.

## Audit Logging

`BusinessInsightLog` stores aggregate request metadata:

- tenant and optional branch
- requesting staff id
- scope and date range
- insight count
- generated categories and priorities
- aggregate metrics metadata

Log failures are non-blocking and do not break the admin response.

## MVP Limitations

- Rule/template-based only.
- No autonomous actions.
- Data quality depends on existing operational records.
- Kitchen insights require `OrderItem.startedAt` and `OrderItem.readyAt`.
- Some categories are skipped when the schema has no usable data.
- Tenant-wide comparisons are aggregate-only and do not yet rank branches.
- Staff performance insights are not emitted yet because MVP attribution is still limited.

## Future LLM Upgrade Path

- LLM rewriting of summaries after NestJS computes scoped metrics.
- Daily and weekly scheduled reports.
- Branch comparison rankings.
- Forecast-aware inventory insights.
- Sentiment-to-kitchen-delay correlation.
- Automated anomaly detection.
- Insight feedback tracking: useful/not useful.

FastAPI must not query the database. NestJS gathers scoped operational metrics first and sends only sanitized metrics and rule insights if future wording improvements are added.
