import "dotenv/config";
import assert from "node:assert/strict";
import { BusinessInsightsService } from "./business-insights.service.js";
import type { PrismaService } from "../../prisma/prisma.service.js";

function createPrismaMock(): any {
  return {
    branch: { findMany: async () => [] },
    lowStockAlert: { count: async () => 0, groupBy: async () => [] },
    serviceRequest: { count: async () => 0 },
    orderItem: {
      findMany: async () => [],
      groupBy: async () => [],
    },
    menuItem: {
      findUnique: async () => null,
      findMany: async () => [],
    },
    order: {
      groupBy: async () => [],
    },
    refund: {
      aggregate: async () => ({ _count: 0, _sum: { amount: null } }),
    },
    review: {
      aggregate: async () => ({ _count: 0, _avg: { overallRating: null } }),
      groupBy: async () => [],
    },
    businessInsightLog: {
      create: async () => ({}),
    },
  };
}

async function main() {
  const originalAiUrl = process.env.AI_SERVICE_URL;
  process.env.AI_SERVICE_URL = "";

  const emptyPrisma = createPrismaMock();
  const emptyService = new BusinessInsightsService(emptyPrisma as unknown as PrismaService);
  const empty = await emptyService.generateInsights("tenant-1", "staff-1", "BRANCH", "branch-1");
  assert.equal(empty.scope, "BRANCH");
  assert.equal(empty.branchId, "branch-1");
  assert.equal(empty.insights.length, 0);
  assert.equal(empty.summary, "Found 0 priority insights for the selected period.");

  const inventoryPrisma = createPrismaMock();
  inventoryPrisma.lowStockAlert.count = async () => 4;
  const inventoryService = new BusinessInsightsService(inventoryPrisma as unknown as PrismaService);
  const inventory = await inventoryService.generateInsights("tenant-1", "staff-1", "BRANCH", "branch-1");
  assert.equal(inventory.insights.length, 1);
  assert.equal(inventory.insights[0]?.category, "INVENTORY");
  assert.equal(inventory.insights[0]?.priority, "HIGH");
  assert.equal(inventory.insights[0]?.sourceMetadata?.triggerRule, "OPEN_LOW_STOCK_ALERT_COUNT_GT_0");
  assert.equal(inventory.insights[0]?.sourceMetadata?.currentValue, 4);
  assert.equal(inventory.insights[0]?.sourceMetadata?.confidence, "HIGH");

  const originalFetch = globalThis.fetch;
  process.env.AI_SERVICE_URL = "http://ai-service.test";
  const slowLlmPrisma = createPrismaMock();
  slowLlmPrisma.lowStockAlert.count = async () => 4;
  globalThis.fetch = (async () => {
    await new Promise((resolve) => setTimeout(resolve, 3100));
    return new Response(
      JSON.stringify({ summary: "LLM summary after slow response." }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;
  const slowLlmService = new BusinessInsightsService(slowLlmPrisma as unknown as PrismaService);
  const slowLlm = await slowLlmService.generateInsights("tenant-1", "staff-1", "BRANCH", "branch-1");
  assert.equal(slowLlm.summary, "LLM summary after slow response.");
  assert.equal(slowLlm.aiFallbackMessage, undefined);
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ summary: ["malformed"] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )) as typeof fetch;
  const invalidLlm = await slowLlmService.generateInsights("tenant-1", "staff-1", "BRANCH", "branch-1");
  assert.equal(invalidLlm.summary, "Found 1 priority insights for the selected period.");
  assert.equal(
    invalidLlm.aiFallbackMessage,
    "AI summary is temporarily unavailable, but analytics were generated successfully.",
  );
  assert.equal(invalidLlm.insights[0]?.sourceMetadata?.currentValue, 4);
  globalThis.fetch = (async () => {
    throw new Error("provider unavailable");
  }) as typeof fetch;
  const failedLlm = await slowLlmService.generateInsights("tenant-1", "staff-1", "BRANCH", "branch-1");
  assert.equal(failedLlm.summary, "Found 1 priority insights for the selected period.");
  assert.equal(
    failedLlm.aiFallbackMessage,
    "AI summary is temporarily unavailable, but analytics were generated successfully.",
  );
  globalThis.fetch = originalFetch;
  process.env.AI_SERVICE_URL = "";

  const kitchenPrisma = createPrismaMock();
  const startedAt = new Date("2026-05-01T12:00:00.000Z");
  const readyAt = new Date("2026-05-01T12:25:00.000Z");
  kitchenPrisma.orderItem.findMany = async () => Array(6).fill({ startedAt, readyAt });
  const kitchenService = new BusinessInsightsService(kitchenPrisma as unknown as PrismaService);
  const kitchen = await kitchenService.generateInsights(
    "tenant-1",
    "staff-1",
    "TENANT",
    undefined,
    new Date("2026-05-01T00:00:00.000Z"),
    new Date("2026-05-01T23:59:59.999Z"),
  );
  assert.equal(kitchen.insights.length, 1);
  assert.equal(kitchen.insights[0]?.category, "KITCHEN");
  assert.equal(kitchen.insights[0]?.priority, "HIGH");
  assert.equal(kitchen.insights[0]?.sourceMetadata?.triggerRule, "AVERAGE_PREP_MINUTES_GT_20_WITH_SAMPLE_GT_5");

  const logFailurePrisma = createPrismaMock();
  logFailurePrisma.lowStockAlert.count = async () => 2;
  logFailurePrisma.businessInsightLog.create = async () => {
    throw new Error("simulated log failure");
  };
  const logFailureService = new BusinessInsightsService(logFailurePrisma as unknown as PrismaService);
  const logFailure = await logFailureService.generateInsights("tenant-1", "staff-1", "BRANCH", "branch-1");
  assert.equal(logFailure.insights.length, 1);
  assert.equal(logFailure.insights[0]?.category, "INVENTORY");

  process.env.AI_SERVICE_URL = originalAiUrl;
  console.log("Business insights checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
