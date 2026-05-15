import "dotenv/config";
import assert from "node:assert/strict";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  OrderPaymentStatus,
  OrderSource,
  OrderStatus,
  ServiceRequestStatus,
  ServiceRequestType,
  SessionStatus,
  StaffRoleCode,
  TaxClass,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";
import { ReviewSentimentQueryDto } from "./dto/review-sentiment-query.dto.js";
import { ReviewSentimentService } from "./review-sentiment.service.js";

const prisma = new PrismaService();
const service = new ReviewSentimentService(prisma);
const runId = `review-sentiment-${Date.now()}`;

const ids = {
  tenant: `${runId}-tenant`,
  otherTenant: `${runId}-other-tenant`,
  branch: `${runId}-branch`,
  otherBranch: `${runId}-other-branch`,
  otherTenantBranch: `${runId}-other-tenant-branch`,
  table: `${runId}-table`,
  otherTable: `${runId}-other-table`,
  otherTenantTable: `${runId}-other-tenant-table`,
  owner: `${runId}-owner`,
  waiter: `${runId}-waiter`,
  otherTenantOwner: `${runId}-other-tenant-owner`,
  category: `${runId}-category`,
  otherCategory: `${runId}-other-category`,
  otherTenantCategory: `${runId}-other-tenant-category`,
  burger: `${runId}-burger`,
  pasta: `${runId}-pasta`,
  otherBranchItem: `${runId}-other-branch-item`,
  otherTenantItem: `${runId}-other-tenant-item`,
  session: `${runId}-session`,
  otherSession: `${runId}-other-session`,
  otherTenantSession: `${runId}-other-tenant-session`,
};

const ownerStaff: AuthenticatedStaff = {
  staffId: ids.owner,
  tenantId: ids.tenant,
  branchId: ids.branch,
  primaryRole: StaffRoleCode.OWNER,
  permissions: ["analytics:read"],
};

const branchBoundStaff: AuthenticatedStaff = {
  staffId: ids.waiter,
  tenantId: ids.tenant,
  branchId: ids.branch,
  primaryRole: StaffRoleCode.WAITER,
  permissions: ["analytics:read"],
};

const otherTenantStaff: AuthenticatedStaff = {
  staffId: ids.otherTenantOwner,
  tenantId: ids.otherTenant,
  branchId: ids.otherTenantBranch,
  primaryRole: StaffRoleCode.OWNER,
  permissions: ["analytics:read"],
};

async function cleanup() {
  const tenantIds = [ids.tenant, ids.otherTenant];
  const branchIds = [ids.branch, ids.otherBranch, ids.otherTenantBranch];

  await new Promise((resolve) => setTimeout(resolve, 50));
  await prisma.reviewSentimentLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.review.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.serviceRequest.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.orderItem.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.order.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.session.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.table.deleteMany({ where: { branchId: { in: branchIds } } });
  await prisma.staff.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.menuItem.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.category.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.reviewSentimentLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.branch.deleteMany({ where: { id: { in: branchIds } } });
  await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
}

