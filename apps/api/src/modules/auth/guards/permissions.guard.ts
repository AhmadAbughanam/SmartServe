import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { StaffRoleCode } from "@prisma/client";
import { ROLES_KEY } from "../decorators/require-roles.decorator.js";
import { PERMISSIONS_KEY } from "../decorators/require-permissions.decorator.js";
import type { AuthenticatedStaff } from "../types/auth.types.js";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      StaffRoleCode[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    const requiredPermissions = this.reflector.getAllAndOverride<
      string[] | undefined
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    // No role or permission requirement — allow through.
    if (!requiredRoles?.length && !requiredPermissions?.length) return true;

    const request = context.switchToHttp().getRequest();
    const staff: AuthenticatedStaff | undefined = request.staff;
    if (!staff) {
      throw new ForbiddenException("No authenticated staff context");
    }

    if (requiredRoles?.length) {
      if (!requiredRoles.includes(staff.primaryRole)) {
        throw new ForbiddenException("Insufficient role");
      }
    }

    if (requiredPermissions?.length) {
      const hasAll = requiredPermissions.every((p) =>
        staff.permissions.includes(p),
      );
      if (!hasAll) {
        throw new ForbiddenException("Insufficient permissions");
      }
    }

    return true;
  }
}
