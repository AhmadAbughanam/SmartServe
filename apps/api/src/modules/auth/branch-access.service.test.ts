import "dotenv/config";
import assert from "node:assert/strict";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { BranchAccessService } from "./branch-access.service.js";
import type { AuthenticatedStaff } from "./types/auth.types.js";

const StaffRoleCode = {
  OWNER: "OWNER",
  MANAGER: "MANAGER",
  WAITER: "WAITER",
} as const;

type StaffRoleCode = (typeof StaffRoleCode)[keyof typeof StaffRoleCode];

function staff(role: StaffRoleCode, branchId = "branch-1"): AuthenticatedStaff {
  return {
    staffId: `${role.toLowerCase()}-1`,
    tenantId: "tenant-1",
    branchId,
    primaryRole: role,
    permissions: [],
  };
}

function serviceForBranch(branch: { id: string; tenantId: string; isActive?: boolean } | null) {
  return new BranchAccessService({
    branch: {
      findUnique: async () => branch,
    },
  } as any);
}

async function rejectsAs(fn: () => Promise<unknown>, errorClass: new (...args: any[]) => Error) {
  let thrown: unknown;
  try {
    await fn();
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown instanceof errorClass);
}

async function main() {
  await serviceForBranch({ id: "branch-1", tenantId: "tenant-1", isActive: true })
    .assertUserCanAccessBranch(staff(StaffRoleCode.WAITER), "branch-1");

  await rejectsAs(
    () => serviceForBranch({ id: "branch-2", tenantId: "tenant-1", isActive: true })
      .assertUserCanAccessBranch(staff(StaffRoleCode.WAITER), "branch-2"),
    ForbiddenException,
  );

  await serviceForBranch({ id: "branch-2", tenantId: "tenant-1", isActive: true })
    .assertUserCanAccessBranch(staff(StaffRoleCode.MANAGER), "branch-2");

  await serviceForBranch({ id: "branch-2", tenantId: "tenant-1", isActive: true })
    .assertUserCanAccessBranch(staff(StaffRoleCode.OWNER), "branch-2");

  await rejectsAs(
    () => serviceForBranch({ id: "branch-3", tenantId: "tenant-1", isActive: false })
      .assertUserCanAccessBranch(staff(StaffRoleCode.OWNER), "branch-3"),
    ForbiddenException,
  );

  await rejectsAs(
    () => serviceForBranch({ id: "branch-x", tenantId: "tenant-x", isActive: true })
      .assertUserCanAccessBranch(staff(StaffRoleCode.OWNER), "branch-x"),
    ForbiddenException,
  );

  await rejectsAs(
    () => serviceForBranch(null).assertUserCanAccessBranch(staff(StaffRoleCode.MANAGER), "missing"),
    NotFoundException,
  );

  const ownerService = serviceForBranch({ id: "branch-2", tenantId: "tenant-1", isActive: true });
  assert.equal(
    await ownerService.resolveOptionalBranchId(staff(StaffRoleCode.OWNER), undefined),
    undefined,
    "owner tenant-wide queries may omit branchId",
  );

  assert.equal(
    await serviceForBranch({ id: "branch-1", tenantId: "tenant-1", isActive: true })
      .resolveOptionalBranchId(staff(StaffRoleCode.WAITER), undefined),
    "branch-1",
    "branch staff default to their own branch",
  );

  await rejectsAs(
    () => serviceForBranch({ id: "branch-2", tenantId: "tenant-1", isActive: true })
      .resolveOptionalBranchId(staff(StaffRoleCode.WAITER), "branch-2"),
    ForbiddenException,
  );

  await serviceForBranch({ id: "branch-1", tenantId: "tenant-1", isActive: true })
    .assertUserCanAccessEntityBranch(staff(StaffRoleCode.WAITER), {
      tenantId: "tenant-1",
      branchId: "branch-1",
    });

  await rejectsAs(
    () => serviceForBranch({ id: "branch-x", tenantId: "tenant-x", isActive: true })
      .assertUserCanAccessEntityBranch(staff(StaffRoleCode.OWNER), {
        tenantId: "tenant-x",
        branchId: "branch-x",
      }),
    ForbiddenException,
  );

  console.log("Branch access service tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
