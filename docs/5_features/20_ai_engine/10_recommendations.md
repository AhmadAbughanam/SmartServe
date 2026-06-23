# Menu Recommendations

The menu recommendation engine is a deterministic, rule-based system that suggests menu items to customers. It does not use any large language models (LLMs).

## Recommendation Strategies

The engine uses a variety of strategies to generate recommendations, including:

-   **Popular Items:** Recommending items that are frequently ordered.
-   **Frequently Bought Together:** Suggesting items that are often purchased with items already in the customer's cart.
-   **Reorder:** Suggesting items that the customer has ordered in the past.
-   **Time-based:** Recommending items based on the time of day (e.g., breakfast items in the morning).
-   **Available Items Fallback:** As a fallback, the engine will recommend other available items.

## API Endpoint

-   **Endpoint:** `POST /api/recommendations/menu`
-   **Request:** The request body includes the branch ID, and can optionally include tenant, user, and session IDs, as well as the current cart items.
-   **Response:** The response is a ranked list of menu item recommendations, each with a reason, score, and other metadata.

## Telemetry

The system logs recommendation impressions, clicks, additions to the cart, purchases, and dismissals to the `RecommendationInteraction` table. This data is used to evaluate and improve the recommendation strategies. The telemetry endpoint is `POST /api/recommendations/telemetry`.
