import test from "node:test";
import assert from "node:assert/strict";
import { BusinessInsightsService } from "./business-insights.service.js";
import type { PrismaService } from "../../prisma/prisma.service.js";

function createPrismaMock(): any {
  return {
    lowStockAlert: { count: async () => 0 },
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
    },
    businessInsightLog: {
      create: async () => ({}),
    },
  };
}

test("BusinessInsightsService returns deterministic empty-state summary", async () => {
  const originalAiUrl = process.env.AI_SERVICE_URL;
  process.env.AI_SERVICE_URL = "";
  const prisma = createPrismaMock();
  const service = new BusinessInsightsService(prisma as unknown as PrismaService);

  const response = await service.generateInsights("tenant-1", "staff-1", "BRANCH", "branch-1");

  assert.equal(response.scope, "BRANCH");
  assert.equal(response.branchId, "branch-1");
  assert.deepEqual(response.insights, []);
  assert.equal(response.summary, "Found 0 priority insights for the selected period.");
  process.env.AI_SERVICE_URL = originalAiUrl;
});

test("BusinessInsightsService prioritizes low-stock inventory alerts", async () => {
  const prisma = createPrismaMock();
  prisma.lowStockAlert.count = async () => 4;
  const service = new BusinessInsightsService(prisma as unknown as PrismaService);

  const response = await service.generateInsights("tenant-1", "staff-1", "BRANCH", "branch-1");

  assert.equal(response.insights.length, 1);
  assert.equal(response.insights[0]?.category, "INVENTORY");
  assert.equal(response.insights[0]?.priority, "HIGH");
  assert.equal(response.insights[0]?.sourceMetadata?.triggerRule, "OPEN_LOW_STOCK_ALERT_COUNT_GT_0");
  assert.equal(response.insights[0]?.sourceMetadata?.currentValue, 4);
  assert.equal(response.insights[0]?.sourceMetadata?.confidence, "HIGH");
});

test("BusinessInsightsService tolerates audit logging failures", async () => {
  const prisma = createPrismaMock();
  prisma.lowStockAlert.count = async () => 2;
  prisma.businessInsightLog.create = async () => {
    throw new Error("simulated audit failure");
  };
  const service = new BusinessInsightsService(prisma as unknown as PrismaService);

  const response = await service.generateInsights("tenant-1", "staff-1", "BRANCH", "branch-1");

  assert.equal(response.insights.length, 1);
  assert.equal(response.insights[0]?.category, "INVENTORY");
});
