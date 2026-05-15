import { SetMetadata } from "@nestjs/common";
import type { StaffRoleCode } from "@prisma/client";

export const ROLES_KEY = "roles";

/** Restrict access to staff whose primaryRole is one of the listed roles. */
export const RequireRoles = (...roles: StaffRoleCode[]) =>
  SetMetadata(ROLES_KEY, roles);
