import "dotenv/config";
import assert from "node:assert/strict";
import { OrderPaymentStatus, OrderSource, OrderStatus, SessionStatus, TaxClass } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { RecommendationService } from "./recommendation.service.js";

const prisma = new PrismaService();
const service = new RecommendationService(prisma);
const runId = `rec-phase4-${Date.now()}`;

const ids = {
  tenant: `${runId}-tenant`,
  otherTenant: `${runId}-other-tenant`,
  branch: `${runId}-branch`,
  otherBranch: `${runId}-other-branch`,
  otherTenantBranch: `${runId}-other-tenant-branch`,
  table: `${runId}-table`,
  otherTable: `${runId}-other-table`,
  otherTenantTable: `${runId}-other-tenant-table`,
  session: `${runId}-session`,
  otherSession: `${runId}-other-session`,
  otherTenantSession: `${runId}-other-tenant-session`,
  user: `${runId}-user`,
  category: `${runId}-category`,
  otherCategory: `${runId}-other-category`,
  otherTenantCategory: `${runId}-other-tenant-category`,
  cartItem: `${runId}-cart`,
  popularItem: `${runId}-popular`,
  coItem: `${runId}-co`,
  reorderItem: `${runId}-reorder`,
  timeItem: `${runId}-time`,
  inactiveItem: `${runId}-inactive`,
  unavailableItem: `${runId}-unavailable`,
  otherBranchItem: `${runId}-other-branch-item`,
  otherTenantItem: `${runId}-other-tenant-item`,
};

async function cleanup() {
  const tenantIds = [ids.tenant, ids.otherTenant];
  const branchIds = [ids.branch, ids.otherBranch, ids.otherTenantBranch];

  await prisma.recommendationLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.orderStatusHistory.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.orderItem.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.order.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.session.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.table.deleteMany({ where: { branchId: { in: branchIds } } });
  await prisma.userItemStat.deleteMany({ where: { userId: ids.user } });
  await prisma.user.deleteMany({ where: { id: ids.user } });
  await prisma.menuItem.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.category.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.branch.deleteMany({ where: { id: { in: branchIds } } });
  await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
}

async function seed() {
  await prisma.tenant.createMany({
    data: [
      { id: ids.tenant, name: "Recommendation Phase 4 Tenant" },
      { id: ids.otherTenant, name: "Recommendation Phase 4 Other Tenant" },
    ],
  });

  await prisma.branch.createMany({
    data: [
      { id: ids.branch, tenantId: ids.tenant, name: "Main", location: "Test" },
      { id: ids.otherBranch, tenantId: ids.tenant, name: "Other", location: "Test" },
      { id: ids.otherTenantBranch, tenantId: ids.otherTenant, name: "Other Tenant", location: "Test" },
    ],
  });

  await prisma.table.createMany({
    data: [
      { id: ids.table, branchId: ids.branch, tableCode: "R1", capacity: 2 },
      { id: ids.otherTable, branchId: ids.otherBranch, tableCode: "R2", capacity: 2 },
      { id: ids.otherTenantTable, branchId: ids.otherTenantBranch, tableCode: "R3", capacity: 2 },
    ],
  });

  await prisma.user.create({
    data: {
      id: ids.user,
      tenantId: ids.tenant,
      name: "Recommendation Tester",
      phone: `+1555${Date.now().toString().slice(-7)}`,
    },
  });

  await prisma.category.createMany({
    data: [
      { id: ids.category, tenantId: ids.tenant, branchId: ids.branch, name: "Main" },
      { id: ids.otherCategory, tenantId: ids.tenant, branchId: ids.otherBranch, name: "Other" },
      { id: ids.otherTenantCategory, tenantId: ids.otherTenant, branchId: ids.otherTenantBranch, name: "Other Tenant" },
    ],
  });

  await prisma.menuItem.createMany({
    data: [
      menuItem(ids.cartItem, "Cart Item", ids.branch, ids.category),
      menuItem(ids.popularItem, "Popular Item", ids.branch, ids.category),
      menuItem(ids.coItem, "Co Item", ids.branch, ids.category),
      menuItem(ids.reorderItem, "Reorder Item", ids.branch, ids.category),
      menuItem(ids.timeItem, "Time Item", ids.branch, ids.category),
      menuItem(ids.inactiveItem, "Inactive Item", ids.branch, ids.category, { isActive: false }),
      menuItem(ids.unavailableItem, "Unavailable Item", ids.branch, ids.category, { isUnavailable: true }),
      menuItem(ids.otherBranchItem, "Other Branch Item", ids.otherBranch, ids.otherCategory),
      menuItem(ids.otherTenantItem, "Other Tenant Item", ids.otherTenantBranch, ids.otherTenantCategory, {}, ids.otherTenant),
    ],
  });

  await prisma.session.createMany({
    data: [
      session(ids.session, ids.tenant, ids.branch, ids.table, ids.user),
      session(ids.otherSession, ids.tenant, ids.otherBranch, ids.otherTable),
      session(ids.otherTenantSession, ids.otherTenant, ids.otherTenantBranch, ids.otherTenantTable),
    ],
  });

  const now = new Date();
  const fortyTwoDaysAgo = new Date(now);
  fortyTwoDaysAgo.setDate(now.getDate() - 42);
  const fortyTwoDaysAgoDifferentHour = new Date(fortyTwoDaysAgo);
  fortyTwoDaysAgoDifferentHour.setHours((now.getHours() + 5) % 24);

  await createOrder(ids.branch, ids.tenant, ids.session, null, now, [
    [ids.popularItem, 5],
    [ids.inactiveItem, 10],
    [ids.unavailableItem, 10],
  ]);
  await createOrder(ids.branch, ids.tenant, ids.session, null, now, [
    [ids.cartItem, 1],
    [ids.coItem, 6],
  ]);
  await createOrder(ids.branch, ids.tenant, ids.session, ids.user, fortyTwoDaysAgoDifferentHour, [
    [ids.reorderItem, 2],
  ]);
  await createOrder(ids.branch, ids.tenant, ids.session, null, fortyTwoDaysAgo, [
    [ids.timeItem, 1],
  ]);
  await createOrder(ids.otherBranch, ids.tenant, ids.otherSession, null, now, [
    [ids.otherBranchItem, 20],
  ]);
  await createOrder(ids.otherTenantBranch, ids.otherTenant, ids.otherTenantSession, null, now, [
    [ids.otherTenantItem, 20],
  ]);
}

