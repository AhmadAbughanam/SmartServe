import { Controller, Get, Inject, Query } from "@nestjs/common";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";
import { LogsQueryDto } from "./dto/logs-query.dto.js";
import { LogsService } from "./logs.service.js";

@Controller("admin/logs")
@RequirePermissions("audit:read")
export class LogsController {
  constructor(@Inject(LogsService) private readonly logsService: LogsService) {}

  @Get("audit")
  listAudit(
    @Query() query: LogsQueryDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.logsService.listAudit(staff, query);
  }

  @Get("operational")
  listOperational(
    @Query() query: LogsQueryDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.logsService.listOperational(staff, query);
  }

  @Get("payments")
  listPayments(
    @Query() query: LogsQueryDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.logsService.listPayments(staff, query);
  }
}
