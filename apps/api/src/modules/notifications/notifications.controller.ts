import { Controller, Get, Patch, Param, Query, Inject } from "@nestjs/common";
import { NotificationsService } from "./notifications.service.js";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";

@Controller("notifications")
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly service: NotificationsService) {}

  @Get()
  @RequirePermissions("tables:read")
  list(
    @Query("unreadOnly") unreadOnly: string | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.service.listForStaff(staff.tenantId, staff.branchId, staff.staffId, unreadOnly === "true");
  }

  @Get("unread-count")
  @RequirePermissions("tables:read")
  unreadCount(@CurrentStaff() staff: AuthenticatedStaff) {
    return this.service.unreadCount(staff.tenantId, staff.branchId, staff.staffId);
  }

  @Patch(":id/read")
  @RequirePermissions("tables:read")
  markRead(@Param("id") id: string, @CurrentStaff() staff: AuthenticatedStaff) {
    return this.service.markRead(id, staff.tenantId, staff.branchId, staff.staffId);
  }

  @Patch("read-all")
  @RequirePermissions("tables:read")
  markAllRead(@CurrentStaff() staff: AuthenticatedStaff) {
    return this.service.markAllRead(staff.tenantId, staff.branchId, staff.staffId);
  }
}
