import {
  Controller,
  Get,
  Inject,
  Post,
  Query,
} from "@nestjs/common";
import { AnalyticsService } from "./analytics.service.js";
import { BranchAccessService } from "../auth/branch-access.service.js";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";

@Controller("analytics")
export class AnalyticsController {
  constructor(
    @Inject(AnalyticsService)
    private readonly analyticsService: AnalyticsService,
    @Inject(BranchAccessService)
    private readonly branchAccess: BranchAccessService,
  ) {}

  @Get("dashboard")
  @RequirePermissions("analytics:read")
  async getDashboard(
    @Query("branchId") branchId: string | undefined,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.analyticsService.getDashboard(
      staff.tenantId,
      effectiveBranchId,
      from,
      to,
    );
  }

  @Get("sales")
  @RequirePermissions("analytics:read")
  async getSales(
    @Query("branchId") branchId: string | undefined,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.analyticsService.getSalesReport(
      staff.tenantId,
      effectiveBranchId,
      from,
      to,
    );
  }

  @Get("orders")
  @RequirePermissions("analytics:read")
  async getOrders(
    @Query("branchId") branchId: string | undefined,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.analyticsService.getOrderMetrics(
      staff.tenantId,
      effectiveBranchId,
      from,
      to,
    );
  }

  @Get("menu-performance")
  @RequirePermissions("analytics:read")
  async getMenuPerformance(
    @Query("branchId") branchId: string | undefined,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.analyticsService.getMenuPerformance(
      staff.tenantId,
      effectiveBranchId,
      from,
      to,
    );
  }

  @Get("tables")
  @RequirePermissions("analytics:read")
  async getTables(
    @Query("branchId") branchId: string | undefined,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.analyticsService.getTableMetrics(
      staff.tenantId,
      effectiveBranchId,
      from,
      to,
    );
  }

  @Get("staff")
  @RequirePermissions("analytics:read")
  async getStaff(
    @Query("branchId") branchId: string | undefined,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.analyticsService.getStaffMetrics(
      staff.tenantId,
      effectiveBranchId,
      from,
      to,
    );
  }

  @Get("expenses")
  @RequirePermissions("analytics:read")
  async getExpenses(
    @Query("branchId") branchId: string | undefined,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.analyticsService.getExpenseSummary(
      staff.tenantId,
      effectiveBranchId,
      from,
      to,
    );
  }

  @Post("snapshots/daily")
  @RequirePermissions("analytics:read")
  async generateSnapshot(
    @Query("branchId") branchId: string | undefined,
    @Query("date") date: string | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.analyticsService.generateDailySnapshot(
      staff.tenantId,
      effectiveBranchId,
      date || new Date().toISOString().split("T")[0],
    );
  }

  @Get("insights")
  @RequirePermissions("analytics:read")
  async getInsights(
    @Query("branchId") branchId: string | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.analyticsService.getInsights(staff.tenantId, effectiveBranchId);
  }

  @Get("snapshots/daily")
  @RequirePermissions("analytics:read")
  async getSnapshots(
    @Query("branchId") branchId: string | undefined,
    @Query("from") from: string | undefined,
    @Query("to") to: string | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    const effectiveBranchId = await this.branchAccess.resolveBranchId(staff, branchId);
    return this.analyticsService.getDailySnapshots(
      staff.tenantId,
      effectiveBranchId,
      from,
      to,
    );
  }
}
