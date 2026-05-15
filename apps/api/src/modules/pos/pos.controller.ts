import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
} from "@nestjs/common";
import { PosService } from "./pos.service.js";
import { CreatePosOrderDto } from "./dto/pos-order.dto.js";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";

@Controller("pos")
export class PosController {
  constructor(
    @Inject(PosService) private readonly posService: PosService,
  ) {}

  @Post("orders")
  @RequirePermissions("pos:write")
  createOrder(
    @Body() dto: CreatePosOrderDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.posService.createOrder(dto, staff.staffId);
  }

  @Get("orders/active")
  @RequirePermissions("pos:read")
  getActiveOrders(
    @Query("branchId") branchId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.posService.getActiveOrders(
      branchId || staff.branchId,
      staff.tenantId,
    );
  }
}
