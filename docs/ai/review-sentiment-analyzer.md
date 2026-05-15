# Review Sentiment Analyzer

## Purpose

The Review Sentiment Analyzer helps owners and managers understand customer feedback quickly without exposing raw customer text. The MVP summarizes review quality, repeated complaints, affected menu items, and advisory sentiment using backend rule/statistical analysis.

No external AI, hosted LLM, or FastAPI call is used in the MVP.

## Where It Appears

- Admin analytics: review sentiment summary
- Reviews page: common complaints and affected items
- Menu performance page: items with repeated negative feedback
- Admin dashboard: aggregate insight cards such as the most common issue this week

Current UI status:

- `ReviewSentimentPanel` is mounted on admin analytics.
- `ReviewSentimentPanel` is mounted on admin dashboard.
- The panel includes a compact aggregate insight row: `Most common issue this period: ...`.

## Endpoint

`GET /api/admin/ai/review-sentiment`

The internal NestJS route is:

`GET /admin/ai/review-sentiment`

Example:

```http
GET /api/admin/ai/review-sentiment?branchId=seed-branch-1&from=2026-05-01&to=2026-05-07
```

## Query Parameters

```ts
{
  branchId: string;
  from: string;
  to: string;
  menuItemId?: string;
}
```

Rules:

- `branchId` is required.
- `from` and `to` are required ISO date strings in `YYYY-MM-DD` format.
- `from` must be before or equal to `to`.
- Date range is capped at 180 days.
- `menuItemId` is optional and must belong to the same tenant and requested branch scope.

## Response Shape

```ts
{
  branchId: string;
  from: string;
  to: string;
  totalReviews: number;
  averageRating: number;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MIXED";
  summary: string;
  commonIssues: {
    issue: string;
    count: number;
    severity: "LOW" | "MEDIUM" | "HIGH";
  }[];
  affectedItems: {
    menuItemId: string;
    name: string;
    averageRating: number;
    issueCount: number;
    topIssue?: string;
  }[];
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
  alerts: {
    type: "ISSUE_SPIKE" | "RATING_DECLINE";
    severity: "MEDIUM" | "HIGH";
    message: string;
    issue?: string;
    currentCount?: number;
    previousCount?: number;
    countDelta?: number;
    ratingDelta?: number;
  }[];
  itemTimelines: {
    menuItemId: string;
    name: string;
    totalIssueCount: number;
    direction: "IMPROVING" | "WORSENING" | "STABLE" | "INSUFFICIENT_DATA";
    points: {
      from: string;
      to: string;
      reviewCount: number;
      averageRating: number;
      issueCount: number;
      topIssue?: string;
    }[];
  }[];
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
  actionSuggestions: {
    id: string;
    title: string;
    action: string;
    reason: string;
    severity: "LOW" | "MEDIUM" | "HIGH";
    relatedIssue?: string;
    menuItemId?: string;
    menuItemName?: string;
  }[];
}
```

## MVP Sentiment Rules

Sentiment is rating-based first:

```ts
if (totalReviews === 0) sentiment = "NEUTRAL";
else if (averageRating >= 4.2) sentiment = "POSITIVE";
else if (averageRating < 3.2) sentiment = "NEGATIVE";
else sentiment = commonIssues.length > 0 ? "MIXED" : "NEUTRAL";
```

`averageRating` is rounded to 2 decimals.

## Common Issue Logic

The MVP uses normalized `ReviewIssueTag` rows. It does not extract complaints from raw review text.

- Issue tags are normalized to lowercase display labels.
- Counts are aggregated across reviews in the selected branch/date range.
- Top 5 issues are returned.
- Severity:
  - `HIGH`: count >= 10
  - `MEDIUM`: count >= 4
  - `LOW`: count < 4

## Affected Item Logic

The current schema supports `ItemReview`, so affected items are calculated from item-level ratings and review issue tags.

Affected item signals:

- item rating `<= 3`
- review issue tags associated with an item review

For each affected item, the service returns:

- item name
- average item rating
- issue count
- top issue where tags exist

Items are sorted by issue count descending, then average rating ascending. The response returns the top 10 items.

## Item Complaint Timeline Logic

The analyzer also returns aggregate per-item complaint timelines for the top affected menu items.

- The selected date range is split into up to 4 deterministic buckets.
- Each bucket includes item-level review count, average item rating, issue count, and top issue.
- Issue signals use the same affected item rules: item rating `<= 3` or normalized review issue tags.
- Direction is calculated from the first and last active timeline buckets:
  - `WORSENING`: issue count increases meaningfully, or complaints increase while rating drops.
  - `IMPROVING`: issue count decreases meaningfully, or complaints decrease while rating improves.
  - `STABLE`: enough data exists but no meaningful movement is detected.
  - `INSUFFICIENT_DATA`: fewer than two active buckets have item-level review data.
- The response returns the top 5 item timelines by total issue count.
- Raw review comments and item review comments are not used.

## Operational Correlation Logic

The analyzer correlates late complaint tags with operational timing signals from reviewed orders.

Inputs:

- order creation time
- first `READY` status timestamp, with item `readyAt` as a fallback
- first `SERVED` status timestamp
- service requests created between order creation and review creation
- normalized `late` review issue tags

Returned aggregate fields include:

