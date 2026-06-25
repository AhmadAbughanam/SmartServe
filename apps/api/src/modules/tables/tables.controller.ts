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
import { BranchAccessService } from "../auth/branch-access.service.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";
import { TablesService } from "./tables.service.js";
import { CreateTableDto, UpdateTableDto } from "./dto/index.js";

@Controller("admin/tables")
export class TablesController {
  constructor(
    @Inject(TablesService)
    private readonly tablesService: TablesService,
    @Inject(BranchAccessService)
    private readonly branchAccess: BranchAccessService,
  ) {}

  @Get()
  @RequirePermissions("tables:read")
  async findAll(
    @Query("branchId") branchId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    await this.branchAccess.assertUserCanAccessBranch(staff, effectiveBranchId);
    return this.tablesService.findAllForBranch(effectiveBranchId);
  }

  @Post()
  @RequirePermissions("tables:write")
  async create(
    @Body() createTableDto: CreateTableDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    await this.branchAccess.assertUserCanAccessBranch(
      staff,
      createTableDto.branchId,
    );
    // TODO: Add audit log
    return this.tablesService.create(createTableDto);
  }

  @Patch(":id")
  @RequirePermissions("tables:write")
  async update(
    @Param("id") id: string,
    @Body() updateTableDto: UpdateTableDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const table = await this.tablesService.findById(id);
    if (table) {
      await this.branchAccess.assertUserCanAccessBranch(staff, table.branchId);
    }
    // TODO: Add audit log
    return this.tablesService.update(id, updateTableDto);
  }

  @Delete(":id")
  @RequirePermissions("tables:write")
  async remove(
    @Param("id") id: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    // Ensure staff has access to the branch this table belongs to.
    const table = await this.tablesService.findById(id);
    if (table) {
      await this.branchAccess.assertUserCanAccessBranch(staff, table.branchId);
    }
    // TODO: Add audit log
    return this.tablesService.remove(id);
  }
}
