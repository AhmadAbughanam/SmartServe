# AI Improvements Roadmap

This document tracks future improvements for the Smart Restaurant OS AI features without weakening backend boundaries, tenant isolation, or auditability.

## Current AI Features

- Feature 1: Menu Recommendation Engine
- Feature 2: Menu Chatbot Assistant
- Feature 3: Demand Forecasting Engine
- Feature 4: Review Sentiment Analyzer
- Feature 5: Business Insights Assistant

The current rule is unchanged: frontend clients call NestJS only. External AI services, hosted LLMs, or FastAPI boundaries may assist only behind backend orchestration.

## Cross-Feature Principles

- Keep deterministic business numbers in NestJS.
- Never let an LLM invent prices, quantities, revenue, stock levels, allergen claims, or permissions.
- Derive tenant and branch scope from trusted backend data.
- Log AI inputs and outputs in tenant-scoped audit records.
- Prefer simple statistical or rule-based logic before advanced ML.
- Treat LLM output as optional explanation, summarization, or copy polishing.
- Keep fallback behavior deterministic when AI providers fail.

## Demand Forecasting Improvements

Implemented improvement:

- Forecast item reasons are now item-specific and short: units sold, sample basis, and forecast quantity in a manager-friendly sentence.

Implemented Phase 4 & 5 state:

- Forecast item reasons include structured explanation metadata.
- Backend generates a deterministic summary card text for expected orders, revenue, and peak hour.
- Forecasts utilize `Branch.timezone`.
- Forecast accuracy is tracked against actual sales daily via the `DemandForecastAccuracy` model and cron job.
- Recency-weighted averages apply linear decay (newer sales days receive higher weight).
- Explicit multiplier factors for weather and events are included in the query and UI.
- Expected quantities are mapped to an `IngredientForecast` using `MenuItemInventoryMap`.
- Kitchen station dropdown filters demand forecasts explicitly for KDS planning.

Implemented Phase 6 state:

- `DemandForecastLlmService` uses Hugging Face to rewrite deterministic metrics into a short narrative.
- Backend calls the LLM securely after computing exact numbers and explicitly sets timeouts.
- The UI surfaces the `llmSummary` directly within `DemandForecastPanel`.
- Numbers and calculations remain purely deterministic.

Implemented Phase 7 state:

- FastAPI `ai-services` hosts a Ridge regression time-series model for forecasting.
- NestJS acts as the secure boundary, passing sanitized historical data to FastAPI.
- NestJS successfully applies an explicit multiplier factor to the AI-optimized result.
- NestJS gracefully falls back to the deterministic recency-weighted statistical model if the ML service is unavailable.
- Tests updated to verify accurate predictions and fallback capabilities.
- `ai` service added to local `docker-compose.yml`.
- Per-category forecasts grouping has been implemented in the UI and mounted directly on the dashboard.

Implemented data-quality warnings state:

- Demand forecasts now return deterministic `dataQualityWarnings`.
- Warnings cover low matching weekday sample size, sparse historical order data, no forecastable items, weather/event multiplier impact, and fallback-model usage.
- The admin forecast panel surfaces these warnings before the forecast cards.
- Demand forecast audit metadata records the warnings and whether the fallback model was used.

Do not upgrade demand forecasting to LLM-driven quantity prediction. If advanced forecasting is needed, use a time-series model behind the NestJS boundary and keep the result auditable.

## Review Sentiment Analyzer Plan

Feature 4 should be built as a review-domain analytics feature with a protected admin route:

- canonical endpoint: `GET /api/admin/ai/review-sentiment`
- internal NestJS route: `GET /admin/ai/review-sentiment`
- frontend calls NestJS only
- no FastAPI, hosted LLM, or external AI call in the MVP
- raw review text and customer personal data are not exposed

Refinements before implementation:

- Keep the protected admin endpoint separate from public customer review endpoints.
- Make auth context explicit in the service signature, so access checks use trusted staff tenant, branch, role, and permissions.
- Derive tenant scope from `Branch.tenantId`; never trust a client-supplied tenant ID.
- Validate `menuItemId` inside the same tenant and requested branch scope before filtering.
- Prefer normalized `ReviewIssueTag` and `ItemReview` data; do not keyword-scan raw review comments in the MVP.
- If issue tags or item review relationships are missing in a future schema, return empty aggregate arrays and document the limitation.
- Keep summaries template-based and explainable.
- Only record memory entries for behavior actually implemented.

Phase 1 deliverables:

- shared review sentiment contracts
- query/response DTOs
- protected admin controller
- `ReviewSentimentService`
- tenant/branch-scoped Prisma queries
- rating-based sentiment classification
- common issue counting
- affected item detection
- template summary generation
- backend tests
- documentation
- memory checkpoint

Phase 2 deliverables:

- admin analytics and dashboard UI panel
- API client integration
- branch/date/menu item controls
- loading, empty, and error states
- aggregate-only summary cards, common issue table, and affected item table
- frontend tests if the current test setup supports them

Implemented Phase 2 state:

- `ReviewSentimentPanel` is mounted on admin analytics and admin dashboard.
- The panel uses the existing global admin branch context, local date range controls, and optional menu item filter.
- The panel calls only `GET /api/admin/ai/review-sentiment` through the authenticated NestJS API client.
- The UI renders total reviews, average rating, sentiment, top complaint, template summary, common issues, and affected items.
- The UI shows loading, error, no-review, no-issue, and no-affected-item states.
- No raw review text or customer personal data is displayed.

Phase 3 hardening and demo readiness:

- Add deterministic seed data for demo review sentiment output.
- Add stable frontend test hooks for the panel.
- Add focused Playwright coverage for controls, request URL, summary cards, common issues, affected items, loading, empty, and error states.
- Add a compact aggregate insight row using the same sentiment endpoint response.
- Keep raw review text hidden from all admin sentiment UI.

Implemented Phase 3 state:

- `apps/api/prisma/seed.ts` creates 5 deterministic review sentiment demo reviews for `seed-branch-1`.
- `ReviewSentimentPanel` exposes stable `data-testid` hooks and a compact `Most common issue this period` insight row.
- `e2e/15-review-sentiment-panel.spec.ts` verifies the panel against mocked API responses.

Phase 4 operational traceability:

- Add aggregate-only audit logging for review sentiment requests.
- Store tenant, branch, requesting staff, date range, menu item filter, total reviews, average rating, sentiment, common issue aggregates, and affected item aggregates.
- Do not store raw review comments, item review comments, customer names, phone numbers, emails, or order personal data.
- Keep log writes non-blocking.
- Extend backend tests for log creation, log privacy, and log failure tolerance.

Implemented Phase 4 state:

- Added `ReviewSentimentLog` Prisma model and migration.
- `ReviewSentimentService` writes aggregate-only logs asynchronously.
- Focused backend test verifies log creation, privacy, and response success when logging fails.

Phase 5 sentiment trends and menu performance integration:

- Compare the selected review range to the immediately previous range of the same length.
- Add trend fields for previous review count, previous average rating, rating delta, review count delta, top issue change, and trend direction.
- Surface the trend in `ReviewSentimentPanel`.
- Label affected items as repeated negative feedback by menu item so the sentiment result connects directly to menu performance.
- Keep the logic deterministic and tenant/branch scoped.

Implemented Phase 5 state:

- Shared review sentiment response now includes `trend`.
- `ReviewSentimentService` fetches previous-period reviews with the same tenant, branch, date, and optional menu item scope.
- Summary text includes rating trend language when prior data exists.
- `ReviewSentimentPanel` renders a rating trend card and previous-period trend row.
- Demo seed data includes previous-period reviews for visible trend output.
- Focused backend and Playwright tests cover trend output.

Phase 6 deterministic sentiment alerts:

- Add aggregate-only alerts for complaint spikes and sharp rating declines.
- Compare current issue counts and average rating against the previous matching period already used by trend analysis.
- Surface alerts in `ReviewSentimentPanel` without raw review text or customer personal data.
- Store only aggregate alert metadata with review sentiment audit logs.

Implemented Phase 6 state:

