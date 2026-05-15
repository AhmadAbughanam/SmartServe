import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  KitchenItemStatus,
  OrderPaymentStatus,
  OrderSource,
  OrderStatus,
  SessionStatus,
  type Prisma,
} from "@prisma/client";
import { Decimal, type InputJsonValue } from "@prisma/client/runtime/library";
import { PrismaService } from "../../prisma/prisma.service.js";
import { RealtimeService } from "../realtime/realtime.service.js";
import { LogsService } from "../logs/logs.service.js";
import { BranchAccessService } from "../auth/branch-access.service.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";
import { isValidOrderTransition } from "./order-status.rules.js";
import type { CreateOrderDto } from "./dto/create-order.dto.js";

type CreateOrderOptions = {
  source?: OrderSource;
};

@Injectable()
export class OrdersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
    @Inject(LogsService) private readonly logsService: LogsService,
    @Inject(BranchAccessService)
    private readonly branchAccess: BranchAccessService,
  ) {}

  async createOrder(sessionId: string, dto: CreateOrderDto, options: CreateOrderOptions = {}) {
    // --- Validate session ---
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        branch: { select: { id: true, tenantId: true, isActive: true } },
        table: { select: { id: true, branchId: true } },
      },
    });
    if (!session) throw new NotFoundException("Session not found");
    if (session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException(
        `Cannot create order: session is ${session.status}`,
      );
    }
    if (!session.branch.isActive) {
      throw new BadRequestException("Cannot create order: branch is inactive");
    }
    if (session.table.branchId !== session.branchId) {
      throw new ForbiddenException("Session table does not belong to session branch");
    }

    const tenantId = session.branch.tenantId;
    const branchId = session.branchId;

    // --- Idempotency check is session-scoped for public safety ---
    if (dto.idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: { orderItems: true },
      });
      if (existing) {
        if (existing.sessionId !== sessionId || existing.tenantId !== tenantId || existing.branchId !== branchId) {
          throw new ConflictException("Idempotency key was already used for another session");
        }
        return existing;
      }
    }

    if (!dto.items.length) {
      throw new BadRequestException("Order must have at least one item");
    }

    // --- Load all menu items at once ---
    const menuItemIds = dto.items.map((i) => i.menuItemId);
    const menuItems = await this.prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        tenantId,
        OR: [{ branchId }, { branchId: null }],
      },
      include: {
        additions: true,
        inventoryLinks: {
          include: {
            inventoryItem: true,
          },
        },
      },
    });

    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));
    const requestedQuantityByItem = new Map<string, number>();
    for (const item of dto.items) {
      requestedQuantityByItem.set(
        item.menuItemId,
        (requestedQuantityByItem.get(item.menuItemId) ?? 0) + item.quantity,
      );
    }

    // --- Load tax rules for this branch ---
    const taxRules = await this.prisma.taxRule.findMany({
      where: { tenantId, branchId, isActive: true },
    });
    const taxRateByClass = new Map(
      taxRules.map((r) => [r.taxClass, r.ratePercent]),
    );

    // --- Build order items with price calculation ---
    type OrderItemData = {
      tenantId: string;
      branchId: string;
      menuItemId: string;
      quantity: number;
      itemBasePrice: Decimal;
      lineDiscountAmount: Decimal;
      lineTaxAmount: Decimal;
      lineTotal: Decimal;
      specializationsJson: InputJsonValue | undefined;
      kitchenStatus: KitchenItemStatus;
    };

    const orderItemsData: OrderItemData[] = [];
    let subtotal = new Decimal(0);
    let totalTax = new Decimal(0);

    for (const lineItem of dto.items) {
      const menuItem = menuItemMap.get(lineItem.menuItemId);
      if (!menuItem) {
        throw new NotFoundException(
          `Menu item ${lineItem.menuItemId} not found`,
        );
      }
      if (menuItem.branchId && menuItem.branchId !== branchId) {
        throw new ForbiddenException(
          `Menu item '${menuItem.name}' is not available for this branch`,
        );
      }
      if (!menuItem.isActive) {
        throw new ConflictException(
          `Menu item '${menuItem.name}' is not active`,
        );
      }
      if (menuItem.isUnavailable) {
        throw new ConflictException(
          `Menu item '${menuItem.name}' is currently unavailable (86'd)`,
        );
      }

      this.assertStockAvailable(
        menuItem,
        branchId,
        requestedQuantityByItem.get(lineItem.menuItemId) ?? lineItem.quantity,
      );

      // Validate additions and calculate price impact
      let additionsPrice = new Decimal(0);
      const selectedAdditions: Array<{
        id: string;
        name: string;
        priceImpact: string;
      }> = [];

      if (lineItem.additions?.length) {
        for (const sel of lineItem.additions) {
          const addition = menuItem.additions.find(
            (a) => a.id === sel.additionId && a.isActive,
          );
          if (!addition) {
            throw new BadRequestException(
              `Addition ${sel.additionId} not found or inactive for item '${menuItem.name}'`,
            );
          }
          additionsPrice = additionsPrice.add(addition.priceImpact);
          selectedAdditions.push({
            id: addition.id,
            name: addition.name,
            priceImpact: addition.priceImpact.toString(),
          });
        }
      }

      const unitPrice = menuItem.price.add(additionsPrice);
      const lineBase = unitPrice.mul(lineItem.quantity);

      // Tax calculation
      const taxRate = taxRateByClass.get(menuItem.taxClass) ?? new Decimal(0);
      const lineTax = lineBase.mul(taxRate).div(100).toDecimalPlaces(2);

      const lineTotal = lineBase.add(lineTax);

      subtotal = subtotal.add(lineBase);
      totalTax = totalTax.add(lineTax);

      orderItemsData.push({
        tenantId,
        branchId,
        menuItemId: menuItem.id,
        quantity: lineItem.quantity,
        itemBasePrice: unitPrice,
        lineDiscountAmount: new Decimal(0),
        lineTaxAmount: lineTax,
        lineTotal,
        specializationsJson:
          selectedAdditions.length > 0 ? selectedAdditions : undefined,
        kitchenStatus: KitchenItemStatus.PENDING,
      });
    }

    const serviceChargeAmount = new Decimal(0);
    const discountAmount = new Decimal(0);
    const totalAmount = subtotal.add(totalTax).add(serviceChargeAmount).sub(discountAmount);

    // Snapshot tax rules used
    const taxSnapshot = taxRules.map((r) => ({
      taxClass: r.taxClass,
      ratePercent: r.ratePercent.toString(),
    }));

    // --- Create order in transaction ---
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          tenantId,
          branchId,
          sessionId,
          userId: session.userId,
          source: options.source ?? OrderSource.USER_APP,
          specialInstructions: dto.specialInstructions,
          idempotencyKey: dto.idempotencyKey,
          subtotalAmount: subtotal,
          taxAmount: totalTax,
          serviceChargeAmount,
          discountAmount,
          totalAmount,
          orderStatus: OrderStatus.PLACED,
          paymentStatus: OrderPaymentStatus.UNPAID,
          taxSnapshotJson: taxSnapshot,
        },
      });

      // Create order items
      await tx.orderItem.createMany({
        data: orderItemsData.map((item) => ({
          ...item,
          orderId: created.id,
        })),
      });

      // Create initial status history entry
      await tx.orderStatusHistory.create({
        data: {
          orderId: created.id,
          tenantId,
          branchId,
          fromStatus: null,
          toStatus: OrderStatus.PLACED,
        },
      });

      // Increment table totalOrders
      await tx.table.update({
        where: { id: session.tableId },
        data: { totalOrders: { increment: 1 } },
      });

      // Reload with items
      return tx.order.findUniqueOrThrow({
        where: { id: created.id },
        include: { orderItems: true },
      });
    });

    this.realtime.emit("ORDER_PLACED", tenantId, branchId, {
      orderId: order.id,
      sessionId,
      itemCount: order.orderItems.length,
      totalAmount: order.totalAmount.toString(),
    });
    void this.logsService.writeOperational({
      tenantId,
      branchId,
      sessionId,
      orderId: order.id,
      eventType: "ORDER_PLACED",
      message: `Order ${order.id.slice(-6)} was placed`,
      metadata: {
        itemCount: order.orderItems.length,
        totalAmount: order.totalAmount.toString(),
        source: order.source,
      },
    });

    // Update UserItemStat for recommendation engine (non-critical)
    if (session.userId) {
      this.updateUserItemStats(session.userId, dto.items).catch(() => {});
    }

    return order;
  }

  private async updateUserItemStats(
    userId: string,
    items: Array<{ menuItemId: string; quantity: number }>,
  ) {
    for (const item of items) {
      await this.prisma.userItemStat.upsert({
        where: {
          userId_menuItemId: { userId, menuItemId: item.menuItemId },
        },
        update: {
          timesOrdered: { increment: item.quantity },
          lastOrderedAt: new Date(),
        },
        create: {
          userId,
          menuItemId: item.menuItemId,
          timesOrdered: item.quantity,
          lastOrderedAt: new Date(),
        },
      });
    }
  }

  private assertStockAvailable(
    menuItem: {
      name: string;
      inventoryLinks: Array<{
        qtyPerItem: Decimal;
        inventoryItem: {
          branchId: string;
          name: string;
          currentStock: Decimal;
          isActive: boolean;
        };
      }>;
    },
    branchId: string,
    requestedQuantity: number,
  ) {
    const branchInventoryLinks = menuItem.inventoryLinks.filter(
      (link) => link.inventoryItem.isActive && link.inventoryItem.branchId === branchId,
    );
    for (const link of branchInventoryLinks) {
      const required = link.qtyPerItem.mul(requestedQuantity);
      if (link.inventoryItem.currentStock.lt(required)) {
        throw new ConflictException(
          `Menu item '${menuItem.name}' is out of stock: insufficient ${link.inventoryItem.name}`,
        );
      }
    }
  }

  async getById(orderId: string, tenantId?: string, staff?: AuthenticatedStaff) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: {
            menuItem: {
              select: { id: true, name: true, imageUrl: true },
            },
          },
        },
        session: {
          select: { id: true, tableId: true, status: true },
        },
        statusHistory: {
          orderBy: { changedAt: "asc" },
          select: {
            fromStatus: true,
            toStatus: true,
            reason: true,
            changedAt: true,
          },
        },
      },
    });
    if (!order || (tenantId && order.tenantId !== tenantId)) {
      throw new NotFoundException("Order not found");
    }
    if (staff) {
      await this.branchAccess.assertUserCanAccessEntityBranch(staff, order);
    }
    return order;
  }

  async getByIdForSession(orderId: string, sessionId: string) {
    const order = await this.getById(orderId);
    if (order.session.id !== sessionId) {
      throw new NotFoundException("Order not found in session");
    }
    return order;
  }

  async updateStatus(
    orderId: string,
    newStatus: OrderStatus,
    staff: AuthenticatedStaff,
    reason?: string,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.tenantId !== staff.tenantId) {
      throw new NotFoundException("Order not found");
    }
    await this.branchAccess.assertUserCanAccessEntityBranch(staff, order);

    if (!isValidOrderTransition(order.orderStatus, newStatus)) {
      throw new BadRequestException(
        `Cannot transition order from ${order.orderStatus} to ${newStatus}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (newStatus === OrderStatus.SERVED) {
        await this.decrementInventoryForServedOrder(tx, orderId, staff.staffId);
      }

      const updateResult = await tx.order.updateMany({
        where: {
          id: orderId,
          tenantId: order.tenantId,
          branchId: order.branchId,
          orderStatus: order.orderStatus,
          ...(newStatus === OrderStatus.SERVED
            ? { inventoryDecrementedAt: null }
            : {}),
        },
        data: {
          orderStatus: newStatus,
          ...(newStatus === OrderStatus.SERVED
            ? { inventoryDecrementedAt: new Date() }
            : {}),
        },
      });
      if (updateResult.count !== 1) {
        throw new ConflictException("Order status was already changed");
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          tenantId: order.tenantId,
          branchId: order.branchId,
          fromStatus: order.orderStatus,
          toStatus: newStatus,
          reason,
          changedByStaffId: staff.staffId,
        },
      });

      return tx.order.findUniqueOrThrow({ where: { id: orderId } });
    });

    const eventName =
      newStatus === OrderStatus.READY
        ? "ORDER_READY"
        : newStatus === OrderStatus.SERVED
          ? "ORDER_SERVED"
          : "ORDER_UPDATED";

    this.realtime.emit(eventName, order.tenantId, order.branchId, {
      orderId,
      sessionId: order.sessionId,
      status: newStatus,
    });
    void this.logsService.writeOperational({
      tenantId: order.tenantId,
      branchId: order.branchId,
      sessionId: order.sessionId,
      orderId,
      actorStaffId: staff.staffId,
      eventType: eventName,
      message: `Order ${orderId.slice(-6)} changed from ${order.orderStatus} to ${newStatus}`,
      metadata: {
        fromStatus: order.orderStatus,
        toStatus: newStatus,
        reason,
      },
    });

    return updated;
  }

  private async decrementInventoryForServedOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    staffId: string,
  ) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          where: { kitchenStatus: { not: KitchenItemStatus.CANCELLED } },
          include: {
            menuItem: {
              include: {
                inventoryLinks: { include: { inventoryItem: true } },
              },
            },
          },
        },
      },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.inventoryDecrementedAt) {
      throw new ConflictException("Inventory was already decremented for this order");
    }

    const requirements = new Map<string, {
      inventoryItem: {
        id: string;
        tenantId: string;
        branchId: string;
        name: string;
        currentStock: Decimal;
        reorderLevel: Decimal;
      };
      required: Decimal;
      menuItemIds: Set<string>;
    }>();

    for (const orderItem of order.orderItems) {
      for (const link of orderItem.menuItem.inventoryLinks) {
        const inventoryItem = link.inventoryItem;
        if (!inventoryItem.isActive || inventoryItem.branchId !== order.branchId) continue;
        const required = link.qtyPerItem.mul(orderItem.quantity);
        const existing = requirements.get(inventoryItem.id);
        if (existing) {
          existing.required = existing.required.add(required);
          existing.menuItemIds.add(orderItem.menuItem.id);
        } else {
          requirements.set(inventoryItem.id, {
            inventoryItem,
            required,
            menuItemIds: new Set([orderItem.menuItem.id]),
          });
        }
      }
    }

    for (const requirement of requirements.values()) {
      const { inventoryItem, required } = requirement;
      if (inventoryItem.tenantId !== order.tenantId || inventoryItem.branchId !== order.branchId) {
        throw new ConflictException("Inventory item scope does not match order branch");
      }
      if (inventoryItem.currentStock.lt(required)) {
        throw new ConflictException(
          `Insufficient stock for ${inventoryItem.name}: required ${required.toString()}, available ${inventoryItem.currentStock.toString()}`,
        );
      }

      const quantityAfter = inventoryItem.currentStock.sub(required);
      const decrement = await tx.inventoryItem.updateMany({
        where: {
          id: inventoryItem.id,
          tenantId: order.tenantId,
          branchId: order.branchId,
          currentStock: { gte: required },
        },
        data: { currentStock: { decrement: required } },
      });
      if (decrement.count !== 1) {
        throw new ConflictException(`Insufficient stock for ${inventoryItem.name}`);
      }

      await tx.stockAdjustment.create({
        data: {
          tenantId: order.tenantId,
          branchId: order.branchId,
          inventoryItemId: inventoryItem.id,
          delta: required.neg(),
          reason: `Order ${orderId} served; before=${inventoryItem.currentStock.toString()}; after=${quantityAfter.toString()}; menuItems=${[...requirement.menuItemIds].join(",")}`,
          sourceType: "ORDER_AUTO",
          createdByStaffId: staffId,
        },
      });

      if (quantityAfter.lte(inventoryItem.reorderLevel) && inventoryItem.currentStock.gt(inventoryItem.reorderLevel)) {
        await tx.lowStockAlert.create({
          data: {
            tenantId: order.tenantId,
            branchId: order.branchId,
            inventoryItemId: inventoryItem.id,
            thresholdSnapshot: inventoryItem.reorderLevel,
            stockSnapshot: quantityAfter,
          },
        });
      }

      if (quantityAfter.eq(0)) {
        await tx.menuItem.updateMany({
          where: {
            id: { in: [...requirement.menuItemIds] },
            tenantId: order.tenantId,
            OR: [{ branchId: order.branchId }, { branchId: null }],
          },
          data: { isUnavailable: true },
        });
      }
    }
  }
}
