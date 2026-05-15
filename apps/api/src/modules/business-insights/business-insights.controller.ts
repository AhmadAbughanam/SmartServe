import { Controller, Get, Query, Req, Inject } from '@nestjs/common';
import { BusinessInsightsService } from './business-insights.service.js';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator.js';
import { BranchAccessService } from '../auth/branch-access.service.js';

@Controller('admin/ai/business-insights')
export class BusinessInsightsController {
  constructor(
    @Inject(BusinessInsightsService)
    private readonly insightsService: BusinessInsightsService,
    @Inject(BranchAccessService)
    private readonly branchAccess: BranchAccessService,
  ) {}

  @Get()
  @RequirePermissions('analytics:read')
  async getInsights(
    @Req() req: any,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    // `req.staff` is populated by your JwtAuthGuard
    const staff = req.staff;

    const effectiveBranchId = await this.branchAccess.resolveOptionalBranchId(staff, branchId);

    return this.insightsService.generateInsights(
      staff.tenantId,
      staff.staffId,
      effectiveBranchId ? 'BRANCH' : 'TENANT',
      effectiveBranchId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }
}
