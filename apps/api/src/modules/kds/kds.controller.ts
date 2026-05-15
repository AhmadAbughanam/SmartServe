import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import type { OrderStatus } from "@prisma/client";
import { KdsService } from "./kds.service.js";
import { UpdateItemStatusDto } from "./dto/update-item-status.dto.js";
import { RecordWasteDto } from "./dto/waste.dto.js";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";

@Controller("kds")
export class KdsController {
  constructor(
    @Inject(KdsService) private readonly kdsService: KdsService,
  ) {}

  @Get("orders")
  @RequirePermissions("kds:read")
  getQueue(
    @Query("branchId") branchId: string,
    @Query("status") status: OrderStatus | undefined,
    @Query("stationId") stationId: string | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.kdsService.getQueue(branchId, staff, status, stationId);
  }

  @Get("stations")
  @RequirePermissions("kds:read")
  getStations(
    @Query("branchId") branchId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.kdsService.getStations(branchId, staff);
  }

  @Get("stats")
  @RequirePermissions("kds:read")
  getStats(
    @Query("branchId") branchId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.kdsService.getStats(branchId, staff);
  }

  @Get("orders/:orderId")
  @RequirePermissions("kds:read")
  getOrder(
    @Param("orderId") orderId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.kdsService.getOrder(orderId, staff);
  }

  @Patch("orders/:orderId/start")
  @RequirePermissions("kds:write")
  startOrder(
    @Param("orderId") orderId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.kdsService.startOrder(orderId, staff);
  }

  @Patch("orders/:orderId/ready")
  @RequirePermissions("kds:write")
  markReady(
    @Param("orderId") orderId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.kdsService.markOrderReady(
      orderId,
      staff,
    );
  }

  @Patch("order-items/:orderItemId/status")
  @RequirePermissions("kds:write")
  updateItemStatus(
    @Param("orderItemId") orderItemId: string,
    @Body() dto: UpdateItemStatusDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.kdsService.updateItemStatus(
      orderItemId,
      dto.status,
      staff,
    );
  }

  /** Kitchen-side 86: mark a menu item unavailable. */
  @Patch("menu-items/:itemId/unavailable")
  @RequirePermissions("kds:write")
  markItemUnavailable(
    @Param("itemId") itemId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.kdsService.markMenuItemUnavailable(itemId, staff);
  }

  /** Undo last item status change within 8-second window. */
  @Patch("order-items/:orderItemId/undo")
  @RequirePermissions("kds:write")
  undoItemStatus(
    @Param("orderItemId") orderItemId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.kdsService.undoItemStatus(orderItemId, staff);
  }

  /** Record waste/remake for an item. */
  @Post("waste")
  @RequirePermissions("kds:write")
  recordWaste(
    @Body() body: RecordWasteDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.kdsService.recordWaste(body, staff.tenantId, staff.branchId, staff.staffId);
  }
}
