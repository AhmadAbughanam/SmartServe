import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
} from "@nestjs/common";
import { TablesService } from "./tables.service.js";
import { UpdateTableStatusDto } from "./dto/update-table-status.dto.js";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";

@Controller()
export class TablesController {
  constructor(
    @Inject(TablesService) private readonly tablesService: TablesService,
  ) {}

  @Get("branches/:branchId/tables")
  @RequirePermissions("tables:read")
  listTables(
    @Param("branchId") branchId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.tablesService.listByBranch(branchId, staff);
  }

  @Get("tables/:tableId")
  @RequirePermissions("tables:read")
  getTable(
    @Param("tableId") tableId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.tablesService.getById(tableId, staff);
  }

  @Patch("tables/:tableId/status")
  @RequirePermissions("tables:write")
  updateTableStatus(
    @Param("tableId") tableId: string,
    @Body() dto: UpdateTableStatusDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.tablesService.updateStatus(tableId, dto.status, staff);
  }
}
