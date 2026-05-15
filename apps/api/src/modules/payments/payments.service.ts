import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import {
  PaymentMethod,
  OrderPaymentStatus,
  OrderStatus,
  PayerType,
  PaymentStatus,
  RefundStatus,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../../prisma/prisma.service.js";
import { LoyaltyService } from "../loyalty/loyalty.service.js";
import { RealtimeService } from "../realtime/realtime.service.js";
import { LogsService } from "../logs/logs.service.js";
import { BranchAccessService } from "../auth/branch-access.service.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";
import { calculateOrderPaymentStatus } from "./payment-status.rules.js";
import type { CreatePaymentDto } from "./dto/create-payment.dto.js";
import type { CreateRefundDto } from "./dto/create-refund.dto.js";

function isOrderServedForPayment(status: OrderStatus): boolean {
  return status === OrderStatus.SERVED || status === OrderStatus.COMPLETED;
}

const PAYMENT_CURRENCY = "USD";

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
    @Inject(LoyaltyService) private readonly loyaltyService: LoyaltyService,
    @Inject(LogsService) private readonly logsService: LogsService,
    @Inject(BranchAccessService)
    private readonly branchAccess: BranchAccessService,
  ) {}

  async createPayment(
    orderId: string,
    dto: CreatePaymentDto,
    staff: AuthenticatedStaff,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order || order.tenantId !== staff.tenantId) {
      throw new NotFoundException("Order not found");
    }
    await this.branchAccess.assertUserCanAccessEntityBranch(staff, order);
    if (order.orderStatus === OrderStatus.CANCELLED) {
      throw new ConflictException("Cannot pay a cancelled order");
    }
    if (!isOrderServedForPayment(order.orderStatus)) {
      throw new BadRequestException("Payment is available after the order is served");
    }
    if (dto.paymentMethod !== PaymentMethod.CASH && dto.paymentMethod !== PaymentMethod.CARD) {
      throw new BadRequestException("Manual payments must use CASH or CARD");
    }
    if (dto.paymentMethod === PaymentMethod.CARD && !dto.paymentReference?.trim()) {
      throw new BadRequestException("Terminal card payments require a payment reference");
    }

    const remaining = await this.calculateOrderRemainingDecimal(orderId, order.totalAmount);
    if (remaining.lte(0) || order.paymentStatus === OrderPaymentStatus.PAID) {
      throw new ConflictException("Order is already fully paid");
    }
    const payAmount = dto.amount === undefined
      ? remaining
      : new Decimal(dto.amount).toDecimalPlaces(2);
    if (payAmount.lte(0)) {
      throw new BadRequestException("Payment amount must be greater than zero");
    }
    if (payAmount.gt(remaining)) {
      throw new BadRequestException("Payment amount exceeds amount due");
    }

    // Validate splits sum if provided
    if (dto.splits?.length) {
      const splitSum = dto.splits.reduce((s, sp) => s + sp.amount, 0);
      const diff = Math.abs(splitSum - payAmount.toNumber());
      if (diff > 0.01) {
        throw new BadRequestException(
          `Split amounts sum (${splitSum.toFixed(2)}) does not match payment amount (${payAmount.toFixed(2)})`,
        );
      }

      // Validate participant IDs belong to the order's session
      const participantIds = dto.splits
        .map((s) => s.participantId)
        .filter(Boolean) as string[];
      if (participantIds.length > 0) {
        const validParticipants = await this.prisma.sessionParticipant.findMany({
          where: {
            id: { in: participantIds },
            sessionId: order.sessionId,
          },
        });
        const validIds = new Set(validParticipants.map((p) => p.id));
        for (const pid of participantIds) {
          if (!validIds.has(pid)) {
            throw new BadRequestException(
              `Participant ${pid} not found in session`,
            );
          }
        }
      }
    }

    const paymentStatus = PaymentStatus.COMPLETED;

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          tenantId: staff.tenantId,
          branchId: order.branchId,
          orderId,
          sessionId: order.sessionId,
          amount: payAmount,
          paymentMethod: dto.paymentMethod,
          paymentStatus,
          paymentReference: dto.paymentReference,
          tipAmount: dto.tipAmount,
          payerType: PayerType.CUSTOMER,
        },
      });

      // Create splits if provided
      if (dto.splits?.length) {
        await tx.paymentSplit.createMany({
          data: dto.splits.map((s) => ({
            paymentId: payment.id,
            splitType: s.splitType,
            participantId: s.participantId,
            amount: s.amount,
          })),
        });
      }

      // Recalculate order payment status
      if (paymentStatus === PaymentStatus.COMPLETED) {
        const allPayments = await tx.payment.findMany({
          where: { orderId },
        });
        const allRefunds = await tx.refund.findMany({
          where: { orderId },
        });

        const newPaymentStatus = calculateOrderPaymentStatus(
          order.totalAmount,
          allPayments,
          allRefunds,
        );

        await tx.order.update({
          where: { id: orderId },
          data: { paymentStatus: newPaymentStatus },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            tenantId: staff.tenantId,
            branchId: order.branchId,
            actorStaffId: staff.staffId,
            actionCode: "PAYMENT_CREATED",
            entityType: "Payment",
            entityId: payment.id,
            afterJson: {
              paymentId: payment.id,
              orderId,
              amount: payAmount.toString(),
              method: dto.paymentMethod,
              orderPaymentStatus: newPaymentStatus,
            },
          },
        });
      }

      return tx.payment.findUniqueOrThrow({
        where: { id: payment.id },
        include: { splits: true },
      });
    });

    if (paymentStatus === PaymentStatus.COMPLETED) {
      this.realtime.emit(
        "PAYMENT_COMPLETED",
        staff.tenantId,
        order.branchId,
        {
          paymentId: result.id,
          orderId,
          sessionId: order.sessionId,
          amount: dto.amount,
          method: dto.paymentMethod,
        },
      );
      this.loyaltyService.postEarnForPayment(result.id).catch((error: unknown) => {
        console.warn("Loyalty point earning failed", error);
      });
    }
    void this.logsService.writePayment({
      tenantId: staff.tenantId,
      branchId: order.branchId,
      orderId,
      sessionId: order.sessionId,
      paymentId: result.id,
      eventType: paymentStatus === PaymentStatus.COMPLETED ? "PAYMENT_COMPLETED" : "PAYMENT_CREATED",
      amount: payAmount,
      status: paymentStatus,
      metadata: {
        method: dto.paymentMethod,
        payerType: PayerType.CUSTOMER,
        manual: true,
      },
    });

    return result;
  }

  async getByReference(paymentId: string) {
    return this.prisma.payment.findUnique({ where: { id: paymentId } });
  }

  async listForOrder(orderId: string, staff: AuthenticatedStaff) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order || order.tenantId !== staff.tenantId) {
      throw new NotFoundException("Order not found");
    }
    await this.branchAccess.assertUserCanAccessEntityBranch(staff, order);

    const payments = await this.prisma.payment.findMany({
      where: { orderId, tenantId: staff.tenantId, branchId: order.branchId },
      orderBy: { paymentDate: "asc" },
      include: { splits: true, refunds: true },
    });

    return {
      orderId,
      orderTotal: order.totalAmount,
      paymentStatus: order.paymentStatus,
      payments,
    };
  }

  async getSessionBill(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        tenantId: true,
        branchId: true,
      },
    });
    if (!session) throw new NotFoundException("Session not found");

    const orders = await this.prisma.order.findMany({
      where: {
        sessionId,
        tenantId: session.tenantId,
        branchId: session.branchId,
        orderStatus: { not: OrderStatus.CANCELLED },
      },
      orderBy: { orderDateTime: "asc" },
      include: {
        payments: true,
        refunds: true,
      },
    });

    const billOrders = orders.map((order) => {
      const completedPayments = this.sumCompletedPayments(order.payments);
      const completedRefunds = this.sumCompletedRefunds(order.refunds);
      const netPaid = completedPayments.sub(completedRefunds);
      const remainingAmount = Decimal.max(
        order.totalAmount.sub(netPaid),
        new Decimal(0),
      ).toDecimalPlaces(2);

      return {
        id: order.id,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        orderDateTime: order.orderDateTime.toISOString(),
        subtotalAmount: order.subtotalAmount.toString(),
        taxAmount: order.taxAmount.toString(),
        serviceChargeAmount: order.serviceChargeAmount.toString(),
        discountAmount: order.discountAmount.toString(),
        totalAmount: order.totalAmount.toString(),
        paidAmount: netPaid.toDecimalPlaces(2).toString(),
        remainingAmount: remainingAmount.toString(),
      };
    });

    const payableOrders = billOrders.filter((order) =>
      (order.orderStatus === OrderStatus.SERVED || order.orderStatus === OrderStatus.COMPLETED) &&
      new Decimal(order.remainingAmount).gt(0),
    );
    const subtotalAmount = payableOrders
      .reduce((sum, order) => sum.add(order.subtotalAmount), new Decimal(0))
      .toDecimalPlaces(2);
    const taxAmount = payableOrders
      .reduce((sum, order) => sum.add(order.taxAmount), new Decimal(0))
      .toDecimalPlaces(2);
    const serviceChargeAmount = payableOrders
      .reduce((sum, order) => sum.add(order.serviceChargeAmount), new Decimal(0))
      .toDecimalPlaces(2);
    const discountAmount = payableOrders
      .reduce((sum, order) => sum.add(order.discountAmount), new Decimal(0))
      .toDecimalPlaces(2);
    const totalAmount = payableOrders
      .reduce((sum, order) => sum.add(order.totalAmount), new Decimal(0))
      .toDecimalPlaces(2);
    const remainingAmount = payableOrders
      .reduce((sum, order) => sum.add(order.remainingAmount), new Decimal(0))
      .toDecimalPlaces(2);
    const paidAmount = billOrders
      .reduce((sum, order) => sum.add(order.paidAmount), new Decimal(0))
      .toDecimalPlaces(2);

    const paymentStatus =
      remainingAmount.lte(0)
        ? OrderPaymentStatus.PAID
        : paidAmount.gt(0)
          ? OrderPaymentStatus.PARTIALLY_PAID
          : OrderPaymentStatus.UNPAID;

    return {
      sessionId,
      tenantId: session.tenantId,
      branchId: session.branchId,
      orderCount: payableOrders.length,
      subtotalAmount: subtotalAmount.toString(),
      taxAmount: taxAmount.toString(),
      serviceChargeAmount: serviceChargeAmount.toString(),
      discountAmount: discountAmount.toString(),
      totalAmount: totalAmount.toString(),
      paidAmount: paidAmount.toString(),
      remainingAmount: remainingAmount.toString(),
      paymentStatus,
      orders: payableOrders,
      pendingServiceOrderCount: billOrders.filter((order) =>
        order.orderStatus !== OrderStatus.CANCELLED &&
        order.orderStatus !== OrderStatus.SERVED &&
        order.orderStatus !== OrderStatus.COMPLETED &&
        new Decimal(order.remainingAmount).gt(0),
      ).length,
    };
  }

  async getById(paymentId: string, staff: AuthenticatedStaff) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { splits: true, refunds: true },
    });
    if (!payment || payment.tenantId !== staff.tenantId) {
      throw new NotFoundException("Payment not found");
    }
    await this.branchAccess.assertUserCanAccessEntityBranch(staff, payment);
    return payment;
  }

  async createRefund(
    paymentId: string,
    dto: CreateRefundDto,
    staff: AuthenticatedStaff,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { refunds: true },
    });
    if (!payment || payment.tenantId !== staff.tenantId) {
      throw new NotFoundException("Payment not found");
    }
    await this.branchAccess.assertUserCanAccessEntityBranch(staff, payment);

    if (payment.paymentStatus !== PaymentStatus.COMPLETED) {
      throw new ConflictException(
        "Can only refund completed payments",
      );
    }

    // Validate refund doesn't exceed payment amount
    const existingRefundSum = payment.refunds
      .filter((r) => r.status === RefundStatus.COMPLETED)
      .reduce((sum, r) => sum.add(r.amount), new Decimal(0));

    const newRefundAmount = new Decimal(dto.amount);
    if (existingRefundSum.add(newRefundAmount).gt(payment.amount)) {
      throw new ConflictException(
        `Refund total would exceed payment amount. Payment: ${payment.amount}, already refunded: ${existingRefundSum}, requested: ${dto.amount}`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const refund = await tx.refund.create({
        data: {
          tenantId: staff.tenantId,
          branchId: payment.branchId,
          orderId: payment.orderId,
          paymentId,
          amount: dto.amount,
          status: RefundStatus.COMPLETED,
          reason: dto.reason,
          createdByStaffId: staff.staffId,
        },
      });

      // Recalculate order payment status
      const allPayments = await tx.payment.findMany({
        where: { orderId: payment.orderId },
      });
      const allRefunds = await tx.refund.findMany({
        where: { orderId: payment.orderId },
      });

      const order = await tx.order.findUniqueOrThrow({
        where: { id: payment.orderId },
      });

      const newPaymentStatus = calculateOrderPaymentStatus(
        order.totalAmount,
        allPayments,
        allRefunds,
      );

      await tx.order.update({
        where: { id: payment.orderId },
        data: { paymentStatus: newPaymentStatus },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          tenantId: staff.tenantId,
          branchId: payment.branchId,
          actorStaffId: staff.staffId,
          actionCode: "REFUND_CREATED",
          entityType: "Refund",
          entityId: refund.id,
          afterJson: {
            refundId: refund.id,
            paymentId,
            orderId: payment.orderId,
            amount: dto.amount,
            reason: dto.reason,
            orderPaymentStatus: newPaymentStatus,
          },
        },
      });

      return refund;
    });

    this.realtime.emit(
      "PAYMENT_REFUNDED",
      staff.tenantId,
      payment.branchId,
      {
        refundId: result.id,
        paymentId,
        orderId: payment.orderId,
        sessionId: payment.sessionId,
        amount: dto.amount,
      },
    );
    this.loyaltyService.reverseForRefund(result.id).catch((error: unknown) => {
      console.warn("Loyalty point refund reversal failed", error);
    });
    void this.logsService.writePayment({
      tenantId: staff.tenantId,
      branchId: payment.branchId,
      orderId: payment.orderId,
      sessionId: payment.sessionId,
      paymentId,
      eventType: "REFUND_CREATED",
      amount: dto.amount,
      status: RefundStatus.COMPLETED,
      metadata: {
        refundId: result.id,
        reason: dto.reason,
      },
    });

    return result;
  }

  // ── Split-bill Preview ──────────────────────────────

  async previewSplits(
    orderId: string,
    params: { splitType: string; count?: number; customAmounts?: number[] },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: { include: { menuItem: { select: { id: true, name: true } } } } },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (!isOrderServedForPayment(order.orderStatus)) {
      throw new BadRequestException("Payment is available after the order is served");
    }

    const total = order.totalAmount.toNumber();
    const remaining = await this.calculateRemaining(orderId, total);
    if (remaining <= 0) throw new ConflictException("Order is already fully paid");

    if (params.splitType === "BY_PEOPLE") {
      const count = params.count ?? 2;
      if (count < 2) throw new BadRequestException("Split count must be at least 2");
      const perPerson = Math.floor(remaining * 100 / count) / 100;
      const lastPerson = Math.round((remaining - perPerson * (count - 1)) * 100) / 100;
      return {
        orderId,
        splitType: "BY_PEOPLE",
        total,
        remaining,
        splits: Array.from({ length: count }, (_, i) => ({
          index: i,
          amount: i === count - 1 ? lastPerson : perPerson,
        })),
      };
    }

    if (params.splitType === "BY_ITEMS") {
      return {
        orderId,
        splitType: "BY_ITEMS",
        total,
        remaining,
        splits: order.orderItems.map((oi) => ({
          menuItemId: oi.menuItemId,
          name: oi.menuItem?.name ?? "Item",
          quantity: oi.quantity,
          amount: oi.lineTotal.toNumber(),
        })),
      };
    }

    if (params.splitType === "BY_AMOUNT") {
      if (!params.customAmounts?.length) {
        throw new BadRequestException("customAmounts required for BY_AMOUNT split");
      }
      const sum = params.customAmounts.reduce((s, a) => s + a, 0);
      const diff = Math.abs(sum - remaining);
      if (diff > 0.01) {
        throw new BadRequestException(`Custom amounts sum (${sum.toFixed(2)}) does not match remaining (${remaining.toFixed(2)})`);
      }
      return {
        orderId,
        splitType: "BY_AMOUNT",
        total,
        remaining,
        splits: params.customAmounts.map((amount, i) => ({ index: i, amount })),
      };
    }

    throw new BadRequestException(`Unknown split type: ${params.splitType}`);
  }

  private async calculateRemaining(orderId: string, total: number): Promise<number> {
    const remaining = await this.calculateOrderRemainingDecimal(orderId, new Decimal(total));
    return remaining.toNumber();
  }

  private async calculateOrderRemainingDecimal(
    orderId: string,
    total: Decimal,
  ): Promise<Decimal> {
    const allPayments = await this.prisma.payment.findMany({ where: { orderId } });
    const allRefunds = await this.prisma.refund.findMany({ where: { orderId } });
    const paidSum = allPayments
      .filter((p) => p.paymentStatus === PaymentStatus.COMPLETED)
      .reduce((s, p) => s.add(p.amount), new Decimal(0));
    const refundSum = allRefunds
      .filter((r) => r.status === RefundStatus.COMPLETED)
      .reduce((s, r) => s.add(r.amount), new Decimal(0));
    return Decimal.max(total.sub(paidSum).add(refundSum), new Decimal(0))
      .toDecimalPlaces(2);
  }

  private sumCompletedPayments(
    payments: Array<{ amount: Decimal; paymentStatus: PaymentStatus }>,
  ) {
    return payments
      .filter((p) => p.paymentStatus === PaymentStatus.COMPLETED)
      .reduce((sum, p) => sum.add(p.amount), new Decimal(0));
  }

  private sumCompletedRefunds(
    refunds: Array<{ amount: Decimal; status: RefundStatus }>,
  ) {
    return refunds
      .filter((r) => r.status === RefundStatus.COMPLETED)
      .reduce((sum, r) => sum.add(r.amount), new Decimal(0));
  }

  // ── Split-Bill Commit ────────────────────────────────

  async createSplitPayments(
    orderId: string,
    params: { splitType: string; count?: number; customAmounts?: number[] },
    gateway: import("../../contracts/payment-gateway.js").PaymentGateway,
  ) {
    // Use preview to calculate splits
    const preview = await this.previewSplits(orderId, params);

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException("Order not found");

    const results = [];
    for (const split of preview.splits) {
      const amount = split.amount;
      if (amount <= 0) continue;

      const amountMinor = Math.round(amount * 100);
      const intentResult = await gateway.createIntent({
        amountMinor,
        currency: PAYMENT_CURRENCY,
        reference: `${orderId}-split-${results.length}`,
        metadata: {
          scope: "ORDER_SPLIT",
          tenantId: order.tenantId,
          branchId: order.branchId,
          orderId,
          expectedAmountMinor: String(amountMinor),
          currency: PAYMENT_CURRENCY,
        },
      });

      const payment = await this.prisma.payment.create({
        data: {
          tenantId: order.tenantId,
          branchId: order.branchId,
          orderId,
          sessionId: order.sessionId,
          amount,
          paymentMethod: "CARD",
          paymentStatus: PaymentStatus.PENDING,
          paymentReference: intentResult.externalId,
        },
      });

      // Create split record
      await this.prisma.paymentSplit.create({
        data: {
          paymentId: payment.id,
          splitType: params.splitType === "BY_PEOPLE" ? "BY_PEOPLE" : params.splitType === "BY_ITEMS" ? "BY_ITEMS" : "BY_AMOUNT",
          amount,
        },
      });

      results.push({
        paymentId: payment.id,
        amount,
        checkoutUrl: intentResult.checkoutUrl,
        externalId: intentResult.externalId,
      });
    }

    return {
      orderId,
      splitType: params.splitType,
      splitCount: results.length,
      splits: results,
    };
  }

  // ── Gateway Payment Intent ───────────────────────────

  async createPaymentIntent(
    orderId: string,
    method: string,
    returnUrl: string | undefined,
    tenantId: string,
    gateway: import("../../contracts/payment-gateway.js").PaymentGateway,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        session: {
          select: {
            id: true,
            tenantId: true,
            branchId: true,
            table: { select: { id: true, branchId: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (tenantId && order.tenantId !== tenantId) throw new NotFoundException("Order not found");
    const resolvedTenantId = tenantId || order.tenantId;
    if (order.session.tenantId !== order.tenantId || order.session.branchId !== order.branchId) {
      throw new BadRequestException("Order session scope is invalid");
    }
    if (order.session.table.branchId !== order.branchId) {
      throw new BadRequestException("Order table scope is invalid");
    }

    if (order.paymentStatus === OrderPaymentStatus.PAID) {
      throw new ConflictException("Order is already fully paid");
    }
    if (order.orderStatus === OrderStatus.CANCELLED) {
      throw new ConflictException("Cannot pay a cancelled order");
    }
    if (!isOrderServedForPayment(order.orderStatus)) {
      throw new BadRequestException("Payment is available after the order is served");
    }

    const payAmount = await this.calculateOrderRemainingDecimal(orderId, order.totalAmount);
    if (payAmount.lte(0)) throw new ConflictException("Order is already fully paid");

    const amountMinor = payAmount.mul(100).toNumber();
    let intentResult: Awaited<ReturnType<typeof gateway.createIntent>>;
    try {
      intentResult = await gateway.createIntent({
        amountMinor,
        currency: PAYMENT_CURRENCY,
        reference: orderId,
        returnUrl,
        metadata: {
          scope: "ORDER",
          tenantId: resolvedTenantId,
          branchId: order.branchId,
          orderId,
          expectedAmountMinor: String(amountMinor),
          currency: PAYMENT_CURRENCY,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : "Payment provider failed",
      );
    }

    // Create PENDING payment record
    const payment = await this.prisma.payment.create({
      data: {
        tenantId: resolvedTenantId,
        branchId: order.branchId,
        orderId,
        sessionId: order.sessionId,
        amount: payAmount,
        paymentMethod: method as PaymentMethod,
        paymentStatus: PaymentStatus.PENDING,
        paymentReference: intentResult.externalId,
      },
    });
    void this.logsService.writePayment({
      tenantId: resolvedTenantId,
      branchId: order.branchId,
      orderId,
      sessionId: order.sessionId,
      paymentId: payment.id,
      eventType: "PAYMENT_INTENT_CREATED",
      provider: intentResult.provider,
      externalId: intentResult.externalId,
      amount: payAmount,
      status: PaymentStatus.PENDING,
      metadata: {
        method,
        scope: "ORDER",
        expectedAmountMinor: amountMinor,
        currency: PAYMENT_CURRENCY,
      },
    });

    return {
      paymentId: payment.id,
      provider: intentResult.provider,
      externalId: intentResult.externalId,
      checkoutUrl: intentResult.checkoutUrl,
      amount: payAmount.toString(),
      status: "pending",
    };
  }

  async createSessionPaymentIntent(
    sessionId: string,
    method: string,
    returnUrl: string | undefined,
    gateway: import("../../contracts/payment-gateway.js").PaymentGateway,
  ) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, tenantId: true, branchId: true },
    });
    if (!session) throw new NotFoundException("Session not found");

    const orders = await this.prisma.order.findMany({
      where: {
        sessionId,
        tenantId: session.tenantId,
        branchId: session.branchId,
        orderStatus: { not: OrderStatus.CANCELLED },
      },
      orderBy: { orderDateTime: "asc" },
      include: {
        payments: true,
        refunds: true,
      },
    });

    const payableOrders = orders
      .filter((order) => isOrderServedForPayment(order.orderStatus))
      .map((order) => {
        const paidSum = this.sumCompletedPayments(order.payments);
        const refundSum = this.sumCompletedRefunds(order.refunds);
        const remaining = Decimal.max(
          order.totalAmount.sub(paidSum).add(refundSum),
          new Decimal(0),
        ).toDecimalPlaces(2);

        return { order, remaining };
      })
      .filter(({ remaining }) => remaining.gt(0));

    if (payableOrders.length === 0) {
      throw new ConflictException("No payable served orders with an outstanding balance");
    }

    const payAmount = payableOrders
      .reduce((sum, { remaining }) => sum.add(remaining), new Decimal(0))
      .toDecimalPlaces(2);
    if (payAmount.lte(0)) throw new ConflictException("Nothing to pay");

    const amountMinor = payAmount.mul(100).toNumber();
    let intentResult: Awaited<ReturnType<typeof gateway.createIntent>>;
    try {
      intentResult = await gateway.createIntent({
        amountMinor,
        currency: PAYMENT_CURRENCY,
        reference: sessionId,
        returnUrl,
        metadata: {
          scope: "SESSION",
          tenantId: session.tenantId,
          branchId: session.branchId,
          sessionId,
          expectedAmountMinor: String(amountMinor),
          currency: PAYMENT_CURRENCY,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : "Payment provider failed",
      );
    }

    const payments = await this.prisma.$transaction(
      payableOrders.map(({ order, remaining }) =>
        this.prisma.payment.create({
          data: {
            tenantId: session.tenantId,
            branchId: session.branchId,
            orderId: order.id,
            sessionId,
            amount: remaining,
            paymentMethod: method as PaymentMethod,
            paymentStatus: PaymentStatus.PENDING,
            paymentReference: intentResult.externalId,
          },
        }),
      ),
    );
    for (const payment of payments) {
      void this.logsService.writePayment({
        tenantId: session.tenantId,
        branchId: session.branchId,
        orderId: payment.orderId,
        sessionId,
        paymentId: payment.id,
        eventType: "PAYMENT_INTENT_CREATED",
        provider: intentResult.provider,
        externalId: intentResult.externalId,
        amount: payment.amount,
        status: PaymentStatus.PENDING,
        metadata: {
          method,
          scope: "SESSION",
          sessionOrderCount: payableOrders.length,
          expectedAmountMinor: amountMinor,
          currency: PAYMENT_CURRENCY,
        },
      });
    }

    const primaryPayment = payments[0];
    const primaryOrder = payableOrders[0].order;

    return {
      paymentId: primaryPayment.id,
      provider: intentResult.provider,
      externalId: intentResult.externalId,
      checkoutUrl: intentResult.checkoutUrl,
      amount: payAmount.toString(),
      status: "pending",
      sessionId,
      orderId: primaryOrder.id,
      orderIds: payableOrders.map(({ order }) => order.id),
    };
  }

  // ── Webhook: Complete or Fail payment ────────────────

  async handleWebhookEvent(
    event: import("../../contracts/payment-gateway.js").WebhookEvent,
  ) {
    const payments = await this.prisma.payment.findMany({
      where: { paymentReference: event.externalId },
      orderBy: { paymentDate: "asc" },
    });
    if (payments.length === 0) return { ignored: true, reason: "Payment not found" };

    // Idempotency: don't re-process already completed/failed
    const pendingPayments = payments.filter(
      (payment) =>
        payment.paymentStatus !== PaymentStatus.COMPLETED &&
        payment.paymentStatus !== PaymentStatus.FAILED,
    );
    if (pendingPayments.length === 0) {
      return { ignored: true, reason: "Already processed" };
    }

    const newStatus =
      event.type === "payment.completed"
        ? PaymentStatus.COMPLETED
        : event.type === "payment.failed"
          ? PaymentStatus.FAILED
          : null;

    if (!newStatus) return { ignored: true, reason: `Unknown event type: ${event.type}` };
    for (const payment of pendingPayments) {
      void this.logsService.writePayment({
        tenantId: payment.tenantId,
        branchId: payment.branchId,
        orderId: payment.orderId,
        sessionId: payment.sessionId,
        paymentId: payment.id,
        eventType: "PAYMENT_WEBHOOK_RECEIVED",
        provider: "gateway",
        externalId: event.externalId,
        amount: payment.amount,
        status: newStatus,
        metadata: { webhookType: event.type },
      });
    }

    if (newStatus === PaymentStatus.COMPLETED) {
      const expectedAmountMinor = pendingPayments
        .reduce((sum, payment) => sum.add(payment.amount), new Decimal(0))
        .mul(100)
        .toDecimalPlaces(0)
        .toNumber();
      const reportedAmountMinor = typeof event.amount === "number"
        ? Math.round(event.amount)
        : undefined;
      const reportedCurrency = event.currency?.toUpperCase();
      if (reportedAmountMinor === undefined) {
        await this.logWebhookMismatch(pendingPayments, event, "missing_provider_amount", {
          expectedAmountMinor,
        });
        return { ignored: true, reason: "Provider amount missing" };
      }
      if (reportedAmountMinor !== expectedAmountMinor) {
        await this.logWebhookMismatch(pendingPayments, event, "amount_mismatch", {
          expectedAmountMinor,
          reportedAmountMinor,
        });
        return { ignored: true, reason: "Provider amount mismatch" };
      }
      if (reportedCurrency && reportedCurrency !== PAYMENT_CURRENCY) {
        await this.logWebhookMismatch(pendingPayments, event, "currency_mismatch", {
          expectedCurrency: PAYMENT_CURRENCY,
          reportedCurrency,
        });
        return { ignored: true, reason: "Provider currency mismatch" };
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.updateMany({
        where: { id: { in: pendingPayments.map((payment) => payment.id) } },
        data: { paymentStatus: newStatus },
      });

      if (newStatus === PaymentStatus.COMPLETED) {
        for (const orderId of new Set(pendingPayments.map((payment) => payment.orderId))) {
          const allPayments = await tx.payment.findMany({ where: { orderId } });
          const updatedPayments = allPayments.map((payment) =>
            pendingPayments.some((pending) => pending.id === payment.id)
              ? { ...payment, paymentStatus: newStatus }
              : payment,
          );
          const allRefunds = await tx.refund.findMany({ where: { orderId } });
          const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });

          const orderPaymentStatus = calculateOrderPaymentStatus(
            order.totalAmount,
            updatedPayments,
            allRefunds,
          );
          await tx.order.update({
            where: { id: orderId },
            data: { paymentStatus: orderPaymentStatus },
          });
        }
      }
    });

    if (newStatus === PaymentStatus.COMPLETED) {
      for (const payment of pendingPayments) {
        this.realtime.emit("PAYMENT_COMPLETED", payment.tenantId, payment.branchId, {
          paymentId: payment.id,
          orderId: payment.orderId,
          sessionId: payment.sessionId,
          externalId: event.externalId,
          provider: "gateway",
        });
        this.loyaltyService.postEarnForPayment(payment.id).catch((error: unknown) => {
          console.warn("Loyalty point earning failed", error);
        });
        void this.logsService.writePayment({
          tenantId: payment.tenantId,
          branchId: payment.branchId,
          orderId: payment.orderId,
          sessionId: payment.sessionId,
          paymentId: payment.id,
          eventType: "PAYMENT_COMPLETED",
          provider: "gateway",
          externalId: event.externalId,
          amount: payment.amount,
          status: newStatus,
        });
      }
    }

    return {
      processed: true,
      paymentIds: pendingPayments.map((payment) => payment.id),
      status: newStatus,
    };
  }

  private async logWebhookMismatch(
    payments: Array<{
      id: string;
      tenantId: string;
      branchId: string;
      orderId: string;
      sessionId: string;
      amount: Decimal;
      paymentStatus: PaymentStatus;
    }>,
    event: import("../../contracts/payment-gateway.js").WebhookEvent,
    reason: string,
    metadata: Record<string, unknown>,
  ) {
    for (const payment of payments) {
      await this.logsService.writePayment({
        tenantId: payment.tenantId,
        branchId: payment.branchId,
        orderId: payment.orderId,
        sessionId: payment.sessionId,
        paymentId: payment.id,
        eventType: "PAYMENT_WEBHOOK_REJECTED",
        provider: "gateway",
        externalId: event.externalId,
        amount: payment.amount,
        status: payment.paymentStatus,
        metadata: {
          reason,
          reportedAmount: event.amount,
          reportedCurrency: event.currency,
          ...metadata,
        },
      });
    }
  }
}