- Shared review sentiment response now includes `alerts`.
- `ReviewSentimentService` emits `ISSUE_SPIKE` and `RATING_DECLINE` alerts from normalized issue counts and rating deltas.
- Template summaries append the top alert when one exists.
- `ReviewSentimentPanel` renders a deterministic sentiment alerts section with empty state.
- Focused backend and Playwright tests cover alert output.

Phase 7 per-item complaint timelines:

- Add per-item aggregate complaint timelines for the top affected menu items.
- Split the selected date range into deterministic buckets and report review count, average item rating, issue count, and top issue per bucket.
- Add a deterministic direction label for improving, worsening, stable, or insufficient data.
- Keep timeline data aggregate-only and avoid raw review text, item review comments, and customer personal data.

Implemented Phase 7 state:

- Shared review sentiment response now includes `itemTimelines`.
- `ReviewSentimentService` builds top affected item timelines from scoped `ItemReview` and normalized `ReviewIssueTag` signals.
- Template summaries mention worsening item-level complaint signals when present.
- `ReviewSentimentPanel` renders item complaint timeline cards with bucket-level aggregate points.
- Focused backend and Playwright tests cover item timeline output.

Phase 8 operational correlation:

- Correlate late complaint tags with aggregate order timing and service request signals.
- Use order creation time, first ready status or item ready timestamps, served status, and service requests created during the reviewed order window.
- Return only aggregate timing and count fields; do not expose customer data, raw comments, staff names, or individual order IDs.
- Surface the correlation in `ReviewSentimentPanel`.

Implemented Phase 8 state:

- Shared review sentiment response now includes `operationalCorrelations`.
- `ReviewSentimentService` computes reviewed order count, late complaint count, kitchen timing averages, ready-to-served timing averages, service request counts, and deterministic correlation signal.
- Template summaries append operational correlation language when a kitchen/service signal is detected.
- `ReviewSentimentPanel` renders an operational correlation section with aggregate metrics.
- Focused backend and Playwright test data cover operational correlation output.

Implemented action suggestion state:

- Shared review sentiment response now includes deterministic `actionSuggestions`.
- Suggestions are generated from existing aggregate alerts, affected items, item timelines, sentiment trend, and operational correlation signals.
- The admin Review Sentiment panel renders suggested actions without exposing raw review text, item review comments, customer data, staff names, or individual order IDs.
- Review sentiment audit logs store only aggregate suggestion metadata.

## Menu Recommendation Improvements

Current implementation is rule-based and backend-scoped.

Implemented MVP improvements:

- Shared recommendation contracts exist in `packages/shared-types`.
- Canonical customer endpoint is `POST /api/recommendations/menu`.
- `RecommendationLog` records tenant, branch, optional user, optional session, input cart item IDs, recommended item IDs, recommendation types, metadata, and timestamp.
- Main customer menu page includes a reusable `RecommendedForYou` section when category is `All` and search is empty.
- Cart page includes the same component as `Popular with this order`.
- Recommendation engine supports:
  - `POPULAR`: recent completed branch order history
  - `FREQUENTLY_BOUGHT`: co-purchases with current cart items
  - `REORDER`: previous customer items in the same tenant and branch when user/session context is available
  - `TIME_BASED`: older same-hour/same-day sales signals
- Recommendation tests cover tenant/branch isolation, cart exclusion, inactive/unavailable filtering, strategy output, score sorting, validation failures, and audit log creation.
- Recommendation endpoint remains canonical at `POST /api/recommendations/menu`.
- Frontend calls only NestJS and never calls FastAPI or hosted AI services.
- Recommendation output is filtered by tenant, branch, active status, availability, and cart exclusion.

Recommended next improvements:

- Add a no-history fallback for new/demo branches:
  - recommend active and available menu items only from the requested tenant and branch
  - either reuse an existing type with clear reason text or extend the shared `RecommendationType` contract with a new explicit fallback type
  - make fallback use visible in audit metadata
- Add authenticated customer context to the frontend request when available:
  - store customer `user.id` after OTP verification
  - send `userId` only when trusted or derive it from backend session/auth context
  - prefer backend-derived user identity over client-supplied user IDs for production
