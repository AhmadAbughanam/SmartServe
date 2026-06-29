# Demand Forecasting

The demand forecasting feature predicts order volume, revenue, and item quantities for a given branch and date range.

## Forecasting Model

The primary forecasting model is a Ridge regression model in the internal FastAPI service at `POST /forecast/demand`.

If the FastAPI service is unavailable, times out, or returns invalid output, the NestJS backend falls back to a deterministic statistical model built from recent and same-weekday branch history.

## Forecasting Process

1.  The admin user sets the branch, date range, and other filter controls in the demand forecast panel.
2.  The frontend calls the `GET /api/admin/ai/demand-forecast` endpoint.
3.  The `DemandForecastService` in the NestJS backend validates the request and loads historical order data.
4.  It then calls the `/forecast/demand` endpoint on the FastAPI service, sending the historical data.
5.  The FastAPI service trains a Ridge regression model for each item and returns item-level expected quantities.
6.  The NestJS backend validates the response, applies weather and event adjustment factors, and calculates revenue, ingredient needs, hourly demand, and data-quality warnings.
7.  Optionally, the backend sends a structured summary payload to a hosted LLM helper to generate `llmSummary`.

## API Endpoint

-   **Endpoint:** `GET /api/admin/ai/demand-forecast`
-   **Authentication:** Requires admin permissions.
-   **Response:** The response includes:
    - `expectedOrders`
    - `expectedRevenue`
    - `summaryText`
    - optional `llmSummary`
    - optional `aiFallbackMessage`
    - `items`
    - `hourlyDemand`
    - `ingredients`
    - `dataQualityWarnings`

## Fallbacks

-   FastAPI ML failure falls back to deterministic forecasting in NestJS.
-   Hosted LLM summary failure does not break the forecast response; the structured forecast still returns with `aiFallbackMessage`.
-   Low-history or sparse-history cases are surfaced through `dataQualityWarnings` instead of silent degradation.

## UI Locations

The demand forecasting panel is rendered in:

- [admin analytics page](/C:/Users/support/Desktop/WS/GP/apps/web/src/app/admin/analytics/page.tsx)
- [admin dashboard page](/C:/Users/support/Desktop/WS/GP/apps/web/src/app/admin/dashboard/page.tsx)

The shared component is [DemandForecastPanel.tsx](/C:/Users/support/Desktop/WS/GP/apps/web/src/components/admin/ai/DemandForecastPanel.tsx).
