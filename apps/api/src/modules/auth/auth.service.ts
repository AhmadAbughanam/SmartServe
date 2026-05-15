import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { verifyPassword } from "./password.util.js";
import { TokenService } from "./token.service.js";
import { LogsService } from "../logs/logs.service.js";
import type { AuthenticatedStaff } from "./types/auth.types.js";

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TokenService) private readonly tokenService: TokenService,
    @Inject(LogsService) private readonly logsService: LogsService,
  ) {}

  async staffLogin(email: string, password: string) {
    const staff = await this.prisma.staff.findFirst({
      where: { email, isActive: true },
      include: {
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

  async resolveStaff(staffId: string): Promise<AuthenticatedStaff> {
    const staff = await this.prisma.staff.findUniqueOrThrow({
      where: { id: staffId },
      include: {
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

    return {
      staffId: staff.id,
      tenantId: staff.tenantId,
      branchId: staff.branchId,
      primaryRole: staff.primaryRole,
      permissions: this.extractPermissions(staff.roleAssignments),
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