- Add a `RecommendationInteraction` or equivalent analytics table, separate from `RecommendationLog`, so audit logs stay durable while product analytics can be aggregated.
- Add per-branch popularity caching with Redis.
- Add recency weighting so recent sales matter more than old sales.
- Add branch timezone support before production time-based recommendations.
- Add category-aware recommendation diversity.
- Add cart-aware balancing:
  - avoid recommending only items from one category
  - suggest drinks/sides/desserts when the cart has mains
- Add deterministic pairing rules for low-data branches:
  - main -> drink
  - main -> side/starter
  - spicy item -> drink
  - dessert -> coffee/drink
- Add user preference weighting from `User.preferencesJson`.
- Add review-aware ranking when item review volume is sufficient.
- Add promotion-aware ranking without hiding that the recommendation is promotion-influenced.
- Add A/B testing by recommendation strategy.
- Add admin controls:
  - enable or disable recommendations per tenant/branch
  - tune max recommendation count
  - turn strategies on/off
  - inspect audit samples for a recommendation request
- Later, add ML ranking behind NestJS:
  - candidate generation remains backend-scoped
  - ML only ranks allowed candidates
  - NestJS filters inactive, unavailable, cross-tenant, and cart items after ML output

LLM usage should be limited to rewriting recommendation explanations into natural language. It should not choose items unless the backend has already provided the allowed candidate set.

Implemented Metadata & Telemetry state:

- `RecommendationMetadata` shared type now includes strategy source, historical sales count, co-purchase count, time-of-day signal, reorder signal, and score contribution per strategy.
- `RecommendationLog` now captures the explicit `surface`, `trigger`, `candidatePoolSize`, and `fallbackUsed` attributes to explain the recommendation context.
- A new `RecommendationInteraction` Prisma model captures `IMPRESSION`, `CLICK`, `ADD_TO_CART`, `PURCHASED`, and `DISMISSED` events with a `surface` tag.
- The `RecommendedForYou` UI component automatically transmits telemetry data on load (`IMPRESSION`) and on click (`ADD_TO_CART`).

Implemented Recency Weighting state:

- Recency weighting now applies linear decay to recommendation scores across all strategies.
- `POPULAR` and `FREQUENTLY_BOUGHT` strategies weight 30-day-old orders at 0.5x vs recent orders at 1.0x.
- `REORDER` strategy dynamically weights older customer orders across a 90-day window.
- `TIME_BASED` strategy dynamically weights historical sales at the same time of day across a 60-day window.
- Forecasting also implements recency-weighted linear decay for daily sample sales.

## Menu Chatbot Improvements

Current implementation is backend-grounded with local safe rules, recommendation fallback, and optional hosted LLM/FastAPI boundaries.

Implemented MVP improvements:

- Canonical customer endpoint is `POST /api/ai/menu-chat`.
- Frontend chat calls only NestJS.
- NestJS fetches branch-scoped menu data and sends only sanitized context to AI boundaries.
- Hugging Face LLM boundary is optional and configured with backend-only `HF_TOKEN`, `HF_MODEL`, and `HF_BASE_URL`.
- FastAPI boundary remains optional and receives only sanitized menu context.
- LLM/FastAPI suggested item IDs are filtered against active and available current-branch menu items.
- Unknown/off-script questions fall back to grounded active menu items instead of leaving the chat empty.
- Frontend chat request has a timeout so loading cannot stay forever.
- Allergen and strict dietary answers remain conservative when structured data is missing.
- `MenuChatLog` stores intent/hash/preview/suggested IDs/provider metadata without storing full free text.

Recommended next improvements:

- Add stricter structured response validation for any LLM output:
  - validate reply length
  - validate JSON shape
  - validate safety note count
  - reject unsupported claims about discounts, policies, calories, or allergens
- Add provider health diagnostics:
  - missing token
  - unsupported model
  - HTTP status/error preview without secrets
  - timeout count
  - fallback count
