import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  KitchenItemStatus,
  OrderStatus,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { RealtimeService } from "../realtime/realtime.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { BranchAccessService } from "../auth/branch-access.service.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";
import { isValidOrderTransition } from "../orders/order-status.rules.js";
import { isValidKitchenItemTransition } from "./kitchen-item-status.rules.js";

/** Order statuses that are kitchen-relevant. */
const KDS_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PLACED,
  OrderStatus.CONFIRMED,
  OrderStatus.IN_KITCHEN,
  OrderStatus.READY,
];

@Injectable()
export class KdsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
    @Inject(NotificationsService) private readonly notifications: NotificationsService,
    @Inject(BranchAccessService) private readonly branchAccess: BranchAccessService,
  ) {}

  /** Kitchen queue: active orders for a branch with full item detail. */
  async getQueue(branchId: string, staff: AuthenticatedStaff, statusFilter?: OrderStatus, stationId?: string) {
    await this.branchAccess.assertUserCanAccessBranch(staff, branchId);
    // KDS must not hide unfinished tickets just because the clock crossed midnight.
    // Keep a rolling window so still-open late/overnight orders remain visible,
    // while stale seed/demo tickets from old sessions do not flood the board.
    const queueWindowStart = new Date(Date.now() - 48 * 60 * 60 * 1000);

    const where: Record<string, unknown> = {
      branchId,
      tenantId: staff.tenantId,
      orderStatus: statusFilter
        ? { equals: statusFilter }
        : { in: KDS_ORDER_STATUSES },
      orderDateTime: { gte: queueWindowStart },
    };

    // If station filter, only show orders that have items for that station
    if (stationId) {
      where.orderItems = { some: { stationId } };
    }

    return this.prisma.order.findMany({
      where,
      orderBy: { orderDateTime: "asc" },
      include: {
        session: {
          select: {
            id: true,
            table: { select: { id: true, tableCode: true } },
          },
        },
        orderItems: {
          where: stationId ? { stationId } : undefined,
          include: {
            menuItem: {
              select: { id: true, name: true, prepTimeMinutes: true },
            },
            station: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
  }

  /** KDS stats for today: avg prep time, counts, etc. */
  async getStats(branchId: string, staff: AuthenticatedStaff) {
    await this.branchAccess.assertUserCanAccessBranch(staff, branchId);
    const tenantId = staff.tenantId;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Calculate average prep time from OrderStatusHistory
    // Prep time = time between IN_KITCHEN status and READY status
    const prepTimes = await this.prisma.$queryRaw<Array<{ avg_minutes: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (r."changedAt" - k."changedAt")) / 60) AS avg_minutes
      FROM "OrderStatusHistory" k
      JOIN "OrderStatusHistory" r ON k."orderId" = r."orderId"
      WHERE k."toStatus" = 'IN_KITCHEN'
        AND r."toStatus" = 'READY'
        AND k."branchId" = ${branchId}
        AND k."tenantId" = ${tenantId}
        AND k."changedAt" >= ${todayStart}
        AND k."changedAt" <= ${todayEnd}
    `;

    const avgPrepMinutes = prepTimes[0]?.avg_minutes !== null
      ? Math.round(prepTimes[0].avg_minutes)
      : 0;

    // Count today's completed orders (reached READY today)
    const completedToday = await this.prisma.order.count({
      where: {
        branchId, tenantId,
        orderStatus: OrderStatus.READY,
        orderDateTime: { gte: todayStart },
      },
    });

    // Count today's total orders
    const totalToday = await this.prisma.order.count({
      where: {
        branchId, tenantId,
        orderStatus: { in: KDS_ORDER_STATUSES },
        orderDateTime: { gte: todayStart },
      },
    });

    return {
      avgPrepMinutes,
      completedToday,
      totalToday,
      date: todayStart.toISOString().slice(0, 10),
    };
  }

  /** List available kitchen stations for a branch. */
  async getStations(branchId: string, staff: AuthenticatedStaff) {
    await this.branchAccess.assertUserCanAccessBranch(staff, branchId);
    return this.prisma.kitchenStation.findMany({
      where: { branchId, tenantId: staff.tenantId, isActive: true },
      orderBy: { displayOrder: "asc" },
      select: { id: true, code: true, name: true },
    });
  }

  /** Get a single order for KDS view. */
  async getOrder(orderId: string, staff: AuthenticatedStaff) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        session: {
          select: {
            id: true,
            table: { select: { id: true, tableCode: true } },
          },
        },
        orderItems: {
          include: {
            menuItem: {
              select: { id: true, name: true, prepTimeMinutes: true },
            },
            station: { select: { id: true, code: true, name: true } },
          },
        },
        statusHistory: {
          orderBy: { changedAt: "asc" },
        },
      },
    });
    if (!order || order.tenantId !== staff.tenantId) {
      throw new NotFoundException("Order not found");
    }
    await this.branchAccess.assertUserCanAccessEntityBranch(staff, order);
    return order;
  }

  /**
   * Start an order from KDS: advance it into the kitchen.
   * PLACED → CONFIRMED → IN_KITCHEN (two hops) or CONFIRMED → IN_KITCHEN.
   */
  async startOrder(orderId: string, staff: AuthenticatedStaff) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order || order.tenantId !== staff.tenantId) {
      throw new NotFoundException("Order not found");
    }
    await this.branchAccess.assertUserCanAccessEntityBranch(staff, order);

    let targetStatus: OrderStatus;
    if (order.orderStatus === OrderStatus.PLACED) {
      // Jump directly to IN_KITCHEN, recording both hops
      targetStatus = OrderStatus.IN_KITCHEN;
    } else if (order.orderStatus === OrderStatus.CONFIRMED) {
      targetStatus = OrderStatus.IN_KITCHEN;
    } else {
      throw new BadRequestException(
        `Cannot start order: current status is ${order.orderStatus}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // If jumping from PLACED, record PLACED→CONFIRMED first
      if (order.orderStatus === OrderStatus.PLACED) {
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            tenantId: order.tenantId,
            branchId: order.branchId,
            fromStatus: OrderStatus.PLACED,
            toStatus: OrderStatus.CONFIRMED,
            changedByStaffId: staff.staffId,
          },
        });
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          tenantId: order.tenantId,
          branchId: order.branchId,
          fromStatus:
            order.orderStatus === OrderStatus.PLACED
              ? OrderStatus.CONFIRMED
              : order.orderStatus,
          toStatus: targetStatus,
          changedByStaffId: staff.staffId,
        },
      });

      return tx.order.update({
        where: { id: orderId },
        data: { orderStatus: targetStatus },
      });
    });

    this.realtime.emit(
      "ORDER_UPDATED",
      order.tenantId,
      order.branchId,
      { orderId, sessionId: order.sessionId, status: targetStatus },
    );

    return updated;
  }

  /**
   * Mark order READY — only allowed when all non-cancelled items are READY.
   */
  async markOrderReady(orderId: string, staff: AuthenticatedStaff) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: true,
        session: {
          select: {
            table: { select: { tableCode: true } },
          },
        },
      },
    });
    if (!order || order.tenantId !== staff.tenantId) {
      throw new NotFoundException("Order not found");
    }
    await this.branchAccess.assertUserCanAccessEntityBranch(staff, order);

    if (!isValidOrderTransition(order.orderStatus, OrderStatus.READY)) {
      throw new BadRequestException(
        `Cannot mark order READY: current status is ${order.orderStatus}`,
      );
    }

    // Check all active (non-cancelled) items are READY
    const activeItems = order.orderItems.filter(
      (i) => i.kitchenStatus !== KitchenItemStatus.CANCELLED,
    );
    const allReady = activeItems.every(
      (i) => i.kitchenStatus === KitchenItemStatus.READY,
    );
    if (!allReady) {
      const pending = activeItems
        .filter((i) => i.kitchenStatus !== KitchenItemStatus.READY)
        .map((i) => `${i.id}(${i.kitchenStatus})`);
      throw new BadRequestException(
        `Cannot mark order READY: items not ready: ${pending.join(", ")}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          tenantId: order.tenantId,
          branchId: order.branchId,
          fromStatus: order.orderStatus,
          toStatus: OrderStatus.READY,
          changedByStaffId: staff.staffId,
        },
      });

      return tx.order.update({
        where: { id: orderId },
        data: { orderStatus: OrderStatus.READY },
      });
    });

    this.realtime.emit(
      "ORDER_READY",
      order.tenantId,
      order.branchId,
      { orderId, sessionId: order.sessionId, assignedWaiterId: order.assignedWaiterId },
    );

    if (order.assignedWaiterId) {
      try {
        await this.notifications.create({
          tenantId: order.tenantId,
          branchId: order.branchId,
          staffId: order.assignedWaiterId,
          type: "ORDER_STATUS",
          title: `Order ready for table ${order.session.table.tableCode}`,
          body: `Kitchen marked order #${order.id.slice(-4).toUpperCase()} ready to serve.`,
        });
      } catch {
        // A notification write failure must not roll back a completed kitchen update.
      }
    }

    return updated;
  }

  /** Update a single order item's kitchen status. */
  async updateItemStatus(
    orderItemId: string,
    newStatus: KitchenItemStatus,
    staff: AuthenticatedStaff,
  ) {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        order: { select: { tenantId: true, branchId: true, sessionId: true } },
      },
    });
    if (!item || item.order.tenantId !== staff.tenantId) {
      throw new NotFoundException("Order item not found");
    }
    await this.branchAccess.assertUserCanAccessEntityBranch(staff, item.order);

    if (!isValidKitchenItemTransition(item.kitchenStatus, newStatus)) {
      throw new BadRequestException(
        `Cannot transition item from ${item.kitchenStatus} to ${newStatus}`,
      );
    }

    // Capture timing data
    const timingUpdate: Record<string, unknown> = { kitchenStatus: newStatus };
    if (newStatus === KitchenItemStatus.IN_PROGRESS) {
      timingUpdate.startedAt = new Date();
    } else if (newStatus === KitchenItemStatus.READY) {
      timingUpdate.readyAt = new Date();
    }

    const updated = await this.prisma.orderItem.update({
      where: { id: orderItemId },
      data: timingUpdate,
    });

    this.realtime.emit(
      "ORDER_UPDATED",
      item.order.tenantId,
      item.order.branchId,
      {
        orderId: item.orderId,
        sessionId: item.order.sessionId,
        orderItemId,
        kitchenStatus: newStatus,
      },
    );

    return updated;
  }

  // ── Kitchen-side 86 ────────────────────────────────

  async markMenuItemUnavailable(itemId: string, staff: AuthenticatedStaff) {
    const item = await this.prisma.menuItem.findUnique({ where: { id: itemId } });
    if (!item || item.tenantId !== staff.tenantId) {
      throw new NotFoundException("Menu item not found");
    }
    if (item.branchId) {
      await this.branchAccess.assertUserCanAccessBranch(staff, item.branchId);
    }

    const updated = await this.prisma.menuItem.update({
      where: { id: itemId },
      data: { isUnavailable: true },
    });

    this.realtime.emit("ITEM_86ED", staff.tenantId, item.branchId ?? staff.branchId, {
      menuItemId: itemId, name: item.name, isUnavailable: true, reason: "Kitchen 86",
    });

    return updated;
  }

  // ── Undo (8-second window) ─────────────────────────

  private static readonly UNDO_WINDOW_MS = 8_000;

  async undoItemStatus(orderItemId: string, staff: AuthenticatedStaff) {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: { select: { tenantId: true, branchId: true, sessionId: true, orderStatus: true } } },
    });
    if (!item || item.order.tenantId !== staff.tenantId) {
      throw new NotFoundException("Order item not found");
    }
    await this.branchAccess.assertUserCanAccessEntityBranch(staff, item.order);

    // Only allow undo READY → IN_PROGRESS
    if (item.kitchenStatus !== KitchenItemStatus.READY) {
      throw new BadRequestException("Can only undo items in READY status");
    }

    // Check undo window
    if (!item.readyAt) {
      throw new BadRequestException("No timestamp to check undo window");
    }
    const elapsed = Date.now() - new Date(item.readyAt).getTime();
    if (elapsed > KdsService.UNDO_WINDOW_MS) {
      throw new BadRequestException(`Undo window expired (${Math.round(elapsed / 1000)}s > 8s)`);
    }

    // Block if order is already READY (all items done → order moved)
    if (item.order.orderStatus === "READY" || item.order.orderStatus === "SERVED" || item.order.orderStatus === "COMPLETED") {
      throw new BadRequestException("Cannot undo: order has already moved past kitchen");
    }

    const updated = await this.prisma.orderItem.update({
      where: { id: orderItemId },
      data: { kitchenStatus: KitchenItemStatus.IN_PROGRESS, readyAt: null },
    });

    this.realtime.emit("ORDER_UPDATED", item.order.tenantId, item.order.branchId, {
      orderId: item.orderId, sessionId: item.order.sessionId, orderItemId, kitchenStatus: "IN_PROGRESS", undone: true,
    });

    return updated;
  }

  // ── Waste / Remake ─────────────────────────────────

  async recordWaste(
    data: { menuItemId: string; orderId?: string; orderItemId?: string; type: import("@prisma/client").WasteType; quantity?: number; reasonCode: import("@prisma/client").WasteReason; note?: string },
    tenantId: string, branchId: string, staffId: string,
  ) {
    const menuItem = await this.prisma.menuItem.findUnique({ where: { id: data.menuItemId } });
    if (!menuItem || menuItem.tenantId !== tenantId) {
      throw new NotFoundException("Menu item not found");
    }

    return this.prisma.wasteRecord.create({
      data: {
        tenantId, branchId, menuItemId: data.menuItemId,
        orderId: data.orderId, orderItemId: data.orderItemId,
        type: data.type, quantity: data.quantity ?? 1,
        reasonCode: data.reasonCode, note: data.note,
        createdByStaffId: staffId,
      },
    });
  }
}
