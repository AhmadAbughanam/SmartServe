import "dotenv/config";
import assert from "node:assert/strict";
import {
  KitchenItemStatus,
  OrderSource,
  OrderStatus,
  SessionStatus,
  StaffRoleCode,
  TaxClass,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { RealtimeService } from "../realtime/realtime.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { KdsService } from "../kds/kds.service.js";
import { WaiterService } from "./waiter.service.js";
import { OrdersService } from "../orders/orders.service.js";

const prisma = new PrismaService();
const realtime = new RealtimeService();
const notifications = new NotificationsService(prisma);
const branchAccess = {
  assertUserCanAccessBranch: async () => undefined,
  assertUserCanAccessEntityBranch: async () => undefined,
};
const kds = new KdsService(prisma, realtime, notifications, branchAccess as any);
const logs = { writeOperational: async () => undefined };
const orders = new OrdersService(prisma, realtime, logs as any, branchAccess as any);
const waiter = new WaiterService(prisma, realtime, branchAccess as any, orders);
const runId = `waiter-order-assignment-${Date.now()}`;

const ids = {
  tenant: `${runId}-tenant`,
  branch: `${runId}-branch`,
  table: `${runId}-table`,
  session: `${runId}-session`,
  waiterOne: `${runId}-waiter-one`,
  waiterTwo: `${runId}-waiter-two`,
  chef: `${runId}-chef`,
  category: `${runId}-category`,
  item: `${runId}-item`,
  assignedOrder: `${runId}-assigned-order`,
  assignedOrderItem: `${runId}-assigned-order-item`,
  unassignedOrder: `${runId}-unassigned-order`,
  unassignedOrderItem: `${runId}-unassigned-order-item`,
};

async function cleanup() {
  await prisma.notification.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.auditLog.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.orderStatusHistory.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.orderItem.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.order.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.session.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.table.deleteMany({ where: { branchId: ids.branch } });
  await prisma.menuItem.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.category.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.staff.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.branch.deleteMany({ where: { id: ids.branch } });
  await prisma.tenant.deleteMany({ where: { id: ids.tenant } });
}

function staff(id: string, email: string, primaryRole: StaffRoleCode) {
  return {
    id,
    tenantId: ids.tenant,
    branchId: ids.branch,
    name: id,
    phone: `+1555${Math.floor(Math.random() * 1_000_000)}`,
    email,
    primaryRole,
    passwordHash: "test",
  };
}

async function seed() {
  await prisma.tenant.create({ data: { id: ids.tenant, name: "Waiter Order Assignment Tenant" } });
  await prisma.branch.create({
    data: { id: ids.branch, tenantId: ids.tenant, name: "Main", location: "Test" },
  });
  await prisma.staff.createMany({
    data: [
      staff(ids.waiterOne, "waiter-one-order@example.com", StaffRoleCode.WAITER),
      staff(ids.waiterTwo, "waiter-two-order@example.com", StaffRoleCode.WAITER),
      staff(ids.chef, "chef-order@example.com", StaffRoleCode.CHEF),
    ],
  });
  await prisma.table.create({
    data: { id: ids.table, branchId: ids.branch, tableCode: "WO1", capacity: 2, status: "OCCUPIED" },
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
  await prisma.table.update({
    where: { id: ids.table },
    data: { lastSessionId: ids.session },
  });
  await prisma.category.create({
    data: { id: ids.category, tenantId: ids.tenant, branchId: ids.branch, name: "Mains" },
  });
  await prisma.menuItem.create({
    data: {
      id: ids.item,
      tenantId: ids.tenant,
      branchId: ids.branch,
      categoryId: ids.category,
      name: "Test Burger",
      price: 10,
      taxClass: TaxClass.FOOD,
    },
  });

  await createOrder(ids.assignedOrder, ids.assignedOrderItem, ids.waiterOne);
  await createOrder(ids.unassignedOrder, ids.unassignedOrderItem, null);
}

async function createOrder(orderId: string, orderItemId: string, assignedWaiterId: string | null) {
  await prisma.order.create({
    data: {
      id: orderId,
      tenantId: ids.tenant,
      branchId: ids.branch,
      sessionId: ids.session,
      assignedWaiterId,
      orderStatus: OrderStatus.IN_KITCHEN,
      source: OrderSource.USER_APP,
      subtotalAmount: 10,
      taxAmount: 0,
      serviceChargeAmount: 0,
      discountAmount: 0,
      totalAmount: 10,
      orderItems: {
        create: {
          id: orderItemId,
          tenantId: ids.tenant,
          branchId: ids.branch,
          menuItemId: ids.item,
          quantity: 1,
          itemBasePrice: 10,
          lineDiscountAmount: 0,
          lineTaxAmount: 0,
          lineTotal: 10,
          kitchenStatus: KitchenItemStatus.READY,
        },
      },
    },
  });
}

async function main() {
  await cleanup();
  await seed();

  await kds.markOrderReady(ids.assignedOrder, {
    staffId: ids.chef,
    tenantId: ids.tenant,
    branchId: ids.branch,
    primaryRole: StaffRoleCode.CHEF,
    permissions: [],
  });

  const targeted = await prisma.notification.findFirst({
    where: { tenantId: ids.tenant, staffId: ids.waiterOne, type: "ORDER_STATUS" },
  });
  assert.equal(targeted?.staffId, ids.waiterOne);

  const waiterOneFloor = await waiter.getFloorSummary(ids.branch, ids.tenant, ids.waiterOne);
  const waiterTwoFloor = await waiter.getFloorSummary(ids.branch, ids.tenant, ids.waiterTwo);
  assert.equal(waiterOneFloor[0]?.session?.hasReadyOrders, true);
  assert.equal(waiterTwoFloor[0]?.session?.hasReadyOrders, true);

  const waiterTwoAssignedReady = await waiter.getReadyOrders(ids.branch, ids.tenant, ids.waiterTwo);
  const assignedToOther = waiterTwoAssignedReady.find((order) => order.id === ids.assignedOrder);
  assert.equal(assignedToOther?.assignedWaiterId, ids.waiterOne);
  assert.equal(assignedToOther?.isMine, false);

  await kds.markOrderReady(ids.unassignedOrder, {
    staffId: ids.chef,
    tenantId: ids.tenant,
    branchId: ids.branch,
    primaryRole: StaffRoleCode.CHEF,
    permissions: [],
  });
  const waiterTwoReadyHandoff = await waiter.getReadyOrders(ids.branch, ids.tenant, ids.waiterTwo);
  const unassignedReady = waiterTwoReadyHandoff.find((order) => order.id === ids.unassignedOrder);
  assert.equal(unassignedReady?.assignedWaiterId, null);
  assert.equal(unassignedReady?.isMine, false);

  await assert.rejects(
    () => waiter.serveOrder(ids.assignedOrder, {
      staffId: ids.waiterTwo,
      tenantId: ids.tenant,
      branchId: ids.branch,
      primaryRole: StaffRoleCode.WAITER,
      permissions: [],
    }),
    /Only the waiter assigned/,
  );

  const served = await waiter.serveOrder(ids.assignedOrder, {
    staffId: ids.waiterOne,
    tenantId: ids.tenant,
    branchId: ids.branch,
    primaryRole: StaffRoleCode.WAITER,
    permissions: [],
  });
  assert.equal(served.orderStatus, OrderStatus.SERVED);
  assert.ok(served.inventoryDecrementedAt);

  const waiterTwoStaff = {
    staffId: ids.waiterTwo,
    tenantId: ids.tenant,
    branchId: ids.branch,
    primaryRole: StaffRoleCode.WAITER,
    permissions: [],
  };
  const claimed = await waiter.claimOrder(ids.unassignedOrder, waiterTwoStaff);
  assert.equal(claimed.assignedWaiterId, ids.waiterTwo);
  const waiterTwoReadyAfterClaim = await waiter.getReadyOrders(ids.branch, ids.tenant, ids.waiterTwo);
  assert.equal(waiterTwoReadyAfterClaim.find((order) => order.id === ids.unassignedOrder)?.isMine, true);
  await assert.rejects(
    () => waiter.claimOrder(ids.unassignedOrder, {
      staffId: ids.waiterOne,
      tenantId: ids.tenant,
      branchId: ids.branch,
      primaryRole: StaffRoleCode.WAITER,
      permissions: [],
    }),
    /already assigned/,
  );

  console.log("Waiter order assignment notification checks passed");
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
