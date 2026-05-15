import "dotenv/config";
import assert from "node:assert/strict";
import {
  validateBusinessInsightSummaryPayload,
  validateDemandForecastLlmSummaryPayload,
  validateDemandForecastMlPayload,
} from "./ai-output-validation.js";

async function main() {
  assert.deepEqual(
    validateBusinessInsightSummaryPayload({ summary: "Review the real metrics before shift change." }),
    { summary: "Review the real metrics before shift change." },
  );
  assert.equal(validateBusinessInsightSummaryPayload({ summary: "" }), null);
  assert.equal(validateBusinessInsightSummaryPayload({ summary: ["not a string"] }), null);
  assert.equal(validateBusinessInsightSummaryPayload({ summary: "x".repeat(601) }), null);

  assert.equal(
    validateDemandForecastLlmSummaryPayload({ summary: "Demand is expected to peak at lunch." }),
    "Demand is expected to peak at lunch.",
  );
  assert.equal(validateDemandForecastLlmSummaryPayload({ summary: 42 }), null);
  assert.equal(validateDemandForecastLlmSummaryPayload({ summary: "x".repeat(401) }), null);

  assert.deepEqual(
    validateDemandForecastMlPayload({
      items: [
        { menuItemId: "item-1", expectedQuantity: 4.6 },
        { menuItemId: "item-2", expectedQuantity: 0 },
      ],
    }),
    {
      items: [
        { menuItemId: "item-1", expectedQuantity: 4.6 },
        { menuItemId: "item-2", expectedQuantity: 0 },
      ],
    },
  );
  assert.equal(validateDemandForecastMlPayload({ items: [{ menuItemId: "item-1" }] }), null);
  assert.equal(validateDemandForecastMlPayload({ items: [{ menuItemId: "item-1", expectedQuantity: -1 }] }), null);
  assert.equal(validateDemandForecastMlPayload({ items: [{ menuItemId: "", expectedQuantity: 1 }] }), null);
  assert.equal(validateDemandForecastMlPayload({ forecasts: [] }), null);

  console.log("AI output validation tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
