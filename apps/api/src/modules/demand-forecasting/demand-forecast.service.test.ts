import "dotenv/config";
import assert from "node:assert/strict";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  OrderPaymentStatus,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PayerType,
  SessionStatus,
  StaffRoleCode,
  TaxClass,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";
import { DemandForecastService } from "./demand-forecast.service.js";
import { DemandForecastQueryDto } from "./dto/demand-forecast-query.dto.js";
import { DemandForecastLlmService } from "./demand-forecast-llm.service.js";

const prisma = new PrismaService();
const llmService = new DemandForecastLlmService();
const service = new DemandForecastService(prisma, llmService);
const runId = `forecast-${Date.now()}`;

const ids = {
  tenant: `${runId}-tenant`,
  otherTenant: `${runId}-other-tenant`,
  branch: `${runId}-branch`,
  otherBranch: `${runId}-other-branch`,
  otherTenantBranch: `${runId}-other-tenant-branch`,
  table: `${runId}-table`,
  otherTable: `${runId}-other-table`,
  otherTenantTable: `${runId}-other-tenant-table`,
  staffOwner: `${runId}-owner`,
  staffWaiter: `${runId}-waiter`,
  staffOtherTenant: `${runId}-other-tenant-staff`,
  category: `${runId}-main-category`,
  dessertCategory: `${runId}-dessert-category`,
  otherCategory: `${runId}-other-category`,
  otherTenantCategory: `${runId}-other-tenant-category`,
  burger: `${runId}-burger`,
  pasta: `${runId}-pasta`,
  cake: `${runId}-cake`,
  otherBranchItem: `${runId}-other-branch-item`,
  otherTenantItem: `${runId}-other-tenant-item`,
  inactiveItem: `${runId}-inactive-item`,
  session: `${runId}-session`,
  otherSession: `${runId}-other-session`,
  otherTenantSession: `${runId}-other-tenant-session`,
};

const ownerStaff: AuthenticatedStaff = {
  staffId: ids.staffOwner,
  tenantId: ids.tenant,
  branchId: ids.branch,
  primaryRole: StaffRoleCode.OWNER,
  permissions: ["analytics:read"],
};

const branchBoundStaff: AuthenticatedStaff = {
  staffId: ids.staffWaiter,
  tenantId: ids.tenant,
  branchId: ids.branch,
  primaryRole: StaffRoleCode.WAITER,
  permissions: ["analytics:read"],
};

const otherTenantStaff: AuthenticatedStaff = {
  staffId: ids.staffOtherTenant,
  tenantId: ids.otherTenant,
  branchId: ids.otherTenantBranch,
  primaryRole: StaffRoleCode.OWNER,
  permissions: ["analytics:read"],
};

async function cleanup() {
  await new Promise((resolve) => setTimeout(resolve, 50));
  const tenantIds = [ids.tenant, ids.otherTenant];
  const branchIds = [ids.branch, ids.otherBranch, ids.otherTenantBranch];

  await prisma.demandForecastLog.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.payment.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.orderStatusHistory.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.orderItem.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.order.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.session.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.table.deleteMany({ where: { branchId: { in: branchIds } } });
  await prisma.staff.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.menuItem.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.category.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.branch.deleteMany({ where: { id: { in: branchIds } } });
  await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
}

