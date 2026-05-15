import "dotenv/config";
import assert from "node:assert/strict";
import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import {
  OrderPaymentStatus,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  SessionStatus,
  StaffRoleCode,
  TableStatus,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { RealtimeService } from "../realtime/realtime.service.js";
import { BranchAccessService } from "../auth/branch-access.service.js";
import { PaymentsService } from "./payments.service.js";
import type { PaymentGateway, PaymentIntentInput } from "../../contracts/payment-gateway.js";

const prisma = new PrismaService();
const realtime = new RealtimeService();
const loyalty = {
  postEarnForPayment: async () => undefined,
  reverseForRefund: async () => undefined,
};
const logs = {
  writePayment: async () => undefined,
};
const branchAccess = new BranchAccessService(prisma);
const service = new PaymentsService(prisma, realtime, loyalty as any, logs as any, branchAccess);
const runId = `payment-safety-${Date.now()}`;

const ids = {
  tenant: `${runId}-tenant`,
  branch: `${runId}-branch`,
  otherBranch: `${runId}-other-branch`,
  staff: `${runId}-staff`,
  otherStaff: `${runId}-other-staff`,
  table: `${runId}-table`,
  otherTable: `${runId}-other-table`,
  session: `${runId}-session`,
  otherSession: `${runId}-other-session`,
  order: `${runId}-order`,
  partialOrder: `${runId}-partial-order`,
  paidOrder: `${runId}-paid-order`,
  cancelledOrder: `${runId}-cancelled-order`,
  otherBranchOrder: `${runId}-other-branch-order`,
};

const branchStaff = {
  staffId: ids.staff,
  tenantId: ids.tenant,
  branchId: ids.branch,
  primaryRole: StaffRoleCode.CASHIER,
  permissions: ["payments:read", "payments:write"],
};

class CaptureGateway implements PaymentGateway {
  readonly name = "capture";
  calls: PaymentIntentInput[] = [];
  private counter = 0;

  async createIntent(input: PaymentIntentInput) {
    this.calls.push(input);
    this.counter += 1;
    return {
      provider: this.name,
      externalId: `${runId}-intent-${this.counter}`,
      checkoutUrl: `https://pay.test/${this.counter}`,
      status: "pending" as const,
    };
  }

  verifyWebhookSignature() {
    return true;
  }

  parseWebhookEvent(): never {
    throw new Error("not used");
  }
}

async function cleanup() {
  await prisma.paymentSplit.deleteMany({ where: { payment: { tenantId: ids.tenant } } });
  await prisma.refund.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.payment.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.orderStatusHistory.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.orderItem.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.order.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.session.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.auditLog.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.staffRoleAssignment.deleteMany({ where: { staff: { tenantId: ids.tenant } } });
  await prisma.staff.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.table.deleteMany({ where: { branchId: { in: [ids.branch, ids.otherBranch] } } });
  await prisma.branch.deleteMany({ where: { id: { in: [ids.branch, ids.otherBranch] } } });
  await prisma.tenant.deleteMany({ where: { id: ids.tenant } });
}

async function seed() {
  await prisma.tenant.create({ data: { id: ids.tenant, name: "Payment Safety Tenant" } });
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
        name: "Cashier",
        phone: `${runId}-1`,
        email: `${runId}-cashier@test.local`,
        primaryRole: StaffRoleCode.CASHIER,
        passwordHash: "test",
      },
      {
        id: ids.otherStaff,
        tenantId: ids.tenant,
        branchId: ids.otherBranch,
        name: "Other Cashier",
        phone: `${runId}-2`,
        email: `${runId}-other@test.local`,
        primaryRole: StaffRoleCode.CASHIER,
        passwordHash: "test",
      },
    ],
  });
  await prisma.table.createMany({
    data: [
      { id: ids.table, branchId: ids.branch, tableCode: "T1", capacity: 2, status: TableStatus.OCCUPIED },
      { id: ids.otherTable, branchId: ids.otherBranch, tableCode: "T1", capacity: 2, status: TableStatus.OCCUPIED },
    ],
  });
  await prisma.session.createMany({
    data: [
      { id: ids.session, tenantId: ids.tenant, branchId: ids.branch, tableId: ids.table, guestCount: 2, status: SessionStatus.ACTIVE },
      { id: ids.otherSession, tenantId: ids.tenant, branchId: ids.otherBranch, tableId: ids.otherTable, guestCount: 2, status: SessionStatus.ACTIVE },
    ],
  });

  await createOrder(ids.order, ids.branch, ids.session, OrderStatus.SERVED, OrderPaymentStatus.UNPAID, 50);
  await createOrder(ids.partialOrder, ids.branch, ids.session, OrderStatus.SERVED, OrderPaymentStatus.UNPAID, 80);
  await createOrder(ids.paidOrder, ids.branch, ids.session, OrderStatus.SERVED, OrderPaymentStatus.PAID, 20);
  await createOrder(ids.cancelledOrder, ids.branch, ids.session, OrderStatus.CANCELLED, OrderPaymentStatus.UNPAID, 30);
  await createOrder(ids.otherBranchOrder, ids.otherBranch, ids.otherSession, OrderStatus.SERVED, OrderPaymentStatus.UNPAID, 40);

  await prisma.payment.create({
    data: {
      tenantId: ids.tenant,
      branchId: ids.branch,
      orderId: ids.paidOrder,
      sessionId: ids.session,
      amount: 20,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.COMPLETED,
    },
  });
  await prisma.payment.create({
    data: {
      tenantId: ids.tenant,
      branchId: ids.branch,
      orderId: ids.partialOrder,
      sessionId: ids.session,
      amount: 30,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.COMPLETED,
    },
  });
}

