import type { StaffRoleCode } from "@prisma/client";

// ── Staff ──────────────────────────────────────────────

/** Payload encoded inside a staff JWT access token. */
export interface StaffJwtPayload {
  sub: string;
  tenantId: string;
  branchId: string;
  role: StaffRoleCode;
  type: "staff";
  iat?: number;
  exp?: number;
}

/** Resolved identity attached to every authenticated staff request. */
export interface AuthenticatedStaff {
  staffId: string;
  tenantId: string;
  branchId: string;
  primaryRole: StaffRoleCode;
  permissions: string[];
}

// ── Customer ───────────────────────────────────────────

/** Payload encoded inside a customer JWT access token. */
export interface CustomerJwtPayload {
  sub: string;
  phone: string;
  type: "customer";
  iat?: number;
  exp?: number;
}

/** Resolved identity attached to every authenticated customer request. */
export interface AuthenticatedCustomer {
  userId: string;
  phone: string;
  name: string;
}

// ── Union ──────────────────────────────────────────────

export type JwtPayload = StaffJwtPayload | CustomerJwtPayload;
