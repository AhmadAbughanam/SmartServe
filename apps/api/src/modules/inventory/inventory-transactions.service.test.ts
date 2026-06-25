import "dotenv/config";
import assert from "node:assert/strict";
import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import {
  KitchenItemStatus,
  OrderPaymentStatus,
  OrderSource,
  OrderStatus,
  SessionStatus,
  TableStatus,
  TaxClass,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { RealtimeService } from "../realtime/realtime.service.js";
import { BranchAccessService } from "../auth/branch-access.service.js";
import { OrdersService } from "../orders/orders.service.js";
import { InventoryService } from "./inventory.service.js";

const StaffRoleCode = {
  WAITER: "WAITER",
} as const;

const prisma = new PrismaService();
const realtime = new RealtimeService();
const logs = { writeOperational: async () => undefined };
const branchAccess = new BranchAccessService(prisma);
const orders = new OrdersService(prisma, realtime, logs as any, branchAccess);
const inventory = new InventoryService(prisma, realtime, branchAccess);
const runId = `inventory-tx-${Date.now()}`;

const ids = {
  tenant: `${runId}-tenant`,
  branch: `${runId}-branch`,
  otherBranch: `${runId}-other-branch`,
  staff: `${runId}-staff`,
  otherStaff: `${runId}-other-staff`,
  table: `${runId}-table`,
  session: `${runId}-session`,
  category: `${runId}-category`,
  menuItem: `${runId}-menu-item`,
  inventoryItem: `${runId}-inventory-item`,
  otherInventoryItem: `${runId}-other-inventory-item`,
};

const staff = {
  staffId: ids.staff,
  tenantId: ids.tenant,
  branchId: ids.branch,
  primaryRole: StaffRoleCode.WAITER,
  permissions: ["orders:write", "inventory:adjust"],
};

async function cleanup() {
  await prisma.stockAdjustment.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.lowStockAlert.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.auditLog.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.orderStatusHistory.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.orderItem.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.order.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.menuItemInventoryMap.deleteMany({
    where: { inventoryItemId: { in: [ids.inventoryItem, ids.otherInventoryItem] } },
  });
  await prisma.inventoryItem.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.menuItem.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.category.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.session.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.staff.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.table.deleteMany({ where: { branchId: { in: [ids.branch, ids.otherBranch] } } });
  await prisma.branch.deleteMany({ where: { id: { in: [ids.branch, ids.otherBranch] } } });
  await prisma.tenant.deleteMany({ where: { id: ids.tenant } });
}

async function seed() {
  await prisma.tenant.create({ data: { id: ids.tenant, name: "Inventory Tx Tenant" } });
  await prisma.branch.createMany({
    data: [
      { id: ids.branch, tenantId: ids.tenant, name: "Main", location: "Test" },
      { id: ids.otherBranch, tenantId: ids.tenant, name: "Other", location: "Test" },
    ],
  });
  await prisma.staff.createMany({
    data: [
      {
        id: ids.staff,
        tenantId: ids.tenant,
        branchId: ids.branch,
        name: "Waiter",
        phone: `${runId}-staff`,
        email: `${runId}-staff@test.local`,
        primaryRole: StaffRoleCode.WAITER,
        passwordHash: "test",
      },
      {
        id: ids.otherStaff,
        tenantId: ids.tenant,
        branchId: ids.otherBranch,
        name: "Other Waiter",
        phone: `${runId}-other-staff`,
        email: `${runId}-other@test.local`,
        primaryRole: StaffRoleCode.WAITER,
        passwordHash: "test",
      },
    ],
  });
  await prisma.table.create({
    data: {
      id: ids.table,
      branchId: ids.branch,
      tableCode: "T1",
      capacity: 2,
      status: TableStatus.OCCUPIED,
    },
  });
  await prisma.session.create({
    data: {
      id: ids.session,
      tenantId: ids.tenant,
      branchId: ids.branch,
      tableId: ids.table,
      guestCount: 2,
      status: SessionStatus.ACTIVE,
    },
  });
  await prisma.category.create({
    data: { id: ids.category, tenantId: ids.tenant, branchId: ids.branch, name: "Mains" },
  });
  await prisma.menuItem.create({
    data: {
      id: ids.menuItem,
      tenantId: ids.tenant,
      branchId: ids.branch,
      categoryId: ids.category,
      name: "Tracked Burger",
      price: 10,
      taxClass: TaxClass.FOOD,
    },
  });
  await prisma.inventoryItem.createMany({
    data: [
      {
        id: ids.inventoryItem,
        tenantId: ids.tenant,
        branchId: ids.branch,
        name: "Burger patty",
        unit: "pcs",
        currentStock: 10,
        reorderLevel: 2,
      },
      {
        id: ids.otherInventoryItem,
        tenantId: ids.tenant,
        branchId: ids.otherBranch,
        name: "Other branch patty",
        unit: "pcs",
        currentStock: 5,
        reorderLevel: 1,
      },
    ],
  });
  await prisma.menuItemInventoryMap.create({
    data: {
      menuItemId: ids.menuItem,
      inventoryItemId: ids.inventoryItem,
      qtyPerItem: 2,
    },
  });
}

async function createReadyOrder(id: string, quantity: number) {
  await prisma.order.create({
    data: {
      id,
      tenantId: ids.tenant,
      branchId: ids.branch,
      sessionId: ids.session,
      source: OrderSource.USER_APP,
      orderStatus: OrderStatus.READY,
      paymentStatus: OrderPaymentStatus.UNPAID,
      subtotalAmount: quantity * 10,
      taxAmount: 0,
      serviceChargeAmount: 0,
      discountAmount: 0,
      totalAmount: quantity * 10,
    },
  });
  await prisma.orderItem.create({
    data: {
      orderId: id,
      tenantId: ids.tenant,
      branchId: ids.branch,
      menuItemId: ids.menuItem,
      quantity,
      itemBasePrice: 10,
      lineDiscountAmount: 0,
      lineTaxAmount: 0,
      lineTotal: quantity * 10,
      kitchenStatus: KitchenItemStatus.READY,
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

  const servedOrder = `${runId}-served-order`;
  await createReadyOrder(servedOrder, 2);
  const served = await orders.updateStatus(servedOrder, OrderStatus.SERVED, staff as any, "delivered");
  assert.equal(served.orderStatus, OrderStatus.SERVED);
  assert.ok(served.inventoryDecrementedAt);

  const decremented = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: ids.inventoryItem } });
  assert.equal(decremented.currentStock.toString(), "6");
  const movement = await prisma.stockAdjustment.findFirstOrThrow({
    where: { tenantId: ids.tenant, inventoryItemId: ids.inventoryItem, sourceType: "ORDER_AUTO" },
  });
  assert.equal(movement.delta.toString(), "-4");
  assert.match(movement.reason ?? "", /before=10; after=6/);

  await rejectsAs(
    () => orders.updateStatus(servedOrder, OrderStatus.SERVED, staff as any, "retry"),
    BadRequestException,
  );
  const afterRetry = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: ids.inventoryItem } });
  assert.equal(afterRetry.currentStock.toString(), "6");

  const insufficientOrder = `${runId}-insufficient-order`;
  await createReadyOrder(insufficientOrder, 4);
  await rejectsAs(
    () => orders.updateStatus(insufficientOrder, OrderStatus.SERVED, staff as any, "too much"),
    ConflictException,
  );
  const stillReady = await prisma.order.findUniqueOrThrow({ where: { id: insufficientOrder } });
  assert.equal(stillReady.orderStatus, OrderStatus.READY);
  const stockAfterFailure = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: ids.inventoryItem } });
  assert.equal(stockAfterFailure.currentStock.toString(), "6");

  const adjusted = await inventory.adjust(ids.inventoryItem, 3, "delivery", staff as any);
  assert.equal(adjusted.currentStock.toString(), "9");
  const manualMovement = await prisma.stockAdjustment.findFirstOrThrow({
    where: { tenantId: ids.tenant, inventoryItemId: ids.inventoryItem, sourceType: "MANUAL" },
    orderBy: { createdAt: "desc" },
  });
  assert.equal(manualMovement.delta.toString(), "3");
  assert.match(manualMovement.reason ?? "", /before=6; after=9/);

  await rejectsAs(
    () => inventory.adjust(ids.otherInventoryItem, 1, "wrong branch", staff as any),
    ForbiddenException,
  );
  await rejectsAs(
    () => inventory.adjust(ids.inventoryItem, -99, "bad count", staff as any),
    BadRequestException,
  );

  await inventory.adjust(ids.inventoryItem, -9, "deplete", staff as any);
  await rejectsAs(
    () => inventory.adjust(ids.inventoryItem, -1, "second decrement", staff as any),
    BadRequestException,
  );

  console.log("Inventory transaction hardening tests passed");
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
