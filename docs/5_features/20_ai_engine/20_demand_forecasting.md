# Demand Forecasting

The demand forecasting feature predicts order volume, revenue, and item quantities for a given branch and date range.

## Forecasting Model

The forecasting model is a Ridge regression model from the scikit-learn library, which is part of the `ai-services` FastAPI application. If the FastAPI service is unavailable or returns an error, the system falls back to a deterministic, recency-weighted model in the NestJS backend.

## Forecasting Process

1.  The admin user sets the branch, date range, and other filter controls in the demand forecast panel.
2.  The frontend calls the `GET /api/admin/ai/demand-forecast` endpoint.
3.  The `DemandForecastService` in the NestJS backend validates the request and loads historical order data.
4.  It then calls the `/forecast/demand` endpoint on the FastAPI service, sending the historical data.
5.  The FastAPI service trains a Ridge regression model for each item and returns the forecast.
6.  The NestJS backend validates the response from the FastAPI service, applies adjustment factors, and calculates revenue, ingredient needs, and hourly demand.
7.  Optionally, the deterministic forecast metrics are sent to a Hugging Face LLM to generate a narrative summary of the forecast.

## API Endpoint

-   **Endpoint:** `GET /api/admin/ai/demand-forecast`
-   **Authentication:** Requires admin permissions.
-   **Response:** The response includes the forecast data, item-specific forecasts, hourly forecasts, ingredient forecasts, and any data-quality warnings.
