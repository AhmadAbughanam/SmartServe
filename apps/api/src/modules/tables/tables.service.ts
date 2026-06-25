import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { CreateTableDto, UpdateTableDto } from "./dto/index.js";

@Injectable()
export class TablesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findAllForBranch(branchId: string) {
    return this.prisma.table.findMany({
      where: { branchId },
      orderBy: { tableCode: "asc" },
    });
  }

  async findById(id: string) {
    return this.prisma.table.findUnique({
      where: { id },
    });
  }

  async create(createTableDto: CreateTableDto) {
    const { branchId, tableCode, capacity, zone } = createTableDto;
    return this.prisma.table.create({
      data: {
        branchId,
        tableCode,
        capacity,
        zone,
      },
    });
  }

  async update(tableId: string, updateTableDto: UpdateTableDto) {
    return this.prisma.table.update({
      where: { id: tableId },
      data: updateTableDto,
    });
  }

  async remove(tableId: string) {
    return this.prisma.table.delete({
      where: { id: tableId },
    });
  }
}
