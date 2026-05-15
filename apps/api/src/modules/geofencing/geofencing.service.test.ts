import "dotenv/config";
import assert from "node:assert/strict";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { SessionStatus, TableStatus } from "@prisma/client";
import { env } from "../../config/env.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { SessionsService } from "../sessions/sessions.service.js";
import { GeoFencingService } from "./geofencing.service.js";

const prisma = new PrismaService();
const logWrites: any[] = [];
const logs = {
  writeOperational: async (input: any) => {
    logWrites.push(input);
  },
};
const service = new GeoFencingService(prisma, logs as any);
const sessionsService = new SessionsService(prisma, service);
const runId = `geofence-${Date.now()}`;

const ids = {
  tenant: `${runId}-tenant`,
  otherTenant: `${runId}-other-tenant`,
  branch: `${runId}-branch`,
  disabledBranch: `${runId}-disabled-branch`,
  otherTenantBranch: `${runId}-other-tenant-branch`,
  table: `${runId}-table`,
};

async function cleanup() {
  await prisma.operationalEventLog.deleteMany({
    where: {
      OR: [
        { tenantId: ids.tenant },
        { tenantId: ids.otherTenant },
      ],
    },
  });
  await prisma.session.deleteMany({ where: { tenantId: ids.tenant } });
  await prisma.table.deleteMany({ where: { branchId: { in: [ids.branch, ids.disabledBranch] } } });
  await prisma.branch.deleteMany({
    where: { id: { in: [ids.branch, ids.disabledBranch, ids.otherTenantBranch] } },
  });
  await prisma.tenant.deleteMany({ where: { id: { in: [ids.tenant, ids.otherTenant] } } });
}

async function seed() {
  await prisma.tenant.createMany({
    data: [
      { id: ids.tenant, name: "Geo Tenant" },
      { id: ids.otherTenant, name: "Other Geo Tenant" },
    ],
  });
  await prisma.branch.createMany({
    data: [
      {
        id: ids.branch,
        tenantId: ids.tenant,
        name: "Main",
        location: "Test",
        latitude: 31.9539,
        longitude: 35.9106,
        geofenceRadiusM: 100,
        geofenceEnabled: true,
      },
      {
        id: ids.disabledBranch,
        tenantId: ids.tenant,
        name: "Disabled",
        location: "Test",
        latitude: 31.9539,
        longitude: 35.9106,
        geofenceRadiusM: 100,
        geofenceEnabled: false,
      },
      {
        id: ids.otherTenantBranch,
        tenantId: ids.otherTenant,
        name: "Other Tenant Branch",
        location: "Hidden",
        latitude: 40,
        longitude: 40,
        geofenceRadiusM: 50,
        geofenceEnabled: true,
      },
    ],
  });
  await prisma.table.create({
    data: {
      id: ids.table,
      branchId: ids.branch,
      tableCode: "G1",
      capacity: 2,
      status: TableStatus.AVAILABLE,
    },
  });
}

async function rejectsAs(fn: () => Promise<unknown>, errorClass: new (...args: any[]) => Error) {
  let thrown: unknown;
  try {
    await fn();
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown instanceof errorClass, `Expected ${errorClass.name}, got ${String(thrown)}`);
}