function menuItem(
  id: string,
  name: string,
  branchId: string,
  categoryId: string,
  flags: { isActive?: boolean; isUnavailable?: boolean } = {},
  tenantId = ids.tenant,
) {
  return {
    id,
    tenantId,
    branchId,
    categoryId,
    name,
    price: "10.00",
    isActive: flags.isActive ?? true,
    isUnavailable: flags.isUnavailable ?? false,
    taxClass: TaxClass.FOOD,
  };
}

function session(id: string, tenantId: string, branchId: string, tableId: string, userId?: string) {
  return {
    id,
    tenantId,
    branchId,
    tableId,
    userId,
    guestCount: 1,
    status: SessionStatus.COMPLETED,
  };
}

async function createOrder(
  branchId: string,
  tenantId: string,
  sessionId: string,
  userId: string | null,
  orderDateTime: Date,
  items: Array<[string, number]>,
) {
  await prisma.order.create({
    data: {
      tenantId,
      branchId,
      sessionId,
      userId,
      orderDateTime,
      orderStatus: OrderStatus.COMPLETED,
      paymentStatus: OrderPaymentStatus.PAID,
      source: OrderSource.USER_APP,
      subtotalAmount: "10.00",
      taxAmount: "0.00",
      serviceChargeAmount: "0.00",
      discountAmount: "0.00",
      totalAmount: "10.00",
      orderItems: {
        create: items.map(([menuItemId, quantity]) => ({
          tenantId,
          branchId,
          menuItemId,
          quantity,
          itemBasePrice: "10.00",
          lineDiscountAmount: "0.00",
          lineTaxAmount: "0.00",
          lineTotal: "10.00",
        })),
      },
    },
  });
}

