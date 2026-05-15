import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { OrdersService } from "./orders.service.js";
import { CreateOrderDto } from "./dto/create-order.dto.js";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto.js";
import { Public } from "../auth/decorators/public.decorator.js";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";

@Controller()
export class OrdersController {
  constructor(
    @Inject(OrdersService) private readonly ordersService: OrdersService,
  ) {}

  /**
   * Create order for an active session.
   * Public because customers order from their devices via the session.
   */
  @Public()
  @Post("sessions/:sessionId/orders")
  createOrder(
    @Param("sessionId") sessionId: string,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ordersService.createOrder(sessionId, dto);
  }

  @Get("orders/:orderId")
  @RequirePermissions("orders:read")
  getOrder(
    @Param("orderId") orderId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.ordersService.getById(orderId, staff.tenantId, staff);
  }

  /** Public order detail scoped to a session — for customer order tracking. */
  @Public()
  @Get("sessions/:sessionId/orders/:orderId")
  getSessionOrder(
    @Param("sessionId") sessionId: string,
    @Param("orderId") orderId: string,
  ) {
    return this.ordersService.getByIdForSession(orderId, sessionId);
  }

  @Patch("orders/:orderId/status")
  @RequirePermissions("orders:write")
  updateOrderStatus(
    @Param("orderId") orderId: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.ordersService.updateStatus(
      orderId,
      dto.status,
      staff,
      dto.reason,
    );
  }
}