async function main() {
  await cleanup();
  await seed();

  const originalEnabled = env.geofencingEnabled;
  const originalBypass = env.geofencingDemoBypass;
  env.geofencingEnabled = true;
  env.geofencingDemoBypass = false;

  const disabled = await service.check({
    branchId: ids.disabledBranch,
    action: "START_TABLE_SESSION",
  });
  assert.equal(disabled.result, "SKIPPED");
  assert.equal(disabled.allowed, true);

  const missing = await service.check({
    branchId: ids.branch,
    action: "START_TABLE_SESSION",
  });
  assert.equal(missing.result, "DENIED");
  assert.equal(missing.allowed, false);
  assert.equal(missing.reason, "LOCATION_REQUIRED");

  const inside = await service.check({
    branchId: ids.branch,
    action: "START_TABLE_SESSION",
    location: { latitude: 31.95391, longitude: 35.91061, accuracyMeters: 20 },
  });
  assert.equal(inside.result, "ALLOWED");
  assert.equal(inside.allowed, true);
  assert.ok((inside.distanceMeters ?? 999) < 10);

  const outside = await service.check({
    branchId: ids.branch,
    action: "START_TABLE_SESSION",
    location: { latitude: 32.02, longitude: 35.95, accuracyMeters: 20 },
  });
  assert.equal(outside.result, "DENIED");
  assert.equal(outside.reason, "OUTSIDE_RADIUS");

  const invalid = await service.check({
    branchId: ids.branch,
    action: "START_TABLE_SESSION",
    location: { latitude: 91, longitude: 35.9106 },
  });
  assert.equal(invalid.result, "DENIED");
  assert.equal(invalid.reason, "INVALID_LOCATION");

  const lowAccuracy = await service.check({
    branchId: ids.branch,
    action: "START_TABLE_SESSION",
    location: { latitude: 31.95391, longitude: 35.91061, accuracyMeters: 5000 },
  });
  assert.equal(lowAccuracy.result, "UNAVAILABLE");
  assert.equal(lowAccuracy.reason, "LOW_ACCURACY");

  const otherTenant = await service.check({
    branchId: ids.otherTenantBranch,
    action: "START_TABLE_SESSION",
    location: { latitude: 40, longitude: 40, accuracyMeters: 5 },
  });
  assert.equal(otherTenant.allowed, true);
  assert.equal((otherTenant as any).tenantId, undefined);
  assert.equal((otherTenant as any).latitude, undefined);
  assert.equal((otherTenant as any).longitude, undefined);

  const serializedLogs = JSON.stringify(logWrites);
  assert.equal(serializedLogs.includes("latitude"), false);
  assert.equal(serializedLogs.includes("longitude"), false);
  assert.ok(serializedLogs.includes("distanceMeters"));
  assert.ok(serializedLogs.includes("radiusMeters"));

  await rejectsAs(
    () =>
      sessionsService.startSession({
        branchId: ids.branch,
        tableCode: "G1",
        guestCount: 2,
        enforceGeoFence: true,
      }),
    ForbiddenException,
  );
  const sessionAfterDenied = await prisma.session.findFirst({ where: { tableId: ids.table } });
  assert.equal(sessionAfterDenied, null);

  env.geofencingDemoBypass = true;
  const bypassed = await sessionsService.startSession({
    branchId: ids.branch,
    tableCode: "G1",
    guestCount: 2,
    enforceGeoFence: true,
  });
  assert.equal(bypassed.status, SessionStatus.ACTIVE);
  assert.equal(bypassed.branchId, ids.branch);

  await prisma.session.delete({ where: { id: bypassed.id } });
  await prisma.table.update({ where: { id: ids.table }, data: { status: TableStatus.AVAILABLE, lastSessionId: null } });
  env.geofencingDemoBypass = false;

  const allowedSession = await sessionsService.startSession({
    branchId: ids.branch,
    tableCode: "G1",
    guestCount: 2,
    enforceGeoFence: true,
    location: { latitude: 31.95391, longitude: 35.91061, accuracyMeters: 20 },
  });
  assert.equal(allowedSession.status, SessionStatus.ACTIVE);

  env.geofencingEnabled = originalEnabled;
  env.geofencingDemoBypass = originalBypass;

  await cleanup();
  await prisma.$disconnect();
  console.log("Geofencing tests passed");
}

main().catch(async (error) => {
  console.error(error);
  env.geofencingDemoBypass = false;
  await cleanup().catch(() => undefined);
  await prisma.$disconnect();
  process.exit(1);
});
