import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { TableStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { BranchAccessService } from "../auth/branch-access.service.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";
import { isValidTransition } from "./table-status.rules.js";

@Injectable()
export class TablesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BranchAccessService)
    private readonly branchAccess: BranchAccessService,
  ) {}

  async listByBranch(branchId: string, staff: AuthenticatedStaff) {
    await this.branchAccess.assertUserCanAccessBranch(staff, branchId);

    return this.prisma.table.findMany({
      where: { branchId, branch: { tenantId: staff.tenantId } },
      orderBy: { tableCode: "asc" },
      include: {
        lastSession: {
          select: { id: true, status: true, guestCount: true, startTime: true },
        },
      },
    });
  }

  async getById(tableId: string, staff: AuthenticatedStaff) {
    const table = await this.prisma.table.findUnique({
      where: { id: tableId },
      include: {
        branch: { select: { id: true, tenantId: true, name: true } },
        lastSession: {
          select: { id: true, status: true, guestCount: true, startTime: true },
        },
      },
    });

    if (!table || table.branch.tenantId !== staff.tenantId) {
      throw new NotFoundException("Table not found");
    }
    await this.branchAccess.assertUserCanAccessBranch(staff, table.branchId);

    return table;
  }

  async updateStatus(
    tableId: string,
    newStatus: TableStatus,
    staff: AuthenticatedStaff,
  ) {
    const table = await this.prisma.table.findUnique({
      where: { id: tableId },
      include: { branch: { select: { tenantId: true } } },
    });

    if (!table || table.branch.tenantId !== staff.tenantId) {
      throw new NotFoundException("Table not found");
    }
    await this.branchAccess.assertUserCanAccessBranch(staff, table.branchId);

    if (!isValidTransition(table.status, newStatus)) {
      throw new BadRequestException(
        `Cannot transition table from ${table.status} to ${newStatus}`,
      );
    }

    return this.prisma.table.update({
      where: { id: tableId },
      data: { status: newStatus },
    });
  }
}
