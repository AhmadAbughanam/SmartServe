import assert from "node:assert/strict";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { RealtimeService } from "../realtime/realtime.service.js";
import { RealtimeController } from "../realtime/realtime.controller.js";
import { assertProductionPublicUrl } from "../../config/env.js";
import { CSRF_COOKIE } from "../auth/cookie.util.js";
import { CsrfGuard } from "../auth/guards/csrf.guard.js";
import { createCsrfToken, verifyCsrfToken } from "../auth/csrf.util.js";

async function expectRejectsWith(
  action: () => Promise<unknown>,
  errorType: new (...args: any[]) => Error,
) {
  let thrown: unknown;
  try {
    await action();
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof errorType);
}

async function testProductionUrlValidation() {
  assert.doesNotThrow(() => assertProductionPublicUrl("FRONTEND_ORIGIN", "https://restaurant.example"));
  assert.doesNotThrow(() => assertProductionPublicUrl("FRONTEND_ORIGIN", "http://localhost"));
  assert.throws(
    () => assertProductionPublicUrl("FRONTEND_ORIGIN", "http://restaurant.example"),
    /must use https/,
  );
  assert.throws(
    () => assertProductionPublicUrl("CORS_ORIGINS", "*"),
    /explicit https/,
  );
  assert.throws(
    () => assertProductionPublicUrl("CORS_ORIGINS", "https://restaurant.example/api"),
    /origin only/,
  );
}

async function testBranchSseAuth() {
  const realtime = new RealtimeService();
  const tokenService = {
    verifyAccessToken: (token: string) => {
      if (token === "staff-token") {
        return {
          sub: "staff-1",
          tenantId: "tenant-1",
          branchId: "branch-1",
          role: "CHEF",
          type: "staff",
        };
      }
      if (token === "customer-token") {
        return { sub: "user-1", phone: "+100000", type: "customer" };
      }
      throw new Error("bad token");
    },
  };
  const authService = {
    resolveStaff: async () => ({
      staffId: "staff-1",
      tenantId: "tenant-1",
      branchId: "branch-1",
      primaryRole: "CHEF",
      permissions: ["kds:read"],
    }),
  };
  const branchAccess = {
    assertUserCanAccessBranch: async (_staff: unknown, branchId: string) => {
      if (branchId !== "branch-1") {
        throw new ForbiddenException("Cross-branch access denied");
      }
    },
  };
  const controller = new RealtimeController(
    realtime,
    tokenService as any,
    authService as any,
    branchAccess as any,
  );

  await expectRejectsWith(
    () => controller.branchEvents("branch-1", { query: {}, cookies: {}, headers: {} } as any),
    UnauthorizedException,
  );

  await expectRejectsWith(
    () => controller.branchEvents("branch-1", { query: {}, cookies: { sro_access: "customer-token" }, headers: {} } as any),
    UnauthorizedException,
  );

  await expectRejectsWith(
    () => controller.branchEvents("branch-2", { query: {}, cookies: { sro_access: "staff-token" }, headers: {} } as any),
    ForbiddenException,
  );

  const stream = await controller.branchEvents("branch-1", {
    query: {},
    cookies: { sro_access: "staff-token" },
    headers: {},
  } as any);
  assert.equal(typeof stream.subscribe, "function");

  await expectRejectsWith(
    () => controller.branchEvents("branch-1", { query: { token: "staff-token" }, cookies: {}, headers: {} } as any),
    UnauthorizedException,
  );
}

function mockContext(request: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

async function testCsrfGuard() {
  const guard = new CsrfGuard();
  const token = createCsrfToken();

  assert.equal(verifyCsrfToken(token), true);
  assert.equal(verifyCsrfToken(`${token}x`), false);

  assert.equal(
    guard.canActivate(mockContext({
      method: "GET",
      path: "/api/admin/staff",
      headers: {},
      cookies: { sro_access: "access-token" },
    })),
    true,
  );

  assert.equal(
    guard.canActivate(mockContext({
      method: "POST",
      path: "/api/admin/staff",
      headers: { authorization: "Bearer api-client-token" },
      cookies: {},
    })),
    true,
  );

  assert.equal(
    guard.canActivate(mockContext({
      method: "POST",
      path: "/api/sessions/start",
      headers: {},
      cookies: {},
    })),
    true,
  );

  assert.equal(
    guard.canActivate(mockContext({
      method: "POST",
      path: "/api/payments/webhook/stripe",
      headers: {},
      cookies: { sro_access: "access-token" },
    })),
    true,
  );

  assert.equal(
    guard.canActivate(mockContext({
      method: "POST",
      path: "/api/auth/customer/refresh",
      headers: {},
      cookies: { sro_refresh: "refresh-token" },
    })),
    true,
  );

  assert.throws(
    () => guard.canActivate(mockContext({
      method: "POST",
      path: "/api/admin/staff",
      headers: {},
      cookies: { sro_access: "access-token" },
    })),
    ForbiddenException,
  );

  assert.throws(
    () => guard.canActivate(mockContext({
      method: "PATCH",
      path: "/api/menu/items/item-1",
      headers: { "x-csrf-token": "bad-token" },
      cookies: { sro_access: "access-token", [CSRF_COOKIE]: token },
    })),
    ForbiddenException,
  );

  assert.equal(
    guard.canActivate(mockContext({
      method: "PATCH",
      path: "/api/menu/items/item-1",
      headers: { "x-csrf-token": token },
      cookies: { sro_access: "access-token", [CSRF_COOKIE]: token },
    })),
    true,
  );
}

async function main() {
  await testProductionUrlValidation();
  await testBranchSseAuth();
  await testCsrfGuard();
  console.log("security-hardening tests passed");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
