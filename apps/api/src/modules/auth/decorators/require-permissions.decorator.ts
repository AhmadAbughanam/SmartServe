import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "permissions";

/** Restrict access to staff who hold ALL of the listed permission codes. */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