async function createOrder(
  id: string,
  branchId: string,
  sessionId: string,
  orderStatus: OrderStatus,
  paymentStatus: OrderPaymentStatus,
  totalAmount: number,
) {
  await prisma.order.create({
    data: {
      id,
      tenantId: ids.tenant,
      branchId,
      sessionId,
      source: OrderSource.USER_APP,
      orderStatus,
      paymentStatus,
      subtotalAmount: totalAmount,
      taxAmount: 0,
      serviceChargeAmount: 0,
      discountAmount: 0,
      totalAmount,
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

  const gateway = new CaptureGateway();
  const intent = await service.createPaymentIntent(
    ids.partialOrder,
    PaymentMethod.CARD,
    undefined,
    "",
    gateway,
  );
  assert.equal(gateway.calls[0]?.amountMinor, 5000, "intent must use remaining DB amount, not client amount");
  assert.equal(intent.amount, "50");

  await rejectsAs(
    () => service.createPaymentIntent(ids.paidOrder, PaymentMethod.CARD, undefined, "", gateway),
    ConflictException,
  );
  await rejectsAs(
    () => service.createPaymentIntent(ids.cancelledOrder, PaymentMethod.CARD, undefined, "", gateway),
    ConflictException,
  );
  await rejectsAs(
    () => service.listForOrder(ids.otherBranchOrder, branchStaff),
    ForbiddenException,
  );

  const mismatch = await service.handleWebhookEvent({
    type: "payment.completed",
    externalId: intent.externalId,
    amount: 1,
    currency: "USD",
  });
  assert.equal(mismatch.ignored, true);
  const stillPending = await prisma.payment.findUniqueOrThrow({ where: { id: intent.paymentId } });
  assert.equal(stillPending.paymentStatus, PaymentStatus.PENDING);
  const stillUnpaid = await prisma.order.findUniqueOrThrow({ where: { id: ids.partialOrder } });
  assert.equal(stillUnpaid.paymentStatus, OrderPaymentStatus.UNPAID);

  const valid = await service.handleWebhookEvent({
    type: "payment.completed",
    externalId: intent.externalId,
    amount: 5000,
    currency: "USD",
  });
  assert.equal(valid.processed, true);
  const completed = await prisma.payment.findUniqueOrThrow({ where: { id: intent.paymentId } });
  assert.equal(completed.paymentStatus, PaymentStatus.COMPLETED);
  const paid = await prisma.order.findUniqueOrThrow({ where: { id: ids.partialOrder } });
  assert.equal(paid.paymentStatus, OrderPaymentStatus.PAID);

  const duplicate = await service.handleWebhookEvent({
    type: "payment.completed",
    externalId: intent.externalId,
    amount: 5000,
    currency: "USD",
  });
  assert.equal(duplicate.ignored, true);

  const cash = await service.createPayment(ids.order, {
    paymentMethod: PaymentMethod.CASH,
    paymentStatus: PaymentStatus.FAILED,
  } as any, branchStaff);
  assert.equal(cash.paymentStatus, PaymentStatus.COMPLETED);
  assert.equal(cash.amount.toString(), "50");

  await rejectsAs(
    () => service.createPayment(ids.otherBranchOrder, {
      paymentMethod: PaymentMethod.CASH,
    } as any, branchStaff),
    ForbiddenException,
  );

  await rejectsAs(
    () => service.createPayment(ids.order, {
      paymentMethod: PaymentMethod.CARD,
    } as any, branchStaff),
    BadRequestException,
  );

  const refund = await service.createRefund(cash.id, {
    amount: 20,
    reason: "guest issue",
  }, { ...branchStaff, permissions: ["payments:read", "payments:write", "payments:refund"] } as any);
  assert.equal(refund.amount.toString(), "20");
  const partiallyRefundedOrder = await prisma.order.findUniqueOrThrow({ where: { id: ids.order } });
  assert.equal(partiallyRefundedOrder.paymentStatus, OrderPaymentStatus.PARTIALLY_PAID);

  await rejectsAs(
    () => service.createRefund(cash.id, {
      amount: 31,
      reason: "too much",
    }, { ...branchStaff, permissions: ["payments:read", "payments:write", "payments:refund"] } as any),
    ConflictException,
  );

  console.log("Payment safety tests passed");
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
