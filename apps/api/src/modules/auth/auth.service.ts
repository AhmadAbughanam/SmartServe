import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { GlobalRole } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { verifyPassword } from "./password.util.js";
import { TokenService } from "./token.service.js";
import { LogsService } from "../logs/logs.service.js";
import type { AuthenticatedSaasOwner, AuthenticatedStaff } from "./types/auth.types.js";

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(LogsService) private readonly logsService: LogsService,
  ) {}

  async staffLogin(email: string, password: string) {
    const matchingStaff = await this.prisma.staff.findMany({
      where: { email },
      include: {
        branch: {
          select: {
            id: true,
            isActive: true,
            tenant: { select: { id: true, isActive: true } },
          },
        },
        roleAssignments: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    const eligibleStaff = matchingStaff.filter(
      (staff) => staff.isActive && staff.branch.isActive && staff.branch.tenant.isActive,
    );

    if (eligibleStaff.length > 1) {
      throw new UnauthorizedException("Login requires a unique active work email");
    }

    const staff = eligibleStaff[0];
    if (!staff) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const passwordValid = await verifyPassword(password, staff.passwordHash);
    if (!passwordValid) {
      void this.logsService.writeOperational({
        tenantId: staff.tenantId,
        branchId: staff.branchId,
        actorStaffId: staff.id,
        eventType: "STAFF_LOGIN_FAILED",
        severity: "WARN",
        message: `Failed login attempt for ${staff.email}`,
        metadata: { email: staff.email },
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    const permissions = this.extractPermissions(staff.roleAssignments);

    const accessToken = this.tokenService.signStaffAccessToken({
      sub: staff.id,
      tenantId: staff.tenantId,
      branchId: staff.branchId,
      role: staff.primaryRole,
      type: "staff",
    });
    void this.logsService.writeOperational({
      tenantId: staff.tenantId,
      branchId: staff.branchId,
      actorStaffId: staff.id,
      eventType: "STAFF_LOGIN_SUCCEEDED",
      message: `${staff.name} signed in`,
      metadata: {
        role: staff.primaryRole,
        email: staff.email,
      },
    });

    return {
      accessToken,
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        tenantId: staff.tenantId,
        branchId: staff.branchId,
        primaryRole: staff.primaryRole,
        permissions,
      },
    };
  }

  async saasOwnerLogin(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, globalRole: GlobalRole.SAAS_OWNER, isBlocked: false },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const accessToken = this.tokenService.signSaasOwnerAccessToken({
      sub: user.id,
      email: user.email ?? email,
      globalRole: GlobalRole.SAAS_OWNER,
      type: "saas",
    });

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        globalRole: user.globalRole,
      },
    };
  }

  async resolveStaff(staffId: string): Promise<AuthenticatedStaff> {
    const staff = await this.prisma.staff.findUniqueOrThrow({
      where: { id: staffId },
      include: {
        branch: {
          select: {
            id: true,
            isActive: true,
            tenant: { select: { id: true, isActive: true } },
          },
        },
        roleAssignments: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!staff.isActive || !staff.branch.isActive || !staff.branch.tenant.isActive) {
      throw new UnauthorizedException("Staff account is inactive");
    }

    return {
      staffId: staff.id,
      tenantId: staff.tenantId,
      branchId: staff.branchId,
      primaryRole: staff.primaryRole,
      permissions: this.extractPermissions(staff.roleAssignments),
    };
  }

  async resolveSaasOwner(userId: string): Promise<AuthenticatedSaasOwner> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (user.globalRole !== GlobalRole.SAAS_OWNER || user.isBlocked || !user.email) {
      throw new UnauthorizedException("Invalid SaaS owner account");
    }

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      globalRole: user.globalRole,
    };
  }

  private extractPermissions(
    roleAssignments: Array<{
      role: {
        permissions: Array<{ permission: { code: string } }>;
      };
    }>,
  ): string[] {
    const codes = new Set<string>();
    for (const ra of roleAssignments) {
      for (const rp of ra.role.permissions) {
        codes.add(rp.permission.code);
      }
    }
    return [...codes];
  }
}
