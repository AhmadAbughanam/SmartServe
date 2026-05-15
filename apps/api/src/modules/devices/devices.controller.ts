import { Controller, Get, Post, Patch, Param, Query, Body, Inject } from "@nestjs/common";
import { DevicesService } from "./devices.service.js";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import { BranchAccessService } from "../auth/branch-access.service.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";
import { CreateDeviceDto, UpdateDeviceDto } from "./dto/device.dto.js";

@Controller("admin/devices")
export class DevicesController {
  constructor(
    @Inject(DevicesService) private readonly devices: DevicesService,
    @Inject(BranchAccessService)
    private readonly branchAccess: BranchAccessService,
  ) {}

  @Get()
  @RequirePermissions("admin:read")
  async list(
    @Query("branchId") branchId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.devices.listByBranch(staff.tenantId, effectiveBranchId);
  }

  @Post()
  @RequirePermissions("admin:write")
  async create(
    @Body() body: CreateDeviceDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    await this.branchAccess.assertUserCanAccessBranch(staff, body.branchId);
    return this.devices.create({ tenantId: staff.tenantId, ...body });
  }

  @Patch(":deviceId")
  @RequirePermissions("admin:write")
  async update(
    @Param("deviceId") deviceId: string,
    @Body() body: UpdateDeviceDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.devices.update(deviceId, staff.tenantId, body);
  }

  @Post(":deviceId/reset-key")
  @RequirePermissions("admin:write")
  async resetKey(
    @Param("deviceId") deviceId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.devices.resetKey(deviceId, staff.tenantId);
  }
}
