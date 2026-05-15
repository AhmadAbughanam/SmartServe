import { Controller, Get, Patch, Param, Body, Inject } from "@nestjs/common";
import { BranchSettingsService } from "./branch-settings.service.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import { UpdateBranchSettingsDto } from "./dto/branch-settings.dto.js";

@Controller("branches/:branchId/settings")
export class BranchSettingsController {
  constructor(@Inject(BranchSettingsService) private readonly settings: BranchSettingsService) {}

  @Get()
  @RequirePermissions("admin:read")
  async get(@Param("branchId") branchId: string) {
    // tenantId should come from auth context; placeholder scoping
    return this.settings.getByBranch("", branchId);
  }

  @Patch()
  @RequirePermissions("settings:write")
  async update(
    @Param("branchId") branchId: string,
    @Body() body: UpdateBranchSettingsDto,
  ) {
    return this.settings.upsert("", branchId, body);
  }
}
