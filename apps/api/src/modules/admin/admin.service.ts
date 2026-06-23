import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { StaffRoleCode } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { hashPassword } from "../auth/password.util.js";
import type { CreateBranchDto, UpdateBranchDto } from "./dto/branch.dto.js";
import type { CreateStaffDto, UpdateStaffDto } from "./dto/staff.dto.js";
import type { CreateRoleDto, AssignPermissionsDto } from "./dto/role.dto.js";
import type { CreateTaxRuleDto, UpdateTaxRuleDto } from "./dto/tax-rule.dto.js";
import type { CreateExpenseDto } from "./dto/expense.dto.js";
import type { UpdateBranchSettingsDto } from "../branch-settings/dto/branch-settings.dto.js";

@Injectable()
export class AdminService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ── Tenant ───────────────────────────────────────────

  async getTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        branches: { select: { id: true, name: true, location: true, latitude: true, longitude: true, geofenceRadiusM: true, geofenceEnabled: true, isActive: true } },
        _count: { select: { staff: true, branches: true } },
      },
    });
    if (!tenant) throw new NotFoundException("Tenant not found");
    return tenant;
  }

  // ── Branches ─────────────────────────────────────────

  async listBranches(tenantId: string) {
    return this.prisma.branch.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
      include: { _count: { select: { tables: true, staff: true } } },
    });
  }

  async getBranch(branchId: string, tenantId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      include: {
        _count: { select: { tables: true, staff: true, orders: true } },
      },
    });
    if (!branch || branch.tenantId !== tenantId) {
      throw new NotFoundException("Branch not found");
    }
    return branch;
  }

  async createBranch(tenantId: string, dto: CreateBranchDto, staffId: string) {
    const branch = await this.prisma.branch.create({
      data: {
        tenantId,
        name: dto.name,
        location: dto.location,
        latitude: dto.latitude,
        longitude: dto.longitude,
        geofenceRadiusM: dto.geofenceRadiusM,
        geofenceEnabled: dto.geofenceEnabled,
      },
    });

    await this.audit(tenantId, branch.id, staffId, "BRANCH_CREATED", "Branch", branch.id, null, { name: dto.name, location: dto.location, geofenceEnabled: branch.geofenceEnabled, geofenceRadiusM: branch.geofenceRadiusM });
    return branch;
  }

  async updateBranch(branchId: string, tenantId: string, dto: UpdateBranchDto, staffId: string) {
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch || branch.tenantId !== tenantId) {
      throw new NotFoundException("Branch not found");
    }

    const updated = await this.prisma.branch.update({
      where: { id: branchId },
      data: {
        name: dto.name,
        location: dto.location,
        isActive: dto.isActive,
        latitude: dto.latitude,
        longitude: dto.longitude,
        geofenceRadiusM: dto.geofenceRadiusM,
        geofenceEnabled: dto.geofenceEnabled,
      },
    });

    await this.audit(tenantId, branchId, staffId, "BRANCH_UPDATED", "Branch", branchId, { name: branch.name, location: branch.location, isActive: branch.isActive, geofenceEnabled: branch.geofenceEnabled, geofenceRadiusM: branch.geofenceRadiusM }, { name: updated.name, location: updated.location, isActive: updated.isActive, geofenceEnabled: updated.geofenceEnabled, geofenceRadiusM: updated.geofenceRadiusM });
    return updated;
  }

  // ── Staff ────────────────────────────────────────────

  async listStaff(tenantId: string, branchId?: string) {
    return this.prisma.staff.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, email: true, phone: true,
        primaryRole: true, isActive: true, branchId: true, createdAt: true,
      },
    });
  }

  async getStaff(staffId: string, tenantId: string) {
    const staff = await this.prisma.staff.findUnique({
      where: { id: staffId },
      include: {
        roleAssignments: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
        branch: { select: { id: true, name: true } },
      },
    });
    if (!staff || staff.tenantId !== tenantId) {
      throw new NotFoundException("Staff not found");
    }
    const { passwordHash: _, ...safe } = staff;
    return safe;
  }

  async createStaff(tenantId: string, dto: CreateStaffDto, actorStaffId: string) {
    assertTenantStaffRoleAssignable(dto.primaryRole);

    // Verify branch belongs to tenant
    const branch = await this.prisma.branch.findFirst({
      where: { id: dto.branchId, tenantId },
    });
    if (!branch) throw new BadRequestException("Branch not found in tenant");

    // Check email uniqueness within tenant
    const existing = await this.prisma.staff.findFirst({
      where: { email: dto.email, tenantId },
    });
    if (existing) throw new ConflictException("Email already in use");

    const passwordHash = await hashPassword(dto.password);

    const staff = await this.prisma.staff.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        primaryRole: dto.primaryRole,
        passwordHash,
      },
      select: {
        id: true, name: true, email: true, phone: true,
        primaryRole: true, isActive: true, branchId: true,
      },
    });

    await this.audit(tenantId, dto.branchId, actorStaffId, "STAFF_CREATED", "Staff", staff.id, null, { name: dto.name, email: dto.email, primaryRole: dto.primaryRole });
    return staff;
  }

  async updateStaff(staffId: string, tenantId: string, dto: UpdateStaffDto, actorStaffId: string) {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff || staff.tenantId !== tenantId) {
      throw new NotFoundException("Staff not found");
    }
    assertTenantStaffRoleAssignable(dto.primaryRole);

    const updated = await this.prisma.staff.update({
      where: { id: staffId },
      data: { name: dto.name, phone: dto.phone, email: dto.email, primaryRole: dto.primaryRole, isActive: dto.isActive },
      select: {
        id: true, name: true, email: true, phone: true,
        primaryRole: true, isActive: true, branchId: true,
      },
    });

    await this.audit(tenantId, staff.branchId, actorStaffId, "STAFF_UPDATED", "Staff", staffId, { name: staff.name, isActive: staff.isActive }, { name: updated.name, isActive: updated.isActive });
    return updated;
  }

  async assignRole(staffId: string, roleId: string, tenantId: string, actorStaffId: string) {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff || staff.tenantId !== tenantId) {
      throw new NotFoundException("Staff not found");
    }

    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role || role.tenantId !== tenantId) {
      throw new NotFoundException("Role not found");
    }
    assertTenantRoleAssignable(role.roleName);

    await this.prisma.staffRoleAssignment.upsert({
      where: { staffId_roleId: { staffId, roleId } },
      update: {},
      create: { staffId, roleId },
    });

    await this.audit(tenantId, staff.branchId, actorStaffId, "ROLE_ASSIGNED", "StaffRoleAssignment", staffId, null, { staffId, roleId, roleName: role.roleName });
    return { staffId, roleId, roleName: role.roleName };
  }

  // ── Roles / Permissions ──────────────────────────────

  async listRoles(tenantId: string) {
    return this.prisma.role.findMany({
      where: { tenantId },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { staffAssignments: true } },
      },
    });
  }

  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { code: "asc" } });
  }

  async createRole(tenantId: string, dto: CreateRoleDto, staffId: string) {
    assertTenantRoleAssignable(dto.roleName);

    const role = await this.prisma.role.create({
      data: { tenantId, roleName: dto.roleName },
    });
    await this.audit(tenantId, "", staffId, "ROLE_CREATED", "Role", role.id, null, { roleName: dto.roleName });
    return role;
  }

  async assignPermissions(roleId: string, tenantId: string, dto: AssignPermissionsDto, staffId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role || role.tenantId !== tenantId) {
      throw new NotFoundException("Role not found");
    }

    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: dto.permissionCodes } },
    });
    if (permissions.length !== dto.permissionCodes.length) {
      const found = new Set(permissions.map((p) => p.code));
      const missing = dto.permissionCodes.filter((c) => !found.has(c));
      throw new BadRequestException(`Unknown permissions: ${missing.join(", ")}`);
    }

    for (const perm of permissions) {
      await this.prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: perm.id } },
        update: {},
        create: { roleId, permissionId: perm.id },
      });
    }

    await this.audit(tenantId, "", staffId, "PERMISSIONS_ASSIGNED", "Role", roleId, null, { roleName: role.roleName, permissionCodes: dto.permissionCodes });

    return this.prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });
  }

  // ── Tax Rules ────────────────────────────────────────

  async listTaxRules(branchId: string, tenantId: string) {
    return this.prisma.taxRule.findMany({
      where: { branchId, tenantId },
      orderBy: { taxClass: "asc" },
    });
  }

  async createTaxRule(tenantId: string, dto: CreateTaxRuleDto, staffId: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id: dto.branchId, tenantId } });
    if (!branch) throw new BadRequestException("Branch not found in tenant");

    const rule = await this.prisma.taxRule.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        taxClass: dto.taxClass,
        ratePercent: dto.ratePercent,
      },
    });

    await this.audit(tenantId, dto.branchId, staffId, "TAX_RULE_CREATED", "TaxRule", rule.id, null, { taxClass: dto.taxClass, ratePercent: dto.ratePercent });
    return rule;
  }

  async updateTaxRule(taxRuleId: string, tenantId: string, dto: UpdateTaxRuleDto, staffId: string) {
    const rule = await this.prisma.taxRule.findUnique({ where: { id: taxRuleId } });
    if (!rule || rule.tenantId !== tenantId) {
      throw new NotFoundException("Tax rule not found");
    }

    const updated = await this.prisma.taxRule.update({
      where: { id: taxRuleId },
      data: { ratePercent: dto.ratePercent, isActive: dto.isActive },
    });

    await this.audit(tenantId, rule.branchId, staffId, "TAX_RULE_UPDATED", "TaxRule", taxRuleId, { ratePercent: rule.ratePercent.toString(), isActive: rule.isActive }, { ratePercent: updated.ratePercent.toString(), isActive: updated.isActive });
    return updated;
  }

  // ── Expenses ─────────────────────────────────────────

  async createExpense(tenantId: string, dto: CreateExpenseDto, staffId: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id: dto.branchId, tenantId } });
    if (!branch) throw new BadRequestException("Branch not found in tenant");

    const expense = await this.prisma.expense.create({
      data: {
        tenantId,
        branchId: dto.branchId,
        category: dto.category,
        amount: dto.amount,
        expenseDate: new Date(dto.expenseDate),
        description: dto.description,
        receiptUrl: dto.receiptUrl,
        createdByStaffId: staffId,
      },
    });

    await this.audit(tenantId, dto.branchId, staffId, "EXPENSE_CREATED", "Expense", expense.id, null, { category: dto.category, amount: dto.amount });
    return expense;
  }

  async listExpenses(tenantId: string, branchId?: string, from?: string, to?: string) {
    const where: Record<string, unknown> = { tenantId };
    if (branchId) where["branchId"] = branchId;
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) dateFilter["gte"] = new Date(from);
      if (to) dateFilter["lte"] = new Date(to);
      where["expenseDate"] = dateFilter;
    }

    return this.prisma.expense.findMany({
      where,
      orderBy: { expenseDate: "desc" },
      take: 100,
      include: {
        createdByStaff: { select: { id: true, name: true } },
      },
    });
  }

  async getExpense(expenseId: string, tenantId: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      include: { createdByStaff: { select: { id: true, name: true } } },
    });
    if (!expense || expense.tenantId !== tenantId) {
      throw new NotFoundException("Expense not found");
    }
    return expense;
  }

  // ── Audit Logs ───────────────────────────────────────

  async listAuditLogs(
    tenantId: string,
    branchId?: string,
    from?: string,
    to?: string,
    entityType?: string,
    actionCode?: string,
  ) {
    const where: Record<string, unknown> = { tenantId };
    if (branchId) where["branchId"] = branchId;
    if (entityType) where["entityType"] = entityType;
    if (actionCode) where["actionCode"] = actionCode;
    if (from || to) {
      const ts: Record<string, Date> = {};
      if (from) ts["gte"] = new Date(from);
      if (to) ts["lte"] = new Date(to);
      where["timestamp"] = ts;
    }

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: 100,
      include: {
        actorStaff: { select: { id: true, name: true, primaryRole: true } },
      },
    });
  }

  // ── Branch Settings ──────────────────────────────────

  async getBranchSettings(branchId: string, tenantId: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId } });
    if (!branch) throw new NotFoundException("Branch not found");
    return this.prisma.branchSettings.findUnique({ where: { branchId } });
  }

  async updateBranchSettings(branchId: string, tenantId: string, data: UpdateBranchSettingsDto, staffId: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId } });
    if (!branch) throw new NotFoundException("Branch not found");
    if ("featureFlagsJson" in data || "aiConfigJson" in data) {
      throw new ForbiddenException("Feature modules are managed by the SaaS owner");
    }

    const safe: Record<string, unknown> = {};
    if ("serviceChargeEnabled" in data) safe.serviceChargeEnabled = data.serviceChargeEnabled;
    if ("serviceChargeType" in data) safe.serviceChargeType = data.serviceChargeType;
    if ("serviceChargeValue" in data) safe.serviceChargeValue = data.serviceChargeValue;
    if ("tipsEnabled" in data) safe.tipsEnabled = data.tipsEnabled;
    if ("tipPresetsJson" in data) safe.tipPresetsJson = data.tipPresetsJson as any;
    if ("paymentConfigJson" in data) safe.paymentConfigJson = data.paymentConfigJson as any;

    const result = await this.prisma.branchSettings.upsert({
      where: { branchId },
      update: safe,
      create: { branchId, tenantId, ...safe },
    });

    await this.audit(tenantId, branchId, staffId, "BRANCH_SETTINGS_UPDATED", "BranchSettings", branchId, null, safe);
    return result;
  }

  // ── Tables ──────────────────────────────────────────

  async createTable(tenantId: string, dto: { branchId: string; tableCode: string; capacity: number; zone?: string; locationDescription?: string; posX?: number; posY?: number; shape?: string }, staffId: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id: dto.branchId, tenantId } });
    if (!branch) throw new BadRequestException("Branch not found");

    const table = await this.prisma.table.create({
      data: {
        branchId: dto.branchId, tableCode: dto.tableCode, capacity: dto.capacity,
        zone: dto.zone, locationDescription: dto.locationDescription,
        posX: dto.posX, posY: dto.posY, shape: dto.shape as any,
      },
    });

    await this.audit(tenantId, dto.branchId, staffId, "TABLE_CREATED", "Table", table.id, null, { tableCode: dto.tableCode, capacity: dto.capacity, zone: dto.zone });
    return table;
  }

  async updateTable(tableId: string, tenantId: string, dto: { tableCode?: string; capacity?: number; zone?: string; locationDescription?: string; posX?: number; posY?: number; shape?: string }, staffId: string) {
    const table = await this.prisma.table.findUnique({ where: { id: tableId }, include: { branch: { select: { tenantId: true } } } });
    if (!table || table.branch.tenantId !== tenantId) throw new NotFoundException("Table not found");

    const updated = await this.prisma.table.update({
      where: { id: tableId },
      data: {
        ...(dto.tableCode !== undefined ? { tableCode: dto.tableCode } : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(dto.zone !== undefined ? { zone: dto.zone } : {}),
        ...(dto.locationDescription !== undefined ? { locationDescription: dto.locationDescription } : {}),
        ...(dto.posX !== undefined ? { posX: dto.posX } : {}),
        ...(dto.posY !== undefined ? { posY: dto.posY } : {}),
        ...(dto.shape !== undefined ? { shape: dto.shape as any } : {}),
      },
    });

    await this.audit(tenantId, table.branchId, staffId, "TABLE_UPDATED", "Table", tableId, { tableCode: table.tableCode, zone: table.zone }, { tableCode: updated.tableCode, zone: updated.zone });
    return updated;
  }

  // ── Order Edit ──────────────────────────────────────

  async editOrder(orderId: string, tenantId: string, dto: { cancelItemIds?: string[]; reason: string }, staffId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: true },
    });
    if (!order || order.tenantId !== tenantId) throw new NotFoundException("Order not found");

    if (!dto.reason) throw new BadRequestException("Reason is required for order edits");

    // Block edits on completed/cancelled/ready orders
    if (["COMPLETED", "CANCELLED", "READY"].includes(order.orderStatus)) {
      throw new BadRequestException(`Cannot edit order in ${order.orderStatus} status`);
    }

    // If order is IN_KITCHEN, block cancellation of started/ready items
    if (dto.cancelItemIds?.length) {
      for (const itemId of dto.cancelItemIds) {
        const item = order.orderItems.find((i) => i.id === itemId);
        if (!item) throw new BadRequestException(`Item ${itemId} not found in order`);
        if (order.orderStatus === "IN_KITCHEN" && (item.kitchenStatus === "IN_PROGRESS" || item.kitchenStatus === "READY")) {
          throw new BadRequestException(`Cannot cancel item ${itemId}: already ${item.kitchenStatus}. Requires manager override.`);
        }
      }

      await this.prisma.$transaction(async (tx) => {
        for (const itemId of dto.cancelItemIds!) {
          await tx.orderItem.update({
            where: { id: itemId },
            data: { kitchenStatus: "CANCELLED" },
          });
        }
        await tx.order.update({
          where: { id: orderId },
          data: { editedAt: new Date(), lastEditedByStaffId: staffId },
        });
      });
    }

    await this.audit(tenantId, order.branchId, staffId, "ORDER_EDITED", "Order", orderId, null, {
      cancelledItems: dto.cancelItemIds, reason: dto.reason,
    });

    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: { include: { menuItem: { select: { id: true, name: true } } } } },
    });
  }

  // ── Finance Summary ─────────────────────────────────

  async getFinanceSummary(branchId: string, tenantId: string, from?: string, to?: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, tenantId } });
    if (!branch) throw new NotFoundException("Branch not found");

    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    const hasDate = Object.keys(dateFilter).length > 0;

    const orders = await this.prisma.order.findMany({
      where: {
        branchId, tenantId,
        ...(hasDate ? { orderDateTime: dateFilter } : {}),
        orderStatus: { not: "CANCELLED" },
      },
      select: { totalAmount: true, paymentStatus: true },
    });

    const refunds = await this.prisma.refund.findMany({
      where: { branchId, tenantId, status: "COMPLETED", ...(hasDate ? { createdAt: dateFilter } : {}) },
      select: { amount: true },
    });

    const expenses = await this.prisma.expense.findMany({
      where: { branchId, tenantId, ...(hasDate ? { expenseDate: dateFilter } : {}) },
      select: { amount: true, category: true },
    });

    const grossSales = orders.reduce((s, o) => s + o.totalAmount.toNumber(), 0);
    const totalRefunds = refunds.reduce((s, r) => s + r.amount.toNumber(), 0);
    const netSales = grossSales - totalRefunds;
    const totalExpenses = expenses.reduce((s, e) => s + e.amount.toNumber(), 0);
    const estimatedProfit = netSales - totalExpenses;

    const expenseByCategory = new Map<string, number>();
    for (const e of expenses) {
      const cat = e.category || "Other";
      expenseByCategory.set(cat, (expenseByCategory.get(cat) ?? 0) + e.amount.toNumber());
    }

    return {
      period: { from: from ?? "all-time", to: to ?? "now" },
      grossSales: grossSales.toFixed(2),
      totalRefunds: totalRefunds.toFixed(2),
      netSales: netSales.toFixed(2),
      totalExpenses: totalExpenses.toFixed(2),
      estimatedProfit: estimatedProfit.toFixed(2),
      orderCount: orders.length,
      paidOrders: orders.filter((o) => o.paymentStatus === "PAID").length,
      unpaidOrders: orders.filter((o) => o.paymentStatus === "UNPAID").length,
      expenseBreakdown: Object.fromEntries(expenseByCategory),
    };
  }

  // ── Inventory Tracking ──────────────────────────────

  async listStockAdjustments(branchId: string, tenantId: string) {
    return this.prisma.stockAdjustment.findMany({
      where: { branchId, tenantId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        inventoryItem: { select: { id: true, name: true, unit: true } },
        createdByStaff: { select: { id: true, name: true } },
      },
    });
  }

  async listLowStockAlerts(branchId: string, tenantId: string) {
    return this.prisma.lowStockAlert.findMany({
      where: { branchId, tenantId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        inventoryItem: { select: { id: true, name: true, unit: true, currentStock: true } },
      },
    });
  }

  async resolveLowStockAlert(alertId: string, tenantId: string, status: string, staffId: string) {
    const alert = await this.prisma.lowStockAlert.findUnique({ where: { id: alertId } });
    if (!alert || alert.tenantId !== tenantId) throw new NotFoundException("Alert not found");

    if (status !== "ACKNOWLEDGED" && status !== "RESOLVED") {
      throw new BadRequestException("Status must be ACKNOWLEDGED or RESOLVED");
    }

    return this.prisma.lowStockAlert.update({
      where: { id: alertId },
      data: { status: status as any, resolvedAt: status === "RESOLVED" ? new Date() : undefined },
    });
  }

  // ── Promotions Tracking ─────────────────────────────

  async listCouponRedemptions(branchId: string, tenantId: string) {
    return this.prisma.couponRedemption.findMany({
      where: { branchId, tenantId },
      orderBy: { redeemedAt: "desc" },
      take: 100,
      include: {
        coupon: { select: { id: true, code: true } },
        user: { select: { id: true, phone: true, name: true } },
      },
    });
  }

  async listGiftCardTransactions(tenantId: string, branchId?: string) {
    return this.prisma.giftCardTransaction.findMany({
      where: { tenantId, ...(branchId ? { branchId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        giftCard: { select: { id: true, code: true, status: true } },
        createdByStaff: { select: { id: true, name: true } },
      },
    });
  }

  // ── Multi-Branch Summary ─────────────────────────────

  async getMultiBranchSummary(tenantId: string) {
    const branches = await this.prisma.branch.findMany({
      where: { tenantId },
      include: { _count: { select: { tables: true, staff: true, orders: true } } },
    });

    const summaries = await Promise.all(branches.map(async (br) => {
      const orders = await this.prisma.order.findMany({
        where: { branchId: br.id, tenantId, orderStatus: { not: "CANCELLED" } },
        select: { totalAmount: true, paymentStatus: true, orderStatus: true },
      });
      const activeSessions = await this.prisma.session.count({ where: { branchId: br.id, tenantId, status: "ACTIVE" } });
      const openRequests = await this.prisma.serviceRequest.count({ where: { branchId: br.id, tenantId, status: { in: ["NEW", "CLAIMED"] } } });
      const lowStockAlerts = await this.prisma.lowStockAlert.count({ where: { branchId: br.id, tenantId, status: "OPEN" } });

      const totalSales = orders.reduce((s, o) => s + o.totalAmount.toNumber(), 0);
      const paidOrders = orders.filter((o) => o.paymentStatus === "PAID").length;

      return {
        branchId: br.id,
        name: br.name,
        location: br.location,
        isActive: br.isActive,
        tableCount: br._count.tables,
        staffCount: br._count.staff,
        orderCount: br._count.orders,
        totalSales: Math.round(totalSales * 100) / 100,
        paidOrders,
        activeSessions,
        openRequests,
        lowStockAlerts,
      };
    }));

    const tenantTotals = {
      totalBranches: branches.length,
      activeBranches: branches.filter((b) => b.isActive).length,
      totalSales: Math.round(summaries.reduce((s, b) => s + b.totalSales, 0) * 100) / 100,
      totalOrders: summaries.reduce((s, b) => s + b.orderCount, 0),
      totalActiveSessions: summaries.reduce((s, b) => s + b.activeSessions, 0),
      totalOpenRequests: summaries.reduce((s, b) => s + b.openRequests, 0),
      totalLowStockAlerts: summaries.reduce((s, b) => s + b.lowStockAlerts, 0),
    };

    return { tenant: tenantTotals, branches: summaries };
  }

  // ── Helpers ──────────────────────────────────────────

  private async audit(
    tenantId: string,
    branchId: string,
    actorStaffId: string,
    actionCode: string,
    entityType: string,
    entityId: string,
    beforeJson: unknown,
    afterJson: unknown,
  ) {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        branchId,
        actorStaffId,
        actionCode,
        entityType,
        entityId,
        beforeJson: beforeJson as any,
        afterJson: afterJson as any,
      },
    });
  }
}

function assertTenantStaffRoleAssignable(role?: StaffRoleCode) {
  if (role === StaffRoleCode.OWNER) {
    throw new BadRequestException("Owner accounts are provisioned by the SaaS operator");
  }
}

function assertTenantRoleAssignable(roleName?: string) {
  if (roleName?.trim().toUpperCase() === StaffRoleCode.OWNER) {
    throw new BadRequestException("Owner roles are managed by the SaaS operator");
  }
}