async function main() {
  await cleanup();
  await seed();

  const response = await service.getMenuRecommendations({
    branchId: ids.branch,
    sessionId: ids.session,
    cartItems: [{ menuItemId: ids.cartItem, quantity: 1 }],
    limit: 10,
  });

  const recommendations = response.recommendations;
  const byId = new Map(recommendations.map((item) => [item.menuItemId, item]));
  const scores = recommendations.map((item) => item.score);

  assert.equal(byId.has(ids.cartItem), false, "cart items must be excluded");
  assert.equal(byId.has(ids.inactiveItem), false, "inactive items must be excluded");
  assert.equal(byId.has(ids.unavailableItem), false, "unavailable items must be excluded");
  assert.equal(byId.has(ids.otherBranchItem), false, "other branch items must not leak");
  assert.equal(byId.has(ids.otherTenantItem), false, "other tenant items must not leak");

  assert.equal(byId.get(ids.popularItem)?.type, "POPULAR");
  assert.equal(byId.get(ids.coItem)?.type, "FREQUENTLY_BOUGHT");
  assert.equal(byId.get(ids.reorderItem)?.type, "REORDER");
  assert.equal(byId.get(ids.timeItem)?.type, "TIME_BASED");

  assert.deepEqual(
    scores,
    [...scores].sort((a, b) => b - a),
    "recommendations must be sorted by score descending",
  );

  const log = await prisma.recommendationLog.findFirst({
    where: { tenantId: ids.tenant, branchId: ids.branch },
    orderBy: { createdAt: "desc" },
  });

  assert.ok(log, "recommendation request should create an audit log");
  assert.deepEqual(log.inputCartItemIds, [ids.cartItem]);
  assert.ok(log.recommendedItemIds.includes(ids.popularItem));
  assert.ok(log.recommendationTypes.includes("POPULAR"));
  assert.ok(log.recommendationTypes.includes("FREQUENTLY_BOUGHT"));
  assert.ok(log.recommendationTypes.includes("REORDER"));
  assert.ok(log.recommendationTypes.includes("TIME_BASED"));

  const noHistoryTenant = `${runId}-no-history-tenant`;
  const noHistoryBranch = `${runId}-no-history-branch`;
  const noHistoryCategory = `${runId}-no-history-category`;
  const noHistoryItem = `${runId}-no-history-item`;
  const noHistoryInactiveItem = `${runId}-no-history-inactive`;
  const noHistoryOtherBranch = `${runId}-no-history-other-branch`;
  const noHistoryOtherBranchItem = `${runId}-no-history-other-branch-item`;

  await prisma.tenant.create({ data: { id: noHistoryTenant, name: "No History Tenant" } });
  await prisma.branch.createMany({
    data: [
      { id: noHistoryBranch, tenantId: noHistoryTenant, name: "No History", location: "Test" },
      { id: noHistoryOtherBranch, tenantId: noHistoryTenant, name: "No History Other", location: "Test" },
    ],
  });
  await prisma.category.create({
    data: {
      id: noHistoryCategory,
      tenantId: noHistoryTenant,
      branchId: noHistoryBranch,
      name: "No History Menu",
    },
  });
  await prisma.menuItem.createMany({
    data: [
      menuItem(noHistoryItem, "No History Active Item", noHistoryBranch, noHistoryCategory, {}, noHistoryTenant),
      menuItem(noHistoryInactiveItem, "No History Inactive Item", noHistoryBranch, noHistoryCategory, { isActive: false }, noHistoryTenant),
      menuItem(noHistoryOtherBranchItem, "No History Other Branch Item", noHistoryOtherBranch, noHistoryCategory, {}, noHistoryTenant),
    ],
  });

  const noHistory = await service.getMenuRecommendations({
    branchId: noHistoryBranch,
    cartItems: [],
    limit: 6,
  });
  const noHistoryIds = new Set(noHistory.recommendations.map((item) => item.menuItemId));
  assert.equal(noHistoryIds.has(noHistoryItem), true, "no-history fallback should show active branch menu items");
  assert.equal(noHistory.recommendations[0]?.type, "AVAILABLE");
  assert.equal(noHistoryIds.has(noHistoryInactiveItem), false, "no-history fallback must exclude inactive items");
  assert.equal(noHistoryIds.has(noHistoryOtherBranchItem), false, "no-history fallback must not leak other branch items");

  await assert.rejects(
    () =>
      service.getMenuRecommendations({
        tenantId: ids.otherTenant,
        branchId: ids.branch,
        cartItems: [],
      }),
    /Branch does not belong to tenant/,
  );

  await assert.rejects(
    () =>
      service.getMenuRecommendations({
        branchId: ids.branch,
        sessionId: ids.otherSession,
        cartItems: [],
      }),
    /Session does not belong to branch/,
  );

  console.log("Recommendation Phase 4 checks passed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
