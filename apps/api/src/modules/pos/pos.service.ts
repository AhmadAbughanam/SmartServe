import {
  BadRequestException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { OrderSource, SessionStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { OrdersService } from "../orders/orders.service.js";
import { SessionsService } from "../sessions/sessions.service.js";
import type { CreatePosOrderDto } from "./dto/pos-order.dto.js";

@Injectable()
export class PosService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OrdersService) private readonly ordersService: OrdersService,
    @Inject(SessionsService) private readonly sessionsService: SessionsService,
  ) {}

  /**
   * POS order creation.
   *
   * If sessionId is provided, the order is placed on that session.
   * If not, branchId + tableCode starts a new session first.
   * Source is always POS_DASHBOARD.
   */
  async createOrder(dto: CreatePosOrderDto, staffId: string) {
    let sessionId = dto.sessionId;

    if (!sessionId) {
      if (!dto.branchId || !dto.tableCode) {
        throw new BadRequestException(
          "Either sessionId or branchId + tableCode must be provided",
        );
      }

      const session = await this.sessionsService.startSession({
        branchId: dto.branchId,
        tableCode: dto.tableCode,
        guestCount: dto.guestCount ?? 1,
        createdByStaffId: staffId,
      });

      sessionId = session.id;
    }

    return this.ordersService.createOrder(sessionId, {
      items: dto.items,
      specialInstructions: dto.specialInstructions,
      idempotencyKey: dto.idempotencyKey,
    }, {
      source: OrderSource.POS_DASHBOARD,
    });
  }

  /** Active orders for POS dashboard — branch-scoped, non-terminal statuses. */
  async getActiveOrders(branchId: string, tenantId: string) {
    return this.prisma.order.findMany({
      where: {
        branchId,
        tenantId,
        source: OrderSource.POS_DASHBOARD,
        orderStatus: {
          in: ["PLACED", "CONFIRMED", "IN_KITCHEN", "READY", "SERVED"],
        },
      },
      orderBy: { orderDateTime: "desc" },
      include: {
        session: {
          select: {
            id: true,
            table: { select: { tableCode: true } },
          },
        },
        orderItems: {
          include: {
            menuItem: { select: { name: true } },
          },
        },
      },
    });
  }
}