- Expand intent coverage:
  - budget-friendly
  - kids meal
  - high protein
  - low calorie if nutrition data is later added
  - preparation time
  - ingredient-specific exclusions
- Add conversation memory inside a single session, scoped to branch and session.
- Add staff escalation when the question cannot be answered safely.
- Add Arabic/English multilingual responses with explicit language detection.
- Add tenant-configurable tone and response length.
- Add richer safety rules for allergens:
  - answer only from structured allergen fields
  - otherwise advise asking staff
- Add admin controls for:
  - enabling/disabling hosted LLM per tenant
  - selecting provider/model
  - setting maximum response length
  - setting assistant tone
- Add cost and rate controls:
  - per-tenant daily request limits
  - provider timeout thresholds
  - fallback-only mode

LLM output must remain filtered against active and available branch menu items.

Implemented Phase 1 hardening:

- Shared menu chat response contracts now support staff escalation fields.
- Hosted LLM/FastAPI menu-chat outputs are rejected when they have invalid shape, excessive reply/safety-note/reason length, too many suggestions, unknown item IDs, cart item suggestions, or unsupported claims about discounts, policies, nutrition, prices, or allergens.
- Provider rejection diagnostics are stored in `MenuChatLog.metadata.providerRejectionReason` without storing full customer free text.
- Deterministic intent coverage now includes not-spicy, budget-friendly, kids meal, high-protein, fast-prep, ingredient-exclusion, dessert, and drink requests.
- Allergen and ingredient-exclusion responses can flag `requiresStaffHelp` so the customer UI can offer staff confirmation.
- The menu chat sheet now shows all safety notes and can create a waiter call request when staff confirmation is needed.

Implemented Phase 2 session memory:

- Menu chat now stores compact `conversationMemory` in `MenuChatLog.metadata` for session-scoped follow-up behavior.
- Memory is scoped by tenant, branch, and session, and stores only structured data: last intent, dietary constraints, avoided ingredients, preferred attributes, last suggested item IDs, turn count, and update timestamp.
- Follow-up messages such as "Anything else?" can reuse the previous intent without storing full chat transcripts.
- Follow-up suggestions avoid repeating the previous suggestion set and apply remembered constraints such as vegetarian, dairy-free, not-spicy, and avoided ingredients.
- Provider context is filtered with the same memory constraints before optional hosted LLM/FastAPI calls.

Implemented Phase 3 staff escalation:

- Shared menu chat contracts now define explicit staff-help reason codes for allergen uncertainty, ingredient uncertainty, policy/payment questions, custom preparation, and no safe menu match.
- Backend staff-escalation responses now use a single helper so `requiresStaffHelp`, `staffHelpReason`, and safety notes are consistent.
- Payment, discount, policy, reservation, hours, Wi-Fi, parking, service-charge, and tip questions are escalated instead of answered by the menu assistant.
- Custom preparation and substitution questions are escalated instead of inventing kitchen capabilities.
- Staff-help metadata is written to `MenuChatLog.metadata` for auditability.
- The customer menu chat sheet now labels the ask-staff action based on the escalation reason.

Implemented Phase 4 multilingual support:

- Shared menu chat responses now include `language` with `en` or `ar`.
- NestJS detects Arabic script before intent handling and keeps the frontend-to-NestJS-only AI boundary unchanged.
- Deterministic menu-chat replies now have Arabic templates for recommendations, spicy/not-spicy, vegetarian, light, budget, kids, high-protein, fast-prep, dessert, drinks, allergen safety, policy/payment escalation, custom-preparation escalation, and fallback text.
- Arabic keyword matching covers the same main deterministic intent families without relying on hosted LLMs.
- Optional hosted LLM requests receive the detected language and are instructed to keep item names unchanged while writing prose in the requested language.
- Menu chat logs include detected response language in metadata.

Implemented Phase 5 admin and cost controls:

- Added `BranchSettings.aiConfigJson` for branch-scoped menu assistant controls.
- Admin branch settings can now configure menu chat enablement, hosted LLM enablement, fallback-only mode, daily hosted request limit, and max reply length.
- The backend enforces these controls before optional Hugging Face/FastAPI calls.
- Disabled menu chat returns a deterministic disabled response and does not suggest items.
- Fallback-only mode skips hosted providers while keeping deterministic menu answers available.
- Daily hosted request limits are counted from tenant/branch-scoped `MenuChatLog` rows where `usedAiService=true`.
- Menu chat log metadata records the applied control mode for auditability.

Implemented Phase 6 operational diagnostics:

- Added protected `GET /api/admin/ai/menu-chat/diagnostics` for aggregate-only menu chat diagnostics.
- Diagnostics are tenant/branch scoped from authenticated staff and reject cross-tenant branch access.
- The endpoint returns request totals, hosted-provider usage, fallback counts, staff-help counts, provider rejection reasons, response languages, control modes, current controls, and latest activity time.
- Diagnostics intentionally do not select or return raw message text, message previews, message hashes, customer names, phone numbers, or emails.
- Admin Settings now includes a compact Menu Assistant Diagnostics panel for the selected branch.

Implemented Phase 7 rate and timeout hardening:

- Branch `aiConfigJson` now supports total daily menu-chat request limits, per-session hourly request limits, and hosted-provider timeout settings.
- The backend enforces request limits before response generation and logs the applied control mode.
- Rate-limited responses are deterministic, tenant/branch scoped, and return no menu suggestions.
- Hosted Hugging Face and FastAPI menu-chat calls now use the configured provider timeout with bounded minimum and maximum values.
- Admin Settings exposes daily request, session hourly request, hosted request, provider timeout, and max reply length controls.

Implemented Phase 8 response shaping controls:

- Branch `aiConfigJson` now supports `assistantTone` (`concise`, `friendly`, or `formal`) and `maxSuggestions`.
- The backend shapes final menu-chat responses after deterministic/provider generation, enforcing max reply length and max suggestion count before returning to the customer.
- Deterministic replies can be lightly tone-adjusted in English and Arabic while preserving menu grounding.
- Optional hosted provider requests receive the requested tone so rewriting stays aligned with branch settings.
- Admin Settings exposes assistant tone and max suggestion controls.

## Analytics And Management AI Improvements

Future management insights should start as deterministic analytics:

- unusual refund volume
- unusual cancellation rate
- low-stock risk
- slow kitchen station
- top margin items when cost data exists
- low-selling but highly rated items

Optional LLM usage:

- summarize already-computed insights
- turn metrics into owner-friendly recommendations
- draft action items

LLM must not query the database directly and must not bypass tenant/branch scoping.

## Business Insights Assistant Improvements

Current MVP state:

- Canonical admin endpoint is `GET /api/admin/ai/business-insights`.
- Frontend calls only NestJS.
- The MVP is a backend rule/template engine with no external AI call.
- Business insights are advisory only and never perform actions automatically.
- Shared contracts exist in `packages/shared-types`.
- `BusinessInsightsService` gathers tenant/branch-scoped operational metrics from existing data.
- Supported MVP insight categories:
  - sales trend
  - top-selling menu item
  - low-performing active menu items
  - kitchen prep delays
  - inventory low-stock warnings
  - review complaint/rating signals
  - table/session turnover signal
- The endpoint supports:
  - `BRANCH` scope with required `branchId`
  - `TENANT` scope for owner/manager-style roles
  - strict date validation
  - max 180-day date range
  - max 5 prioritized insights
- `BusinessInsightLog` stores aggregate-only request metadata.
- Dashboard shows a compact snapshot only.
- Analytics shows the full insight cards with metrics and recommended actions.
- Raw review comments and customer personal data are not returned or logged.

Recommended next improvements:

- Add structured source metadata per insight:
  - `sourceMetrics`
  - `currentValue`
  - `previousValue`
  - `threshold`
  - `triggerRule`
  - `confidence`
  - `affectedBranchIds`
- Add branch comparison cards for tenant scope:
  - best-performing branch by revenue
  - weakest branch by revenue trend
  - slowest kitchen branch
  - branch with most low-stock warnings
  - branch with lowest review rating
