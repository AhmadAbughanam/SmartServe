import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  LowStockAlertStatus,
  OrderStatus,
  OrderPaymentStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
  ServiceRequestStatus,
  SessionStatus,
  ShiftStatus,
  StaffRoleCode,
  TableStatus,
  type Prisma,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { env } from "../../config/env.js";
import { MenuChatbotService } from "../ai/menu-chatbot.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { hashPassword } from "../auth/password.util.js";
import type {
  CreateSaasBranchDto,
  CreateSaasTenantDto,
  CreateTenantOwnerDto,
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

interface NormalizedAiControls {
  menuChatEnabled: boolean;
  hostedLlmEnabled: boolean;
  fallbackOnly: boolean;
  dailyHostedRequestLimit: number;
  dailyRequestLimit: number;
  sessionHourlyRequestLimit: number;
  hostedProviderTimeoutMs: number;
  maxResponseLength: number;
  maxSuggestions: number;
  assistantTone: "concise" | "friendly" | "formal";
}

interface AiBranchLogStats {
  requests: number;
  hostedRequests: number;
  fallbackResponses: number;
  staffHelpResponses: number;
  providerRejections: number;
  latestAt: string | null;
}

interface AiBranchStatusSummary {
  code: "healthy" | "attention" | "fallback" | "disabled";
  label: string;
  reason: string;
}

interface OperationsBranchStatusSummary {
  code: "healthy" | "watch" | "attention" | "inactive";
  label: string;
  reason: string;
}

interface StaffActivitySummary {
  code: "active" | "watch" | "idle" | "inactive";
  label: string;
  reason: string;
}

interface SystemHealthStatusSummary {
  code: "healthy" | "degraded" | "unavailable";
  label: string;
  reason: string;
}

interface SystemHealthServiceRow {
  id: string;
  name: string;
  category: "core" | "integration" | "config";
  status: SystemHealthStatusSummary;
  mode: string;
  endpoint: string | null;
  lastCheckedAt: string;
  metrics: {
    incidentCount: number;
    warningCount: number;
    affectedBranches: number;
  };
  highlights: string[];
  actionRoute: string;
}

interface SaasAuditFeedRow {
  id: string;
  stream: "audit" | "operational" | "payments";
  occurredAt: string;
  tenantId: string;
  tenantName: string;
  branchId: string;
  branchName: string;
  actor: { id: string | null; name: string; role: string | null } | null;
  severity: "INFO" | "WARN" | "ERROR" | "AUDIT";
  code: string;
  title: string;
  summary: string;
  reference: string | null;
  entityType: string | null;
  entityId: string | null;
  sessionId: string | null;
  orderId: string | null;
  paymentId: string | null;
  paymentProvider: string | null;
  paymentStatus: string | null;
  amount: string | null;
  beforeJson: Prisma.JsonValue | null;
  afterJson: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
}

type JsonRecord = Record<string, unknown>;

@Injectable()
export class SaasAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MenuChatbotService)
    private readonly menuChatbotService: MenuChatbotService,
  ) {}

  async listTenants() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        branches: {
          orderBy: { name: "asc" },
          include: {
            branchSettings: true,
            _count: { select: { staff: true, orders: true, sessions: true } },
          },
        },
        staff: {
          where: { primaryRole: StaffRoleCode.OWNER },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            branchId: true,
            primaryRole: true,
            isActive: true,
            createdAt: true,
          },
        },
        _count: { select: { branches: true, staff: true, orders: true } },
      },
    });
  }

  async createTenant(dto: CreateSaasTenantDto) {
    return this.prisma.tenant.create({
      data: {
        name: dto.name.trim(),
        ownerName: dto.ownerName?.trim() || null,
        ownerPhone: dto.ownerPhone?.trim() || null,
        ownerEmail: dto.ownerEmail?.trim().toLowerCase() || null,
      },
    });
  }

  async updateTenant(tenantId: string, dto: UpdateSaasTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Tenant not found");

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.ownerName !== undefined ? { ownerName: dto.ownerName.trim() || null } : {}),
        ...(dto.ownerPhone !== undefined ? { ownerPhone: dto.ownerPhone.trim() || null } : {}),
        ...(dto.ownerEmail !== undefined ? { ownerEmail: dto.ownerEmail.trim().toLowerCase() || null } : {}),
      },
    });

    const primaryBranch = await this.prisma.branch.findFirst({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: { id: true },
    });
    if (primaryBranch) {
      await this.prisma.operationalEventLog.create({
        data: {
          tenantId,
          branchId: primaryBranch.id,
          eventType: "SAAS_TENANT_UPDATED",
          message: `Tenant profile updated for ${updated.name}`,
          metadata: { changedFields: Object.keys(dto) },
        },
      });
    }

    return updated;
  }

  async updateTenantStatus(tenantId: string, dto: UpdateSaasTenantStatusDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Tenant not found");

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { isActive: dto.isActive },
    });

    const primaryBranch = await this.prisma.branch.findFirst({
      where: { tenantId },
      orderBy: { name: "asc" },
      select: { id: true },
    });
    if (primaryBranch) {
      await this.prisma.operationalEventLog.create({
        data: {
          tenantId,
          branchId: primaryBranch.id,
          eventType: dto.isActive ? "SAAS_TENANT_REACTIVATED" : "SAAS_TENANT_SUSPENDED",
          message: `Tenant ${updated.name} is now ${dto.isActive ? "active" : "inactive"}`,
          metadata: { isActive: dto.isActive },
        },
      });
    }

    return updated;
  }

  async createBranch(tenantId: string, dto: CreateSaasBranchDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException("Tenant not found");

    return this.prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          location: dto.location.trim(),
          timezone: dto.timezone?.trim() || "UTC",
        },
      });

      await tx.branchSettings.create({
        data: {
          tenantId,
          branchId: branch.id,
          featureFlagsJson: {
            customerOrdering: true,
            kds: true,
            waiterDashboard: true,
            pos: true,
            inventory: true,
            promotions: false,
            aiRecommendations: false,
          },
          aiConfigJson: {
            menuChatEnabled: true,
            hostedLlmEnabled: true,
            fallbackOnly: false,
            dailyHostedRequestLimit: 200,
            dailyRequestLimit: 1000,
            sessionHourlyRequestLimit: 40,
            hostedProviderTimeoutMs: 4500,
            maxResponseLength: 500,
            maxSuggestions: 5,
            assistantTone: "concise",
          },
        },
      });

      await tx.operationalEventLog.create({
        data: {
          tenantId,
          branchId: branch.id,
          eventType: "SAAS_BRANCH_CREATED",
          message: `Branch ${branch.name} created for ${tenant.name}`,
          metadata: { location: branch.location, timezone: branch.timezone },
        },
      });

      return branch;
    });
  }

  async updateBranch(branchId: string, dto: UpdateSaasBranchDto) {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException("Branch not found");

    const updated = await this.prisma.branch.update({
      where: { id: branchId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.location !== undefined ? { location: dto.location.trim() } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone.trim() || "UTC" } : {}),
      },
    });

    await this.prisma.operationalEventLog.create({
      data: {
        tenantId: updated.tenantId,
        branchId: updated.id,
        eventType: "SAAS_BRANCH_UPDATED",
        message: `Branch ${updated.name} profile updated`,
        metadata: { changedFields: Object.keys(dto) },
      },
    });

    return updated;
  }

  async updateBranchStatus(branchId: string, dto: UpdateSaasBranchStatusDto) {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) throw new NotFoundException("Branch not found");

    const updated = await this.prisma.branch.update({
      where: { id: branchId },
      data: { isActive: dto.isActive },
    });

    await this.prisma.operationalEventLog.create({
      data: {
        tenantId: updated.tenantId,
        branchId: updated.id,
        eventType: dto.isActive ? "SAAS_BRANCH_ACTIVATED" : "SAAS_BRANCH_DEACTIVATED",
        message: `Branch ${updated.name} is now ${dto.isActive ? "active" : "inactive"}`,
        metadata: { isActive: dto.isActive },
      },
    });

    return updated;
  }

  async createTenantOwner(dto: CreateTenantOwnerDto) {
    const platformSettings = await this.getOrCreatePlatformSettings();
    if (!platformSettings.ownerProvisioningEnabled) {
      throw new BadRequestException("Owner provisioning is currently disabled at the platform level");
    }

    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, tenantId: dto.tenantId },
    });
    if (!branch) throw new BadRequestException("Branch not found in tenant");

    const existing = await this.prisma.staff.findFirst({
      where: { tenantId: dto.tenantId, email: dto.email },
    });
    if (existing) throw new ConflictException("Email already in use for this tenant");

    const passwordHash = await hashPassword(dto.password);

    return this.prisma.$transaction(async (tx) => {
      const ownerRole = await tx.role.upsert({
        where: {
          tenantId_roleName: {
            tenantId: dto.tenantId,
            roleName: "Owner",
          },
        },
        update: { isActive: true },
        create: {
          tenantId: dto.tenantId,
          roleName: "Owner",
        },
      });

      const permissions = await tx.permission.findMany();
      for (const permission of permissions) {
        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: ownerRole.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: {
            roleId: ownerRole.id,
            permissionId: permission.id,
          },
        });
      }

      const staff = await tx.staff.create({
        data: {
          tenantId: dto.tenantId,
          branchId: dto.branchId,
          name: dto.name,
          phone: dto.phone,
          email: dto.email,
          primaryRole: StaffRoleCode.OWNER,
          passwordHash,
          roleAssignments: {
            create: {
              roleId: ownerRole.id,
            },
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          tenantId: true,
          branchId: true,
          primaryRole: true,
          isActive: true,
          createdAt: true,
        },
      });

      await tx.operationalEventLog.create({
        data: {
          tenantId: dto.tenantId,
          branchId: dto.branchId,
          eventType: "SAAS_OWNER_PROVISIONED_TENANT_OWNER",
          message: `SaaS owner provisioned tenant owner ${dto.email}`,
          metadata: {
            staffId: staff.id,
            role: StaffRoleCode.OWNER,
          },
        },
      });

      return staff;
    });
  }

  async getPlatformSettings() {
    const settings = await this.getOrCreatePlatformSettings();

    return {
      settings: {
        id: settings.id,
        platformName: settings.platformName,
        supportEmail: settings.supportEmail,
        supportPhone: settings.supportPhone,
        maintenanceModeEnabled: settings.maintenanceModeEnabled,
        maintenanceMessage: settings.maintenanceMessage,
        ownerProvisioningEnabled: settings.ownerProvisioningEnabled,
        auditRetentionDays: settings.auditRetentionDays,
        defaultSystemHealthWindowHours: settings.defaultSystemHealthWindowHours,
        defaultRevenueRangeDays: settings.defaultRevenueRangeDays,
        announcements: this.normalizeAnnouncements(settings.announcementJson),
        updatedAt: settings.updatedAt.toISOString(),
      },
      runtime: {
        environment: env.nodeEnv,
        paymentProvider: env.paymentProvider,
        smsProvider: env.smsProvider,
        aiServiceUrl: env.aiServiceUrl,
        storageEndpoint: env.s3Endpoint,
        buildVersion: env.buildVersion,
        commitSha: env.commitSha,
      },
      recentChanges: this.normalizePlatformChangeLog(settings.changeLogJson),
    };
  }

  async updatePlatformSettings(dto: UpdatePlatformSettingsDto) {
    const current = await this.getOrCreatePlatformSettings();
    const currentAnnouncements = this.normalizeAnnouncements(current.announcementJson);
    const nextAnnouncements = dto.announcements ?? currentAnnouncements;
    const currentChangeLog = this.normalizePlatformChangeLog(current.changeLogJson);
    const nextChangeLog = [
      {
        id: `chg_${Date.now()}`,
        createdAt: new Date().toISOString(),
        message: "Platform settings updated",
        metadata: {
          changedFields: Object.keys(dto),
          maintenanceModeEnabled:
            dto.maintenanceModeEnabled ?? current.maintenanceModeEnabled,
          ownerProvisioningEnabled:
            dto.ownerProvisioningEnabled ?? current.ownerProvisioningEnabled,
          auditRetentionDays: dto.auditRetentionDays ?? current.auditRetentionDays,
          defaultSystemHealthWindowHours:
            dto.defaultSystemHealthWindowHours ?? current.defaultSystemHealthWindowHours,
          defaultRevenueRangeDays:
            dto.defaultRevenueRangeDays ?? current.defaultRevenueRangeDays,
        },
      },
      ...currentChangeLog,
    ].slice(0, 12);

    const update: Prisma.PlatformSettingsUpdateInput = {
      ...(dto.platformName !== undefined ? { platformName: dto.platformName.trim() } : {}),
      ...(dto.supportEmail !== undefined ? { supportEmail: dto.supportEmail || null } : {}),
      ...(dto.supportPhone !== undefined ? { supportPhone: dto.supportPhone || null } : {}),
      ...(dto.maintenanceModeEnabled !== undefined ? { maintenanceModeEnabled: dto.maintenanceModeEnabled } : {}),
      ...(dto.maintenanceMessage !== undefined ? { maintenanceMessage: dto.maintenanceMessage || null } : {}),
      ...(dto.ownerProvisioningEnabled !== undefined ? { ownerProvisioningEnabled: dto.ownerProvisioningEnabled } : {}),
      ...(dto.auditRetentionDays !== undefined ? { auditRetentionDays: dto.auditRetentionDays } : {}),
      ...(dto.defaultSystemHealthWindowHours !== undefined ? { defaultSystemHealthWindowHours: dto.defaultSystemHealthWindowHours } : {}),
      ...(dto.defaultRevenueRangeDays !== undefined ? { defaultRevenueRangeDays: dto.defaultRevenueRangeDays } : {}),
      announcementJson: nextAnnouncements as Prisma.InputJsonValue,
      changeLogJson: nextChangeLog as Prisma.InputJsonValue,
    };

    await this.prisma.platformSettings.update({
      where: { id: current.id },
      data: update,
    });

    return this.getPlatformSettings();
  }

  async getAnalytics() {
    const [
      totalTenants,
      activeTenants,
      totalBranches,
      activeBranches,
      activeOrders,
      activeSessions,
      revenue,
      ordersByStatus,
      tenantRows,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { isActive: true } }),
      this.prisma.branch.count(),
      this.prisma.branch.count({ where: { isActive: true } }),
      this.prisma.order.count({
        where: { orderStatus: { in: ["PLACED", "CONFIRMED", "IN_KITCHEN", "READY"] } },
      }),
      this.prisma.session.count({ where: { status: "ACTIVE" } }),
      this.prisma.payment.aggregate({
        where: { paymentStatus: "COMPLETED" },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.order.groupBy({
        by: ["orderStatus"],
        _count: { _all: true },
      }),
      this.prisma.tenant.findMany({
        orderBy: { name: "asc" },
        include: {
          branches: { select: { id: true, name: true, isActive: true } },
          orders: {
            where: { orderStatus: { not: "CANCELLED" } },
            select: { totalAmount: true, paymentStatus: true },
          },
        },
      }),
    ]);

    const tenants = tenantRows.map((tenant) => {
      const totalRevenue = tenant.orders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
      return {
        id: tenant.id,
        name: tenant.name,
        isActive: tenant.isActive,
        branchCount: tenant.branches.length,
        activeBranchCount: tenant.branches.filter((branch) => branch.isActive).length,
        orderCount: tenant.orders.length,
        paidOrderCount: tenant.orders.filter((order) => order.paymentStatus === "PAID").length,
        revenue: totalRevenue.toFixed(2),
      };
    });

    return {
      totals: {
        totalTenants,
        activeTenants,
        totalBranches,
        activeBranches,
        activeOrders,
        activeSessions,
        completedPaymentCount: revenue._count.id,
        globalRevenueVolume: (revenue._sum.amount ?? 0).toString(),
      },
      ordersByStatus: Object.fromEntries(
        ordersByStatus.map((row) => [row.orderStatus, row._count._all]),
      ),
      tenants,
    };
  }

  async getRevenueOverview(from?: string, to?: string) {
    const { start, end } = this.parseRevenueRange(from, to);

    const [tenants, branches, payments, refunds, expenses, orders] = await Promise.all([
      this.prisma.tenant.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, isActive: true },
      }),
      this.prisma.branch.findMany({
        orderBy: [{ tenant: { name: "asc" } }, { name: "asc" }],
        select: {
          id: true,
          tenantId: true,
          name: true,
          location: true,
          isActive: true,
          tenant: { select: { name: true } },
        },
      }),
      this.prisma.payment.findMany({
        where: {
          paymentStatus: PaymentStatus.COMPLETED,
          paymentDate: { gte: start, lte: end },
        },
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          amount: true,
          tipAmount: true,
          paymentMethod: true,
          paymentDate: true,
        },
      }),
      this.prisma.refund.findMany({
        where: {
          status: RefundStatus.COMPLETED,
          createdAt: { gte: start, lte: end },
        },
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          amount: true,
          reason: true,
          createdAt: true,
        },
      }),
      this.prisma.expense.findMany({
        where: { expenseDate: { gte: start, lte: end } },
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          category: true,
          amount: true,
          description: true,
          expenseDate: true,
        },
      }),
      this.prisma.order.findMany({
        where: { orderDateTime: { gte: start, lte: end } },
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          totalAmount: true,
          paymentStatus: true,
          orderDateTime: true,
        },
      }),
    ]);

    const tenantInfo = new Map(tenants.map((tenant) => [tenant.id, tenant]));
    const branchesById = new Map(branches.map((branch) => [branch.id, branch]));
    const branchCountByTenant = new Map<string, { total: number; active: number }>();
    for (const branch of branches) {
      const current = branchCountByTenant.get(branch.tenantId) ?? { total: 0, active: 0 };
      current.total += 1;
      if (branch.isActive) current.active += 1;
      branchCountByTenant.set(branch.tenantId, current);
    }

    const totals = {
      grossSales: new Decimal(0),
      totalRefunds: new Decimal(0),
      totalExpenses: new Decimal(0),
      tipRevenue: new Decimal(0),
      paymentCount: payments.length,
      refundCount: refunds.length,
      expenseCount: expenses.length,
      orderCount: orders.length,
      paidOrders: 0,
      unpaidOrders: 0,
    };

    const paymentMethods = new Map<PaymentMethod, { total: Decimal; count: number }>();
    const expenseCategories = new Map<string, { total: Decimal; count: number }>();
    const dailyTrend = new Map<string, {
      date: string;
      grossSales: Decimal;
      refunds: Decimal;
      expenses: Decimal;
      paymentCount: number;
      orderCount: number;
    }>();
    const tenantRollup = new Map<string, {
      tenantId: string;
      tenantName: string;
      tenantActive: boolean;
      grossSales: Decimal;
      refunds: Decimal;
      expenses: Decimal;
      tipRevenue: Decimal;
      paymentCount: number;
      refundCount: number;
      expenseCount: number;
      orderCount: number;
      paidOrders: number;
      unpaidOrders: number;
      latestPaymentAt: string | null;
    }>();
    const branchRollup = new Map<string, {
      branchId: string;
      branchName: string;
      branchLocation: string;
      branchActive: boolean;
      tenantId: string;
      tenantName: string;
      grossSales: Decimal;
      refunds: Decimal;
      expenses: Decimal;
      tipRevenue: Decimal;
      paymentCount: number;
      refundCount: number;
      expenseCount: number;
      orderCount: number;
      paidOrders: number;
      unpaidOrders: number;
      latestPaymentAt: string | null;
    }>();

    const ensureTenant = (tenantId: string) => {
      const existing = tenantRollup.get(tenantId);
      if (existing) return existing;
      const tenant = tenantInfo.get(tenantId);
      const created = {
        tenantId,
        tenantName: tenant?.name ?? "Unknown tenant",
        tenantActive: tenant?.isActive ?? false,
        grossSales: new Decimal(0),
        refunds: new Decimal(0),
        expenses: new Decimal(0),
        tipRevenue: new Decimal(0),
        paymentCount: 0,
        refundCount: 0,
        expenseCount: 0,
        orderCount: 0,
        paidOrders: 0,
        unpaidOrders: 0,
        latestPaymentAt: null,
      };
      tenantRollup.set(tenantId, created);
      return created;
    };

    const ensureBranch = (branchId: string) => {
      const existing = branchRollup.get(branchId);
      if (existing) return existing;
      const branch = branchesById.get(branchId);
      const created = {
        branchId,
        branchName: branch?.name ?? "Unknown branch",
        branchLocation: branch?.location ?? "Unknown location",
        branchActive: branch?.isActive ?? false,
        tenantId: branch?.tenantId ?? "unknown",
        tenantName: branch?.tenant.name ?? "Unknown tenant",
        grossSales: new Decimal(0),
        refunds: new Decimal(0),
        expenses: new Decimal(0),
        tipRevenue: new Decimal(0),
        paymentCount: 0,
        refundCount: 0,
        expenseCount: 0,
        orderCount: 0,
        paidOrders: 0,
        unpaidOrders: 0,
        latestPaymentAt: null,
      };
      branchRollup.set(branchId, created);
      return created;
    };

    const ensureDay = (date: Date) => {
      const key = this.dayKey(date);
      const existing = dailyTrend.get(key);
      if (existing) return existing;
      const created = {
        date: key,
        grossSales: new Decimal(0),
        refunds: new Decimal(0),
        expenses: new Decimal(0),
        paymentCount: 0,
        orderCount: 0,
      };
      dailyTrend.set(key, created);
      return created;
    };

    for (const payment of payments) {
      totals.grossSales = totals.grossSales.add(payment.amount);
      totals.tipRevenue = totals.tipRevenue.add(payment.tipAmount ?? new Decimal(0));

      const byMethod = paymentMethods.get(payment.paymentMethod) ?? { total: new Decimal(0), count: 0 };
      byMethod.total = byMethod.total.add(payment.amount);
      byMethod.count += 1;
      paymentMethods.set(payment.paymentMethod, byMethod);

      const day = ensureDay(payment.paymentDate);
      day.grossSales = day.grossSales.add(payment.amount);
      day.paymentCount += 1;

      const tenant = ensureTenant(payment.tenantId);
      tenant.grossSales = tenant.grossSales.add(payment.amount);
      tenant.tipRevenue = tenant.tipRevenue.add(payment.tipAmount ?? new Decimal(0));
      tenant.paymentCount += 1;
      if (!tenant.latestPaymentAt || payment.paymentDate.toISOString() > tenant.latestPaymentAt) {
        tenant.latestPaymentAt = payment.paymentDate.toISOString();
      }

      const branch = ensureBranch(payment.branchId);
      branch.grossSales = branch.grossSales.add(payment.amount);
      branch.tipRevenue = branch.tipRevenue.add(payment.tipAmount ?? new Decimal(0));
      branch.paymentCount += 1;
      if (!branch.latestPaymentAt || payment.paymentDate.toISOString() > branch.latestPaymentAt) {
        branch.latestPaymentAt = payment.paymentDate.toISOString();
      }
    }

    for (const refund of refunds) {
      totals.totalRefunds = totals.totalRefunds.add(refund.amount);

      const day = ensureDay(refund.createdAt);
      day.refunds = day.refunds.add(refund.amount);

      const tenant = ensureTenant(refund.tenantId);
      tenant.refunds = tenant.refunds.add(refund.amount);
      tenant.refundCount += 1;

      const branch = ensureBranch(refund.branchId);
      branch.refunds = branch.refunds.add(refund.amount);
      branch.refundCount += 1;
    }

    for (const expense of expenses) {
      totals.totalExpenses = totals.totalExpenses.add(expense.amount);

      const category = expenseCategories.get(expense.category) ?? { total: new Decimal(0), count: 0 };
      category.total = category.total.add(expense.amount);
      category.count += 1;
      expenseCategories.set(expense.category, category);

      const day = ensureDay(expense.expenseDate);
      day.expenses = day.expenses.add(expense.amount);

      const tenant = ensureTenant(expense.tenantId);
      tenant.expenses = tenant.expenses.add(expense.amount);
      tenant.expenseCount += 1;

      const branch = ensureBranch(expense.branchId);
      branch.expenses = branch.expenses.add(expense.amount);
      branch.expenseCount += 1;
    }

    for (const order of orders) {
      totals.orderCount += 1;
      if (order.paymentStatus === OrderPaymentStatus.PAID) {
        totals.paidOrders += 1;
      } else if (order.paymentStatus === OrderPaymentStatus.UNPAID) {
        totals.unpaidOrders += 1;
      }

      const day = ensureDay(order.orderDateTime);
      day.orderCount += 1;

      const tenant = ensureTenant(order.tenantId);
      tenant.orderCount += 1;
      if (order.paymentStatus === OrderPaymentStatus.PAID) tenant.paidOrders += 1;
      if (order.paymentStatus === OrderPaymentStatus.UNPAID) tenant.unpaidOrders += 1;

      const branch = ensureBranch(order.branchId);
      branch.orderCount += 1;
      if (order.paymentStatus === OrderPaymentStatus.PAID) branch.paidOrders += 1;
      if (order.paymentStatus === OrderPaymentStatus.UNPAID) branch.unpaidOrders += 1;
    }

    const tenantBreakdown = [...tenantRollup.values()]
      .map((tenant) => {
        const netSales = tenant.grossSales.sub(tenant.refunds);
        const estimatedProfit = netSales.sub(tenant.expenses);
        const averageOrderValue = tenant.orderCount > 0
          ? netSales.div(tenant.orderCount).toDecimalPlaces(2)
          : new Decimal(0);
        const refundRate = tenant.grossSales.gt(0)
          ? tenant.refunds.div(tenant.grossSales).mul(100).toDecimalPlaces(1)
          : new Decimal(0);
        const branchCount = branchCountByTenant.get(tenant.tenantId) ?? { total: 0, active: 0 };

        return {
          tenantId: tenant.tenantId,
          tenantName: tenant.tenantName,
          tenantActive: tenant.tenantActive,
          grossSales: tenant.grossSales.toString(),
          refunds: tenant.refunds.toString(),
          netSales: netSales.toString(),
          expenses: tenant.expenses.toString(),
          estimatedProfit: estimatedProfit.toString(),
          tipRevenue: tenant.tipRevenue.toString(),
          paymentCount: tenant.paymentCount,
          refundCount: tenant.refundCount,
          expenseCount: tenant.expenseCount,
          orderCount: tenant.orderCount,
          paidOrders: tenant.paidOrders,
          unpaidOrders: tenant.unpaidOrders,
          averageOrderValue: averageOrderValue.toString(),
          refundRatePercent: refundRate.toString(),
          branchCount: branchCount.total,
          activeBranchCount: branchCount.active,
          latestPaymentAt: tenant.latestPaymentAt,
        };
      })
      .sort((left, right) => Number(right.netSales) - Number(left.netSales));

    const branchBreakdown = [...branchRollup.values()]
      .map((branch) => {
        const netSales = branch.grossSales.sub(branch.refunds);
        const estimatedProfit = netSales.sub(branch.expenses);
        const averageOrderValue = branch.orderCount > 0
          ? netSales.div(branch.orderCount).toDecimalPlaces(2)
          : new Decimal(0);
        const refundRate = branch.grossSales.gt(0)
          ? branch.refunds.div(branch.grossSales).mul(100).toDecimalPlaces(1)
          : new Decimal(0);

        return {
          branchId: branch.branchId,
          branchName: branch.branchName,
          branchLocation: branch.branchLocation,
          branchActive: branch.branchActive,
          tenantId: branch.tenantId,
          tenantName: branch.tenantName,
          grossSales: branch.grossSales.toString(),
          refunds: branch.refunds.toString(),
          netSales: netSales.toString(),
          expenses: branch.expenses.toString(),
          estimatedProfit: estimatedProfit.toString(),
          tipRevenue: branch.tipRevenue.toString(),
          paymentCount: branch.paymentCount,
          refundCount: branch.refundCount,
          expenseCount: branch.expenseCount,
          orderCount: branch.orderCount,
          paidOrders: branch.paidOrders,
          unpaidOrders: branch.unpaidOrders,
          averageOrderValue: averageOrderValue.toString(),
          refundRatePercent: refundRate.toString(),
          latestPaymentAt: branch.latestPaymentAt,
        };
      })
      .sort((left, right) => Number(right.netSales) - Number(left.netSales));

    const grossSales = totals.grossSales;
    const totalRefunds = totals.totalRefunds;
    const totalExpenses = totals.totalExpenses;
    const netSales = grossSales.sub(totalRefunds);
    const estimatedProfit = netSales.sub(totalExpenses);
    const averageOrderValue = totals.orderCount > 0
      ? netSales.div(totals.orderCount).toDecimalPlaces(2)
      : new Decimal(0);
    const refundRate = grossSales.gt(0)
      ? totalRefunds.div(grossSales).mul(100).toDecimalPlaces(1)
      : new Decimal(0);

    const alerts = [
      ...tenantBreakdown
        .filter((tenant) => Number(tenant.estimatedProfit) < 0)
        .slice(0, 3)
        .map((tenant) => ({
          scope: "tenant",
          id: tenant.tenantId,
          label: tenant.tenantName,
          severity: "warn",
          message: `Profit is negative for the selected window at ${this.money(tenant.estimatedProfit)}.`,
        })),
      ...branchBreakdown
        .filter((branch) => Number(branch.refundRatePercent) >= 8)
        .slice(0, 3)
        .map((branch) => ({
          scope: "branch",
          id: branch.branchId,
          label: `${branch.tenantName} - ${branch.branchName}`,
          severity: "bad",
          message: `Refund rate is ${branch.refundRatePercent}% for the selected window.`,
        })),
    ].slice(0, 6);

    return {
      period: { from: start.toISOString(), to: end.toISOString() },
      totals: {
        tenantCount: tenants.length,
        branchCount: branches.length,
        grossSales: grossSales.toString(),
        totalRefunds: totalRefunds.toString(),
        netSales: netSales.toString(),
        totalExpenses: totalExpenses.toString(),
        estimatedProfit: estimatedProfit.toString(),
        tipRevenue: totals.tipRevenue.toString(),
        paymentCount: totals.paymentCount,
        refundCount: totals.refundCount,
        expenseCount: totals.expenseCount,
        orderCount: totals.orderCount,
        paidOrders: totals.paidOrders,
        unpaidOrders: totals.unpaidOrders,
        averageOrderValue: averageOrderValue.toString(),
        refundRatePercent: refundRate.toString(),
      },
      dailyTrend: [...dailyTrend.values()]
        .map((day) => {
          const net = day.grossSales.sub(day.refunds);
          return {
            date: day.date,
            grossSales: day.grossSales.toString(),
            refunds: day.refunds.toString(),
            netSales: net.toString(),
            expenses: day.expenses.toString(),
            estimatedProfit: net.sub(day.expenses).toString(),
            paymentCount: day.paymentCount,
            orderCount: day.orderCount,
          };
        })
        .sort((left, right) => left.date.localeCompare(right.date)),
      byPaymentMethod: [...paymentMethods.entries()]
        .map(([method, entry]) => ({
          method,
          total: entry.total.toString(),
          count: entry.count,
        }))
        .sort((left, right) => Number(right.total) - Number(left.total)),
      expenseCategories: [...expenseCategories.entries()]
        .map(([category, entry]) => ({
          category,
          total: entry.total.toString(),
          count: entry.count,
        }))
        .sort((left, right) => Number(right.total) - Number(left.total)),
      tenantBreakdown,
      branchBreakdown,
      recentRefunds: refunds
        .map((refund) => {
          const branch = branchesById.get(refund.branchId);
          return {
            refundId: refund.id,
            tenantId: refund.tenantId,
            tenantName: tenantInfo.get(refund.tenantId)?.name ?? "Unknown tenant",
            branchId: refund.branchId,
            branchName: branch?.name ?? "Unknown branch",
            amount: refund.amount.toString(),
            reason: refund.reason,
            createdAt: refund.createdAt.toISOString(),
          };
        })
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 8),
      alerts,
    };
  }

  async getBillingOverview() {
    const [subscriptions, invoices, tenants] = await Promise.all([
      this.prisma.tenantSubscription.findMany(),
      this.prisma.saasInvoice.findMany(),
      this.prisma.tenant.count(),
    ]);

    const mrr = subscriptions
      .filter((subscription) => subscription.status === "ACTIVE" || subscription.status === "TRIALING")
      .reduce((sum, subscription) => sum + Number(subscription.amount), 0);
    const openInvoiceAmount = invoices
      .filter((invoice) => invoice.status === "OPEN" || invoice.status === "OVERDUE")
      .reduce((sum, invoice) => sum + Number(invoice.amount), 0);

    return {
      totals: {
        tenantCount: tenants,
        subscriptionCount: subscriptions.length,
        activeSubscriptions: subscriptions.filter((subscription) => subscription.status === "ACTIVE").length,
        trialingSubscriptions: subscriptions.filter((subscription) => subscription.status === "TRIALING").length,
        overdueSubscriptions: subscriptions.filter((subscription) => subscription.status === "PAST_DUE").length,
        invoiceCount: invoices.length,
        openInvoices: invoices.filter((invoice) => invoice.status === "OPEN").length,
        overdueInvoices: invoices.filter((invoice) => invoice.status === "OVERDUE").length,
        mrr: mrr.toFixed(2),
        openInvoiceAmount: openInvoiceAmount.toFixed(2),
      },
    };
  }

  async getBillingTenants() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: { name: "asc" },
      include: {
        subscription: true,
        _count: { select: { branches: true } },
      },
    });

    return tenants.map((tenant) => ({
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantActive: tenant.isActive,
      branchCount: tenant._count.branches,
      subscription: tenant.subscription
        ? {
            id: tenant.subscription.id,
            planCode: tenant.subscription.planCode,
            status: tenant.subscription.status,
            trialEndsAt: tenant.subscription.trialEndsAt?.toISOString() ?? null,
            billingPeriodStart: tenant.subscription.billingPeriodStart?.toISOString() ?? null,
            billingPeriodEnd: tenant.subscription.billingPeriodEnd?.toISOString() ?? null,
            nextInvoiceAt: tenant.subscription.nextInvoiceAt?.toISOString() ?? null,
            amount: tenant.subscription.amount.toFixed(2),
            currency: tenant.subscription.currency,
            updatedAt: tenant.subscription.updatedAt.toISOString(),
          }
        : null,
    }));
  }

  async getBillingInvoices() {
    const invoices = await this.prisma.saasInvoice.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: {
        tenant: { select: { name: true } },
        subscription: { select: { planCode: true, status: true } },
      },
    });

    return invoices.map((invoice) => ({
      id: invoice.id,
      tenantId: invoice.tenantId,
      tenantName: invoice.tenant.name,
      subscriptionId: invoice.subscriptionId,
      planCode: invoice.subscription?.planCode ?? null,
      subscriptionStatus: invoice.subscription?.status ?? null,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      amount: invoice.amount.toFixed(2),
      currency: invoice.currency,
      dueAt: invoice.dueAt?.toISOString() ?? null,
      paidAt: invoice.paidAt?.toISOString() ?? null,
      createdAt: invoice.createdAt.toISOString(),
    }));
  }

  async updateTenantSubscription(tenantId: string, dto: UpdateTenantSubscriptionDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { branches: { orderBy: { name: "asc" }, take: 1, select: { id: true } } },
    });
    if (!tenant) throw new NotFoundException("Tenant not found");

    const subscription = await this.prisma.tenantSubscription.upsert({
      where: { tenantId },
      update: {
        planCode: dto.planCode.trim(),
        status: dto.status,
        trialEndsAt: this.parseOptionalDate(dto.trialEndsAt),
        billingPeriodStart: this.parseOptionalDate(dto.billingPeriodStart),
        billingPeriodEnd: this.parseOptionalDate(dto.billingPeriodEnd),
        nextInvoiceAt: this.parseOptionalDate(dto.nextInvoiceAt),
        amount: new Decimal(dto.amount),
        currency: dto.currency.trim().toUpperCase(),
      },
      create: {
        tenantId,
        planCode: dto.planCode.trim(),
        status: dto.status,
        trialEndsAt: this.parseOptionalDate(dto.trialEndsAt),
        billingPeriodStart: this.parseOptionalDate(dto.billingPeriodStart),
        billingPeriodEnd: this.parseOptionalDate(dto.billingPeriodEnd),
        nextInvoiceAt: this.parseOptionalDate(dto.nextInvoiceAt),
        amount: new Decimal(dto.amount),
        currency: dto.currency.trim().toUpperCase(),
      },
    });

    if (tenant.branches[0]) {
      await this.prisma.paymentEventLog.create({
        data: {
          tenantId,
          branchId: tenant.branches[0].id,
          eventType: "SAAS_SUBSCRIPTION_UPDATED",
          provider: "saas-billing",
          amount: subscription.amount,
          status: subscription.status,
          metadata: {
            planCode: subscription.planCode,
            currency: subscription.currency,
            nextInvoiceAt: subscription.nextInvoiceAt?.toISOString() ?? null,
          },
        },
      });
    }

    return {
      id: subscription.id,
      tenantId: subscription.tenantId,
      planCode: subscription.planCode,
      status: subscription.status,
      trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
      billingPeriodStart: subscription.billingPeriodStart?.toISOString() ?? null,
      billingPeriodEnd: subscription.billingPeriodEnd?.toISOString() ?? null,
      nextInvoiceAt: subscription.nextInvoiceAt?.toISOString() ?? null,
      amount: subscription.amount.toFixed(2),
      currency: subscription.currency,
      updatedAt: subscription.updatedAt.toISOString(),
    };
  }

  async getOperationsOverview(hours = 24) {
    const rows = await this.loadOperationsRows(hours);
    const issueBranches = rows
      .filter((row) => row.status.code !== "healthy")
      .slice(0, 8)
      .map((row) => ({
        branchId: row.branchId,
        branchName: row.branchName,
        tenantId: row.tenantId,
        tenantName: row.tenantName,
        status: row.status,
        activeOrders: row.activeOrders,
        openRequests: row.openRequests,
        lowStockAlerts: row.lowStockAlerts,
        latestEventAt: row.latestEventAt,
      }));

    return {
      generatedAt: new Date().toISOString(),
      windowHours: this.normalizeHours(hours),
      totals: {
        totalBranches: rows.length,
        activeBranches: rows.filter((row) => row.branchActive).length,
        activeOrders: rows.reduce((sum, row) => sum + row.activeOrders, 0),
        delayedOrders: rows.reduce((sum, row) => sum + row.delayedOrders, 0),
        activeSessions: rows.reduce((sum, row) => sum + row.activeSessions, 0),
        openRequests: rows.reduce((sum, row) => sum + row.openRequests, 0),
        lowStockAlerts: rows.reduce((sum, row) => sum + row.lowStockAlerts, 0),
        openShifts: rows.reduce((sum, row) => sum + row.openShifts, 0),
        occupiedTables: rows.reduce((sum, row) => sum + row.tableStatuses.OCCUPIED, 0),
        readyOrders: rows.reduce((sum, row) => sum + row.readyOrders, 0),
      },
      issueBranches,
    };
  }

  async listOperationsBranches(hours = 24) {
    return this.loadOperationsRows(hours);
  }

  async getOperationsBranchDetail(branchId: string, hours = 24) {
    const normalizedHours = this.normalizeHours(hours);
    const windowStart = this.hoursAgo(normalizedHours);
    const delayedCutoff = new Date(Date.now() - 20 * 60 * 1000);

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        name: true,
        location: true,
        isActive: true,
        tenantId: true,
        tenant: { select: { id: true, name: true, isActive: true } },
        _count: { select: { tables: true, staff: true, orders: true } },
      },
    });
    if (!branch) throw new NotFoundException("Branch not found");

    const [
      activeSessions,
      activeOrders,
      delayedOrders,
      readyOrders,
      openRequests,
      lowStockAlerts,
      openShifts,
      tableGroup,
      orderGroup,
      requestTypeGroup,
      recentEvents,
    ] = await Promise.all([
      this.prisma.session.count({
        where: { tenantId: branch.tenantId, branchId, status: SessionStatus.ACTIVE },
      }),
      this.prisma.order.count({
        where: { tenantId: branch.tenantId, branchId, orderStatus: { in: this.activeOrderStatuses() } },
      }),
      this.prisma.order.count({
        where: {
          tenantId: branch.tenantId,
          branchId,
          orderStatus: { in: [OrderStatus.PLACED, OrderStatus.CONFIRMED, OrderStatus.IN_KITCHEN] },
          orderDateTime: { lt: delayedCutoff },
        },
      }),
      this.prisma.order.count({
        where: { tenantId: branch.tenantId, branchId, orderStatus: OrderStatus.READY },
      }),
      this.prisma.serviceRequest.count({
        where: { tenantId: branch.tenantId, branchId, status: { in: [ServiceRequestStatus.NEW, ServiceRequestStatus.CLAIMED] } },
      }),
      this.prisma.lowStockAlert.count({
        where: { tenantId: branch.tenantId, branchId, status: LowStockAlertStatus.OPEN },
      }),
      this.prisma.shift.count({
        where: { tenantId: branch.tenantId, branchId, status: ShiftStatus.OPEN },
      }),
      this.prisma.table.groupBy({
        by: ["status"],
        where: { branchId },
        _count: { _all: true },
      }),
      this.prisma.order.groupBy({
        by: ["orderStatus"],
        where: { tenantId: branch.tenantId, branchId, orderStatus: { in: this.activeOrderStatuses() } },
        _count: { _all: true },
      }),
      this.prisma.serviceRequest.groupBy({
        by: ["type"],
        where: { tenantId: branch.tenantId, branchId, status: { in: [ServiceRequestStatus.NEW, ServiceRequestStatus.CLAIMED] } },
        _count: { _all: true },
      }),
      this.prisma.operationalEventLog.findMany({
        where: { tenantId: branch.tenantId, branchId, createdAt: { gte: windowStart } },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          eventType: true,
          severity: true,
          message: true,
          createdAt: true,
          sessionId: true,
          tableId: true,
          orderId: true,
        },
      }),
    ]);

    const tableStatuses = this.normalizeTableStatuses(tableGroup);
    const orderStatuses = Object.fromEntries(orderGroup.map((row) => [row.orderStatus, row._count._all]));
    const requestTypes = Object.fromEntries(requestTypeGroup.map((row) => [row.type, row._count._all]));
    const status = this.deriveOperationsStatus({
      branchActive: branch.isActive,
      activeOrders,
      delayedOrders,
      openRequests,
      lowStockAlerts,
      activeSessions,
      openShifts,
      readyOrders,
    });

    const recommendations = this.buildOperationsRecommendations({
      branchActive: branch.isActive,
      delayedOrders,
      openRequests,
      lowStockAlerts,
      openShifts,
      activeSessions,
      readyOrders,
      occupiedTables: tableStatuses.OCCUPIED,
      totalTables: branch._count.tables,
    });

    return {
      branchId: branch.id,
      branchName: branch.name,
      branchLocation: branch.location,
      branchActive: branch.isActive,
      tenantId: branch.tenant.id,
      tenantName: branch.tenant.name,
      tenantActive: branch.tenant.isActive,
      windowHours: normalizedHours,
      generatedAt: new Date().toISOString(),
      status,
      capacity: {
        tables: branch._count.tables,
        staff: branch._count.staff,
      },
      live: {
        activeOrders,
        delayedOrders,
        readyOrders,
        activeSessions,
        openRequests,
        lowStockAlerts,
        openShifts,
      },
      tableStatuses,
      orderStatuses,
      requestTypes,
      recommendations,
      recentEvents: recentEvents.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }

  async getSessionsOverview(hours = 24) {
    const rows = await this.loadSessionRows(hours);
    return {
      generatedAt: new Date().toISOString(),
      windowHours: this.normalizeHours(hours),
      totals: {
        visibleSessions: rows.length,
        activeSessions: rows.filter((row) => row.status === SessionStatus.ACTIVE).length,
        completedSessions: rows.filter((row) => row.status === SessionStatus.COMPLETED).length,
        cancelledSessions: rows.filter((row) => row.status === SessionStatus.CANCELLED).length,
        totalGuests: rows.reduce((sum, row) => sum + row.guestCount, 0),
        totalOrders: rows.reduce((sum, row) => sum + row.orderCount, 0),
        totalOpenRequests: rows.reduce((sum, row) => sum + row.openRequestCount, 0),
        fullyPaidSessions: rows.filter((row) => row.outstandingBalance <= 0).length,
        attentionSessions: rows.filter((row) => row.attentionState !== "healthy").length,
      },
      attentionSessions: rows
        .filter((row) => row.attentionState !== "healthy")
        .slice(0, 8)
        .map((row) => ({
          sessionId: row.sessionId,
          tenantId: row.tenantId,
          tenantName: row.tenantName,
          branchId: row.branchId,
          branchName: row.branchName,
          tableCode: row.tableCode,
          status: row.status,
          attentionState: row.attentionState,
          orderCount: row.orderCount,
          openRequestCount: row.openRequestCount,
          outstandingBalance: row.outstandingBalance.toFixed(2),
          startedAt: row.startedAt,
        })),
    };
  }

  async listSessions(hours = 24) {
    return this.loadSessionRows(hours).then((rows) =>
      rows.map((row) => ({
        ...row,
        totalAmount: row.totalAmount.toFixed(2),
        paidAmount: row.paidAmount.toFixed(2),
        outstandingBalance: row.outstandingBalance.toFixed(2),
      })),
    );
  }

  async getSessionDetail(sessionId: string) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        tenantId: true,
        branchId: true,
        status: true,
        guestCount: true,
        notes: true,
        startTime: true,
        endTime: true,
        branch: { select: { id: true, name: true, location: true, isActive: true } },
        tenant: { select: { id: true, name: true, isActive: true } },
        table: { select: { id: true, tableCode: true, capacity: true, status: true, zone: true } },
        user: { select: { id: true, name: true, phone: true } },
        createdByStaff: { select: { id: true, name: true, primaryRole: true } },
        participants: { select: { id: true, displayName: true, userId: true } },
        orders: {
          select: {
            id: true,
            orderStatus: true,
            paymentStatus: true,
            totalAmount: true,
            orderDateTime: true,
            assignedWaiter: { select: { id: true, name: true } },
          },
          orderBy: { orderDateTime: "desc" },
        },
        serviceRequests: {
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
            completedAt: true,
            claimedByStaff: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentStatus: true,
            paymentMethod: true,
            paymentDate: true,
            tipAmount: true,
          },
          orderBy: { paymentDate: "desc" },
        },
      },
    });
    if (!session) throw new NotFoundException("Session not found");

    const totalAmount = session.orders.reduce((sum, order) => sum.add(order.totalAmount), new Decimal(0));
    const paidAmount = session.payments
      .filter((payment) => payment.paymentStatus === PaymentStatus.COMPLETED)
      .reduce((sum, payment) => sum.add(payment.amount), new Decimal(0));
    const outstandingBalance = Decimal.max(totalAmount.sub(paidAmount), new Decimal(0));
    const openRequestCount = session.serviceRequests.filter((request) => request.status === ServiceRequestStatus.NEW || request.status === ServiceRequestStatus.CLAIMED).length;
    const durationMinutes = this.sessionDurationMinutes(session.startTime, session.endTime, session.status);

    return {
      sessionId: session.id,
      tenantId: session.tenant.id,
      tenantName: session.tenant.name,
      tenantActive: session.tenant.isActive,
      branchId: session.branch.id,
      branchName: session.branch.name,
      branchLocation: session.branch.location,
      branchActive: session.branch.isActive,
      table: session.table,
      status: session.status,
      guestCount: session.guestCount,
      notes: session.notes,
      startedAt: session.startTime.toISOString(),
      endedAt: session.endTime?.toISOString() ?? null,
      durationMinutes,
      user: session.user,
      createdByStaff: session.createdByStaff,
      participants: session.participants,
      totals: {
        orderCount: session.orders.length,
        openRequestCount,
        totalAmount: totalAmount.toFixed(2),
        paidAmount: paidAmount.toFixed(2),
        outstandingBalance: outstandingBalance.toFixed(2),
      },
      attentionState: this.deriveSessionAttentionState({
        status: session.status,
        orderCount: session.orders.length,
        openRequestCount,
        outstandingBalance,
        durationMinutes,
      }),
      orders: session.orders.map((order) => ({
        ...order,
        totalAmount: order.totalAmount.toFixed(2),
        orderDateTime: order.orderDateTime.toISOString(),
      })),
      serviceRequests: session.serviceRequests.map((request) => ({
        ...request,
        createdAt: request.createdAt.toISOString(),
        completedAt: request.completedAt?.toISOString() ?? null,
      })),
      payments: session.payments.map((payment) => ({
        ...payment,
        amount: payment.amount.toFixed(2),
        tipAmount: payment.tipAmount?.toFixed(2) ?? null,
        paymentDate: payment.paymentDate.toISOString(),
      })),
    };
  }

  async getStaffOverview(hours = 168) {
    const rows = await this.loadStaffRows(hours);
    const activeRows = rows.filter((row) => row.isActive);
    const roleTotals = rows.reduce(
      (acc, row) => {
        acc[row.primaryRole] += 1;
        return acc;
      },
      {
        OWNER: 0,
        MANAGER: 0,
        WAITER: 0,
        CASHIER: 0,
        CHEF: 0,
        KITCHEN_LEAD: 0,
      },
    );

    return {
      generatedAt: new Date().toISOString(),
      windowHours: this.normalizeStaffHours(hours),
      totals: {
        totalStaff: rows.length,
        activeStaff: activeRows.length,
        inactiveStaff: rows.length - activeRows.length,
        owners: roleTotals.OWNER,
        managers: roleTotals.MANAGER,
        waiters: roleTotals.WAITER,
        cashiers: roleTotals.CASHIER,
        kitchen: roleTotals.CHEF + roleTotals.KITCHEN_LEAD,
        openShifts: rows.filter((row) => row.openShift).length,
        checkedInNow: rows.filter((row) => row.checkedInNow).length,
        recentlyActive: rows.filter((row) => row.activity.code === "active").length,
        branchesCovered: new Set(rows.map((row) => row.branchId)).size,
        tenantsCovered: new Set(rows.map((row) => row.tenantId)).size,
      },
      attentionMembers: rows
        .filter((row) => row.activity.code === "watch" || row.activity.code === "inactive")
        .slice(0, 8)
        .map((row) => ({
          staffId: row.staffId,
          name: row.name,
          tenantId: row.tenantId,
          tenantName: row.tenantName,
          branchId: row.branchId,
          branchName: row.branchName,
          primaryRole: row.primaryRole,
          isActive: row.isActive,
          openShift: row.openShift,
          checkedInNow: row.checkedInNow,
          latestActivityAt: row.latestActivityAt,
          activity: row.activity,
        })),
    };
  }

  async listStaffMembers(hours = 168) {
    return this.loadStaffRows(hours).then((rows) =>
      rows.map((row) => ({
        ...row,
        assignedSales: row.assignedSales.toFixed(2),
      })),
    );
  }

  async getStaffMemberDetail(staffId: string, hours = 168) {
    const normalizedHours = this.normalizeStaffHours(hours);
    const windowStart = this.hoursAgo(normalizedHours);
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        tenantId: true,
        branchId: true,
        name: true,
        phone: true,
        email: true,
        primaryRole: true,
        isActive: true,
        createdAt: true,
        tenant: { select: { id: true, name: true, isActive: true } },
        branch: { select: { id: true, name: true, location: true, isActive: true } },
        roleAssignments: {
          select: {
            role: {
              select: {
                roleName: true,
                permissions: { select: { permission: { select: { code: true } } } },
              },
            },
          },
        },
        shiftAssignments: {
          where: { startTime: { gte: windowStart } },
          orderBy: { startTime: "desc" },
          take: 8,
          select: {
            id: true,
            startTime: true,
            endTime: true,
            status: true,
          },
        },
        attendanceRecords: {
          where: { checkIn: { gte: windowStart } },
          orderBy: { checkIn: "desc" },
          take: 8,
          select: {
            id: true,
            checkIn: true,
            checkOut: true,
            shiftId: true,
          },
        },
        claimedServiceRequests: {
          where: { createdAt: { gte: windowStart } },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
            completedAt: true,
            sessionId: true,
            table: { select: { tableCode: true } },
          },
        },
        createdSessions: {
          where: { startTime: { gte: windowStart } },
          orderBy: { startTime: "desc" },
          take: 8,
          select: {
            id: true,
            status: true,
            guestCount: true,
            startTime: true,
            endTime: true,
            table: { select: { tableCode: true } },
          },
        },
        assignedOrders: {
          where: { orderDateTime: { gte: windowStart } },
          orderBy: { orderDateTime: "desc" },
          take: 8,
          select: {
            id: true,
            orderStatus: true,
            paymentStatus: true,
            totalAmount: true,
            orderDateTime: true,
            sessionId: true,
          },
        },
        operationalEventLogs: {
          where: { createdAt: { gte: windowStart } },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            eventType: true,
            severity: true,
            message: true,
            createdAt: true,
            branchId: true,
            orderId: true,
            sessionId: true,
          },
        },
        _count: {
          select: {
            shiftAssignments: true,
            attendanceRecords: true,
            claimedServiceRequests: true,
            createdSessions: true,
            assignedOrders: true,
          },
        },
      },
    });
    if (!staff) throw new NotFoundException("Staff member not found");

    const permissionCodes = new Set<string>();
    const roleNames = new Set<string>();
    for (const assignment of staff.roleAssignments) {
      roleNames.add(assignment.role.roleName);
      for (const permission of assignment.role.permissions) {
        permissionCodes.add(permission.permission.code);
      }
    }

    const assignedSales = staff.assignedOrders.reduce(
      (sum, order) => sum.add(order.totalAmount),
      new Decimal(0),
    );
    const latestActivityAt = this.latestStaffActivity([
      ...staff.shiftAssignments.map((shift) => shift.startTime),
      ...staff.attendanceRecords.flatMap((attendance) =>
        attendance.checkOut ? [attendance.checkIn, attendance.checkOut] : [attendance.checkIn],
      ),
      ...staff.claimedServiceRequests.flatMap((request) =>
        request.completedAt ? [request.createdAt, request.completedAt] : [request.createdAt],
      ),
      ...staff.createdSessions.map((session) => session.startTime),
      ...staff.assignedOrders.map((order) => order.orderDateTime),
      ...staff.operationalEventLogs.map((event) => event.createdAt),
    ]);
    const openShift = staff.shiftAssignments.some((shift) => shift.status === ShiftStatus.OPEN);
    const checkedInNow = staff.attendanceRecords.some((attendance) => !attendance.checkOut);
    const activity = this.deriveStaffActivity({
      isActive: staff.isActive,
      primaryRole: staff.primaryRole,
      openShift,
      checkedInNow,
      latestActivityAt,
      recentRequestCount: staff.claimedServiceRequests.length,
      recentSessionCount: staff.createdSessions.length,
      recentOrderCount: staff.assignedOrders.length,
    });

    return {
      staffId: staff.id,
      tenantId: staff.tenant.id,
      tenantName: staff.tenant.name,
      tenantActive: staff.tenant.isActive,
      branchId: staff.branch.id,
      branchName: staff.branch.name,
      branchLocation: staff.branch.location,
      branchActive: staff.branch.isActive,
      name: staff.name,
      email: staff.email,
      phone: staff.phone,
      primaryRole: staff.primaryRole,
      isActive: staff.isActive,
      createdAt: staff.createdAt.toISOString(),
      roles: [...roleNames],
      permissions: [...permissionCodes].sort(),
      permissionCount: permissionCodes.size,
      windowHours: normalizedHours,
      openShift,
      checkedInNow,
      latestActivityAt,
      activity,
      totals: {
        lifetimeShifts: staff._count.shiftAssignments,
        lifetimeAttendanceRecords: staff._count.attendanceRecords,
        lifetimeRequestsHandled: staff._count.claimedServiceRequests,
        lifetimeSessionsStarted: staff._count.createdSessions,
        lifetimeAssignedOrders: staff._count.assignedOrders,
        recentAssignedSales: assignedSales.toFixed(2),
      },
      recommendations: this.buildStaffRecommendations({
        isActive: staff.isActive,
        primaryRole: staff.primaryRole,
        openShift,
        checkedInNow,
        recentRequestCount: staff.claimedServiceRequests.length,
        recentSessionCount: staff.createdSessions.length,
        recentOrderCount: staff.assignedOrders.length,
        latestActivityAt,
      }),
      recentShifts: staff.shiftAssignments.map((shift) => ({
        ...shift,
        startTime: shift.startTime.toISOString(),
        endTime: shift.endTime?.toISOString() ?? null,
      })),
      recentAttendance: staff.attendanceRecords.map((attendance) => ({
        ...attendance,
        checkIn: attendance.checkIn.toISOString(),
        checkOut: attendance.checkOut?.toISOString() ?? null,
      })),
      recentRequests: staff.claimedServiceRequests.map((request) => ({
        ...request,
        createdAt: request.createdAt.toISOString(),
        completedAt: request.completedAt?.toISOString() ?? null,
      })),
      recentSessions: staff.createdSessions.map((session) => ({
        ...session,
        startTime: session.startTime.toISOString(),
        endTime: session.endTime?.toISOString() ?? null,
      })),
      recentOrders: staff.assignedOrders.map((order) => ({
        ...order,
        totalAmount: order.totalAmount.toFixed(2),
        orderDateTime: order.orderDateTime.toISOString(),
      })),
      recentEvents: staff.operationalEventLogs.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }

  async updateStaffMemberStatus(staffId: string, dto: UpdateSaasStaffStatusDto) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        tenantId: true,
        branchId: true,
        name: true,
        email: true,
        isActive: true,
        primaryRole: true,
      },
    });
    if (!staff) throw new NotFoundException("Staff member not found");
    if (staff.isActive === dto.isActive) {
      return {
        staffId: staff.id,
        isActive: staff.isActive,
        updatedAt: new Date().toISOString(),
      };
    }

    const updated = await this.prisma.staff.update({
      where: { id: staffId },
      data: { isActive: dto.isActive },
      select: {
        id: true,
        isActive: true,
      },
    });

    await this.prisma.operationalEventLog.create({
      data: {
        tenantId: staff.tenantId,
        branchId: staff.branchId,
        actorStaffId: staff.id,
        eventType: dto.isActive ? "SAAS_STAFF_ACTIVATED" : "SAAS_STAFF_DEACTIVATED",
        severity: dto.isActive ? "INFO" : "WARN",
        message: `SaaS owner ${dto.isActive ? "activated" : "deactivated"} ${staff.email}`,
        metadata: {
          staffId: staff.id,
          primaryRole: staff.primaryRole,
          isActive: dto.isActive,
        },
      },
    });

    return {
      staffId: updated.id,
      isActive: updated.isActive,
      updatedAt: new Date().toISOString(),
    };
  }

  async getSystemHealthOverview(hours = 24) {
    const normalizedHours = this.normalizeSystemHealthHours(hours);
    const [services, incidents] = await Promise.all([
      this.loadSystemHealthServices(normalizedHours),
      this.loadSystemHealthIncidents(normalizedHours),
    ]);

    const branchIssueMap = new Map<
      string,
      { tenantId: string; tenantName: string; branchId: string; branchName: string; count: number }
    >();
    for (const incident of incidents) {
      if (!incident.branchId) continue;
      const existing = branchIssueMap.get(incident.branchId) ?? {
        tenantId: incident.tenantId ?? "unknown",
        tenantName: incident.tenantName ?? "Unknown tenant",
        branchId: incident.branchId,
        branchName: incident.branchName ?? "Unknown branch",
        count: 0,
      };
      existing.count += 1;
      branchIssueMap.set(incident.branchId, existing);
    }

    return {
      generatedAt: new Date().toISOString(),
      windowHours: normalizedHours,
      totals: {
        totalServices: services.length,
        healthyServices: services.filter((service) => service.status.code === "healthy").length,
        degradedServices: services.filter((service) => service.status.code === "degraded").length,
        unavailableServices: services.filter((service) => service.status.code === "unavailable").length,
        incidentCount: incidents.length,
        errorIncidents: incidents.filter((incident) => incident.severity === "ERROR").length,
        warningIncidents: incidents.filter((incident) => incident.severity === "WARN").length,
        affectedBranches: new Set(incidents.map((incident) => incident.branchId).filter(Boolean)).size,
        affectedTenants: new Set(incidents.map((incident) => incident.tenantId).filter(Boolean)).size,
      },
      services: services.map((service) => ({
        id: service.id,
        name: service.name,
        status: service.status,
        mode: service.mode,
        incidentCount: service.metrics.incidentCount,
      })),
      issueBranches: [...branchIssueMap.values()]
        .sort((left, right) => right.count - left.count)
        .slice(0, 8),
    };
  }

  async listSystemHealthServices(hours = 24) {
    return this.loadSystemHealthServices(this.normalizeSystemHealthHours(hours));
  }

  async listSystemHealthIncidents(hours = 24) {
    return this.loadSystemHealthIncidents(this.normalizeSystemHealthHours(hours));
  }

  async getAuditLogsOverview(from?: string, to?: string) {
    const { start, end } = this.parseAuditLogRange(from, to);
    const feed = await this.loadAuditLogFeed(start, end);
    const branchCounts = new Map<
      string,
      { tenantId: string; tenantName: string; branchId: string; branchName: string; count: number }
    >();
    const actorCounts = new Map<
      string,
      { actorId: string; actorName: string; actorRole: string | null; count: number }
    >();

    for (const row of feed) {
      const branch = branchCounts.get(row.branchId) ?? {
        tenantId: row.tenantId,
        tenantName: row.tenantName,
        branchId: row.branchId,
        branchName: row.branchName,
        count: 0,
      };
      branch.count += 1;
      branchCounts.set(row.branchId, branch);

      if (row.actor?.id) {
        const actor = actorCounts.get(row.actor.id) ?? {
          actorId: row.actor.id,
          actorName: row.actor.name,
          actorRole: row.actor.role,
          count: 0,
        };
        actor.count += 1;
        actorCounts.set(row.actor.id, actor);
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      range: {
        from: start.toISOString(),
        to: end.toISOString(),
      },
      totals: {
        totalEvents: feed.length,
        auditEvents: feed.filter((row) => row.stream === "audit").length,
        operationalEvents: feed.filter((row) => row.stream === "operational").length,
        paymentEvents: feed.filter((row) => row.stream === "payments").length,
        warningEvents: feed.filter((row) => row.severity === "WARN").length,
        errorEvents: feed.filter((row) => row.severity === "ERROR").length,
        uniqueTenants: new Set(feed.map((row) => row.tenantId)).size,
        uniqueBranches: new Set(feed.map((row) => row.branchId)).size,
        uniqueActors: new Set(feed.map((row) => row.actor?.id).filter(Boolean)).size,
      },
      issueBranches: [...branchCounts.values()]
        .sort((left, right) => right.count - left.count)
        .slice(0, 8),
      topActors: [...actorCounts.values()]
        .sort((left, right) => right.count - left.count)
        .slice(0, 8),
    };
  }

  async getAuditLogsFeed(from?: string, to?: string) {
    const { start, end } = this.parseAuditLogRange(from, to);
    return this.loadAuditLogFeed(start, end);
  }

  async getAiOverview() {
    const branches = await this.loadAiBranchesBase();
    const statsByBranch = await this.loadAiLogStatsMap();

    const rows = branches.map((branch) => this.toAiBranchRow(branch, statsByBranch.get(branch.id)));
    const issueBranches = rows
      .filter((branch) => branch.status.code !== "healthy")
      .slice(0, 6)
      .map((branch) => ({
        branchId: branch.branchId,
        branchName: branch.branchName,
        tenantId: branch.tenantId,
        tenantName: branch.tenantName,
        status: branch.status,
        requests24h: branch.requests24h,
        lastActivityAt: branch.lastActivityAt,
      }));

    return {
      totals: {
        totalBranches: rows.length,
        activeBranches: rows.filter((row) => row.isActive).length,
        menuChatEnabledBranches: rows.filter((row) => row.controls.menuChatEnabled).length,
        hostedLlmEnabledBranches: rows.filter((row) => row.controls.hostedLlmEnabled).length,
        fallbackOnlyBranches: rows.filter((row) => row.controls.fallbackOnly).length,
        aiRecommendationsEnabledBranches: rows.filter((row) => row.aiRecommendationsEnabled).length,
        requests24h: rows.reduce((sum, row) => sum + row.requests24h, 0),
        hostedRequests24h: rows.reduce((sum, row) => sum + row.hostedRequests24h, 0),
        fallbackResponses24h: rows.reduce((sum, row) => sum + row.fallbackResponses24h, 0),
        staffHelpResponses24h: rows.reduce((sum, row) => sum + row.staffHelpResponses24h, 0),
        providerRejections24h: rows.reduce((sum, row) => sum + row.providerRejections24h, 0),
      },
      issueBranches,
    };
  }

  async listAiBranches() {
    const branches = await this.loadAiBranchesBase();
    const statsByBranch = await this.loadAiLogStatsMap();
    return branches.map((branch) => this.toAiBranchRow(branch, statsByBranch.get(branch.id)));
  }

  async getAiBranchDetail(branchId: string, hours = 24) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        name: true,
        location: true,
        isActive: true,
        tenantId: true,
        tenant: { select: { id: true, name: true, isActive: true } },
        branchSettings: {
          select: {
            branchId: true,
            aiConfigJson: true,
            featureFlagsJson: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!branch) throw new NotFoundException("Branch not found");

    const [diagnostics, recentLogs, businessInsightRuns7d, forecastRuns7d] = await Promise.all([
      this.menuChatbotService.getDiagnostics({
        tenantId: branch.tenantId,
        branchId,
        hours,
      }),
      this.prisma.menuChatLog.findMany({
        where: { tenantId: branch.tenantId, branchId },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          createdAt: true,
          messageIntent: true,
          usedAiService: true,
          usedFallback: true,
          safetyNotes: true,
          metadata: true,
        },
      }),
      this.prisma.businessInsightLog.count({
        where: {
          tenantId: branch.tenantId,
          OR: [{ branchId }, { branchId: null }],
          createdAt: { gte: this.daysAgo(7) },
        },
      }),
      this.prisma.demandForecastLog.count({
        where: {
          tenantId: branch.tenantId,
          branchId,
          createdAt: { gte: this.daysAgo(7) },
        },
      }),
    ]);

    const controls = this.normalizeAiControls(branch.branchSettings?.aiConfigJson);
    const aiRecommendationsEnabled = this.readBoolean(branch.branchSettings?.featureFlagsJson, "aiRecommendations", false);
    const status = this.deriveAiStatus(controls, {
      requests: diagnostics.totals.requests,
      hostedRequests: diagnostics.totals.hostedRequests,
      fallbackResponses: diagnostics.totals.fallbackResponses,
      staffHelpResponses: diagnostics.totals.staffHelpResponses,
      providerRejections: diagnostics.totals.providerRejections,
      latestAt: diagnostics.latestAt,
    });

    return {
      branchId: branch.id,
      branchName: branch.name,
      branchLocation: branch.location,
      isActive: branch.isActive,
      tenantId: branch.tenant.id,
      tenantName: branch.tenant.name,
      tenantActive: branch.tenant.isActive,
      aiRecommendationsEnabled,
      branchSettingsUpdatedAt: branch.branchSettings?.updatedAt?.toISOString() ?? null,
      status,
      controls,
      diagnostics,
      aiOperations: {
        businessInsightRuns7d,
        demandForecastRuns7d: forecastRuns7d,
      },
      recommendations: this.buildAiRecommendations({
        controls,
        diagnostics: {
          requests: diagnostics.totals.requests,
          staffHelpResponses: diagnostics.totals.staffHelpResponses,
          providerRejections: diagnostics.totals.providerRejections,
          hostedRequests: diagnostics.totals.hostedRequests,
          fallbackResponses: diagnostics.totals.fallbackResponses,
        },
        aiRecommendationsEnabled,
      }),
      recentActivity: recentLogs.map((log) => {
        const metadata = this.objectMetadata(log.metadata);
        return {
          createdAt: log.createdAt.toISOString(),
          intent: log.messageIntent ?? "UNKNOWN",
          provider: typeof metadata.aiProvider === "string"
            ? metadata.aiProvider
            : log.usedAiService
              ? "hosted"
              : "rules",
          controlMode: typeof metadata.controlMode === "string" ? metadata.controlMode : null,
          providerRejectionReason:
            typeof metadata.providerRejectionReason === "string"
              ? metadata.providerRejectionReason
              : null,
          requiresStaffHelp:
            metadata.requiresStaffHelp === true || this.jsonArrayLength(log.safetyNotes) > 0,
          usedFallback: log.usedFallback,
        };
      }),
    };
  }

  async updateBranchAiControls(branchId: string, dto: UpdateBranchAiControlsDto) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        tenantId: true,
        branchSettings: {
          select: {
            aiConfigJson: true,
          },
        },
      },
    });
    if (!branch) throw new NotFoundException("Branch not found");

    const current = this.objectMetadata(branch.branchSettings?.aiConfigJson);
    const nextRaw: JsonRecord = { ...current };

    const assignableEntries = Object.entries(dto).filter(([, value]) => value !== undefined);
    if (assignableEntries.length === 0) {
      throw new BadRequestException("No AI controls provided");
    }

    for (const [key, value] of assignableEntries) {
      nextRaw[key] = value;
    }

    const normalized = this.normalizeAiControls(nextRaw as Prisma.JsonObject);
    const aiConfigJson = this.serializeAiControls(current, normalized);

    const settings = await this.prisma.branchSettings.upsert({
      where: { branchId },
      update: { aiConfigJson },
      create: {
        branchId,
        tenantId: branch.tenantId,
        aiConfigJson,
      },
    });

    await this.prisma.operationalEventLog.create({
      data: {
        tenantId: branch.tenantId,
        branchId,
        eventType: "SAAS_BRANCH_AI_CONTROLS_UPDATED",
        message: "SaaS owner updated branch AI controls",
        metadata: aiConfigJson,
      },
    });

    return {
      branchId,
      controls: normalized,
      updatedAt: settings.updatedAt.toISOString(),
    };
  }

  async updateBranchFeatures(branchId: string, dto: UpdateBranchFeatureModulesDto) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, tenantId: true },
    });
    if (!branch) throw new NotFoundException("Branch not found");

    const data: {
      featureFlagsJson?: Prisma.InputJsonValue;
      aiConfigJson?: Prisma.InputJsonValue;
    } = {};
    if ("featureFlagsJson" in dto) data.featureFlagsJson = dto.featureFlagsJson as Prisma.InputJsonValue;
    if ("aiConfigJson" in dto) data.aiConfigJson = dto.aiConfigJson as Prisma.InputJsonValue;
    if (!Object.keys(data).length) {
      throw new BadRequestException("No feature module fields provided");
    }

    const settings = await this.prisma.branchSettings.upsert({
      where: { branchId },
      update: data,
      create: {
        branchId,
        tenantId: branch.tenantId,
        ...data,
      },
    });

    await this.prisma.operationalEventLog.create({
      data: {
        tenantId: branch.tenantId,
        branchId,
        eventType: "SAAS_BRANCH_FEATURES_UPDATED",
        message: "SaaS owner updated branch feature modules",
        metadata: data as Prisma.InputJsonObject,
      },
    });

    return settings;
  }

  private async loadAiBranchesBase() {
    return this.prisma.branch.findMany({
      orderBy: [{ tenant: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        location: true,
        isActive: true,
        tenantId: true,
        tenant: { select: { name: true } },
        branchSettings: {
          select: {
            aiConfigJson: true,
            featureFlagsJson: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  private async loadAiLogStatsMap() {
    const logs = await this.prisma.menuChatLog.findMany({
      where: { createdAt: { gte: this.hoursAgo(24) } },
      select: {
        branchId: true,
        usedAiService: true,
        usedFallback: true,
        safetyNotes: true,
        metadata: true,
        createdAt: true,
      },
    });

    const statsByBranch = new Map<string, AiBranchLogStats>();

    for (const log of logs) {
      const current = statsByBranch.get(log.branchId) ?? {
        requests: 0,
        hostedRequests: 0,
        fallbackResponses: 0,
        staffHelpResponses: 0,
        providerRejections: 0,
        latestAt: null,
      };

      current.requests += 1;
      if (log.usedAiService) current.hostedRequests += 1;
      if (log.usedFallback) current.fallbackResponses += 1;

      const metadata = this.objectMetadata(log.metadata);
      if (typeof metadata.providerRejectionReason === "string") {
        current.providerRejections += 1;
      }
      if (metadata.requiresStaffHelp === true || this.jsonArrayLength(log.safetyNotes) > 0) {
        current.staffHelpResponses += 1;
      }

      if (!current.latestAt || log.createdAt.toISOString() > current.latestAt) {
        current.latestAt = log.createdAt.toISOString();
      }

      statsByBranch.set(log.branchId, current);
    }

    return statsByBranch;
  }

  private toAiBranchRow(
    branch: Awaited<ReturnType<typeof this.loadAiBranchesBase>>[number],
    stats?: AiBranchLogStats,
  ) {
    const controls = this.normalizeAiControls(branch.branchSettings?.aiConfigJson);
    const aiRecommendationsEnabled = this.readBoolean(branch.branchSettings?.featureFlagsJson, "aiRecommendations", false);
    const effectiveStats = stats ?? {
      requests: 0,
      hostedRequests: 0,
      fallbackResponses: 0,
      staffHelpResponses: 0,
      providerRejections: 0,
      latestAt: null,
    };
    const status = this.deriveAiStatus(controls, effectiveStats);

    return {
      tenantId: branch.tenantId,
      tenantName: branch.tenant.name,
      branchId: branch.id,
      branchName: branch.name,
      branchLocation: branch.location,
      isActive: branch.isActive,
      aiRecommendationsEnabled,
      controls,
      requests24h: effectiveStats.requests,
      hostedRequests24h: effectiveStats.hostedRequests,
      fallbackResponses24h: effectiveStats.fallbackResponses,
      staffHelpResponses24h: effectiveStats.staffHelpResponses,
      providerRejections24h: effectiveStats.providerRejections,
      lastActivityAt: effectiveStats.latestAt,
      branchSettingsUpdatedAt: branch.branchSettings?.updatedAt?.toISOString() ?? null,
      status,
    };
  }

  private deriveAiStatus(
    controls: NormalizedAiControls,
    stats: AiBranchLogStats,
  ): AiBranchStatusSummary {
    if (!controls.menuChatEnabled) {
      return {
        code: "disabled",
        label: "Disabled",
        reason: "Menu chat is turned off for this branch.",
      };
    }

    if (controls.fallbackOnly) {
      return {
        code: "fallback",
        label: "Fallback only",
        reason: "The branch is locked to deterministic responses.",
      };
    }

    if (
      stats.providerRejections > 0 ||
      stats.staffHelpResponses >= Math.max(4, Math.ceil(stats.requests * 0.35))
    ) {
      return {
        code: "attention",
        label: "Needs attention",
        reason: stats.providerRejections > 0
          ? "Hosted provider rejections were detected in the last 24 hours."
          : "A high share of requests escalated to staff help.",
      };
    }

    return {
      code: "healthy",
      label: "Healthy",
      reason: stats.requests > 0
        ? "Traffic and AI responses are operating within the expected envelope."
        : "AI is enabled and waiting for branch traffic.",
    };
  }

  private buildAiRecommendations(input: {
    controls: NormalizedAiControls;
    diagnostics: {
      requests: number;
      staffHelpResponses: number;
      providerRejections: number;
      hostedRequests: number;
      fallbackResponses: number;
    };
    aiRecommendationsEnabled: boolean;
  }) {
    const recommendations: string[] = [];

    if (!input.aiRecommendationsEnabled) {
      recommendations.push("Operational AI recommendations are disabled at the branch module layer.");
    }
    if (!input.controls.menuChatEnabled) {
      recommendations.push("Menu chat is disabled. Customer-facing AI assistance is currently unavailable.");
    }
    if (input.controls.fallbackOnly) {
      recommendations.push("Fallback-only mode is active. Hosted AI responses are bypassed for this branch.");
    }
    if (!input.controls.hostedLlmEnabled && input.controls.menuChatEnabled && !input.controls.fallbackOnly) {
      recommendations.push("Hosted LLM responses are disabled, so the branch is relying on the rules engine only.");
    }
    if (input.diagnostics.providerRejections > 0) {
      recommendations.push("Provider rejections were logged recently. Review timeout and response-length settings.");
    }
    if (input.diagnostics.staffHelpResponses >= Math.max(4, Math.ceil(input.diagnostics.requests * 0.35))) {
      recommendations.push("Staff escalations are high for the current traffic window. Review the branch prompt controls.");
    }
    if (input.diagnostics.requests === 0) {
      recommendations.push("No menu chat traffic was recorded in the selected window.");
    }

    return recommendations.slice(0, 6);
  }

  private async loadSessionRows(hours: number) {
    const normalizedHours = this.normalizeHours(hours);
    const windowStart = this.hoursAgo(normalizedHours);
    const sessions = await this.prisma.session.findMany({
      where: {
        OR: [
          { status: SessionStatus.ACTIVE },
          { startTime: { gte: windowStart } },
          { endTime: { gte: windowStart } },
        ],
      },
      orderBy: [{ startTime: "desc" }],
      select: {
        id: true,
        tenantId: true,
        branchId: true,
        status: true,
        guestCount: true,
        startTime: true,
        endTime: true,
        notes: true,
        tenant: { select: { name: true, isActive: true } },
        branch: { select: { name: true, location: true, isActive: true } },
        table: { select: { id: true, tableCode: true, zone: true, capacity: true, status: true } },
        user: { select: { id: true, name: true, phone: true } },
        createdByStaff: { select: { id: true, name: true, primaryRole: true } },
        participants: { select: { id: true } },
        orders: {
          select: {
            id: true,
            totalAmount: true,
            orderStatus: true,
            paymentStatus: true,
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentStatus: true,
            paymentMethod: true,
            paymentDate: true,
          },
        },
        serviceRequests: {
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
            completedAt: true,
          },
        },
      },
    });

    return sessions.map((session) => {
      const totalAmount = session.orders.reduce((sum, order) => sum.add(order.totalAmount), new Decimal(0));
      const paidAmount = session.payments
        .filter((payment) => payment.paymentStatus === PaymentStatus.COMPLETED)
        .reduce((sum, payment) => sum.add(payment.amount), new Decimal(0));
      const openRequestCount = session.serviceRequests.filter(
        (request) =>
          request.status === ServiceRequestStatus.NEW ||
          request.status === ServiceRequestStatus.CLAIMED,
      ).length;
      const completedRequestCount = session.serviceRequests.filter(
        (request) => request.status === ServiceRequestStatus.COMPLETED,
      ).length;
      const durationMinutes = this.sessionDurationMinutes(
        session.startTime,
        session.endTime,
        session.status,
      );
      const outstandingBalance = Decimal.max(totalAmount.sub(paidAmount), new Decimal(0));
      const orderCount = session.orders.length;
      const completedPaymentCount = session.payments.filter(
        (payment) => payment.paymentStatus === PaymentStatus.COMPLETED,
      ).length;
      const attentionState = this.deriveSessionAttentionState({
        status: session.status,
        orderCount,
        openRequestCount,
        outstandingBalance,
        durationMinutes,
      });

      return {
        sessionId: session.id,
        tenantId: session.tenantId,
        tenantName: session.tenant.name,
        tenantActive: session.tenant.isActive,
        branchId: session.branchId,
        branchName: session.branch.name,
        branchLocation: session.branch.location,
        branchActive: session.branch.isActive,
        tableId: session.table.id,
        tableCode: session.table.tableCode,
        tableZone: session.table.zone,
        tableCapacity: session.table.capacity,
        tableStatus: session.table.status,
        status: session.status,
        guestCount: session.guestCount,
        participantCount: session.participants.length,
        orderCount,
        paymentCount: session.payments.length,
        completedPaymentCount,
        openRequestCount,
        completedRequestCount,
        totalAmount: Number(totalAmount.toFixed(2)),
        paidAmount: Number(paidAmount.toFixed(2)),
        outstandingBalance: Number(outstandingBalance.toFixed(2)),
        durationMinutes,
        startedAt: session.startTime.toISOString(),
        endedAt: session.endTime?.toISOString() ?? null,
        customerName: session.user?.name ?? null,
        customerPhone: session.user?.phone ?? null,
        createdByStaffName: session.createdByStaff?.name ?? null,
        createdByStaffRole: session.createdByStaff?.primaryRole ?? null,
        notes: session.notes,
        attentionState,
      };
    });
  }

  private async loadStaffRows(hours: number) {
    const normalizedHours = this.normalizeStaffHours(hours);
    const windowStart = this.hoursAgo(normalizedHours);
    const members = await this.prisma.staff.findMany({
      orderBy: [{ tenant: { name: "asc" } }, { branch: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        tenantId: true,
        branchId: true,
        name: true,
        phone: true,
        email: true,
        primaryRole: true,
        isActive: true,
        createdAt: true,
        tenant: { select: { name: true, isActive: true } },
        branch: { select: { name: true, location: true, isActive: true } },
        roleAssignments: {
          select: {
            role: {
              select: {
                roleName: true,
                permissions: { select: { permission: { select: { code: true } } } },
              },
            },
          },
        },
        shiftAssignments: {
          where: { startTime: { gte: windowStart } },
          select: { id: true, startTime: true, endTime: true, status: true },
        },
        attendanceRecords: {
          where: { checkIn: { gte: windowStart } },
          select: { id: true, checkIn: true, checkOut: true },
        },
        claimedServiceRequests: {
          where: { createdAt: { gte: windowStart } },
          select: { id: true, createdAt: true, completedAt: true, status: true },
        },
        createdSessions: {
          where: { startTime: { gte: windowStart } },
          select: { id: true, startTime: true, status: true },
        },
        assignedOrders: {
          where: { orderDateTime: { gte: windowStart } },
          select: { id: true, totalAmount: true, orderDateTime: true, orderStatus: true },
        },
        operationalEventLogs: {
          where: { createdAt: { gte: windowStart } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true, eventType: true, severity: true, message: true },
        },
      },
    });

    return members.map((member) => {
      const permissionCodes = new Set<string>();
      const roleNames = new Set<string>();
      for (const assignment of member.roleAssignments) {
        roleNames.add(assignment.role.roleName);
        for (const permission of assignment.role.permissions) {
          permissionCodes.add(permission.permission.code);
        }
      }

      const latestActivityAt = this.latestStaffActivity([
        ...member.shiftAssignments.map((shift) => shift.startTime),
        ...member.attendanceRecords.flatMap((attendance) =>
          attendance.checkOut ? [attendance.checkIn, attendance.checkOut] : [attendance.checkIn],
        ),
        ...member.claimedServiceRequests.flatMap((request) =>
          request.completedAt ? [request.createdAt, request.completedAt] : [request.createdAt],
        ),
        ...member.createdSessions.map((session) => session.startTime),
        ...member.assignedOrders.map((order) => order.orderDateTime),
        ...member.operationalEventLogs.map((event) => event.createdAt),
      ]);
      const openShift = member.shiftAssignments.some((shift) => shift.status === ShiftStatus.OPEN);
      const checkedInNow = member.attendanceRecords.some((attendance) => !attendance.checkOut);
      const assignedSales = member.assignedOrders.reduce(
        (sum, order) => sum.add(order.totalAmount),
        new Decimal(0),
      );
      const activity = this.deriveStaffActivity({
        isActive: member.isActive,
        primaryRole: member.primaryRole,
        openShift,
        checkedInNow,
        latestActivityAt,
        recentRequestCount: member.claimedServiceRequests.length,
        recentSessionCount: member.createdSessions.length,
        recentOrderCount: member.assignedOrders.length,
      });

      return {
        staffId: member.id,
        tenantId: member.tenantId,
        tenantName: member.tenant.name,
        tenantActive: member.tenant.isActive,
        branchId: member.branchId,
        branchName: member.branch.name,
        branchLocation: member.branch.location,
        branchActive: member.branch.isActive,
        name: member.name,
        email: member.email,
        phone: member.phone,
        primaryRole: member.primaryRole,
        isActive: member.isActive,
        createdAt: member.createdAt.toISOString(),
        roleNames: [...roleNames].sort(),
        permissionCount: permissionCodes.size,
        openShift,
        checkedInNow,
        shiftCount: member.shiftAssignments.length,
        attendanceCount: member.attendanceRecords.length,
        requestCount: member.claimedServiceRequests.length,
        completedRequestCount: member.claimedServiceRequests.filter(
          (request) => request.status === ServiceRequestStatus.COMPLETED,
        ).length,
        sessionStartCount: member.createdSessions.length,
        activeSessionStartCount: member.createdSessions.filter(
          (session) => session.status === SessionStatus.ACTIVE,
        ).length,
        assignedOrderCount: member.assignedOrders.length,
        assignedSales,
        latestActivityAt,
        latestEventType: member.operationalEventLogs[0]?.eventType ?? null,
        latestEventSeverity: member.operationalEventLogs[0]?.severity ?? null,
        latestEventMessage: member.operationalEventLogs[0]?.message ?? null,
        activity,
      };
    });
  }

  private async loadOperationsRows(hours: number) {
    const normalizedHours = this.normalizeHours(hours);
    const windowStart = this.hoursAgo(normalizedHours);
    const delayedCutoff = new Date(Date.now() - 20 * 60 * 1000);
    const branches = await this.prisma.branch.findMany({
      orderBy: [{ tenant: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        tenantId: true,
        name: true,
        location: true,
        isActive: true,
        tenant: { select: { name: true } },
        _count: { select: { tables: true, staff: true } },
      },
    });

    return Promise.all(
      branches.map(async (branch) => {
        const [
          activeSessions,
          activeOrders,
          delayedOrders,
          readyOrders,
          openRequests,
          lowStockAlerts,
          openShifts,
          tableGroup,
          latestEvent,
        ] = await Promise.all([
          this.prisma.session.count({
            where: { tenantId: branch.tenantId, branchId: branch.id, status: SessionStatus.ACTIVE },
          }),
          this.prisma.order.count({
            where: { tenantId: branch.tenantId, branchId: branch.id, orderStatus: { in: this.activeOrderStatuses() } },
          }),
          this.prisma.order.count({
            where: {
              tenantId: branch.tenantId,
              branchId: branch.id,
              orderStatus: { in: [OrderStatus.PLACED, OrderStatus.CONFIRMED, OrderStatus.IN_KITCHEN] },
              orderDateTime: { lt: delayedCutoff },
            },
          }),
          this.prisma.order.count({
            where: { tenantId: branch.tenantId, branchId: branch.id, orderStatus: OrderStatus.READY },
          }),
          this.prisma.serviceRequest.count({
            where: { tenantId: branch.tenantId, branchId: branch.id, status: { in: [ServiceRequestStatus.NEW, ServiceRequestStatus.CLAIMED] } },
          }),
          this.prisma.lowStockAlert.count({
            where: { tenantId: branch.tenantId, branchId: branch.id, status: LowStockAlertStatus.OPEN },
          }),
          this.prisma.shift.count({
            where: { tenantId: branch.tenantId, branchId: branch.id, status: ShiftStatus.OPEN },
          }),
          this.prisma.table.groupBy({
            by: ["status"],
            where: { branchId: branch.id },
            _count: { _all: true },
          }),
          this.prisma.operationalEventLog.findFirst({
            where: { tenantId: branch.tenantId, branchId: branch.id, createdAt: { gte: windowStart } },
            orderBy: { createdAt: "desc" },
            select: { createdAt: true, severity: true, eventType: true, message: true },
          }),
        ]);

        const tableStatuses = this.normalizeTableStatuses(tableGroup);
        return {
          tenantId: branch.tenantId,
          tenantName: branch.tenant.name,
          branchId: branch.id,
          branchName: branch.name,
          branchLocation: branch.location,
          branchActive: branch.isActive,
          tableCount: branch._count.tables,
          staffCount: branch._count.staff,
          activeOrders,
          delayedOrders,
          readyOrders,
          activeSessions,
          openRequests,
          lowStockAlerts,
          openShifts,
          tableStatuses,
          latestEventAt: latestEvent?.createdAt.toISOString() ?? null,
          latestEventType: latestEvent?.eventType ?? null,
          latestEventMessage: latestEvent?.message ?? null,
          latestEventSeverity: latestEvent?.severity ?? null,
          status: this.deriveOperationsStatus({
            branchActive: branch.isActive,
            activeOrders,
            delayedOrders,
            openRequests,
            lowStockAlerts,
            activeSessions,
            openShifts,
            readyOrders,
          }),
        };
      }),
    );
  }

  private normalizeHours(hours?: number) {
    return Math.min(Math.max(hours ?? 24, 1), 168);
  }

  private activeOrderStatuses() {
    return [
      OrderStatus.PLACED,
      OrderStatus.CONFIRMED,
      OrderStatus.IN_KITCHEN,
      OrderStatus.READY,
    ];
  }

  private normalizeTableStatuses(
    rows: Array<{ status: TableStatus; _count: { _all: number } }>,
  ) {
    const base = {
      AVAILABLE: 0,
      OCCUPIED: 0,
      RESERVED: 0,
      CLEANING: 0,
      OUT_OF_SERVICE: 0,
    };
    for (const row of rows) {
      base[row.status] = row._count._all;
    }
    return base;
  }

  private deriveOperationsStatus(input: {
    branchActive: boolean;
    activeOrders: number;
    delayedOrders: number;
    openRequests: number;
    lowStockAlerts: number;
    activeSessions: number;
    openShifts: number;
    readyOrders: number;
  }): OperationsBranchStatusSummary {
    if (!input.branchActive) {
      return {
        code: "inactive",
        label: "Inactive",
        reason: "Branch is inactive at the platform level.",
      };
    }

    if (
      input.delayedOrders >= 3 ||
      input.openRequests >= 5 ||
      input.lowStockAlerts >= 3 ||
      (input.openShifts === 0 && (input.activeOrders > 0 || input.activeSessions > 0))
    ) {
      return {
        code: "attention",
        label: "Needs attention",
        reason:
          input.openShifts === 0 && (input.activeOrders > 0 || input.activeSessions > 0)
            ? "Live activity is running without an open shift."
            : input.delayedOrders >= 3
              ? "Kitchen backlog is building beyond the healthy range."
              : input.openRequests >= 5
                ? "Table service demand is rising faster than staff resolution."
                : "Low-stock alerts are stacking up on this branch.",
      };
    }

    if (
      input.delayedOrders > 0 ||
      input.openRequests > 0 ||
      input.lowStockAlerts > 0 ||
      input.readyOrders > 0 ||
      input.activeOrders >= 8
    ) {
      return {
        code: "watch",
        label: "Watch",
        reason: "The branch is live with operational pressure that should be monitored.",
      };
    }

    return {
      code: "healthy",
      label: "Healthy",
      reason: "No branch-level operational pressure is currently visible.",
    };
  }

  private buildOperationsRecommendations(input: {
    branchActive: boolean;
    delayedOrders: number;
    openRequests: number;
    lowStockAlerts: number;
    openShifts: number;
    activeSessions: number;
    readyOrders: number;
    occupiedTables: number;
    totalTables: number;
  }) {
    const recommendations: string[] = [];

    if (!input.branchActive) {
      recommendations.push("Branch is inactive. Re-enable it before expecting live operating flow.");
    }
    if (input.openShifts === 0 && input.activeSessions > 0) {
      recommendations.push("Open a staffed shift for this branch. Sessions are active without shift coverage.");
    }
    if (input.delayedOrders >= 3) {
      recommendations.push("Kitchen backlog is elevated. Review station throughput and current order aging.");
    }
    if (input.readyOrders >= 2) {
      recommendations.push("Ready orders are waiting. Check handoff pace between kitchen and floor staff.");
    }
    if (input.openRequests >= 4) {
      recommendations.push("Table service requests are building. Add waiter coverage or rebalance active staff.");
    }
    if (input.lowStockAlerts > 0) {
      recommendations.push("Inventory alerts are open. Review stock and supplier readiness for this branch.");
    }
    if (input.totalTables > 0 && input.occupiedTables / input.totalTables >= 0.8) {
      recommendations.push("Dining room utilization is high. Watch table turns and cleaning response closely.");
    }
    if (recommendations.length === 0) {
      recommendations.push("No corrective action is suggested from the current operating signals.");
    }

    return recommendations.slice(0, 6);
  }

  private normalizeStaffHours(hours?: number) {
    return Math.min(Math.max(hours ?? 168, 1), 720);
  }

  private sessionDurationMinutes(
    startTime: Date,
    endTime: Date | null,
    status: SessionStatus,
  ) {
    const effectiveEnd =
      endTime ?? (status === SessionStatus.ACTIVE ? new Date() : startTime);
    return Math.max(1, Math.round((effectiveEnd.getTime() - startTime.getTime()) / 60000));
  }

  private deriveSessionAttentionState(input: {
    status: SessionStatus;
    orderCount: number;
    openRequestCount: number;
    outstandingBalance: Decimal | number;
    durationMinutes: number;
  }) {
    const outstanding =
      typeof input.outstandingBalance === "number"
        ? input.outstandingBalance
        : Number(input.outstandingBalance.toFixed(2));

    if (
      (input.status === SessionStatus.ACTIVE &&
        (input.openRequestCount >= 3 || input.durationMinutes >= 120)) ||
      (input.status === SessionStatus.CANCELLED && outstanding > 0) ||
      (input.status === SessionStatus.CANCELLED && input.orderCount > 0)
    ) {
      return "attention" as const;
    }

    if (
      (input.status === SessionStatus.ACTIVE &&
        (input.openRequestCount > 0 || input.durationMinutes >= 75 || input.orderCount >= 4)) ||
      (input.status === SessionStatus.COMPLETED && outstanding > 0)
    ) {
      return "watch" as const;
    }

    return "healthy" as const;
  }

  private latestStaffActivity(values: Date[]) {
    if (!values.length) return null;
    return values
      .map((value) => value.toISOString())
      .sort((left, right) => right.localeCompare(left))[0] ?? null;
  }

  private deriveStaffActivity(input: {
    isActive: boolean;
    primaryRole: StaffRoleCode;
    openShift: boolean;
    checkedInNow: boolean;
    latestActivityAt: string | null;
    recentRequestCount: number;
    recentSessionCount: number;
    recentOrderCount: number;
  }): StaffActivitySummary {
    if (!input.isActive) {
      return {
        code: "inactive",
        label: "Inactive",
        reason: "This staff account is disabled at the platform level.",
      };
    }

    if (input.openShift || input.checkedInNow || input.recentRequestCount >= 2 || input.recentOrderCount >= 4) {
      return {
        code: "active",
        label: "Active",
        reason: input.openShift
          ? "This staff member is currently on an open shift."
          : input.checkedInNow
            ? "This staff member is currently checked in."
            : "Recent operational activity is visible in the selected window.",
      };
    }

    if (
      input.primaryRole === StaffRoleCode.OWNER ||
      input.primaryRole === StaffRoleCode.MANAGER ||
      input.recentSessionCount > 0 ||
      input.latestActivityAt
    ) {
      return {
        code: "watch",
        label: "Watch",
        reason:
          input.primaryRole === StaffRoleCode.OWNER || input.primaryRole === StaffRoleCode.MANAGER
            ? "Leadership account with limited recent live activity."
            : "Some recent activity exists, but this staff member is not currently live.",
      };
    }

    return {
      code: "idle",
      label: "Idle",
      reason: "No operational activity was recorded in the selected window.",
    };
  }

  private buildStaffRecommendations(input: {
    isActive: boolean;
    primaryRole: StaffRoleCode;
    openShift: boolean;
    checkedInNow: boolean;
    recentRequestCount: number;
    recentSessionCount: number;
    recentOrderCount: number;
    latestActivityAt: string | null;
  }) {
    const recommendations: string[] = [];

    if (!input.isActive) {
      recommendations.push("This account is disabled. Re-enable it only if branch leadership confirms active staffing need.");
    }
    if (input.openShift && !input.checkedInNow) {
      recommendations.push("An open shift exists without an active attendance record. Review clock-in discipline for this staff member.");
    }
    if (input.primaryRole === StaffRoleCode.OWNER && !input.latestActivityAt) {
      recommendations.push("Owner account has no recent operational footprint. Confirm the tenant has an active leadership contact.");
    }
    if (input.primaryRole === StaffRoleCode.WAITER && input.recentRequestCount === 0 && input.recentOrderCount === 0) {
      recommendations.push("Waiter account shows no recent floor activity. Check scheduling and branch assignment.");
    }
    if (
      (input.primaryRole === StaffRoleCode.CHEF ||
        input.primaryRole === StaffRoleCode.KITCHEN_LEAD) &&
      input.recentOrderCount === 0 &&
      !input.openShift
    ) {
      recommendations.push("Kitchen account is not attached to recent order flow. Validate station staffing coverage.");
    }
    if (input.recentSessionCount > 0 && !input.checkedInNow) {
      recommendations.push("This staff member started sessions recently but is not currently checked in. Review handoff coverage.");
    }
    if (recommendations.length === 0) {
      recommendations.push("No staffing correction is suggested from the current operating signals.");
    }

    return recommendations.slice(0, 6);
  }

  private normalizeSystemHealthHours(hours?: number) {
    return Math.min(Math.max(hours ?? 24, 1), 720);
  }

  private async loadSystemHealthServices(hours: number): Promise<SystemHealthServiceRow[]> {
    const windowStart = this.hoursAgo(hours);
    const checkedAt = new Date().toISOString();
    const [operationalWarnCounts, paymentWarnCounts, aiRejectionRows, coreChecks] = await Promise.all([
      this.prisma.operationalEventLog.groupBy({
        by: ["eventType"],
        where: {
          createdAt: { gte: windowStart },
          severity: { in: ["WARN", "ERROR"] },
        },
        _count: { _all: true },
      }),
      this.prisma.paymentEventLog.groupBy({
        by: ["provider"],
        where: {
          createdAt: { gte: windowStart },
          OR: [
            { status: { notIn: ["COMPLETED", "completed", "SUCCESS", "success", "SUCCEEDED", "succeeded"] } },
            { eventType: { contains: "FAILED" } },
            { eventType: { contains: "MISMATCH" } },
          ],
        },
        _count: { _all: true },
        _min: { createdAt: true },
      }),
      this.prisma.menuChatLog.findMany({
        where: { createdAt: { gte: windowStart } },
        select: {
          branchId: true,
          metadata: true,
        },
      }),
      this.runCoreSystemChecks(),
    ]);

    const aiRejections = aiRejectionRows.filter((row) => {
      const metadata = this.objectMetadata(row.metadata);
      return typeof metadata.providerRejectionReason === "string";
    });
    const aiAffectedBranches = new Set(aiRejections.map((row) => row.branchId)).size;
    const apiWarnings = operationalWarnCounts.reduce((sum, row) => sum + row._count._all, 0);
    const paymentWarnings = paymentWarnCounts.reduce((sum, row) => sum + row._count._all, 0);

    const rows: SystemHealthServiceRow[] = [
      {
        id: "api",
        name: "API runtime",
        category: "core",
        status: coreChecks.api,
        mode: env.nodeEnv,
        endpoint: "/api/health",
        lastCheckedAt: checkedAt,
        metrics: {
          incidentCount: apiWarnings,
          warningCount: apiWarnings,
          affectedBranches: 0,
        },
        highlights: [
          `Build ${env.buildVersion}`,
          `Commit ${env.commitSha}`,
          apiWarnings > 0 ? `${apiWarnings} warn/error operational events in window` : "No warn/error operational events in window",
        ],
        actionRoute: "/saas/operations",
      },
      {
        id: "database",
        name: "PostgreSQL",
        category: "core",
        status: coreChecks.database,
        mode: "primary",
        endpoint: "DATABASE_URL",
        lastCheckedAt: checkedAt,
        metrics: {
          incidentCount: coreChecks.database.code === "healthy" ? 0 : 1,
          warningCount: 0,
          affectedBranches: 0,
        },
        highlights: [
          coreChecks.database.reason,
          "Primary store for operational, payment, and audit records.",
        ],
        actionRoute: "/saas/system-health",
      },
      {
        id: "redis",
        name: "Redis",
        category: "core",
        status: coreChecks.redis,
        mode: "cache + realtime",
        endpoint: env.redisUrl,
        lastCheckedAt: checkedAt,
        metrics: {
          incidentCount: coreChecks.redis.code === "healthy" ? 0 : 1,
          warningCount: 0,
          affectedBranches: 0,
        },
        highlights: [
          coreChecks.redis.reason,
          "Used for cache and realtime coordination.",
        ],
        actionRoute: "/saas/operations",
      },
      {
        id: "ai",
        name: "AI service",
        category: "integration",
        status: coreChecks.ai,
        mode: "hybrid",
        endpoint: `${env.aiServiceUrl}/health`,
        lastCheckedAt: checkedAt,
        metrics: {
          incidentCount: aiRejections.length,
          warningCount: aiRejections.length,
          affectedBranches: aiAffectedBranches,
        },
        highlights: [
          coreChecks.ai.reason,
          aiRejections.length > 0
            ? `${aiRejections.length} hosted provider rejections in window`
            : "No hosted provider rejections in window",
        ],
        actionRoute: "/saas/ai",
      },
      {
        id: "storage",
        name: "Object storage",
        category: "integration",
        status: coreChecks.storage,
        mode: "s3-compatible",
        endpoint: env.s3Endpoint,
        lastCheckedAt: checkedAt,
        metrics: {
          incidentCount: coreChecks.storage.code === "healthy" ? 0 : 1,
          warningCount: 0,
          affectedBranches: 0,
        },
        highlights: [
          coreChecks.storage.reason,
          `Bucket ${env.s3Bucket}`,
        ],
        actionRoute: "/saas/system-health",
      },
      {
        id: "payments",
        name: "Payment gateway",
        category: "integration",
        status: this.deriveProviderHealth({
          liveProvider: env.paymentProvider === "stripe",
          issueCount: paymentWarnings,
          label: env.paymentProvider === "stripe" ? "Stripe" : "Mock payments",
          issueReason: "Payment anomalies were logged in the selected window.",
          nonLiveReason: "Mock payments are enabled for this environment.",
        }),
        mode: env.paymentProvider,
        endpoint: env.paymentProvider === "stripe" ? "Stripe API" : null,
        lastCheckedAt: checkedAt,
        metrics: {
          incidentCount: paymentWarnings,
          warningCount: paymentWarnings,
          affectedBranches: new Set(paymentWarnCounts.map((row) => row.provider ?? "unknown")).size,
        },
        highlights: [
          env.paymentProvider === "stripe" ? "Live gateway mode is enabled." : "Mock gateway is handling payments.",
          paymentWarnings > 0 ? `${paymentWarnings} payment log anomalies in window` : "No payment anomalies in window",
        ],
        actionRoute: "/saas/revenue",
      },
      {
        id: "sms",
        name: "SMS delivery",
        category: "config",
        status: this.deriveProviderHealth({
          liveProvider: env.smsProvider === "twilio",
          issueCount: 0,
          label: env.smsProvider === "twilio" ? "Twilio" : "Noop SMS",
          issueReason: "SMS issues require provider inspection.",
          nonLiveReason: "Noop SMS mode is enabled for this environment.",
        }),
        mode: env.smsProvider,
        endpoint: env.smsProvider === "twilio" ? "Twilio Messages API" : null,
        lastCheckedAt: checkedAt,
        metrics: {
          incidentCount: 0,
          warningCount: 0,
          affectedBranches: 0,
        },
        highlights: [
          env.smsProvider === "twilio"
            ? "Customer OTP delivery is routed through Twilio."
            : "Customer OTPs stay in demo-safe noop mode.",
        ],
        actionRoute: "/saas/tenants",
      },
    ];

    return rows;
  }

  private async loadSystemHealthIncidents(hours: number) {
    const windowStart = this.hoursAgo(hours);
    const [operational, payment, aiRejectionLogs] = await Promise.all([
      this.prisma.operationalEventLog.findMany({
        where: {
          createdAt: { gte: windowStart },
          severity: { in: ["WARN", "ERROR"] },
        },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          eventType: true,
          severity: true,
          message: true,
          createdAt: true,
          branch: { select: { name: true } },
          tenant: { select: { name: true } },
        },
      }),
      this.prisma.paymentEventLog.findMany({
        where: {
          createdAt: { gte: windowStart },
          OR: [
            { status: { notIn: ["COMPLETED", "completed", "SUCCESS", "success", "SUCCEEDED", "succeeded"] } },
            { eventType: { contains: "FAILED" } },
            { eventType: { contains: "MISMATCH" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          eventType: true,
          status: true,
          provider: true,
          createdAt: true,
          branch: { select: { name: true } },
          tenant: { select: { name: true } },
        },
      }),
      this.prisma.menuChatLog.findMany({
        where: { createdAt: { gte: windowStart } },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          createdAt: true,
          branch: { select: { name: true } },
          tenant: { select: { name: true } },
          metadata: true,
        },
      }),
    ]);

    const aiIncidents = aiRejectionLogs
      .map((log) => {
        const metadata = this.objectMetadata(log.metadata);
        const reason =
          typeof metadata.providerRejectionReason === "string"
            ? metadata.providerRejectionReason
            : null;
        if (!reason) return null;
        return {
          id: `ai-${log.id}`,
          source: "ai",
          serviceId: "ai",
          serviceName: "AI service",
          tenantId: log.tenantId,
          tenantName: log.tenant.name,
          branchId: log.branchId,
          branchName: log.branch.name,
          severity: "WARN" as const,
          title: "Hosted AI rejection",
          message: reason,
          occurredAt: log.createdAt.toISOString(),
        };
      })
      .filter(
        (
          incident,
        ): incident is {
          id: string;
          source: string;
          serviceId: string;
          serviceName: string;
          tenantId: string;
          tenantName: string;
          branchId: string;
          branchName: string;
          severity: "WARN";
          title: string;
          message: string;
          occurredAt: string;
        } => incident !== null,
      );

    const incidents = [
      ...operational.map((event) => ({
        id: `ops-${event.id}`,
        source: "operations",
        serviceId: "api",
        serviceName: "API runtime",
        tenantId: event.tenantId,
        tenantName: event.tenant.name,
        branchId: event.branchId,
        branchName: event.branch.name,
        severity: event.severity as "WARN" | "ERROR",
        title: event.eventType,
        message: event.message,
        occurredAt: event.createdAt.toISOString(),
      })),
      ...payment.map((event) => ({
        id: `pay-${event.id}`,
        source: "payments",
        serviceId: "payments",
        serviceName: "Payment gateway",
        tenantId: event.tenantId,
        tenantName: event.tenant.name,
        branchId: event.branchId,
        branchName: event.branch.name,
        severity: event.status && ["FAILED", "ERROR"].includes(event.status.toUpperCase()) ? "ERROR" as const : "WARN" as const,
        title: `${event.provider ?? "payment"} ${event.eventType}`.trim(),
        message: event.status ? `Gateway status ${event.status}` : "Payment anomaly was logged without a normalized status.",
        occurredAt: event.createdAt.toISOString(),
      })),
      ...aiIncidents,
    ]
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, 120);

    return incidents;
  }

  private async runCoreSystemChecks() {
    const [database, redis, ai, storage] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkTcpHealth(env.redisUrl, "Redis accepted a TCP connection.", "Redis is unreachable from the API runtime."),
      this.checkHttpHealth(`${env.aiServiceUrl}/health`, "AI service health endpoint responded.", "AI service health endpoint is unavailable."),
      this.checkHttpHealth(env.s3Endpoint, "Object storage endpoint responded.", "Object storage endpoint is unavailable."),
    ]);

    return {
      api: {
        code: "healthy",
        label: "Healthy",
        reason: "The API is serving this SaaS health request successfully.",
      } satisfies SystemHealthStatusSummary,
      database,
      redis,
      ai,
      storage,
    };
  }

  private async checkDatabaseHealth(): Promise<SystemHealthStatusSummary> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        code: "healthy",
        label: "Healthy",
        reason: "Database connectivity is healthy.",
      };
    } catch {
      return {
        code: "unavailable",
        label: "Unavailable",
        reason: "Database connectivity failed.",
      };
    }
  }

  private async checkTcpHealth(
    url: string,
    okReason: string,
    failReason: string,
  ): Promise<SystemHealthStatusSummary> {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname;
      const port = Number(parsed.port || "6379");

      const status = await new Promise<"healthy" | "unavailable">((resolve) => {
        import("node:net")
          .then(({ createConnection }) => {
            const socket = createConnection({ host, port, timeout: 2000 });
            socket.on("connect", () => {
              socket.destroy();
              resolve("healthy");
            });
            socket.on("error", () => {
              socket.destroy();
              resolve("unavailable");
            });
            socket.on("timeout", () => {
              socket.destroy();
              resolve("unavailable");
            });
          })
          .catch(() => resolve("unavailable"));
      });

      return {
        code: status,
        label: status === "healthy" ? "Healthy" : "Unavailable",
        reason: status === "healthy" ? okReason : failReason,
      };
    } catch {
      return {
        code: "unavailable",
        label: "Unavailable",
        reason: failReason,
      };
    }
  }

  private async checkHttpHealth(
    url: string,
    okReason: string,
    failReason: string,
  ): Promise<SystemHealthStatusSummary> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.ok) {
        return {
          code: "healthy",
          label: "Healthy",
          reason: okReason,
        };
      }

      return {
        code: "degraded",
        label: "Degraded",
        reason: `Endpoint responded with HTTP ${response.status}.`,
      };
    } catch {
      return {
        code: "unavailable",
        label: "Unavailable",
        reason: failReason,
      };
    }
  }

  private deriveProviderHealth(input: {
    liveProvider: boolean;
    issueCount: number;
    label: string;
    issueReason: string;
    nonLiveReason: string;
  }): SystemHealthStatusSummary {
    if (input.issueCount > 0) {
      return {
        code: "degraded",
        label: "Degraded",
        reason: input.issueReason,
      };
    }
    if (!input.liveProvider) {
      return {
        code: "degraded",
        label: "Degraded",
        reason: input.nonLiveReason,
      };
    }
    return {
      code: "healthy",
      label: "Healthy",
      reason: `${input.label} is configured and no recent issue signal was detected.`,
    };
  }

  private async loadAuditLogFeed(start: Date, end: Date): Promise<SaasAuditFeedRow[]> {
    const [auditRows, operationalRows, paymentRows] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { timestamp: { gte: start, lte: end } },
        orderBy: { timestamp: "desc" },
        take: 250,
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          actionCode: true,
          entityType: true,
          entityId: true,
          timestamp: true,
          beforeJson: true,
          afterJson: true,
          tenant: { select: { name: true } },
          branch: { select: { name: true } },
          actorStaff: { select: { id: true, name: true, primaryRole: true } },
        },
      }),
      this.prisma.operationalEventLog.findMany({
        where: { createdAt: { gte: start, lte: end } },
        orderBy: { createdAt: "desc" },
        take: 250,
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          sessionId: true,
          orderId: true,
          eventType: true,
          severity: true,
          message: true,
          metadata: true,
          createdAt: true,
          tenant: { select: { name: true } },
          branch: { select: { name: true } },
          actorStaff: { select: { id: true, name: true, primaryRole: true } },
        },
      }),
      this.prisma.paymentEventLog.findMany({
        where: { createdAt: { gte: start, lte: end } },
        orderBy: { createdAt: "desc" },
        take: 250,
        select: {
          id: true,
          tenantId: true,
          branchId: true,
          orderId: true,
          sessionId: true,
          paymentId: true,
          eventType: true,
          provider: true,
          amount: true,
          status: true,
          metadata: true,
          createdAt: true,
          tenant: { select: { name: true } },
          branch: { select: { name: true } },
        },
      }),
    ]);

    return [
      ...auditRows.map((row) => ({
        id: `audit-${row.id}`,
        stream: "audit" as const,
        occurredAt: row.timestamp.toISOString(),
        tenantId: row.tenantId,
        tenantName: row.tenant.name,
        branchId: row.branchId,
        branchName: row.branch.name,
        actor: {
          id: row.actorStaff.id,
          name: row.actorStaff.name,
          role: row.actorStaff.primaryRole,
        },
        severity: "AUDIT" as const,
        code: row.actionCode,
        title: `${row.entityType} change`,
        summary: `${row.actionCode} on ${row.entityType} ${row.entityId}`,
        reference: row.entityId,
        entityType: row.entityType,
        entityId: row.entityId,
        sessionId: null,
        orderId: null,
        paymentId: null,
        paymentProvider: null,
        paymentStatus: null,
        amount: null,
        beforeJson: row.beforeJson,
        afterJson: row.afterJson,
        metadata: null,
      })),
      ...operationalRows.map((row) => ({
        id: `operational-${row.id}`,
        stream: "operational" as const,
        occurredAt: row.createdAt.toISOString(),
        tenantId: row.tenantId,
        tenantName: row.tenant.name,
        branchId: row.branchId,
        branchName: row.branch.name,
        actor: row.actorStaff
          ? {
              id: row.actorStaff.id,
              name: row.actorStaff.name,
              role: row.actorStaff.primaryRole,
            }
          : null,
        severity: row.severity as "INFO" | "WARN" | "ERROR",
        code: row.eventType,
        title: row.eventType.replaceAll("_", " "),
        summary: row.message,
        reference: row.orderId ?? row.sessionId ?? null,
        entityType: null,
        entityId: null,
        sessionId: row.sessionId,
        orderId: row.orderId,
        paymentId: null,
        paymentProvider: null,
        paymentStatus: null,
        amount: null,
        beforeJson: null,
        afterJson: null,
        metadata: row.metadata,
      })),
      ...paymentRows.map((row) => ({
        id: `payments-${row.id}`,
        stream: "payments" as const,
        occurredAt: row.createdAt.toISOString(),
        tenantId: row.tenantId,
        tenantName: row.tenant.name,
        branchId: row.branchId,
        branchName: row.branch.name,
        actor: null,
        severity: this.normalizePaymentSeverity(row.status, row.eventType),
        code: row.eventType,
        title: `${row.provider ?? "payment"} ${row.eventType}`.trim(),
        summary: row.status ? `Status ${row.status}` : "Payment event recorded",
        reference: row.paymentId ?? row.orderId ?? row.sessionId ?? null,
        entityType: null,
        entityId: null,
        sessionId: row.sessionId,
        orderId: row.orderId,
        paymentId: row.paymentId,
        paymentProvider: row.provider,
        paymentStatus: row.status,
        amount: row.amount?.toFixed(2) ?? null,
        beforeJson: null,
        afterJson: null,
        metadata: row.metadata,
      })),
    ]
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, 500);
  }

  private parseAuditLogRange(from?: string, to?: string) {
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const start = from ? new Date(from) : defaultStart;
    const end = to ? new Date(to) : now;

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException("Invalid audit log date range");
    }
    if (start > end) {
      throw new BadRequestException("Audit log range start must be before end");
    }
    const rangeDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
    if (rangeDays > 180) {
      throw new BadRequestException("Audit log range cannot exceed 180 days");
    }

    return { start, end };
  }

  private normalizePaymentSeverity(status: string | null, eventType: string) {
    const normalizedStatus = status?.toUpperCase() ?? "";
    const normalizedEventType = eventType.toUpperCase();
    if (
      normalizedStatus.includes("FAIL") ||
      normalizedStatus.includes("ERROR") ||
      normalizedEventType.includes("FAIL") ||
      normalizedEventType.includes("MISMATCH")
    ) {
      return "ERROR" as const;
    }
    if (
      normalizedStatus.includes("PENDING") ||
      normalizedStatus.includes("REFUND") ||
      normalizedEventType.includes("REFUND") ||
      normalizedEventType.includes("WEBHOOK")
    ) {
      return "WARN" as const;
    }
    return "INFO" as const;
  }

  private async getOrCreatePlatformSettings() {
    return this.prisma.platformSettings.upsert({
      where: { id: "global" },
      update: {},
      create: {
        id: "global",
        announcementJson: [],
        changeLogJson: [],
      },
    });
  }

  private normalizeAnnouncements(raw: Prisma.JsonValue | null | undefined) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const record = item as Record<string, unknown>;
        if (
          typeof record.id !== "string" ||
          typeof record.title !== "string" ||
          typeof record.message !== "string" ||
          (record.tone !== "info" && record.tone !== "warning" && record.tone !== "success") ||
          typeof record.enabled !== "boolean"
        ) {
          return null;
        }
        return {
          id: record.id,
          title: record.title,
          message: record.message,
          tone: record.tone,
          enabled: record.enabled,
        };
      })
      .filter(Boolean);
  }

  private normalizePlatformChangeLog(raw: Prisma.JsonValue | null | undefined) {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const record = item as Record<string, unknown>;
        if (
          typeof record.id !== "string" ||
          typeof record.createdAt !== "string" ||
          typeof record.message !== "string"
        ) {
          return null;
        }
        return {
          id: record.id,
          createdAt: record.createdAt,
          message: record.message,
          metadata:
            record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
              ? record.metadata
              : null,
        };
      })
      .filter(Boolean);
  }

  private parseRevenueRange(from?: string, to?: string) {
    const today = new Date();
    const defaultEnd = new Date(today);
    defaultEnd.setHours(23, 59, 59, 999);
    const defaultStart = new Date(defaultEnd);
    defaultStart.setDate(defaultStart.getDate() - 29);
    defaultStart.setHours(0, 0, 0, 0);

    const start = from ? new Date(from) : defaultStart;
    const end = to ? new Date(to) : defaultEnd;
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException("Invalid revenue date range");
    }
    if (start > end) {
      throw new BadRequestException("Revenue range start must be before end");
    }

    return { start, end };
  }

  private parseOptionalDate(value?: string) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException("Invalid date value");
    }
    return parsed;
  }

  private dayKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private money(value: string | number) {
    const amount = typeof value === "string" ? Number(value) : value;
    return `$${amount.toFixed(2)}`;
  }

  private normalizeAiControls(raw: Prisma.JsonValue | null | undefined): NormalizedAiControls {
    const config = this.objectMetadata(raw);

    const dailyHostedRequestLimit =
      typeof config.dailyHostedRequestLimit === "number" && Number.isFinite(config.dailyHostedRequestLimit)
        ? Math.min(Math.max(Math.floor(config.dailyHostedRequestLimit), 0), 1000)
        : 200;
    const dailyRequestLimit =
      typeof config.dailyRequestLimit === "number" && Number.isFinite(config.dailyRequestLimit)
        ? Math.min(Math.max(Math.floor(config.dailyRequestLimit), 0), 5000)
        : 1000;
    const sessionHourlyRequestLimit =
      typeof config.sessionHourlyRequestLimit === "number" && Number.isFinite(config.sessionHourlyRequestLimit)
        ? Math.min(Math.max(Math.floor(config.sessionHourlyRequestLimit), 0), 200)
        : 40;
    const hostedProviderTimeoutMs =
      typeof config.hostedProviderTimeoutMs === "number" && Number.isFinite(config.hostedProviderTimeoutMs)
        ? Math.min(Math.max(Math.floor(config.hostedProviderTimeoutMs), 750), 10_000)
        : 4500;
    const maxResponseLength =
      typeof config.maxResponseLength === "number" && Number.isFinite(config.maxResponseLength)
        ? Math.min(Math.max(Math.floor(config.maxResponseLength), 120), 700)
        : 500;
    const maxSuggestions =
      typeof config.maxSuggestions === "number" && Number.isFinite(config.maxSuggestions)
        ? Math.min(Math.max(Math.floor(config.maxSuggestions), 1), 5)
        : 5;
    const assistantTone =
      config.assistantTone === "friendly" || config.assistantTone === "formal"
        ? config.assistantTone
        : "concise";

    return {
      menuChatEnabled: config.menuChatEnabled !== false,
      hostedLlmEnabled: config.hostedLlmEnabled !== false,
      fallbackOnly: config.fallbackOnly === true,
      dailyHostedRequestLimit,
      dailyRequestLimit,
      sessionHourlyRequestLimit,
      hostedProviderTimeoutMs,
      maxResponseLength,
      maxSuggestions,
      assistantTone,
    };
  }

  private serializeAiControls(base: JsonRecord, controls: NormalizedAiControls): Prisma.InputJsonObject {
    return {
      ...base,
      menuChatEnabled: controls.menuChatEnabled,
      hostedLlmEnabled: controls.hostedLlmEnabled,
      fallbackOnly: controls.fallbackOnly,
      dailyHostedRequestLimit: controls.dailyHostedRequestLimit,
      dailyRequestLimit: controls.dailyRequestLimit,
      sessionHourlyRequestLimit: controls.sessionHourlyRequestLimit,
      hostedProviderTimeoutMs: controls.hostedProviderTimeoutMs,
      maxResponseLength: controls.maxResponseLength,
      maxSuggestions: controls.maxSuggestions,
      assistantTone: controls.assistantTone,
    } as Prisma.InputJsonObject;
  }

  private readBoolean(raw: Prisma.JsonValue | null | undefined, key: string, fallback: boolean) {
    const object = this.objectMetadata(raw);
    return typeof object[key] === "boolean" ? (object[key] as boolean) : fallback;
  }

  private objectMetadata(raw: Prisma.JsonValue | null | undefined): JsonRecord {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return raw as JsonRecord;
    }
    return {};
  }

  private jsonArrayLength(raw: Prisma.JsonValue | null | undefined) {
    return Array.isArray(raw) ? raw.length : 0;
  }

  private hoursAgo(hours: number) {
    return new Date(Date.now() - hours * 60 * 60 * 1000);
  }

  private daysAgo(days: number) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }
}
