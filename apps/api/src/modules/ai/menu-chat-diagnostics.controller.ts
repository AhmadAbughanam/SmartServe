import { Controller, Get, Inject, Query } from "@nestjs/common";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import { BranchAccessService } from "../auth/branch-access.service.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";
import { MenuChatbotService } from "./menu-chatbot.service.js";

@Controller("admin/ai/menu-chat")
export class MenuChatDiagnosticsController {
  constructor(
    @Inject(MenuChatbotService)
    private readonly menuChatbotService: MenuChatbotService,
    @Inject(BranchAccessService)
    private readonly branchAccess: BranchAccessService,
  ) {}

  @Get("diagnostics")
  @RequirePermissions("admin:read")
  async getDiagnostics(
    @Query("branchId") branchId: string,
    @Query("hours") hours: string | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.menuChatbotService.getDiagnostics({
      tenantId: staff.tenantId,
      branchId: effectiveBranchId,
      hours: hours ? Number(hours) : undefined,
    });
  }
}
