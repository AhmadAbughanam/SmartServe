import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type { AuthenticatedSaasOwner } from "../auth/types/auth.types.js";
import {
  CreateSaasBranchDto,
  CreateSaasTenantDto,
  CreateTenantOwnerDto,
  SaasAiBranchDetailQueryDto,
  SaasAuditLogsQueryDto,
  SaasOperationsQueryDto,
  SaasRevenueQueryDto,
  SaasStaffQueryDto,
  SaasSystemHealthQueryDto,
  SaasSessionsQueryDto,
  UpdateSaasBranchDto,
  UpdateSaasBranchStatusDto,
  UpdateSaasTenantDto,
  UpdateSaasTenantStatusDto,
  UpdateTenantSubscriptionDto,
  UpdatePlatformSettingsDto,
  UpdateSaasStaffStatusDto,
  UpdateBranchAiControlsDto,
  UpdateBranchFeatureModulesDto,
} from "./dto/saas-admin.dto.js";
import { SaasAdminGuard } from "./guards/saas-admin.guard.js";
import { SaasAdminService } from "./saas-admin.service.js";

type SaasRequest = Request & { saasOwner?: AuthenticatedSaasOwner };

@Controller("saas")
@UseGuards(SaasAdminGuard)
export class SaasAdminController {
  constructor(
    @Inject(SaasAdminService) private readonly service: SaasAdminService,
  ) {}

  @Get("me")
  me(@Req() req: SaasRequest) {
    return req.saasOwner;
  }

  @Get("tenants")
  listTenants() {
    return this.service.listTenants();
  }

  @Post("tenants")
  createTenant(@Body() dto: CreateSaasTenantDto) {
    return this.service.createTenant(dto);
  }

  @Patch("tenants/:tenantId")
  updateTenant(
    @Param("tenantId") tenantId: string,
    @Body() dto: UpdateSaasTenantDto,
  ) {
    return this.service.updateTenant(tenantId, dto);
  }

  @Patch("tenants/:tenantId/status")
  updateTenantStatus(
    @Param("tenantId") tenantId: string,
    @Body() dto: UpdateSaasTenantStatusDto,
  ) {
    return this.service.updateTenantStatus(tenantId, dto);
  }

  @Post("tenants/:tenantId/branches")
  createBranch(
    @Param("tenantId") tenantId: string,
    @Body() dto: CreateSaasBranchDto,
  ) {
    return this.service.createBranch(tenantId, dto);
  }

  @Post("tenants/owners")
  createTenantOwner(@Body() dto: CreateTenantOwnerDto) {
    return this.service.createTenantOwner(dto);
  }

  @Patch("branches/:branchId")
  updateBranch(
    @Param("branchId") branchId: string,
    @Body() dto: UpdateSaasBranchDto,
  ) {
    return this.service.updateBranch(branchId, dto);
  }

  @Patch("branches/:branchId/status")
  updateBranchStatus(
    @Param("branchId") branchId: string,
    @Body() dto: UpdateSaasBranchStatusDto,
  ) {
    return this.service.updateBranchStatus(branchId, dto);
  }

  @Get("analytics")
  getAnalytics() {
    return this.service.getAnalytics();
  }

  @Get("revenue")
  getRevenue(@Query() query: SaasRevenueQueryDto) {
    return this.service.getRevenueOverview(query.from, query.to);
  }

  @Get("billing/overview")
  getBillingOverview() {
    return this.service.getBillingOverview();
  }

  @Get("billing/tenants")
  getBillingTenants() {
    return this.service.getBillingTenants();
  }

  @Get("billing/invoices")
  getBillingInvoices() {
    return this.service.getBillingInvoices();
  }

  @Patch("billing/tenants/:tenantId/subscription")
  updateTenantSubscription(
    @Param("tenantId") tenantId: string,
    @Body() dto: UpdateTenantSubscriptionDto,
  ) {
    return this.service.updateTenantSubscription(tenantId, dto);
  }

  @Get("operations/overview")
  getOperationsOverview(@Query() query: SaasOperationsQueryDto) {
    return this.service.getOperationsOverview(query.hours);
  }