- reviewed order count
- late-complaint review count
- average kitchen minutes for all reviewed orders and late-complaint orders
- average ready-to-served minutes for all reviewed orders and late-complaint orders
- service request counts for all reviewed orders and late-complaint orders
- deterministic signal: `KITCHEN_DELAY`, `SERVICE_DELAY`, `BOTH`, `NONE`, or `INSUFFICIENT_DATA`

No staff names, customer data, raw comments, or individual order identifiers are returned.

## Action Suggestion Logic

The analyzer returns deterministic manager action suggestions based on existing aggregate signals:

- late complaints plus kitchen delay -> review prep workflow and KDS timing
- late complaints plus service delay -> tighten ready-to-served handoff
- affected item with repeated issue signals -> inspect recipe, plating, and service consistency
- worsening item timeline -> compare recent preparation and service notes
- issue spike or rating decline alert -> investigate the affected period

Suggestions are template-based. They do not use raw review text, item review comments, customer personal data, staff names, or individual order IDs.

## Summary Template Logic

The summary is template-generated and explainable.

Examples:

- No reviews: `No customer reviews were found for this period.`
- Positive: `Customer feedback is positive for this period. Average rating is 4.5 across 12 reviews.`
- Mixed/negative summaries include the top one or two issues when available.
- Affected item names are appended when item-level signals exist.
- When prior-period data exists, the summary appends whether average rating improved, declined, or stayed stable.

## Trend Logic

The service automatically compares the selected date range to the immediately previous range of the same length.

Example:

- selected range: `2026-05-01` to `2026-05-07`
- previous range: `2026-04-24` to `2026-04-30`

Trend fields include:

- previous review count
- previous average rating
- rating delta
- review count delta
- current and previous top issue
- whether the top issue changed
- direction:
  - `NO_PRIOR_DATA`: previous range has no reviews
  - `IMPROVING`: rating delta is at least `+0.10`
  - `DECLINING`: rating delta is at most `-0.10`
  - `STABLE`: rating delta is between `-0.09` and `+0.09`

## Alert Logic

The analyzer returns deterministic aggregate alerts when the selected period shows a meaningful complaint or rating risk.

- `ISSUE_SPIKE`: returned when a normalized issue has at least 3 current mentions, increased by at least 2 mentions, and doubled versus the previous period.
- `RATING_DECLINE`: returned when the previous period has reviews and average rating declined by at least 0.50 points.
- Alert severity is `HIGH` for large issue spikes or rating declines of at least 1.00 point; otherwise it is `MEDIUM`.
- Alerts use only aggregate issue counts and rating deltas. They do not include raw review text or customer data.

## Tenant/Branch Safety

The service derives tenant scope from the requested branch:

```ts
where: {
  tenantId: branch.tenantId,
  branchId: branch.id
}
```

Access rules:

- Staff tenant must match the branch tenant.
- Branch-bound staff can inspect only their own branch.
- Owners and managers can inspect branches inside the same tenant.
- Cross-tenant review analysis is rejected.

## Privacy Behavior

- Response contains aggregates only.
- Raw review comments are not returned.
- Item review comments are not returned.
- Customer names, phone numbers, emails, and order personal data are not returned.
- The MVP does not call external AI services.
- Review sentiment audit logs store aggregate metadata only.
- Review sentiment audit logs do not store raw review comments or customer personal data.

## Audit Logging

`ReviewSentimentLog` records aggregate request and result metadata:

- tenant and branch
- optional requesting staff ID
- requested date range
- optional menu item filter
- total review count
- average rating
- sentiment label
- common issue aggregates
- affected item aggregates
- alert aggregates inside the common issue metadata
- item complaint timeline aggregates inside the affected item metadata
- operational correlation aggregates inside the affected item metadata

Logging is non-blocking. If the log write fails, the admin response still succeeds.

## Demo Data

The seed script creates deterministic review sentiment demo data for `seed-branch-1`:

- 7 completed demo orders
- overall review ratings
- normalized issue tags such as `LATE`, `COLD`, and `WRONG_ITEM`
- item-level reviews for Classic Burger, Spaghetti Carbonara, Cola, and Fresh Orange Juice
- previous-period reviews so the admin panel can show a real trend

The seeded records are reset and recreated on each seed run using fixed IDs, so the demo output remains repeatable.

## Verification

Focused coverage exists for:

- backend review sentiment service and tenant/branch isolation
- frontend review sentiment panel controls
- authenticated API request URL
- summary cards
- common issue rendering
- affected item rendering
- compact insight row
- previous-period trend rendering
- deterministic complaint/rating alert rendering
- aggregate item complaint timeline rendering
- aggregate operational correlation rendering
- empty state
- error state

## MVP Limitations

- Rule/statistics-based only.
- No deep natural-language sentiment detection.
- Issue detection depends on existing `ReviewIssueTag` rows.
- Affected item detection depends on existing `ItemReview` rows.
- Raw review text is not used by default for privacy and safety.
- Audit logs currently store one aggregate snapshot per request, not trend rollups.
- Item complaint timelines are bucketed aggregates, not a full historical time-series store.
- Operational correlation is advisory and deterministic; it does not prove causation.

## Future Upgrades

- LLM-generated sanitized summaries after deterministic analysis.
- Multilingual Arabic/English review understanding.
- Keyword extraction from sanitized text.
- Topic clustering.
- Sentiment trend over time.
- Deeper staff/service/kitchen delay drilldowns with stronger minimum sample thresholds.
