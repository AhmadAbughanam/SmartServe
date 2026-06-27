import { Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from "@nestjs/common";
import { OrderStatus, SessionStatus, TableStatus, PaymentStatus, type PaymentMethod } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { calculateOrderPaymentStatus } from "../payments/payment-status.rules.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { RealtimeService } from "../realtime/realtime.service.js";
import { BranchAccessService } from "../auth/branch-access.service.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";
import { OrdersService } from "../orders/orders.service.js";

/** Delay threshold: orders older than this many minutes are flagged */
const DELAY_THRESHOLD_MINUTES = 20;

export type AttentionState =
  | "AVAILABLE"
  | "OCCUPIED"
  | "ASSISTANCE_NEEDED"
  | "ORDER_READY"
  | "PAYMENT_PENDING"
  | "TURNOVER_REQUIRED"
  | "RESERVED"
  | "CLEANING"
  | "OUT_OF_SERVICE";

export interface WaiterTableSummary {
  id: string;
  tableCode: string;
  capacity: number;
  status: string;
  zone: string | null;
  posX: number | null;
  posY: number | null;
  shape: string | null;
  locationDescription: string | null;
  attentionState: AttentionState;
  session: {
    id: string;
    guestCount: number;
    startTime: string;
    orderCount: number;
    hasReadyOrders: boolean;
    hasDelayedOrders: boolean;
    paymentPending: boolean;
    totalAmount: number;
    paidAmount: number;
  } | null;
  activeRequests: number;
}

export interface WaiterReadyOrder {
  id: string;
  sessionId: string;
  tableId: string;
  tableCode: string;
  orderDateTime: string;
  assignedWaiterId: string | null;
  assignedWaiterName: string | null;
  itemCount: number;
  totalItems: number;
  totalAmount: number;
  isMine: boolean;
}

@Injectable()
export class WaiterService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
    @Inject(BranchAccessService)
    private readonly branchAccess: BranchAccessService,
    @Inject(OrdersService)
    private readonly ordersService: OrdersService,
  ) {}

  async getFloorSummary(branchId: string, tenantId: string, staffId: string): Promise<WaiterTableSummary[]> {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId } });
    if (!branch) throw new NotFoundException("Branch not found");

    const tables = await this.prisma.table.findMany({
      where: { branchId },
      orderBy: { tableCode: "asc" },
      include: {
        sessions: {
          where: { status: SessionStatus.ACTIVE },
          orderBy: { startTime: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            guestCount: true,
            startTime: true,
            orders: {
              select: {
                id: true, orderStatus: true, totalAmount: true, paymentStatus: true, orderDateTime: true,
                assignedWaiterId: true,
              },
            },
          },
        },
        lastSession: {
          select: {
            id: true, status: true, guestCount: true, startTime: true,
            orders: {
              select: {
                id: true, orderStatus: true, totalAmount: true, paymentStatus: true, orderDateTime: true,
                assignedWaiterId: true,
              },
            },
          },
        },
        serviceRequests: {
          where: {
            OR: [
              { status: "NEW" },
              { status: "CLAIMED", claimedByStaffId: staffId },
            ],
          },
          select: { id: true, type: true },
        },
      },
    });

    const now = Date.now();

    return tables.map((t) => {
      const activeSession = t.sessions[0] ?? (t.lastSession?.status === "ACTIVE" ? t.lastSession : null);
      const effectiveStatus = activeSession
        ? TableStatus.OCCUPIED
        : t.status === TableStatus.OCCUPIED
          ? TableStatus.AVAILABLE
          : t.status;

      let orderCount = 0;
      let hasReadyOrders = false;
      let hasDelayedOrders = false;
      let paymentPending = false;
      let totalAmount = 0;
      let paidAmount = 0;

      if (activeSession) {
        const orders = activeSession.orders;
        orderCount = orders.length;
        hasReadyOrders = orders.some((o) => o.orderStatus === "READY");
        hasDelayedOrders = orders.some(
          (o) =>
            (o.orderStatus === "PLACED" || o.orderStatus === "CONFIRMED" || o.orderStatus === "IN_KITCHEN") &&
            now - new Date(o.orderDateTime).getTime() > DELAY_THRESHOLD_MINUTES * 60_000,
        );
        paymentPending = t.serviceRequests.some(
          (r) => r.type === "BILL_REQUEST" || r.type === "PAYMENT_TERMINAL",
        );
        totalAmount = orders.reduce((s, o) => s + o.totalAmount.toNumber(), 0);
        paidAmount = orders
          .filter((o) => o.paymentStatus === "PAID")
          .reduce((s, o) => s + o.totalAmount.toNumber(), 0);
      }

      const activeRequests = t.serviceRequests.length;

      // Derive attention state
      let attentionState: AttentionState;
      if (effectiveStatus === "AVAILABLE") attentionState = "AVAILABLE";
      else if (effectiveStatus === "RESERVED") attentionState = "RESERVED";
      else if (effectiveStatus === "CLEANING") {
        // Check if session ended — turnover needed
        attentionState = t.lastSession?.status === "COMPLETED" ? "TURNOVER_REQUIRED" : "CLEANING";
      } else if (effectiveStatus === "OUT_OF_SERVICE") attentionState = "OUT_OF_SERVICE";
      else if (activeRequests > 0 && !paymentPending) attentionState = "ASSISTANCE_NEEDED";
      else if (paymentPending) attentionState = "PAYMENT_PENDING";
      else if (hasReadyOrders) attentionState = "ORDER_READY";
      else attentionState = "OCCUPIED";

      return {
        id: t.id,
        tableCode: t.tableCode,
        capacity: t.capacity,
        status: effectiveStatus,
        zone: t.zone,
        posX: t.posX,
        posY: t.posY,
        shape: t.shape,
        locationDescription: t.locationDescription,
        attentionState,
        session: activeSession
          ? {
              id: activeSession.id,
              guestCount: activeSession.guestCount,
              startTime: activeSession.startTime.toISOString(),
              orderCount,
              hasReadyOrders,
              hasDelayedOrders,
              paymentPending,
              totalAmount: Math.round(totalAmount * 100) / 100,
              paidAmount: Math.round(paidAmount * 100) / 100,
            }
          : null,
        activeRequests,
      };
    });
  }

  async getReadyOrders(branchId: string, tenantId: string, staffId: string): Promise<WaiterReadyOrder[]> {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId } });
    if (!branch) throw new NotFoundException("Branch not found");

    const orders = await this.prisma.order.findMany({
      where: {
        branchId,
        tenantId,
        orderStatus: OrderStatus.READY,
        paymentStatus: { not: "PAID" },
        session: { status: SessionStatus.ACTIVE },
      },
      orderBy: { orderDateTime: "asc" },
      include: {
        assignedWaiter: { select: { id: true, name: true } },
        session: {
          select: {
            id: true,
            table: { select: { id: true, tableCode: true } },
          },
        },
        orderItems: {
          where: { kitchenStatus: { not: "CANCELLED" } },
          select: { quantity: true },
        },
      },
      take: 25,
    });

    return orders.map((order) => ({
      id: order.id,
      sessionId: order.sessionId,
      tableId: order.session.table.id,
      tableCode: order.session.table.tableCode,
      orderDateTime: order.orderDateTime.toISOString(),
      assignedWaiterId: order.assignedWaiterId,
      assignedWaiterName: order.assignedWaiter?.name ?? null,
      itemCount: order.orderItems.length,
      totalItems: order.orderItems.reduce((sum, item) => sum + item.quantity, 0),
      totalAmount: order.totalAmount.toNumber(),
      isMine: order.assignedWaiterId === staffId,
    }));
  }

  async getTableDetail(tableId: string, staff: AuthenticatedStaff) {
    const table = await this.prisma.table.findUnique({
      where: { id: tableId },
      include: {
        branch: { select: { tenantId: true, name: true } },
        sessions: {
          where: { status: SessionStatus.ACTIVE },
          orderBy: { startTime: "desc" },
          take: 1,
          include: {
            orders: {
              orderBy: { orderDateTime: "desc" },
              include: {
                assignedWaiter: { select: { id: true, name: true } },
                orderItems: {
                  include: { menuItem: { select: { id: true, name: true } } },
                },
              },
            },
          },
        },
        lastSession: {
          include: {
            orders: {
              orderBy: { orderDateTime: "desc" },
              include: {
                assignedWaiter: { select: { id: true, name: true } },
                orderItems: {
                  include: { menuItem: { select: { id: true, name: true } } },
                },
              },
            },
          },
        },
        serviceRequests: {
          where: {
            OR: [
              { status: "NEW" },
              { status: "CLAIMED", claimedByStaffId: staff.staffId },
            ],
          },
          orderBy: { createdAt: "desc" },
          include: {
            claimedByStaff: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!table || table.branch.tenantId !== staff.tenantId) {
      throw new NotFoundException("Table not found");
    }
    await this.branchAccess.assertUserCanAccessEntityBranch(staff, {
      tenantId: table.branch.tenantId,
      branchId: table.branchId,
    });

    const activeSession = table.sessions[0] ?? null;
    const effectiveStatus = activeSession
      ? TableStatus.OCCUPIED
      : table.status === TableStatus.OCCUPIED
        ? TableStatus.AVAILABLE
        : table.status;

    return {
      ...table,
      status: effectiveStatus,
      lastSession: activeSession ?? table.lastSession,
    };
  }

  async serveOrder(orderId: string, staff: AuthenticatedStaff) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.tenantId !== staff.tenantId) throw new NotFoundException("Order not found");
    await this.branchAccess.assertUserCanAccessEntityBranch(staff, order);
    if (order.assignedWaiterId && order.assignedWaiterId !== staff.staffId) {
      throw new ForbiddenException("Only the waiter assigned to this order can mark it served");
    }
    if (order.orderStatus !== OrderStatus.READY) {
      throw new BadRequestException(`Cannot serve order: status is ${order.orderStatus}, must be READY`);
    }

    if (!order.assignedWaiterId) {
      const claimResult = await this.prisma.order.updateMany({
        where: { id: orderId, tenantId: staff.tenantId, assignedWaiterId: null },
        data: { assignedWaiterId: staff.staffId },
      });
      if (claimResult.count !== 1) {
        throw new ConflictException("Order was claimed by another waiter");
      }
    }

    return this.ordersService.updateStatus(orderId, OrderStatus.SERVED, staff, "served by waiter");
  }

  async claimOrder(orderId: string, staff: AuthenticatedStaff) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        session: { select: { table: { select: { tableCode: true } } } },
        assignedWaiter: { select: { id: true, name: true } },
      },
    });
    if (!order || order.tenantId !== staff.tenantId) throw new NotFoundException("Order not found");
    await this.branchAccess.assertUserCanAccessEntityBranch(staff, order);
    if (order.assignedWaiterId && order.assignedWaiterId !== staff.staffId) {
      throw new ForbiddenException(`Order is already assigned to ${order.assignedWaiter?.name ?? "another waiter"}`);
    }
    if (order.orderStatus === OrderStatus.SERVED || order.orderStatus === OrderStatus.COMPLETED || order.orderStatus === OrderStatus.CANCELLED) {
      throw new BadRequestException(`Cannot take order: status is ${order.orderStatus}`);
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { assignedWaiterId: staff.staffId },
      include: { assignedWaiter: { select: { id: true, name: true } } },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: staff.tenantId,
        branchId: order.branchId,
        actorStaffId: staff.staffId,
        actionCode: "ORDER_ASSIGNED_TO_WAITER",
        entityType: "Order",
        entityId: orderId,
        afterJson: {
          orderId,
          sessionId: order.sessionId,
          tableCode: order.session.table.tableCode,
          assignedWaiterId: staff.staffId,
        },
      },
    });

    return updated;
  }

  async clearTable(tableId: string, staff: AuthenticatedStaff) {
    const table = await this.prisma.table.findUnique({
      where: { id: tableId },
      include: {
        branch: { select: { tenantId: true } },
        sessions: {
          where: { status: SessionStatus.ACTIVE },
          orderBy: { startTime: "desc" },
          take: 1,
          select: { id: true, status: true },
        },
        lastSession: {
          select: { id: true, status: true },
        },
      },
    });

    if (!table || table.branch.tenantId !== staff.tenantId) throw new NotFoundException("Table not found");
    await this.branchAccess.assertUserCanAccessEntityBranch(staff, {
      tenantId: table.branch.tenantId,
      branchId: table.branchId,
    });

    if (table.status !== "OCCUPIED" && table.status !== "CLEANING") {
      throw new BadRequestException(`Cannot clear table: status is ${table.status}`);
    }

    await this.prisma.$transaction(async (tx) => {
      const activeSession = table.sessions[0] ?? (table.lastSession?.status === SessionStatus.ACTIVE ? table.lastSession : null);

      // End active session if still running
      if (activeSession?.status === SessionStatus.ACTIVE) {
        await tx.session.update({
          where: { id: activeSession.id },
          data: { status: SessionStatus.COMPLETED, endTime: new Date() },
        });
      }

      // Move to CLEANING
      await tx.table.update({
        where: { id: tableId },
        data: { status: TableStatus.CLEANING },
      });

      // Cancel any remaining active service requests
      await tx.serviceRequest.updateMany({
        where: { tableId, status: { in: ["NEW", "CLAIMED"] } },
        data: { status: "CANCELLED" },
      });

      await tx.auditLog.create({
        data: {
          tenantId: staff.tenantId, branchId: table.branchId, actorStaffId: staff.staffId,
          actionCode: "TABLE_CLEARED", entityType: "Table", entityId: tableId,
          afterJson: { tableId, tableCode: table.tableCode, sessionEnded: activeSession?.status === "ACTIVE" },
        },
      });
    });

    this.realtime.emit("TABLE_CLEARED", staff.tenantId, table.branchId, {
      tableId, tableCode: table.tableCode,
    });

    return { cleared: true, tableCode: table.tableCode };
  }

  async quickAddOrder(
    tableId: string,
    staff: AuthenticatedStaff,
    items: Array<{ menuItemId: string; quantity: number; specializations?: Array<{ name: string }> }>,
    specialInstructions?: string,
  ) {
    const table = await this.prisma.table.findUnique({
      where: { id: tableId },
      include: {
        branch: { select: { tenantId: true } },
        sessions: {
          where: { status: SessionStatus.ACTIVE },
          orderBy: { startTime: "desc" },
          take: 1,
          select: { id: true, status: true },
        },
        lastSession: { select: { id: true, status: true } },
      },
    });

    if (!table || table.branch.tenantId !== staff.tenantId) throw new NotFoundException("Table not found");
    await this.branchAccess.assertUserCanAccessEntityBranch(staff, {
      tenantId: table.branch.tenantId,
      branchId: table.branchId,
    });
    const activeSession = table.sessions[0] ?? (table.lastSession?.status === "ACTIVE" ? table.lastSession : null);
    if (!activeSession || activeSession.status !== "ACTIVE") {
      throw new BadRequestException("No active session on this table");
    }

    const sessionId = activeSession.id;
    const tenantId = staff.tenantId;

    // Load menu items for pricing
    const menuItemIds = items.map((i) => i.menuItemId);
    const menuItems = await this.prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        tenantId,
        OR: [{ branchId: table.branchId }, { branchId: null }],
        isActive: true,
      },
    });
    const menuMap = new Map(menuItems.map((m) => [m.id, m]));

    // Load tax rules
    const taxRules = await this.prisma.taxRule.findMany({
      where: { branchId: table.branchId, isActive: true },
    });
    const taxMap = new Map(taxRules.map((r) => [r.taxClass, r.ratePercent.toNumber()]));

    let subtotal = 0;
    let totalTax = 0;
    const orderItemsData = items.map((item) => {
      const mi = menuMap.get(item.menuItemId);
      if (!mi) throw new BadRequestException(`Menu item ${item.menuItemId} not found or inactive`);
      const basePrice = mi.price.toNumber();
      const lineSubtotal = basePrice * item.quantity;
      const taxRate = taxMap.get(mi.taxClass) ?? 0;
      const lineTax = Math.round(lineSubtotal * taxRate) / 100;
      const lineTotal = Math.round((lineSubtotal + lineTax) * 100) / 100;
      subtotal += lineSubtotal;
      totalTax += lineTax;
      return {
        tenantId, branchId: table.branchId, menuItemId: item.menuItemId,
        quantity: item.quantity, itemBasePrice: basePrice,
        lineDiscountAmount: 0, lineTaxAmount: lineTax, lineTotal,
        specializationsJson: item.specializations ?? [],
      };
    });

    const totalAmount = Math.round((subtotal + totalTax) * 100) / 100;

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          tenantId, branchId: table.branchId, sessionId,
          assignedWaiterId: staff.staffId,
          subtotalAmount: subtotal, taxAmount: totalTax,
          serviceChargeAmount: 0, discountAmount: 0, totalAmount,
          source: "WAITER_QUICK_ADD",
          specialInstructions,
          idempotencyKey: `wqa-${staff.staffId}-${Date.now()}`,
          orderItems: { create: orderItemsData },
        },
        include: { orderItems: true },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: created.id, tenantId, branchId: table.branchId,
          fromStatus: null, toStatus: "PLACED", changedByStaffId: staff.staffId,
        },
      });
      await tx.table.update({
        where: { id: tableId },
        data: { totalOrders: { increment: 1 } },
      });
      return created;
    });

    this.realtime.emit("ORDER_PLACED", tenantId, table.branchId, {
      orderId: order.id, sessionId, source: "WAITER_QUICK_ADD",
      itemCount: order.orderItems.length, totalAmount: totalAmount.toString(),
    });

    return order;
  }

  // ── Payment confirmation ───────────────────────────

  async confirmPayment(
    orderId: string, method: string, staff: AuthenticatedStaff,
    amount?: number, tipAmount?: number, reference?: string,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.tenantId !== staff.tenantId) throw new NotFoundException("Order not found");
    await this.branchAccess.assertUserCanAccessEntityBranch(staff, order);
    if (order.orderStatus === OrderStatus.CANCELLED) throw new ConflictException("Cannot pay a cancelled order");
    if (order.orderStatus !== OrderStatus.SERVED && order.orderStatus !== OrderStatus.COMPLETED) {
      throw new BadRequestException("Payment is available after the order is served");
    }
    if (method !== "CASH" && method !== "CARD") throw new BadRequestException("Manual payments must use CASH or CARD");
    if (method === "CARD" && !reference?.trim()) {
      throw new BadRequestException("Terminal card payments require a payment reference");
    }

    if (order.paymentStatus === "PAID") throw new ConflictException("Order is already fully paid");

    // Calculate remaining due
    const allPayments = await this.prisma.payment.findMany({ where: { orderId } });
    const allRefunds = await this.prisma.refund.findMany({ where: { orderId } });
    const paidSum = allPayments.filter((p) => p.paymentStatus === PaymentStatus.COMPLETED).reduce((s, p) => s.add(p.amount), new Decimal(0));
    const refundSum = allRefunds.filter((r) => r.status === "COMPLETED").reduce((s, r) => s.add(r.amount), new Decimal(0));
    const remaining = Decimal.max(order.totalAmount.sub(paidSum).add(refundSum), new Decimal(0)).toDecimalPlaces(2);

    const payAmount = amount ? new Decimal(amount).toDecimalPlaces(2) : remaining;
    if (payAmount.lte(0)) throw new BadRequestException("Nothing to pay");
    if (payAmount.gt(remaining)) throw new BadRequestException("Payment amount exceeds amount due");

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          tenantId: staff.tenantId, branchId: order.branchId, orderId, sessionId: order.sessionId,
          amount: payAmount, paymentMethod: method as PaymentMethod,
          paymentStatus: PaymentStatus.COMPLETED, payerType: "CUSTOMER",
          tipAmount: tipAmount ? new Decimal(tipAmount) : undefined,
          paymentReference: reference,
        },
      });

      // Recalculate order payment status
      const updatedPayments = await tx.payment.findMany({ where: { orderId } });
      const updatedRefunds = await tx.refund.findMany({ where: { orderId } });
      const newStatus = calculateOrderPaymentStatus(order.totalAmount, updatedPayments, updatedRefunds);
      await tx.order.update({ where: { id: orderId }, data: { paymentStatus: newStatus } });

      // Complete any bill/terminal service requests
      await tx.serviceRequest.updateMany({
        where: { sessionId: order.sessionId, type: { in: ["BILL_REQUEST", "PAYMENT_TERMINAL"] }, status: { in: ["NEW", "CLAIMED"] } },
        data: { status: "COMPLETED", completedAt: new Date(), claimedByStaffId: staff.staffId },
      });

      await tx.auditLog.create({
        data: {
          tenantId: staff.tenantId, branchId: order.branchId, actorStaffId: staff.staffId,
          actionCode: "WAITER_PAYMENT_CONFIRMED", entityType: "Payment", entityId: payment.id,
          afterJson: { orderId, method, amount: payAmount.toString(), tip: tipAmount },
        },
      });

      return payment;
    });

    this.realtime.emit("PAYMENT_COMPLETED", staff.tenantId, order.branchId, {
      paymentId: result.id, orderId, sessionId: order.sessionId, amount: payAmount.toString(), method,
    });

    return result;
  }

  // ── Order Editing ──────────────────────────────────

  /** Update quantity of an order item (only if PENDING in kitchen). */
  async updateItemQuantity(orderItemId: string, newQuantity: number, staff: AuthenticatedStaff) {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: true, menuItem: true },
    });
    if (!item || item.tenantId !== staff.tenantId) throw new NotFoundException("Order item not found");
    await this.branchAccess.assertUserCanAccessEntityBranch(staff, item);
    if (item.kitchenStatus !== "PENDING") throw new BadRequestException(`Cannot edit item: already ${item.kitchenStatus}. Only PENDING items can be changed.`);
    if (newQuantity < 1) throw new BadRequestException("Quantity must be at least 1. Use cancel to remove.");

    const unitPrice = item.itemBasePrice;
    const newLineTotal = unitPrice.mul(newQuantity);

    const updated = await this.prisma.orderItem.update({
      where: { id: orderItemId },
      data: { quantity: newQuantity, lineTotal: newLineTotal },
    });

    // Recalculate order totals
    await this.recalcOrderTotals(item.orderId, staff.staffId);

    return updated;
  }

  /** Cancel/remove an order item (only if PENDING). */
  async cancelOrderItem(orderItemId: string, staff: AuthenticatedStaff, reason?: string) {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: true },
    });
    if (!item || item.tenantId !== staff.tenantId) throw new NotFoundException("Order item not found");
    await this.branchAccess.assertUserCanAccessEntityBranch(staff, item);
    if (item.kitchenStatus !== "PENDING") throw new BadRequestException(`Cannot cancel item: already ${item.kitchenStatus}. Only PENDING items can be removed.`);

    await this.prisma.orderItem.update({
      where: { id: orderItemId },
      data: { kitchenStatus: "CANCELLED", quantity: 0, lineTotal: 0 },
    });

    // Recalculate order totals
    await this.recalcOrderTotals(item.orderId, staff.staffId);

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        tenantId: staff.tenantId, branchId: item.branchId, actorStaffId: staff.staffId,
        actionCode: "ORDER_ITEM_CANCELLED", entityType: "OrderItem", entityId: orderItemId,
        afterJson: { reason: reason ?? "Waiter cancelled", menuItemId: item.menuItemId } as any,
      },
    });

    return { success: true };
  }

  /** Add a surcharge/service charge to an order. */
  async addSurcharge(orderId: string, amount: number, staff: AuthenticatedStaff) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.tenantId !== staff.tenantId) throw new NotFoundException("Order not found");
    await this.branchAccess.assertUserCanAccessEntityBranch(staff, order);
    if (amount < 0) throw new BadRequestException("Surcharge must be positive");

    const newTotal = order.subtotalAmount.add(order.taxAmount).add(new Decimal(amount));
    return this.prisma.order.update({
      where: { id: orderId },
      data: { serviceChargeAmount: amount, totalAmount: newTotal, editedAt: new Date(), lastEditedByStaffId: staff.staffId },
    });
  }

  /** Update special instructions on an order. */
  async updateOrderNotes(orderId: string, notes: string, staff: AuthenticatedStaff) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.tenantId !== staff.tenantId) throw new NotFoundException("Order not found");
    await this.branchAccess.assertUserCanAccessEntityBranch(staff, order);

    return this.prisma.order.update({
      where: { id: orderId },
      data: { specialInstructions: notes || null, editedAt: new Date(), lastEditedByStaffId: staff.staffId },
    });
  }

  /** Recalculate order totals after item changes. */
  private async recalcOrderTotals(orderId: string, staffId: string) {
    const items = await this.prisma.orderItem.findMany({
      where: { orderId, kitchenStatus: { not: "CANCELLED" } },
    });

    const subtotal = items.reduce((s, i) => s.add(i.lineTotal), new Decimal(0));
    const taxTotal = items.reduce((s, i) => s.add(i.lineTaxAmount), new Decimal(0));
    const total = subtotal.add(taxTotal);

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        subtotalAmount: subtotal,
        taxAmount: taxTotal,
        totalAmount: total,
        editedAt: new Date(),
        lastEditedByStaffId: staffId,
      },
    });
  }
}
