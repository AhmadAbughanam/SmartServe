"use client";

const TOKEN_KEY = "staff_token";
const BRANCH_KEY = "staff_branch_id";
const NAME_KEY = "staff_name";
const ROLE_KEY = "staff_role";
const TENANT_KEY = "staff_tenant_id";
const PERMISSIONS_KEY = "staff_permissions";
const SELECTED_BRANCH_KEY = "admin_selected_branch";
const AUTH_HINT_KEY = "staff_cookie_auth";
const COOKIE_AUTH_SENTINEL = "__cookie_auth__";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export type StaffAuthScope = "default" | "waiter" | "kitchen";

function scopedKey(key: string, scope: StaffAuthScope = "default"): string {
  return scope === "default" ? key : `${scope}_${key}`;
}

export function hasStaffSession(scope: StaffAuthScope = "default"): boolean {
  if (typeof window === "undefined") return false;
  const legacyToken = localStorage.getItem(scopedKey(TOKEN_KEY, scope));
  if (legacyToken && legacyToken !== COOKIE_AUTH_SENTINEL) {
    localStorage.removeItem(scopedKey(TOKEN_KEY, scope));
    localStorage.setItem(scopedKey(AUTH_HINT_KEY, scope), "1");
    return true;
  }
  return Boolean(
    localStorage.getItem(scopedKey(AUTH_HINT_KEY, scope)) === "1" ||
    localStorage.getItem(scopedKey(BRANCH_KEY, scope)) ||
    localStorage.getItem(scopedKey(NAME_KEY, scope)) ||
    localStorage.getItem(scopedKey(ROLE_KEY, scope))
  );
}

/**
 * Browser compatibility helper for existing API helpers.
 * Browser pages should treat this as a cookie-session sentinel, not a real token.
 */
export function getStaffToken(scope: StaffAuthScope = "default"): string | null {
  return hasStaffSession(scope) ? COOKIE_AUTH_SENTINEL : null;
}

export function setStaffToken(_token: string, scope: StaffAuthScope = "default"): void {
  localStorage.removeItem(scopedKey(TOKEN_KEY, scope));
  localStorage.setItem(scopedKey(AUTH_HINT_KEY, scope), "1");
}

export function clearStaffToken(scope: StaffAuthScope = "default"): void {
  fetch(`${API_BASE}/api/auth/staff/logout`, {
    method: "POST",
    credentials: "include",
    keepalive: true,
  }).catch(() => {});
  localStorage.removeItem(scopedKey(TOKEN_KEY, scope));
  localStorage.removeItem(scopedKey(AUTH_HINT_KEY, scope));
  localStorage.removeItem(scopedKey(BRANCH_KEY, scope));
  localStorage.removeItem(scopedKey(NAME_KEY, scope));
  localStorage.removeItem(scopedKey(ROLE_KEY, scope));
  localStorage.removeItem(scopedKey(TENANT_KEY, scope));
  localStorage.removeItem(scopedKey(PERMISSIONS_KEY, scope));
}

export function getStaffBranchId(scope: StaffAuthScope = "default"): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(scopedKey(BRANCH_KEY, scope));
}

export function setStaffBranchId(branchId: string, scope: StaffAuthScope = "default"): void {
  localStorage.setItem(scopedKey(BRANCH_KEY, scope), branchId);
}

export function getStaffName(scope: StaffAuthScope = "default"): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(scopedKey(NAME_KEY, scope));
}

export function setStaffName(name: string, scope: StaffAuthScope = "default"): void {
  localStorage.setItem(scopedKey(NAME_KEY, scope), name);
}

export function getStaffRole(scope: StaffAuthScope = "default"): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(scopedKey(ROLE_KEY, scope));
}

export function setStaffRole(role: string, scope: StaffAuthScope = "default"): void {
  localStorage.setItem(scopedKey(ROLE_KEY, scope), role);
}

export function getStaffPermissions(scope: StaffAuthScope = "default"): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(scopedKey(PERMISSIONS_KEY, scope));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setStaffPermissions(permissions: string[], scope: StaffAuthScope = "default"): void {
  localStorage.setItem(scopedKey(PERMISSIONS_KEY, scope), JSON.stringify(permissions));
}

export function getStaffTenantId(scope: StaffAuthScope = "default"): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(scopedKey(TENANT_KEY, scope));
}

export function setStaffTenantId(tenantId: string, scope: StaffAuthScope = "default"): void {
  localStorage.setItem(scopedKey(TENANT_KEY, scope), tenantId);
}

/** Get admin-selected branch (may differ from login branch for owners) */
export function getSelectedBranchId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SELECTED_BRANCH_KEY) || localStorage.getItem(BRANCH_KEY);
}

export function setSelectedBranchId(branchId: string): void {
  localStorage.setItem(SELECTED_BRANCH_KEY, branchId);
}
