import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { AdminService } from "./admin.service.js";
import { CreateBranchDto, UpdateBranchDto } from "./dto/branch.dto.js";
import { CreateStaffDto, UpdateStaffDto, AssignRoleDto } from "./dto/staff.dto.js";
import { CreateRoleDto, AssignPermissionsDto } from "./dto/role.dto.js";
import { CreateTaxRuleDto, UpdateTaxRuleDto } from "./dto/tax-rule.dto.js";
import { CreateExpenseDto } from "./dto/expense.dto.js";
import {
  AdminEditOrderDto,
  ResolveLowStockAlertDto,
} from "./dto/operations.dto.js";
import { UpdateBranchSettingsDto } from "../branch-settings/dto/branch-settings.dto.js";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import { BranchAccessService } from "../auth/branch-access.service.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";

@Controller("admin")
export class AdminController {
  constructor(
    @Inject(AdminService) private readonly adminService: AdminService,
    @Inject(BranchAccessService)
    private readonly branchAccess: BranchAccessService,
  ) {}

  // ── Tenant ───────────────────────────────────────────

  @Get("tenant")
  @RequirePermissions("admin:read")
  getTenant(@CurrentStaff() staff: AuthenticatedStaff) {
    return this.adminService.getTenant(staff.tenantId);
  }

  // ── Branches ─────────────────────────────────────────

  @Get("branches")
  @RequirePermissions("admin:read")
  listBranches(@CurrentStaff() staff: AuthenticatedStaff) {
    return this.adminService.listBranches(staff.tenantId);
  }

  @Get("branches/:branchId")
  @RequirePermissions("admin:read")
  getBranch(
    @Param("branchId") branchId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.adminService.getBranch(branchId, staff.tenantId);
  }

  @Post("branches")
  @RequirePermissions("admin:write")
  createBranch(
    @Body() dto: CreateBranchDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.adminService.createBranch(staff.tenantId, dto, staff.staffId);
  }

  @Patch("branches/:branchId")
  @RequirePermissions("admin:write")
  updateBranch(
    @Param("branchId") branchId: string,
    @Body() dto: UpdateBranchDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.adminService.updateBranch(branchId, staff.tenantId, dto, staff.staffId);
  }

  // ── Staff ────────────────────────────────────────────

  @Get("staff")
  @RequirePermissions("staff:read")
  async listStaff(
    @Query("branchId") branchId: string | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.adminService.listStaff(staff.tenantId, effectiveBranchId);
  }

  @Get("staff/:staffId")
  @RequirePermissions("staff:read")
  async getStaff(
    @Param("staffId") staffId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const result = await this.adminService.getStaff(staffId, staff.tenantId);
    await this.branchAccess.assertUserCanAccessBranch(staff, result.branchId);
    return result;
  }

  @Post("staff")
  @RequirePermissions("staff:write")
  async createStaff(
    @Body() dto: CreateStaffDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    await this.branchAccess.assertUserCanAccessBranch(staff, dto.branchId);
    return this.adminService.createStaff(staff.tenantId, dto, staff.staffId);
  }

  @Patch("staff/:staffId")
  @RequirePermissions("staff:write")
  async updateStaff(
    @Param("staffId") staffId: string,
    @Body() dto: UpdateStaffDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const result = await this.adminService.updateStaff(staffId, staff.tenantId, dto, staff.staffId);
    await this.branchAccess.assertUserCanAccessBranch(staff, result.branchId);
    return result;
  }

  @Post("staff/:staffId/roles")
  @RequirePermissions("staff:write")
  async assignRole(
    @Param("staffId") staffId: string,
    @Body() dto: AssignRoleDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const targetStaff = await this.adminService.getStaff(staffId, staff.tenantId);
    await this.branchAccess.assertUserCanAccessBranch(staff, targetStaff.branchId);
    return this.adminService.assignRole(staffId, dto.roleId, staff.tenantId, staff.staffId);
  }

  // ── Roles / Permissions ──────────────────────────────

  @Get("roles")
  @RequirePermissions("admin:read")
  listRoles(@CurrentStaff() staff: AuthenticatedStaff) {
    return this.adminService.listRoles(staff.tenantId);
  }

  @Get("permissions")
  @RequirePermissions("admin:read")
  listPermissions() {
    return this.adminService.listPermissions();
  }

  @Post("roles")
  @RequirePermissions("admin:write")
  createRole(
    @Body() dto: CreateRoleDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.adminService.createRole(staff.tenantId, dto, staff.staffId);
  }

  @Post("roles/:roleId/permissions")
  @RequirePermissions("admin:write")
  assignPermissions(
    @Param("roleId") roleId: string,
    @Body() dto: AssignPermissionsDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.adminService.assignPermissions(roleId, staff.tenantId, dto, staff.staffId);
  }

  // ── Tax Rules ────────────────────────────────────────