async function seed() {
  await prisma.tenant.createMany({
    data: [
      { id: ids.tenant, name: "Review Sentiment Tenant" },
      { id: ids.otherTenant, name: "Review Sentiment Other Tenant" },
    ],
  });

  await prisma.branch.createMany({
    data: [
      { id: ids.branch, tenantId: ids.tenant, name: "Main", location: "Test" },
      { id: ids.otherBranch, tenantId: ids.tenant, name: "Other", location: "Test" },
      { id: ids.otherTenantBranch, tenantId: ids.otherTenant, name: "Other Tenant", location: "Test" },
    ],
  });

  await prisma.staff.createMany({
    data: [
      staff(ids.owner, ids.tenant, ids.branch, StaffRoleCode.OWNER),
      staff(ids.waiter, ids.tenant, ids.branch, StaffRoleCode.WAITER),
      staff(ids.otherTenantOwner, ids.otherTenant, ids.otherTenantBranch, StaffRoleCode.OWNER),
    ],
  });

  await prisma.table.createMany({
    data: [
      { id: ids.table, branchId: ids.branch, tableCode: "RS1", capacity: 2 },
      { id: ids.otherTable, branchId: ids.otherBranch, tableCode: "RS2", capacity: 2 },
      { id: ids.otherTenantTable, branchId: ids.otherTenantBranch, tableCode: "RS3", capacity: 2 },
    ],
  });

  await prisma.category.createMany({
    data: [
      { id: ids.category, tenantId: ids.tenant, branchId: ids.branch, name: "Main Courses" },
      { id: ids.otherCategory, tenantId: ids.tenant, branchId: ids.otherBranch, name: "Other Branch" },
      { id: ids.otherTenantCategory, tenantId: ids.otherTenant, branchId: ids.otherTenantBranch, name: "Other Tenant" },
    ],
  });

  await prisma.menuItem.createMany({
    data: [
      item(ids.burger, ids.tenant, ids.branch, ids.category, "Classic Burger"),
      item(ids.pasta, ids.tenant, ids.branch, ids.category, "Pasta"),
      item(ids.otherBranchItem, ids.tenant, ids.otherBranch, ids.otherCategory, "Other Branch Burger"),
      item(ids.otherTenantItem, ids.otherTenant, ids.otherTenantBranch, ids.otherTenantCategory, "Other Tenant Burger"),
    ],
  });

  await prisma.session.createMany({
    data: [
      session(ids.session, ids.tenant, ids.branch, ids.table),
      session(ids.otherSession, ids.tenant, ids.otherBranch, ids.otherTable),
      session(ids.otherTenantSession, ids.otherTenant, ids.otherTenantBranch, ids.otherTenantTable),
    ],
  });

  await createReviewedOrder("2026-04-24T10:00:00.000Z", 2, [["COLD"]], [
    [ids.pasta, 2],
  ], { kitchenMinutes: 12, readyToServedMinutes: 4 });
  await createReviewedOrder("2026-04-25T10:00:00.000Z", 3, [["COLD"]], [
    [ids.burger, 3],
  ], { kitchenMinutes: 14, readyToServedMinutes: 5 });

  await createReviewedOrder("2026-05-01T10:00:00.000Z", 5, [
    ["COLD"],
  ], [
    [ids.burger, 5],
    [ids.pasta, 4],
  ], { kitchenMinutes: 12, readyToServedMinutes: 4 });
  await createReviewedOrder("2026-05-02T10:00:00.000Z", 4, [["LATE"]], [
    [ids.burger, 3],
  ], { kitchenMinutes: 28, readyToServedMinutes: 8, serviceRequestCount: 1 });
  await createReviewedOrder("2026-05-03T10:00:00.000Z", 3, [["LATE"]], [
    [ids.burger, 2],
  ], { kitchenMinutes: 26, readyToServedMinutes: 7 });
  await createReviewedOrder("2026-05-04T10:00:00.000Z", 2, [["LATE"]], [
    [ids.pasta, 2],
  ], { kitchenMinutes: 45, readyToServedMinutes: 15, serviceRequestCount: 2 });

  await createReviewedOrder("2026-05-02T10:00:00.000Z", 1, [["COLD"]], [
    [ids.otherBranchItem, 1],
  ], {
    tenantId: ids.tenant,
    branchId: ids.otherBranch,
    sessionId: ids.otherSession,
  });
  await createReviewedOrder("2026-05-02T10:00:00.000Z", 1, [["COLD"]], [
    [ids.otherTenantItem, 1],
  ], {
    tenantId: ids.otherTenant,
    branchId: ids.otherTenantBranch,
    sessionId: ids.otherTenantSession,
  });
}

function staff(id: string, tenantId: string, branchId: string, primaryRole: StaffRoleCode) {
  return {
    id,
    tenantId,
    branchId,
    name: id,
    phone: `+1555${Math.floor(Math.random() * 1_000_000)}`,
    email: `${id}@example.com`,
    primaryRole,
    passwordHash: "test",
  };
}

function item(
  id: string,
  tenantId: string,
  branchId: string,
  categoryId: string,
  name: string,
) {
  return {
    id,
    tenantId,
    branchId,
    categoryId,
    name,
    price: "10.00",
    taxClass: TaxClass.FOOD,
  };
}

function session(id: string, tenantId: string, branchId: string, tableId: string) {
  return {
    id,
    tenantId,
    branchId,
    tableId,
    guestCount: 1,
    status: SessionStatus.COMPLETED,
  };
}

