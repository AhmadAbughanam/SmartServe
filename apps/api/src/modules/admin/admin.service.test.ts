import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { StaffRoleCode } from "@prisma/client";
import { AdminService } from "./admin.service.js";

function createMockPrisma() {
  return {
    branch: {
      findFirst: async () => ({ id: "branch-1", tenantId: "tenant-1" }),
    },
    staff: {
      findFirst: async () => null,
      findUnique: async () => ({
        id: "staff-1",
        tenantId: "tenant-1",
        branchId: "branch-1",
        name: "Manager",
        isActive: true,
      }),
      create: async () => ({ id: "staff-2" }),
      update: async () => ({ id: "staff-1" }),
    },
    role: {
      findUnique: async () => ({
        id: "role-owner",
        tenantId: "tenant-1",
        roleName: "OWNER",
      }),
      create: async () => ({ id: "role-1" }),
    },
    staffRoleAssignment: {
      upsert: async () => ({}),
    },
    auditLog: {
      create: async () => ({}),
    },
  };
}

async function assertOwnerBlocked(action: () => Promise<unknown>) {
  await assert.rejects(
    action,
    (error) =>
      error instanceof BadRequestException &&
      error.message === "Owner accounts are provisioned by the SaaS operator" ||
      error instanceof BadRequestException &&
      error.message === "Owner roles are managed by the SaaS operator",
  );
}

async function run() {
  const service = new AdminService(createMockPrisma() as never);

  await assertOwnerBlocked(() =>
    service.createStaff("tenant-1", {
      branchId: "branch-1",
      name: "Second Owner",
      phone: "",
      email: "second-owner@example.com",
      primaryRole: StaffRoleCode.OWNER,
      password: "password1",
    }, "actor-1"),
  );

  await assertOwnerBlocked(() =>
    service.updateStaff("staff-1", "tenant-1", {
      primaryRole: StaffRoleCode.OWNER,
    }, "actor-1"),
  );

  await assertOwnerBlocked(() =>
    service.createRole("tenant-1", { roleName: "OWNER" }, "actor-1"),
  );

  await assertOwnerBlocked(() =>
    service.assignRole("staff-1", "role-owner", "tenant-1", "actor-1"),
  );

  console.log("AdminService owner provisioning guard tests passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
