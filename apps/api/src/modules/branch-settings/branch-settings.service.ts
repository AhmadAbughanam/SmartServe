import { Injectable, Inject } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { ServiceChargeType, Prisma } from "@prisma/client";

@Injectable()
export class BranchSettingsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getByBranch(tenantId: string, branchId: string) {
    return this.prisma.branchSettings.findFirst({
      where: { branchId, tenantId },
    });
  }

  async upsert(
    tenantId: string,
    branchId: string,
    data: {
      serviceChargeEnabled?: boolean;
      serviceChargeType?: ServiceChargeType;
      serviceChargeValue?: number;
      tipsEnabled?: boolean;
      tipPresetsJson?: Prisma.InputJsonValue;
      paymentConfigJson?: Prisma.InputJsonValue;
      featureFlagsJson?: Prisma.InputJsonValue;
      aiConfigJson?: Prisma.InputJsonValue;
    },
  ) {
    return this.prisma.branchSettings.upsert({
      where: { branchId },
      update: data,
      create: { branchId, tenantId, ...data },
    });
  }
}
