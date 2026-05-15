import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { StaffRoleCode } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { AuthenticatedStaff } from "./types/auth.types.js";

const TENANT_WIDE_BRANCH_ROLES = new Set<StaffRoleCode>([
  StaffRoleCode.OWNER,
  StaffRoleCode.MANAGER,
]);

@Injectable()
export class BranchAccessService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  canAccessAnyTenantBranch(staff: AuthenticatedStaff): boolean {
    return TENANT_WIDE_BRANCH_ROLES.has(staff.primaryRole);
  }

  async resolveBranchId(
    staff: AuthenticatedStaff,
    requestedBranchId?: string | null,
  ): Promise<string> {
    const branchId = requestedBranchId || staff.branchId;
    await this.assertUserCanAccessBranch(staff, branchId);
    return branchId;
  }

  async resolveOptionalBranchId(
    staff: AuthenticatedStaff,
    requestedBranchId?: string | null,
  ): Promise<string | undefined> {
    if (!requestedBranchId && this.canAccessAnyTenantBranch(staff)) {
      return undefined;
    }
    return this.resolveBranchId(staff, requestedBranchId);
  }

  async assertUserCanAccessBranch(
    staff: AuthenticatedStaff,
    branchId: string | null | undefined,
  ): Promise<void> {
    if (!branchId) {
      throw new NotFoundException("Branch not found");
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, tenantId: true, isActive: true },
    });
    if (!branch) {
      throw new NotFoundException("Branch not found");
    }
    if (branch.tenantId !== staff.tenantId) {
      throw new ForbiddenException("Cannot access another tenant's branch");
    }
    if (!this.canAccessAnyTenantBranch(staff) && branch.id !== staff.branchId) {
      throw new ForbiddenException("Cannot access another branch");
    }
  }

  async assertUserCanAccessEntityBranch(
    staff: AuthenticatedStaff,
    entity: { tenantId: string; branchId: string | null },
  ): Promise<void> {
    if (entity.tenantId !== staff.tenantId) {
      throw new ForbiddenException("Cannot access another tenant's data");
    }
    await this.assertUserCanAccessBranch(staff, entity.branchId);
  }
}