  @Get("tax-rules")
  @RequirePermissions("admin:read")
  async listTaxRules(
    @Query("branchId") branchId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.adminService.listTaxRules(effectiveBranchId, staff.tenantId);
  }

  @Post("tax-rules")
  @RequirePermissions("admin:write")
  async createTaxRule(
    @Body() dto: CreateTaxRuleDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    await this.branchAccess.assertUserCanAccessBranch(staff, dto.branchId);
    return this.adminService.createTaxRule(staff.tenantId, dto, staff.staffId);
  }

  @Patch("tax-rules/:taxRuleId")
  @RequirePermissions("admin:write")
  updateTaxRule(
    @Param("taxRuleId") taxRuleId: string,
    @Body() dto: UpdateTaxRuleDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.adminService.updateTaxRule(taxRuleId, staff.tenantId, dto, staff.staffId);
  }

  // ── Expenses ─────────────────────────────────────────

  @Post("expenses")
  @RequirePermissions("admin:write")
  async createExpense(
    @Body() dto: CreateExpenseDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    await this.branchAccess.assertUserCanAccessBranch(staff, dto.branchId);
    return this.adminService.createExpense(staff.tenantId, dto, staff.staffId);
  }

  @Get("expenses")
  @RequirePermissions("admin:read")
  async listExpenses(
    @Query("branchId") branchId: string | undefined,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.adminService.listExpenses(staff.tenantId, effectiveBranchId, from, to);
  }

  @Get("expenses/:expenseId")
  @RequirePermissions("admin:read")
  getExpense(
    @Param("expenseId") expenseId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.adminService.getExpense(expenseId, staff.tenantId);
  }

  // ── Branch Settings ──────────────────────────────────

  @Get("branch-settings")
  @RequirePermissions("admin:read")
  async getBranchSettings(
    @Query("branchId") branchId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.adminService.getBranchSettings(effectiveBranchId, staff.tenantId);
  }

  @Patch("branch-settings")
  @RequirePermissions("admin:write")
  async updateBranchSettings(
    @Query("branchId") branchId: string,
    @Body() body: UpdateBranchSettingsDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.adminService.updateBranchSettings(effectiveBranchId, staff.tenantId, body, staff.staffId);
  }

  // ── Order Edit ──────────────────────────────────────

  @Patch("orders/:orderId")
  @RequirePermissions("orders:write")
  editOrder(
    @Param("orderId") orderId: string,
    @Body() body: AdminEditOrderDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.adminService.editOrder(orderId, staff.tenantId, body, staff.staffId);
  }

  // ── Finance Summary ─────────────────────────────────

  @Get("finance-summary")
  @RequirePermissions("analytics:read")
  async getFinanceSummary(
    @Query("branchId") branchId: string,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.adminService.getFinanceSummary(effectiveBranchId, staff.tenantId, from, to);
  }

  // ── Inventory Tracking ──────────────────────────────

  @Get("inventory/adjustments")
  @RequirePermissions("inventory:read")
  async listStockAdjustments(
    @Query("branchId") branchId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.adminService.listStockAdjustments(effectiveBranchId, staff.tenantId);
  }

  @Get("inventory/alerts")
  @RequirePermissions("inventory:read")
  async listLowStockAlerts(
    @Query("branchId") branchId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.adminService.listLowStockAlerts(effectiveBranchId, staff.tenantId);
  }

  @Patch("inventory/alerts/:alertId")
  @RequirePermissions("inventory:write")
  resolveLowStockAlert(
    @Param("alertId") alertId: string,
    @Body() body: ResolveLowStockAlertDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.adminService.resolveLowStockAlert(alertId, staff.tenantId, body.status, staff.staffId);
  }

  // ── Promotions Tracking ─────────────────────────────

  @Get("promotions/coupon-redemptions")
  @RequirePermissions("promotions:read")
  async listCouponRedemptions(
    @Query("branchId") branchId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.adminService.listCouponRedemptions(effectiveBranchId, staff.tenantId);
  }

  @Get("promotions/gift-card-transactions")
  @RequirePermissions("promotions:read")
  async listGiftCardTransactions(
    @Query("branchId") branchId: string | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.adminService.listGiftCardTransactions(staff.tenantId, effectiveBranchId);
  }

  // ── Multi-Branch Summary ─────────────────────────────

  @Get("multi-branch-summary")
  @RequirePermissions("admin:read")
  getMultiBranchSummary(@CurrentStaff() staff: AuthenticatedStaff) {
    return this.adminService.getMultiBranchSummary(staff.tenantId);
  }

  // ── Audit Logs ───────────────────────────────────────

  @Get("audit-logs")
  @RequirePermissions("audit:read")
  async listAuditLogs(
    @Query("branchId") branchId: string | undefined,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @Query("entityType") entityType: string | undefined,
    @Query("actionCode") actionCode: string | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.adminService.listAuditLogs(
      staff.tenantId,
      effectiveBranchId,
      from,
      to,
      entityType,
      actionCode,
    );
  }
}