  @Get("operations/branches")
  listOperationsBranches(@Query() query: SaasOperationsQueryDto) {
    return this.service.listOperationsBranches(query.hours);
  }

  @Get("operations/branches/:branchId")
  getOperationsBranchDetail(
    @Param("branchId") branchId: string,
    @Query() query: SaasOperationsQueryDto,
  ) {
    return this.service.getOperationsBranchDetail(branchId, query.hours);
  }

  @Get("sessions/overview")
  getSessionsOverview(@Query() query: SaasSessionsQueryDto) {
    return this.service.getSessionsOverview(query.hours);
  }

  @Get("sessions")
  listSessions(@Query() query: SaasSessionsQueryDto) {
    return this.service.listSessions(query.hours);
  }

  @Get("sessions/:sessionId")
  getSessionDetail(@Param("sessionId") sessionId: string) {
    return this.service.getSessionDetail(sessionId);
  }

  @Get("staff/overview")
  getStaffOverview(@Query() query: SaasStaffQueryDto) {
    return this.service.getStaffOverview(query.hours);
  }

  @Get("staff/members")
  listStaffMembers(@Query() query: SaasStaffQueryDto) {
    return this.service.listStaffMembers(query.hours);
  }

  @Get("staff/members/:staffId")
  getStaffMemberDetail(
    @Param("staffId") staffId: string,
    @Query() query: SaasStaffQueryDto,
  ) {
    return this.service.getStaffMemberDetail(staffId, query.hours);
  }

  @Patch("staff/members/:staffId/status")
  updateStaffMemberStatus(
    @Param("staffId") staffId: string,
    @Body() dto: UpdateSaasStaffStatusDto,
  ) {
    return this.service.updateStaffMemberStatus(staffId, dto);
  }

  @Get("system-health/overview")
  getSystemHealthOverview(@Query() query: SaasSystemHealthQueryDto) {
    return this.service.getSystemHealthOverview(query.hours);
  }

  @Get("system-health/services")
  listSystemHealthServices(@Query() query: SaasSystemHealthQueryDto) {
    return this.service.listSystemHealthServices(query.hours);
  }

  @Get("system-health/incidents")
  listSystemHealthIncidents(@Query() query: SaasSystemHealthQueryDto) {
    return this.service.listSystemHealthIncidents(query.hours);
  }

  @Get("audit-logs/overview")
  getAuditLogsOverview(@Query() query: SaasAuditLogsQueryDto) {
    return this.service.getAuditLogsOverview(query.from, query.to);
  }

  @Get("audit-logs/feed")
  getAuditLogsFeed(@Query() query: SaasAuditLogsQueryDto) {
    return this.service.getAuditLogsFeed(query.from, query.to);
  }

  @Get("settings")
  getPlatformSettings() {
    return this.service.getPlatformSettings();
  }

  @Patch("settings")
  updatePlatformSettings(@Body() dto: UpdatePlatformSettingsDto) {
    return this.service.updatePlatformSettings(dto);
  }

  @Get("ai/overview")
  getAiOverview() {
    return this.service.getAiOverview();
  }

  @Get("ai/branches")
  listAiBranches() {
    return this.service.listAiBranches();
  }

  @Get("ai/branches/:branchId")
  getAiBranchDetail(
    @Param("branchId") branchId: string,
    @Query() query: SaasAiBranchDetailQueryDto,
  ) {
    return this.service.getAiBranchDetail(branchId, query.hours);
  }

  @Patch("ai/branches/:branchId")
  updateBranchAiControls(
    @Param("branchId") branchId: string,
    @Body() dto: UpdateBranchAiControlsDto,
  ) {
    return this.service.updateBranchAiControls(branchId, dto);
  }

  @Patch("branches/:branchId/features")
  updateBranchFeatures(
    @Param("branchId") branchId: string,
    @Body() dto: UpdateBranchFeatureModulesDto,
  ) {
    return this.service.updateBranchFeatures(branchId, dto);
  }
}