async function seed() {
  await prisma.tenant.createMany({
    data: [
      { id: ids.tenant, name: "Demand Forecast Tenant" },
      { id: ids.otherTenant, name: "Demand Forecast Other Tenant" },
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
      staff(ids.staffOwner, ids.tenant, ids.branch, StaffRoleCode.OWNER),
      staff(ids.staffWaiter, ids.tenant, ids.branch, StaffRoleCode.WAITER),
      staff(ids.staffOtherTenant, ids.otherTenant, ids.otherTenantBranch, StaffRoleCode.OWNER),
    ],
  });

  await prisma.table.createMany({
    data: [
      { id: ids.table, branchId: ids.branch, tableCode: "F1", capacity: 2 },
      { id: ids.otherTable, branchId: ids.otherBranch, tableCode: "F2", capacity: 2 },
      { id: ids.otherTenantTable, branchId: ids.otherTenantBranch, tableCode: "F3", capacity: 2 },
    ],
  });

  await prisma.category.createMany({
    data: [
      { id: ids.category, tenantId: ids.tenant, branchId: ids.branch, name: "Main Courses" },
      { id: ids.dessertCategory, tenantId: ids.tenant, branchId: ids.branch, name: "Desserts" },
      { id: ids.otherCategory, tenantId: ids.tenant, branchId: ids.otherBranch, name: "Other Branch" },
      { id: ids.otherTenantCategory, tenantId: ids.otherTenant, branchId: ids.otherTenantBranch, name: "Other Tenant" },
    ],
  });

  await prisma.menuItem.createMany({
    data: [
      item(ids.burger, ids.tenant, ids.branch, ids.category, "Classic Burger", "14.00"),
      item(ids.pasta, ids.tenant, ids.branch, ids.category, "Pasta", "12.00"),
      item(ids.cake, ids.tenant, ids.branch, ids.dessertCategory, "Cake", "6.00"),
      item(ids.inactiveItem, ids.tenant, ids.branch, ids.category, "Inactive Item", "20.00", false),
      item(ids.otherBranchItem, ids.tenant, ids.otherBranch, ids.otherCategory, "Other Branch Burger", "99.00"),
      item(ids.otherTenantItem, ids.otherTenant, ids.otherTenantBranch, ids.otherTenantCategory, "Other Tenant Burger", "99.00"),
    ],
  });

  await prisma.session.createMany({
    data: [
      session(ids.session, ids.tenant, ids.branch, ids.table),
      session(ids.otherSession, ids.tenant, ids.otherBranch, ids.otherTable),
      session(ids.otherTenantSession, ids.otherTenant, ids.otherTenantBranch, ids.otherTenantTable),
    ],
  });

  await createOrder("2026-04-07T13:15:00.000Z", [[ids.burger, 10], [ids.pasta, 2]], {
    completedAt: "2026-04-07T13:45:00.000Z",
  });
  await createOrder("2026-04-14T13:10:00.000Z", [[ids.burger, 4], [ids.cake, 3]], {
    completedAt: "2026-04-14T13:40:00.000Z",
  });
  await createOrder("2026-04-21T13:20:00.000Z", [[ids.burger, 6], [ids.inactiveItem, 9]], {
    completedAt: "2026-04-21T13:50:00.000Z",
  });

  await createOrder("2026-04-10T12:00:00.000Z", [[ids.burger, 7], [ids.pasta, 7]], {
    completedAt: "2026-04-10T12:30:00.000Z",
  });
  await createOrder("2026-04-11T18:00:00.000Z", [[ids.pasta, 7]], {
    servedAt: "2026-04-11T18:30:00.000Z",
  });
  await createOrder("2026-04-12T19:00:00.000Z", [[ids.cake, 7]], {
    paidAt: "2026-04-12T19:15:00.000Z",
    orderStatus: OrderStatus.READY,
    paymentStatus: OrderPaymentStatus.PAID,
  });

  await createOrder("2026-04-15T13:00:00.000Z", [[ids.burger, 50]], {
    orderStatus: OrderStatus.CANCELLED,
    paymentStatus: OrderPaymentStatus.UNPAID,
  });
  await createOrder("2026-04-16T13:00:00.000Z", [[ids.burger, 50]], {
    orderStatus: OrderStatus.COMPLETED,
    paymentStatus: OrderPaymentStatus.REFUNDED,
  });
  await createOrder("2026-04-17T13:00:00.000Z", [[ids.burger, 50]], {
    orderStatus: OrderStatus.PLACED,
    paymentStatus: OrderPaymentStatus.UNPAID,
  });

  await createOrder("2026-04-21T13:00:00.000Z", [[ids.otherBranchItem, 80]], {
    branchId: ids.otherBranch,
    tenantId: ids.tenant,
    sessionId: ids.otherSession,
    completedAt: "2026-04-21T13:30:00.000Z",
  });
  await createOrder("2026-04-21T13:00:00.000Z", [[ids.otherTenantItem, 90]], {
    branchId: ids.otherTenantBranch,
    tenantId: ids.otherTenant,
    sessionId: ids.otherTenantSession,
    completedAt: "2026-04-21T13:30:00.000Z",
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

function item(
  id: string,
  tenantId: string,
  branchId: string,
  categoryId: string,
  name: string,
  price: string,
  isActive = true,
) {
  return {
    id,
    tenantId,
    branchId,
    categoryId,
    name,
    price,
    isActive,
    taxClass: TaxClass.FOOD,
  };
}

async function createOrder(
  orderDateTime: string,
  orderItems: Array<[string, number]>,
  options: {
    tenantId?: string;
    branchId?: string;
    sessionId?: string;
    orderStatus?: OrderStatus;
    paymentStatus?: OrderPaymentStatus;
    completedAt?: string;
    servedAt?: string;
    paidAt?: string;
  } = {},
) {
  const tenantId = options.tenantId ?? ids.tenant;
  const branchId = options.branchId ?? ids.branch;
  const sessionId = options.sessionId ?? ids.session;
  const orderStatus = options.orderStatus ?? OrderStatus.COMPLETED;
  const paymentStatus = options.paymentStatus ?? OrderPaymentStatus.PAID;

  await prisma.order.create({
    data: {
      tenantId,
      branchId,
      sessionId,
      orderDateTime: new Date(orderDateTime),
      orderStatus,
      paymentStatus,
      source: OrderSource.USER_APP,
      subtotalAmount: "10.00",
      taxAmount: "0.00",
      serviceChargeAmount: "0.00",
      discountAmount: "0.00",
      totalAmount: "10.00",
      orderItems: {
        create: orderItems.map(([menuItemId, quantity]) => ({
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
      statusHistory: {
        create: [
          ...(options.servedAt
            ? [{ tenantId, branchId, toStatus: OrderStatus.SERVED, changedAt: new Date(options.servedAt) }]
            : []),
          ...(options.completedAt
            ? [{ tenantId, branchId, toStatus: OrderStatus.COMPLETED, changedAt: new Date(options.completedAt) }]
            : []),
        ],
      },
      payments: options.paidAt
        ? {
            create: {
              tenantId,
              branchId,
              sessionId,
              amount: "10.00",
              paymentMethod: PaymentMethod.CARD,
              paymentDate: new Date(options.paidAt),
              paymentStatus: PaymentStatus.COMPLETED,
              payerType: PayerType.CUSTOMER,
            },
          }
        : undefined,
    },
  });
}

async function expectDtoInvalid(value: Record<string, unknown>) {
  const dto = plainToInstance(DemandForecastQueryDto, value);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  assert.ok(errors.length > 0, `Expected DTO to reject ${JSON.stringify(value)}`);
}

async function waitForAuditLog() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const log = await prisma.demandForecastLog.findFirst({
      where: { tenantId: ids.tenant, branchId: ids.branch, expectedRevenue: "102.00" },
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

  await expectDtoInvalid({ date: "2026-05-05" });
  await expectDtoInvalid({ branchId: ids.branch, date: "2026-05-05T00:00:00.000Z" });
  await expectDtoInvalid({ branchId: ids.branch, date: "2026-05-05", lookbackDays: 6 });
  await expectDtoInvalid({ branchId: ids.branch, date: "2026-05-05", lookbackDays: 181 });

  const forecast = await service.getDemandForecast(
    { branchId: ids.branch, date: "2026-05-05", lookbackDays: 30 },
    ownerStaff,
  );
  console.dir(forecast, { depth: null });
  assert.equal(forecast.branchId, ids.branch);
  assert.equal(forecast.forecastDate, "2026-05-05");
  assert.equal(forecast.lookbackDays, 30);
  assert.equal(forecast.expectedOrders, 1);
  assert.equal(forecast.expectedRevenue, 102);
  assert.deepEqual(forecast.hourlyDemand, [{ hour: 13, expectedOrders: 1 }]);
  assert.equal(forecast.dataQualityWarnings.some((warning) => warning.code === "LOW_SAMPLE_SIZE"), false);

  const burger = forecast.items.find((item) => item.menuItemId === ids.burger);
  assert.ok(burger, "burger forecast should be present");
  assert.equal(burger.expectedQuantity, 4);
  assert.equal(burger.expectedRevenue, 56);
  assert.equal(burger.confidence, "MEDIUM");
  assert.equal(burger.reason, "27 sold over 3 similar Tuesdays. Forecast: 4. (AI Optimized)");

  const pasta = forecast.items.find((item) => item.menuItemId === ids.pasta);
  assert.ok(pasta, "pasta forecast should be present");
  assert.equal(pasta.expectedQuantity, 7);
  assert.equal(pasta.expectedRevenue, 84);

  assert.equal(forecast.items.some((item) => item.menuItemId === ids.inactiveItem), false);
  assert.equal(forecast.items.some((item) => item.menuItemId === ids.otherBranchItem), false);
  assert.equal(forecast.items.some((item) => item.menuItemId === ids.otherTenantItem), false);

  const fallback = await service.getDemandForecast(
    { branchId: ids.branch, date: "2026-04-14", lookbackDays: 7 },
    ownerStaff,
  );
  const fallbackBurger = fallback.items.find((item) => item.menuItemId === ids.burger);
  assert.ok(fallbackBurger, "fallback burger forecast should be present");
  assert.equal(fallbackBurger.confidence, "LOW");
  assert.equal(fallbackBurger.reason, "17 sold over 4 recent sales days; only 1 matching Tuesday had sales. Forecast: 9. (AI Optimized)");
  assert.equal(fallback.dataQualityWarnings.some((warning) => warning.code === "LOW_SAMPLE_SIZE"), true);

  const dessertOnly = await service.getDemandForecast(
    { branchId: ids.branch, date: "2026-05-05", categoryId: ids.dessertCategory, lookbackDays: 30 },
    ownerStaff,
  );
  assert.deepEqual(dessertOnly.items.map((item) => item.menuItemId), [ids.cake]);
  assert.equal(dessertOnly.items[0]?.categoryName, "Desserts");

  await assert.rejects(
    () =>
      service.getDemandForecast(
        { branchId: ids.otherTenantBranch, date: "2026-05-05" },
        ownerStaff,
      ),
    /another tenant/,
  );

  await assert.rejects(
    () =>
      service.getDemandForecast(
        { branchId: ids.otherBranch, date: "2026-05-05" },
        branchBoundStaff,
      ),
    /another branch/,
  );

  const ownerOtherBranch = await service.getDemandForecast(
    { branchId: ids.otherBranch, date: "2026-05-05", lookbackDays: 30 },
    ownerStaff,
  );
  assert.equal(ownerOtherBranch.branchId, ids.otherBranch);
  assert.equal(ownerOtherBranch.items[0]?.menuItemId, ids.otherBranchItem);

  await assert.rejects(
    () =>
      service.getDemandForecast(
        { branchId: ids.branch, date: "2026-05-05" },
        otherTenantStaff,
      ),
    /another tenant/,
  );

  await prisma.demandForecastLog.deleteMany({
    where: { tenantId: ids.tenant, branchId: ids.branch },
  });
  const rawQueryForecast = await service.getDemandForecast(
    { branchId: ids.branch, date: "2026-05-05", lookbackDays: "30" } as unknown as DemandForecastQueryDto,
    ownerStaff,
  );
  assert.equal(rawQueryForecast.lookbackDays, 30);

  const log = await waitForAuditLog();
  assert.ok(log, "forecast request should create an audit log from a raw query string");
  assert.equal(log.requestedById, ids.staffOwner);
  assert.equal(log.lookbackDays, 30);
  assert.equal(log.expectedOrders, rawQueryForecast.expectedOrders);
  assert.equal(log.expectedRevenue?.toString(), "102");

  console.log("Demand forecast checks passed");
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