- Add branch ranking only after enough branch data exists, and keep rankings tenant-scoped.
- Add daily and weekly scheduled summaries:
  - generate and store summary snapshots
  - send owner/manager report notifications
  - keep reports aggregate-only
  - allow re-generation for a fixed date range
- Add trend-aware insights:
  - repeated kitchen delay over multiple periods
  - recurring inventory issue
  - repeated low-performing menu item
  - review rating decline over several periods
  - sales recovery after a previous decline
- Add cross-signal correlation rules:
  - late review complaints plus high prep time
  - low inventory plus top-selling item dependency
  - sales drop plus high cancellation rate
  - long table sessions plus checkout/payment delay
- Add forecast-aware insights using the Demand Forecasting Engine:
  - expected high demand plus low inventory
  - expected high demand plus historically slow prep items
  - forecasted top item with current stock risk
  - low confidence forecast warning when historical data is sparse
- Add menu optimization insights:
  - low-selling but highly rated items
  - high-selling but poorly rated items
  - top item dependency risk
  - active item with zero sales across repeated periods
  - category-level underperformance
- Add staff/operations insights when attribution improves:
  - service request response time
  - shift coverage vs order volume
  - repeated delayed handoff after kitchen ready
  - cashier checkout bottleneck
- Add anomaly detection:
  - unusual refund spike
  - unusual cancellation spike
  - unusual discount usage
  - sudden sales drop
  - sudden review rating drop
  - abnormal prep time by station or hour
- Add insight feedback tracking:
  - useful/not useful
  - dismissed
  - action taken manually
  - snoozed until later
  - surfaced again after recurrence
- Add admin controls:
  - enable/disable Business Insights per tenant
  - configure thresholds by branch
  - configure dashboard snapshot count
  - configure report frequency
  - hide categories that are not relevant for a tenant
- Add optional LLM rewriting after deterministic insight generation:
  - input: sanitized metrics and rule-generated insights only
  - output: shorter summary or clearer wording
  - NestJS validates category, priority, metric, and action shape after LLM output
  - fallback to deterministic wording when provider fails
- Add multilingual summaries:
  - English and Arabic owner summaries
  - deterministic fallback text for both languages
  - no customer personal data in prompt or output
- Add richer audit metadata:
  - insight ids generated
  - skipped categories and reasons
  - data quality warnings
  - provider used for optional rewriting
  - fallback reason if LLM rewriting fails
- Add report export integration:
  - PDF/CSV weekly business summary
  - branch comparison table
  - action checklist
  - aggregate-only metrics

Implemented source metadata state:

- Business insights now include structured `sourceMetadata` per generated insight.
- Metadata includes source metrics, current value, threshold, trigger rule, confidence, and affected branch IDs when branch-scoped.
- The admin Business Insights panel surfaces trigger, confidence, current value, and threshold for explainability.
- Metadata remains deterministic and does not expose raw customer data.

Future FastAPI role:

- FastAPI may rewrite summaries or cluster already-sanitized insight text.
- FastAPI must not query the database.
- NestJS must gather scoped metrics first.
- NestJS must send only sanitized metrics and rule insights.
- NestJS must validate returned text before sending it to the frontend.

Do not upgrade Business Insights into an autonomous agent. It may recommend actions, but owners/managers must decide and execute operational changes.

## Suggested Implementation Order

1. Add structured explanation metadata to demand forecasting.
2. Add deterministic forecast summary text.
3. [x] Add recency-weighted recommendation and forecast scoring.
4. [x] Add structured source metadata to business insights.
5. [x] Add branch comparison and scheduled business summaries.
6. [x] Add optional LLM summaries for forecast, review sentiment, and business insights only.
7. [x] Add time-series forecasting behind NestJS (Demand Forecast ML model implemented).
8. Add ML ranking for recommendations (Deferred to later add-on; requires more production data).

## Non-Goals

- No frontend-to-FastAPI calls.
- No LLM-generated forecast quantities.
- No LLM-generated item prices, stock needs, allergens, or revenue.
- No cross-tenant training or inference data leakage.
- No hidden coupling between frontend, database, and AI providers.
