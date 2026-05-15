import { Controller, Get, Post, Patch, Param, Query, Body, Inject } from "@nestjs/common";
import { WaiterService } from "./waiter.service.js";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import { BranchAccessService } from "../auth/branch-access.service.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";
import {
  WaiterCancelItemDto,
  WaiterNotesDto,
  WaiterPaymentConfirmDto,
  WaiterQuickAddDto,
  WaiterSurchargeDto,
  WaiterUpdateQuantityDto,
} from "./dto/waiter.dto.js";

@Controller("waiter")
export class WaiterController {
  constructor(
    @Inject(WaiterService) private readonly service: WaiterService,
    @Inject(BranchAccessService)
    private readonly branchAccess: BranchAccessService,
  ) {}

  /** Aggregate floor summary with attention states for waiter dashboard. */
  @Get("floor")
  @RequirePermissions("tables:read")
  async getFloor(
    @Query("branchId") branchId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.service.getFloorSummary(effectiveBranchId, staff.tenantId, staff.staffId);
  }

  /** Ready kitchen handoff queue for assigned or unassigned orders. */
  @Get("ready-orders")
  @RequirePermissions("orders:read")
  async getReadyOrders(
    @Query("branchId") branchId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.service.getReadyOrders(effectiveBranchId, staff.tenantId, staff.staffId);
  }

  /** Detailed table view with session, orders, and requests. */
  @Get("tables/:tableId")
  @RequirePermissions("tables:read")
  async getTableDetail(
    @Param("tableId") tableId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.service.getTableDetail(tableId, staff);
  }

  /** Serve an order (READY -> SERVED). */
  @Patch("orders/:orderId/serve")
  @RequirePermissions("orders:write")
  async serveOrder(
    @Param("orderId") orderId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.service.serveOrder(orderId, staff);
  }

  /** Take responsibility for an order before it is served. */
  @Patch("orders/:orderId/claim")
  @RequirePermissions("orders:write")
  async claimOrder(
    @Param("orderId") orderId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.service.claimOrder(orderId, staff);
  }

  /** Clear/close a table: end session, set CLEANING. */
  @Post("tables/:tableId/clear")
  @RequirePermissions("tables:write")
  async clearTable(
    @Param("tableId") tableId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.service.clearTable(tableId, staff);
  }

  /** Quick-add items to a table's active session. */
  @Post("tables/:tableId/quick-add")
  @RequirePermissions("orders:write")
  async quickAdd(
    @Param("tableId") tableId: string,
    @Body() body: WaiterQuickAddDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.service.quickAddOrder(tableId, staff, body.items, body.specialInstructions);
  }

  /** Waiter confirms cash payment received. */
  @Post("orders/:orderId/payments/cash-confirm")
  @RequirePermissions("payments:write")
  async confirmCash(
    @Param("orderId") orderId: string,
    @Body() body: WaiterPaymentConfirmDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.service.confirmPayment(orderId, "CASH", staff, body.amount, body.tipAmount);
  }

  /** Waiter confirms terminal payment completed. */
  @Post("orders/:orderId/payments/terminal-confirm")
  @RequirePermissions("payments:write")
  async confirmTerminal(
    @Param("orderId") orderId: string,
    @Body() body: WaiterPaymentConfirmDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.service.confirmPayment(orderId, "CARD", staff, body.amount, body.tipAmount, body.reference);
  }

  /** Update item quantity (PENDING items only). */
  @Patch("order-items/:itemId/quantity")
  @RequirePermissions("orders:write")
  async updateItemQuantity(
    @Param("itemId") itemId: string,
    @Body() body: WaiterUpdateQuantityDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.service.updateItemQuantity(itemId, body.quantity, staff);
  }

  /** Cancel/remove an order item (PENDING items only). */
  @Patch("order-items/:itemId/cancel")
  @RequirePermissions("orders:write")
  async cancelItem(
    @Param("itemId") itemId: string,
    @Body() body: WaiterCancelItemDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.service.cancelOrderItem(itemId, staff, body.reason);
  }

  /** Add surcharge to an order. */
  @Patch("orders/:orderId/surcharge")
  @RequirePermissions("orders:write")
  async addSurcharge(
    @Param("orderId") orderId: string,
    @Body() body: WaiterSurchargeDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.service.addSurcharge(orderId, body.amount, staff);
  }

  /** Update special instructions on an order. */
  @Patch("orders/:orderId/notes")
  @RequirePermissions("orders:write")
  async updateNotes(
    @Param("orderId") orderId: string,
    @Body() body: WaiterNotesDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.service.updateOrderNotes(orderId, body.notes, staff);
  }
}
