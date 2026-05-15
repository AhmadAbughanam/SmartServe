import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { InventoryService } from "./inventory.service.js";
import { BranchAccessService } from "../auth/branch-access.service.js";
import {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  AdjustInventoryDto,
  MapMenuItemInventoryDto,
} from "./dto/inventory.dto.js";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";

@Controller("inventory")
export class InventoryController {
  constructor(
    @Inject(InventoryService)
    private readonly inventoryService: InventoryService,
    @Inject(BranchAccessService)
    private readonly branchAccess: BranchAccessService,
  ) {}

  @Get("items")
  @RequirePermissions("inventory:read")
  async list(
    @Query("branchId") branchId: string | undefined,
    @Query("lowStock") lowStock: string | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.inventoryService.list(
      staff.tenantId,
      effectiveBranchId,
      lowStock === "true",
    );
  }

  @Get("items/:itemId")
  @RequirePermissions("inventory:read")
  getById(
    @Param("itemId") itemId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.inventoryService.getById(itemId, staff);
  }

  @Post("items")
  @RequirePermissions("inventory:write")
  async create(
    @Body() dto: CreateInventoryItemDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    await this.branchAccess.assertUserCanAccessBranch(staff, dto.branchId);
    return this.inventoryService.create(staff.tenantId, dto, staff.staffId);
  }

  @Patch("items/:itemId")
  @RequirePermissions("inventory:write")
  update(
    @Param("itemId") itemId: string,
    @Body() dto: UpdateInventoryItemDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.inventoryService.update(itemId, staff, dto);
  }

  @Post("items/:itemId/adjust")
  @RequirePermissions("inventory:adjust")
  adjust(
    @Param("itemId") itemId: string,
    @Body() dto: AdjustInventoryDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.inventoryService.adjust(itemId, dto.delta, dto.reason, staff);
  }

  @Get("low-stock")
  @RequirePermissions("inventory:read")
  async getLowStock(
    @Query("branchId") branchId: string | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.inventoryService.getLowStock(
      staff.tenantId,
      effectiveBranchId,
    );
  }

  @Get("menu-items/:menuItemId/map")
  @RequirePermissions("inventory:read")
  getMapping(
    @Param("menuItemId") menuItemId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.inventoryService.getMapping(menuItemId, staff);
  }

  @Post("menu-items/:menuItemId/map")
  @RequirePermissions("inventory:write")
  createMapping(
    @Param("menuItemId") menuItemId: string,
    @Body() dto: MapMenuItemInventoryDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.inventoryService.createMapping(menuItemId, dto, staff);
  }

  @Delete("menu-items/:menuItemId/map/:inventoryItemId")
  @RequirePermissions("inventory:write")
  removeMapping(
    @Param("menuItemId") menuItemId: string,
    @Param("inventoryItemId") inventoryItemId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.inventoryService.removeMapping(menuItemId, inventoryItemId, staff);
  }
}
