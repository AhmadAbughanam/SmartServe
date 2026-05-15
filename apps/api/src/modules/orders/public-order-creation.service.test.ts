import "dotenv/config";
import assert from "node:assert/strict";
import { ConflictException, NotFoundException, BadRequestException } from "@nestjs/common";
import {
  KitchenItemStatus,
  OrderSource,
  SessionStatus,
  TableStatus,
  TaxClass,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { RealtimeService } from "../realtime/realtime.service.js";
import { OrdersService } from "./orders.service.js";

const prisma = new PrismaService();
const realtime = new RealtimeService();
const logs = { writeOperational: async () => undefined };
const branchAccess = {
  assertUserCanAccessEntityBranch: async () => undefined,
};
const service = new OrdersService(prisma, realtime, logs as any, branchAccess as any);
const runId = `public-order-${Date.now()}`;

const ids = {
  tenant: `${runId}-tenant`,
  branch: `${runId}-branch`,
  otherBranch: `${runId}-other-branch`,
  table: `${runId}-table`,
  table2: `${runId}-table-2`,
  completedTable: `${runId}-completed-table`,
  session: `${runId}-session`,
  session2: `${runId}-session-2`,
  completedSession: `${runId}-completed-session`,
  category: `${runId}-category`,
  item: `${runId}-item`,
  addition: `${runId}-addition`,
  otherBranchItem: `${runId}-other-branch-item`,
  unavailableItem: `${runId}-unavailable-item`,
  stockItem: `${runId}-stock-item`,
  inventoryItem: `${runId}-inventory-item`,
};

async function cleanup() {
  await prisma.orderStatusHistory.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.orderItem.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.order.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.menuItemInventoryMap.deleteMany({
    where: { inventoryItemId: ids.inventoryItem },
  });
  await prisma.inventoryItem.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.menuItemAddition.deleteMany({ where: { menuItemId: { in: [
    ids.item,
    ids.otherBranchItem,
    ids.unavailableItem,
    ids.stockItem,
  ] } } });
  await prisma.menuItem.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.taxRule.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.session.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.table.deleteMany({ where: { branchId: { in: [ids.branch, ids.otherBranch] } } });
  await prisma.category.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.branch.deleteMany({ where: { id: { in: [ids.branch, ids.otherBranch] } } });
  await prisma.tenant.deleteMany({ where: { id: ids.tenant } });
}

async function seed() {
  await prisma.tenant.create({ data: { id: ids.tenant, name: "Public Order Tenant" } });
  await prisma.branch.createMany({
    data: [
      { id: ids.branch, tenantId: ids.tenant, name: "Main", location: "Test" },
      { id: ids.otherBranch, tenantId: ids.tenant, name: "Other", location: "Test" },
    ],
  });
  await prisma.table.createMany({
    data: [
      { id: ids.table, branchId: ids.branch, tableCode: "T1", capacity: 2, status: TableStatus.OCCUPIED },
      { id: ids.table2, branchId: ids.branch, tableCode: "T2", capacity: 2, status: TableStatus.OCCUPIED },
      { id: ids.completedTable, branchId: ids.branch, tableCode: "T3", capacity: 2, status: TableStatus.CLEANING },
    ],
  });
  await prisma.session.createMany({
    data: [
      { id: ids.session, tenantId: ids.tenant, branchId: ids.branch, tableId: ids.table, guestCount: 2, status: SessionStatus.ACTIVE },
      { id: ids.session2, tenantId: ids.tenant, branchId: ids.branch, tableId: ids.table2, guestCount: 2, status: SessionStatus.ACTIVE },
      { id: ids.completedSession, tenantId: ids.tenant, branchId: ids.branch, tableId: ids.completedTable, guestCount: 2, status: SessionStatus.COMPLETED },
    ],
  });
  await prisma.category.create({
    data: { id: ids.category, tenantId: ids.tenant, branchId: ids.branch, name: "Mains" },
  });
  await prisma.taxRule.create({
    data: {
      tenantId: ids.tenant,
      branchId: ids.branch,
      taxClass: TaxClass.FOOD,
      ratePercent: 10,
      isActive: true,
    },
  });
  await prisma.menuItem.createMany({
    data: [
      {
        id: ids.item,
        tenantId: ids.tenant,
        branchId: ids.branch,
        categoryId: ids.category,
        name: "Safe Burger",
        price: 10,
        taxClass: TaxClass.FOOD,
      },
      {
        id: ids.otherBranchItem,
        tenantId: ids.tenant,
        branchId: ids.otherBranch,
        categoryId: ids.category,
        name: "Other Branch Pasta",
        price: 9,
        taxClass: TaxClass.FOOD,
      },
      {
        id: ids.unavailableItem,
        tenantId: ids.tenant,
        branchId: ids.branch,
        categoryId: ids.category,
        name: "Sold Out Soup",
        price: 5,
        taxClass: TaxClass.FOOD,
        isUnavailable: true,
      },
      {
        id: ids.stockItem,
        tenantId: ids.tenant,
        branchId: ids.branch,
        categoryId: ids.category,
        name: "Tracked Steak",
        price: 30,
        taxClass: TaxClass.FOOD,
      },
    ],
  });
  await prisma.menuItemAddition.create({
    data: {
      id: ids.addition,
      menuItemId: ids.item,
      name: "Cheese",
      priceImpact: 2,
    },
  });
  await prisma.inventoryItem.create({
    data: {
      id: ids.inventoryItem,
      tenantId: ids.tenant,
      branchId: ids.branch,
      name: "Steak portion",
      unit: "pcs",
      currentStock: 0,
      reorderLevel: 1,
    },
  });
  await prisma.menuItemInventoryMap.create({
    data: {
      menuItemId: ids.stockItem,
      inventoryItemId: ids.inventoryItem,
      qtyPerItem: 1,
    },
  });
}

async function rejectsAs(fn: () => Promise<unknown>, errorClass: new (...args: any[]) => Error) {
  let thrown: unknown;
  try {
    await fn();
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown instanceof errorClass, `Expected ${errorClass.name}, got ${String(thrown)}`);
}

async function main() {
  await cleanup();
  await seed();

  const maliciousOrder = await service.createOrder(ids.session, {
    tenantId: "attacker-tenant",
    branchId: ids.otherBranch,
    tableId: "attacker-table",
    source: OrderSource.POS_DASHBOARD,
    totalAmount: 0.01,
    paymentStatus: "PAID",
    orderStatus: "COMPLETED",
    items: [{
      menuItemId: ids.item,
      quantity: 2,
      price: 0.01,
      lineTotal: 0.02,
      additions: [{ additionId: ids.addition, priceImpact: 0 }],
    }],
    specialInstructions: "No onions",
    idempotencyKey: `${runId}-valid`,
  } as any);

  assert.equal(maliciousOrder.tenantId, ids.tenant);
  assert.equal(maliciousOrder.branchId, ids.branch);
  assert.equal(maliciousOrder.source, OrderSource.USER_APP);
  assert.equal(maliciousOrder.paymentStatus, "UNPAID");
  assert.equal(maliciousOrder.orderStatus, "PLACED");
  assert.equal(maliciousOrder.subtotalAmount.toString(), "24");
  assert.equal(maliciousOrder.taxAmount.toString(), "2.4");
  assert.equal(maliciousOrder.totalAmount.toString(), "26.4");
  assert.equal(maliciousOrder.orderItems[0]?.itemBasePrice.toString(), "12");

  const replayedOrder = await service.createOrder(ids.session, {
    items: [{ menuItemId: ids.item, quantity: 999 }],
    idempotencyKey: `${runId}-valid`,
  });
  assert.equal(replayedOrder.id, maliciousOrder.id);
  assert.equal(replayedOrder.totalAmount.toString(), "26.4");

  await rejectsAs(
    () => service.createOrder(`${runId}-missing-session`, {
      items: [{ menuItemId: ids.item, quantity: 1 }],
      idempotencyKey: `${runId}-missing-session`,
    }),
    NotFoundException,
  );

  await rejectsAs(
    () => service.createOrder(ids.session, {
      items: [{ menuItemId: ids.otherBranchItem, quantity: 1 }],
      idempotencyKey: `${runId}-other-branch`,
    }),
    NotFoundException,
  );

  await rejectsAs(
    () => service.createOrder(ids.session, {
      items: [{ menuItemId: ids.unavailableItem, quantity: 1 }],
      idempotencyKey: `${runId}-unavailable`,
    }),
    ConflictException,
  );

  await rejectsAs(
    () => service.createOrder(ids.session, {
      items: [{ menuItemId: ids.stockItem, quantity: 1 }],
      idempotencyKey: `${runId}-stock`,
    }),
    ConflictException,
  );

  await rejectsAs(
    () => service.createOrder(ids.completedSession, {
      items: [{ menuItemId: ids.item, quantity: 1 }],
      idempotencyKey: `${runId}-completed`,
    }),
    BadRequestException,
  );

  await rejectsAs(
    () => service.createOrder(ids.session2, {
      items: [{ menuItemId: ids.item, quantity: 1 }],
      idempotencyKey: `${runId}-valid`,
    }),
    ConflictException,
  );

  console.log("Public order creation hardening tests passed");
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
