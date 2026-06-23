import type { GlobalRole, StaffRoleCode } from "@prisma/client";

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

// ── SaaS owner ────────────────────────────────────────

/** Payload encoded inside a global SaaS owner JWT access token. */
export interface SaasOwnerJwtPayload {
  sub: string;
  email: string;
  globalRole: GlobalRole;
  type: "saas";
  iat?: number;
  exp?: number;
}

/** Resolved identity attached to authenticated SaaS owner requests. */
export interface AuthenticatedSaasOwner {
  userId: string;
  name: string;
  email: string;
  phone: string;
  globalRole: GlobalRole;
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
  globalRole?: GlobalRole | null;
}

// ── Union ──────────────────────────────────────────────

export type JwtPayload = StaffJwtPayload | CustomerJwtPayload | SaasOwnerJwtPayload;