async function createReviewedOrder(
  createdAt: string,
  overallRating: number,
  issueTagGroups: string[][],
  itemReviews: Array<[string, number]>,
  options: {
    tenantId?: string;
    branchId?: string;
    sessionId?: string;
    kitchenMinutes?: number;
    readyToServedMinutes?: number;
    serviceRequestCount?: number;
  } = {},
) {
  const tenantId = options.tenantId ?? ids.tenant;
  const branchId = options.branchId ?? ids.branch;
  const sessionId = options.sessionId ?? ids.session;
  const orderDate = new Date(createdAt);
  const readyAt = new Date(orderDate.getTime() + (options.kitchenMinutes ?? 10) * 60_000);
  const servedAt = new Date(
    readyAt.getTime() + (options.readyToServedMinutes ?? 4) * 60_000,
  );
  const order = await prisma.order.create({
    data: {
      tenantId,
      branchId,
      sessionId,
      orderDateTime: orderDate,
      orderStatus: OrderStatus.COMPLETED,
      paymentStatus: OrderPaymentStatus.PAID,
      source: OrderSource.USER_APP,
      subtotalAmount: "10.00",
      taxAmount: "0.00",
      serviceChargeAmount: "0.00",
      discountAmount: "0.00",
      totalAmount: "10.00",
      orderItems: {
        create: itemReviews.map(([menuItemId]) => ({
          tenantId,
          branchId,
          menuItemId,
          quantity: 1,
          itemBasePrice: "10.00",
          lineDiscountAmount: "0.00",
          lineTaxAmount: "0.00",
          lineTotal: "10.00",
          startedAt: new Date(orderDate.getTime() + 5 * 60_000),
          readyAt,
        })),
      },
      statusHistory: {
        create: [
          {
            tenantId,
            branchId,
            fromStatus: null,
            toStatus: OrderStatus.PLACED,
            changedAt: orderDate,
          },
          {
            tenantId,
            branchId,
            fromStatus: OrderStatus.IN_KITCHEN,
            toStatus: OrderStatus.READY,
            changedAt: readyAt,
          },
          {
            tenantId,
            branchId,
            fromStatus: OrderStatus.READY,
            toStatus: OrderStatus.SERVED,
            changedAt: servedAt,
          },
        ],
      },
    },
    select: { id: true },
  });

  for (let index = 0; index < (options.serviceRequestCount ?? 0); index++) {
    await prisma.serviceRequest.create({
      data: {
        tenantId,
        branchId,
        sessionId,
        tableId:
          sessionId === ids.otherSession
            ? ids.otherTable
            : sessionId === ids.otherTenantSession
              ? ids.otherTenantTable
              : ids.table,
        type: ServiceRequestType.CALL_WAITER,
        status: ServiceRequestStatus.COMPLETED,
        createdAt: new Date(orderDate.getTime() + (index + 1) * 60_000),
        completedAt: new Date(orderDate.getTime() + (index + 3) * 60_000),
      },
    });
  }

  await prisma.review.create({
    data: {
      tenantId,
      branchId,
      orderId: order.id,
      overallRating,
      comment: "This raw comment must not be exposed",
      createdAt: new Date(servedAt.getTime() + 5 * 60_000),
      issueTags: {
        create: issueTagGroups.flat().map((tag) => ({ tag })),
      },
      itemReviews: {
        create: itemReviews.map(([menuItemId, rating]) => ({
          menuItemId,
          rating,
          comment: "Raw item comment must not be exposed",
        })),
      },
    },
  });
}

async function expectDtoInvalid(value: Record<string, unknown>) {
  const dto = plainToInstance(ReviewSentimentQueryDto, value);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  assert.ok(errors.length > 0, `Expected DTO to reject ${JSON.stringify(value)}`);
}

async function waitForAuditLog(totalReviews: number) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const log = await prisma.reviewSentimentLog.findFirst({
      where: {
        tenantId: ids.tenant,
        branchId: ids.branch,
        totalReviews,
      },
      orderBy: { createdAt: "desc" },
    });
    if (log) return log;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return null;
}

