import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class TableAccessService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolveCode(code: string) {
    const tag = await this.prisma.tableAccessTag.findUnique({
      where: { code },
      include: {
        table: true,
        branch: { select: { id: true, name: true, tenantId: true, location: true } },
      },
    });

    if (!tag || !tag.isActive) {
      const branch = await this.prisma.branch.findFirst({
        where: {
          isActive: true,
          OR: [
            { id: code },
            { name: { equals: code, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, location: true },
      });

      if (branch) {
        return {
          branchId: branch.id,
          tableId: null,
          tableCode: null,
          tagType: "BRANCH",
          branch: { name: branch.name, location: branch.location },
        };
      }

      throw new NotFoundException("Invalid or inactive access code");
    }

    return {
      branchId: tag.branchId,
      tableId: tag.tableId,
      tableCode: tag.table.tableCode,
      tagType: tag.type,
      branch: { name: tag.branch.name, location: tag.branch.location },
    };
  }

  async listBranchTables(branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, isActive: true },
      select: { id: true, name: true, location: true },
    });
    if (!branch) throw new NotFoundException("Branch not found");

    const tables = await this.prisma.table.findMany({
      where: { branchId },
      orderBy: { tableCode: "asc" },
      select: {
        id: true,
        tableCode: true,
        capacity: true,
        status: true,
        zone: true,
        locationDescription: true,
      },
    });

    return {
      branchId: branch.id,
      branch: { name: branch.name, location: branch.location },
      tables,
    };
  }
}
