import "dotenv/config";
import assert from "node:assert/strict";
import {
  ServiceRequestStatus,
  ServiceRequestType,
  SessionStatus,
  StaffRoleCode,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { RealtimeService } from "../realtime/realtime.service.js";
import { ServiceRequestsService } from "./service-requests.service.js";

const prisma = new PrismaService();
const realtime = new RealtimeService();
const logs = {
  writeOperational: async () => {},
};
const service = new ServiceRequestsService(prisma, realtime, logs as any);
const runId = `service-requests-${Date.now()}`;

const ids = {
  tenant: `${runId}-tenant`,
  branch: `${runId}-branch`,
  table: `${runId}-table`,
  session: `${runId}-session`,
  waiterOne: `${runId}-waiter-one`,
  waiterTwo: `${runId}-waiter-two`,
};

async function cleanup() {
  await prisma.operationalEventLog.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.serviceRequest.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.notification.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.session.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.table.deleteMany({ where: { branchId: ids.branch } });
  await prisma.staff.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.branch.deleteMany({ where: { id: ids.branch } });
  await prisma.tenant.deleteMany({ where: { id: ids.tenant } });
}

async function seed() {
  await prisma.tenant.create({
    data: { id: ids.tenant, name: "Service Request Ownership Tenant" },
  });
  await prisma.branch.create({
    data: {
      id: ids.branch,
      tenantId: ids.tenant,
      name: "Main",
      location: "Test",
    },
  });
  await prisma.staff.createMany({
    data: [
      staff(ids.waiterOne, "waiter-one@example.com"),
      staff(ids.waiterTwo, "waiter-two@example.com"),
    ],
  });
  await prisma.table.create({
    data: {
      id: ids.table,
      branchId: ids.branch,
      tableCode: "SR1",
      capacity: 2,
    },
  });
  await prisma.session.create({
    data: {
      id: ids.session,
      tenantId: ids.tenant,
      branchId: ids.branch,
      tableId: ids.table,
      guestCount: 2,
      status: SessionStatus.ACTIVE,
    },
  });
}

function staff(id: string, email: string) {
  return {
    id,
    tenantId: ids.tenant,
    branchId: ids.branch,
    name: id,
    phone: `+1555${Math.floor(Math.random() * 1_000_000)}`,
    email,
    primaryRole: StaffRoleCode.WAITER,
    passwordHash: "test",
  };
}

async function main() {
  await cleanup();
  await seed();

  const created = await service.create(
    ids.session,
    ServiceRequestType.CALL_WAITER,
  );
  assert.equal(created.status, ServiceRequestStatus.NEW);

  const waiterOneBeforeClaim = await service.listForBranch(
    ids.branch,
    ids.tenant,
    ids.waiterOne,
  );
  const waiterTwoBeforeClaim = await service.listForBranch(
    ids.branch,
    ids.tenant,
    ids.waiterTwo,
  );
  assert.equal(waiterOneBeforeClaim.some((req) => req.id === created.id), true);
  assert.equal(waiterTwoBeforeClaim.some((req) => req.id === created.id), true);

  const claimed = await service.claim(created.id, ids.tenant, ids.waiterOne);
  assert.equal(claimed.status, ServiceRequestStatus.CLAIMED);
  assert.equal(claimed.claimedByStaffId, ids.waiterOne);

  const waiterOneAfterClaim = await service.listForBranch(
    ids.branch,
    ids.tenant,
    ids.waiterOne,
  );
  const waiterTwoAfterClaim = await service.listForBranch(
    ids.branch,
    ids.tenant,
    ids.waiterTwo,
  );
  assert.equal(waiterOneAfterClaim.some((req) => req.id === created.id), true);
  assert.equal(waiterTwoAfterClaim.some((req) => req.id === created.id), false);

  await assert.rejects(
    () => service.claim(created.id, ids.tenant, ids.waiterTwo),
    /request is CLAIMED/,
  );
  await assert.rejects(
    () => service.complete(created.id, ids.tenant, ids.waiterTwo),
    /Only the claiming waiter/,
  );

  const completed = await service.complete(created.id, ids.tenant, ids.waiterOne);
  assert.equal(completed.status, ServiceRequestStatus.COMPLETED);

  console.log("Service request ownership checks passed");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