async function main() {
  await cleanup();
  await seed();

  await expectDtoInvalid({ from: "2026-05-01", to: "2026-05-07" });
  await expectDtoInvalid({ branchId: ids.branch, from: "bad", to: "2026-05-07" });
  await expectDtoInvalid({ branchId: ids.branch, from: "2026-05-01", to: "2026-05-07T00:00:00.000Z" });

  await assert.rejects(
    () =>
      service.getReviewSentiment(
        { branchId: ids.branch, from: "2026-05-07", to: "2026-05-01" },
        ownerStaff,
      ),
    /from must be before/,
  );
  await assert.rejects(
    () =>
      service.getReviewSentiment(
        { branchId: ids.branch, from: "2026-01-01", to: "2026-07-01" },
        ownerStaff,
      ),
    /cannot exceed/,
  );

  const sentiment = await service.getReviewSentiment(
    { branchId: ids.branch, from: "2026-05-01", to: "2026-05-07" },
    ownerStaff,
  );

  assert.equal(sentiment.branchId, ids.branch);
  assert.equal(sentiment.totalReviews, 4);
  assert.equal(sentiment.averageRating, 3.5);
  assert.equal(sentiment.sentiment, "MIXED");
  assert.equal(sentiment.commonIssues[0]?.issue, "late");
  assert.equal(sentiment.commonIssues[0]?.count, 3);
  assert.equal(sentiment.commonIssues[0]?.severity, "LOW");
  assert.equal(sentiment.commonIssues[1]?.issue, "cold");
  assert.equal(sentiment.commonIssues[1]?.severity, "LOW");
  assert.equal(sentiment.trend.previousFrom, "2026-04-24");
  assert.equal(sentiment.trend.previousTo, "2026-04-30");
  assert.equal(sentiment.trend.previousTotalReviews, 2);
  assert.equal(sentiment.trend.previousAverageRating, 2.5);
  assert.equal(sentiment.trend.averageRatingDelta, 1);
  assert.equal(sentiment.trend.reviewCountDelta, 2);
  assert.equal(sentiment.trend.currentTopIssue, "late");
  assert.equal(sentiment.trend.previousTopIssue, "cold");
  assert.equal(sentiment.trend.topIssueChanged, true);
  assert.equal(sentiment.trend.direction, "IMPROVING");
  assert.equal(sentiment.alerts[0]?.type, "ISSUE_SPIKE");
  assert.equal(sentiment.alerts[0]?.issue, "late");
  assert.equal(sentiment.alerts[0]?.currentCount, 3);
  assert.equal(sentiment.alerts[0]?.previousCount, 0);
  assert.equal(sentiment.alerts[0]?.countDelta, 3);
  assert.equal(sentiment.alerts[0]?.severity, "MEDIUM");
  assert.equal(sentiment.itemTimelines[0]?.menuItemId, ids.burger);
  assert.equal(sentiment.itemTimelines[0]?.totalIssueCount, 3);
  assert.equal(sentiment.itemTimelines[0]?.direction, "STABLE");
  assert.equal(sentiment.itemTimelines[0]?.points.length, 4);
  assert.equal(sentiment.itemTimelines[0]?.points[0]?.from, "2026-05-01");
  assert.equal(sentiment.itemTimelines[0]?.points[0]?.to, "2026-05-02");
  assert.equal(sentiment.itemTimelines[0]?.points[0]?.issueCount, 2);
  assert.equal(sentiment.itemTimelines[0]?.points[0]?.topIssue, "cold");
  assert.equal(sentiment.operationalCorrelations.reviewedOrderCount, 4);
  assert.equal(sentiment.operationalCorrelations.lateIssueReviewCount, 3);
  assert.equal(sentiment.operationalCorrelations.averageKitchenMinutes, 27.75);
  assert.equal(sentiment.operationalCorrelations.lateReviewsAverageKitchenMinutes, 33);
  assert.equal(sentiment.operationalCorrelations.averageReadyToServedMinutes, 8.5);
  assert.equal(sentiment.operationalCorrelations.lateReviewsAverageReadyToServedMinutes, 10);
  assert.equal(sentiment.operationalCorrelations.serviceRequestCount, 3);
  assert.equal(sentiment.operationalCorrelations.lateReviewsServiceRequestCount, 3);
  assert.equal(sentiment.operationalCorrelations.signal, "KITCHEN_DELAY");
  assert.ok(sentiment.actionSuggestions.length > 0);
  const kitchenSuggestion = sentiment.actionSuggestions.find(
    (suggestion) => suggestion.id === "review-action-kitchen-late-complaints",
  );
  assert.ok(kitchenSuggestion, "kitchen-delay action suggestion should be present");
  assert.equal(kitchenSuggestion.relatedIssue, "late");

  const affectedBurger = sentiment.affectedItems.find((item) => item.menuItemId === ids.burger);
  assert.ok(affectedBurger, "burger should be affected");
  assert.equal(affectedBurger.averageRating, 3.33);
  assert.equal(affectedBurger.issueCount, 3);
  assert.equal(affectedBurger.topIssue, "late");

  assert.equal(JSON.stringify(sentiment).includes("raw comment"), false);
  assert.match(sentiment.summary, /Customer feedback is mixed/);
  assert.match(sentiment.summary, /late and cold/);
  assert.match(sentiment.summary, /Mostly affecting/);
  assert.match(sentiment.summary, /improved by 1\.00 points/);
  assert.match(sentiment.summary, /Alert: late complaints increased by 3/);
  assert.match(sentiment.summary, /Operational correlation/);

  const auditLog = await waitForAuditLog(4);
  assert.ok(auditLog, "review sentiment request should create an audit log");
  assert.equal(auditLog.requestedById, ids.owner);
  assert.equal(auditLog.fromDate.toISOString().slice(0, 10), "2026-05-01");
  assert.equal(auditLog.toDate.toISOString().slice(0, 10), "2026-05-07");
  assert.equal(auditLog.totalReviews, 4);
  assert.equal(auditLog.averageRating?.toString(), "3.5");
  assert.equal(auditLog.sentiment, "MIXED");
  const auditJson = JSON.stringify(auditLog);
  assert.equal(auditJson.includes("raw comment"), false);
  assert.equal(auditJson.includes("Raw item comment"), false);
  assert.equal(auditJson.includes("phone"), false);
  assert.equal(auditJson.includes("email"), false);
  assert.equal(auditJson.includes("ISSUE_SPIKE"), true);
  assert.equal(auditJson.includes("itemTimelines"), true);
  assert.equal(auditJson.includes("operationalCorrelations"), true);
  assert.equal(auditJson.includes("actionSuggestions"), true);

  const burgerOnly = await service.getReviewSentiment(
    {
      branchId: ids.branch,
      from: "2026-05-01",
      to: "2026-05-07",
      menuItemId: ids.burger,
    },
    ownerStaff,
  );
  assert.equal(burgerOnly.totalReviews, 3);
  assert.deepEqual(burgerOnly.affectedItems.map((item) => item.menuItemId), [ids.burger]);
  assert.deepEqual(burgerOnly.itemTimelines.map((item) => item.menuItemId), [ids.burger]);

  const positive = await service.getReviewSentiment(
    { branchId: ids.branch, from: "2026-05-01", to: "2026-05-01" },
    ownerStaff,
  );
  assert.equal(positive.sentiment, "POSITIVE");
  assert.equal(positive.alerts.length, 0);
  assert.equal(positive.itemTimelines.length, 2);

  const negative = await service.getReviewSentiment(
    { branchId: ids.branch, from: "2026-05-04", to: "2026-05-04" },
    ownerStaff,
  );
  assert.equal(negative.sentiment, "NEGATIVE");
  assert.equal(negative.alerts[0]?.type, "RATING_DECLINE");
  assert.equal(negative.alerts[0]?.severity, "HIGH");

  const empty = await service.getReviewSentiment(
    { branchId: ids.branch, from: "2026-05-20", to: "2026-05-20" },
    ownerStaff,
  );
  assert.equal(empty.totalReviews, 0);
  assert.equal(empty.averageRating, 0);
  assert.equal(empty.sentiment, "NEUTRAL");
  assert.equal(empty.summary, "No customer reviews were found for this period.");
  assert.equal(empty.alerts.length, 0);
  assert.equal(empty.itemTimelines.length, 0);
  assert.equal(empty.actionSuggestions.length, 0);

  await assert.rejects(
    () =>
      service.getReviewSentiment(
        { branchId: ids.otherTenantBranch, from: "2026-05-01", to: "2026-05-07" },
        ownerStaff,
      ),
    /another tenant/,
  );
  await assert.rejects(
    () =>
      service.getReviewSentiment(
        { branchId: ids.otherBranch, from: "2026-05-01", to: "2026-05-07" },
        branchBoundStaff,
      ),
    /another branch/,
  );
  await assert.rejects(
    () =>
      service.getReviewSentiment(
        { branchId: ids.branch, from: "2026-05-01", to: "2026-05-07" },
        otherTenantStaff,
      ),
    /another tenant/,
  );

  const ownerOtherBranch = await service.getReviewSentiment(
    { branchId: ids.otherBranch, from: "2026-05-01", to: "2026-05-07" },
    ownerStaff,
  );
  assert.equal(ownerOtherBranch.branchId, ids.otherBranch);
  assert.equal(ownerOtherBranch.totalReviews, 1);
  assert.equal(ownerOtherBranch.commonIssues[0]?.count, 1);

  const originalCreate = prisma.reviewSentimentLog.create.bind(prisma.reviewSentimentLog);
  prisma.reviewSentimentLog.create = (async () => {
    throw new Error("simulated log failure");
  }) as unknown as typeof prisma.reviewSentimentLog.create;
  const responseWithLogFailure = await service.getReviewSentiment(
    { branchId: ids.branch, from: "2026-05-20", to: "2026-05-20" },
    ownerStaff,
  );
  assert.equal(responseWithLogFailure.totalReviews, 0);
  prisma.reviewSentimentLog.create = originalCreate;

  console.log("Review sentiment checks passed");
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
