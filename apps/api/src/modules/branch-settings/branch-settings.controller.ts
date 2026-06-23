import { Controller, Get, Patch, Param, Body, Inject, ForbiddenException } from "@nestjs/common";
import { BranchSettingsService } from "./branch-settings.service.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import { UpdateBranchSettingsDto } from "./dto/branch-settings.dto.js";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";

@Controller("branches/:branchId/settings")
export class BranchSettingsController {
  constructor(@Inject(BranchSettingsService) private readonly settings: BranchSettingsService) {}

  @Get()
  @RequirePermissions("admin:read")
  async get(
    @Param("branchId") branchId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.settings.getByBranch(staff.tenantId, branchId);
  }

  @Patch()
  @RequirePermissions("settings:write")
  async update(
    @Param("branchId") branchId: string,
    @Body() body: UpdateBranchSettingsDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    if ("featureFlagsJson" in body || "aiConfigJson" in body) {
      throw new ForbiddenException("Feature modules are managed by the SaaS owner");
    }
    return this.settings.upsert(staff.tenantId, branchId, body);
  }
}
