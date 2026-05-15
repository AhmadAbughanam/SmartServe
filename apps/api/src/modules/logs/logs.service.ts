import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { StaffRoleCode, type Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";
import type { LogsQueryDto } from "./dto/logs-query.dto.js";

const MAX_RANGE_DAYS = 180;

type OperationalInput = {
  tenantId: string;
  branchId: string;
  eventType: string;
  message: string;
  severity?: "INFO" | "WARN" | "ERROR";
  sessionId?: string;
  tableId?: string;
  orderId?: string;
  actorStaffId?: string;
  metadata?: Prisma.InputJsonValue;
};

type PaymentInput = {
  tenantId: string;
  branchId: string;
  eventType: string;
  orderId?: string;
  sessionId?: string;
  paymentId?: string;
  provider?: string;
  externalId?: string;
  amount?: string | number | Prisma.Decimal;
  status?: string;
  metadata?: Prisma.InputJsonValue;
};

@Injectable()
export class LogsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async writeOperational(input: OperationalInput) {
    try {
      await this.prisma.operationalEventLog.create({ data: input });
    } catch (error) {
      console.warn("Operational log write failed", error);
    }
  }

  async writePayment(input: PaymentInput) {
    try {
      await this.prisma.paymentEventLog.create({ data: input });
    } catch (error) {
      console.warn("Payment log write failed", error);
    }
  }

  async listAudit(staff: AuthenticatedStaff, query: LogsQueryDto) {
    const { from, to } = this.resolveDateRange(query);
    const branchId = this.resolveBranchScope(staff, query.branchId);
    const where: Prisma.AuditLogWhereInput = {
      tenantId: staff.tenantId,
      ...(branchId ? { branchId } : {}),
      timestamp: { gte: from, lte: to },
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.actionCode ? { actionCode: query.actionCode } : {}),
    };

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: 200,
      include: {
        branch: { select: { id: true, name: true } },
        actorStaff: { select: { id: true, name: true, primaryRole: true } },
      },
    });
  }

  async listOperational(staff: AuthenticatedStaff, query: LogsQueryDto) {
    const { from, to } = this.resolveDateRange(query);
    const branchId = this.resolveBranchScope(staff, query.branchId);
    const where: Prisma.OperationalEventLogWhereInput = {
      tenantId: staff.tenantId,
      ...(branchId ? { branchId } : {}),
      createdAt: { gte: from, lte: to },
      ...(query.eventType ? { eventType: query.eventType } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
    };

    return this.prisma.operationalEventLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        branch: { select: { id: true, name: true } },
        actorStaff: { select: { id: true, name: true, primaryRole: true } },
      },
    });
  }

  async listPayments(staff: AuthenticatedStaff, query: LogsQueryDto) {
    const { from, to } = this.resolveDateRange(query);
    const branchId = this.resolveBranchScope(staff, query.branchId);
    const where: Prisma.PaymentEventLogWhereInput = {
      tenantId: staff.tenantId,
      ...(branchId ? { branchId } : {}),
      createdAt: { gte: from, lte: to },
      ...(query.eventType ? { eventType: query.eventType } : {}),
    };

    return this.prisma.paymentEventLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        branch: { select: { id: true, name: true } },
      },
    });
  }

  private resolveDateRange(query: LogsQueryDto) {
    const now = new Date();
    const from = query.from ? new Date(query.from) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : now;

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException("Invalid date range");
    }
    if (from > to) {
      throw new BadRequestException("from must be before or equal to to");
    }
    const rangeDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
    if (rangeDays > MAX_RANGE_DAYS) {
      throw new BadRequestException(`Date range cannot exceed ${MAX_RANGE_DAYS} days`);
    }

    return { from, to };
  }

  private resolveBranchScope(staff: AuthenticatedStaff, requestedBranchId?: string) {
    const canViewTenant =
      staff.primaryRole === StaffRoleCode.OWNER ||
      staff.primaryRole === StaffRoleCode.MANAGER ||
      staff.permissions.includes("admin:read");

    if (!canViewTenant) {
      if (requestedBranchId && requestedBranchId !== staff.branchId) {
        throw new ForbiddenException("Cannot view logs for another branch");
      }
      return staff.branchId;
    }

    return requestedBranchId;
  }
}
