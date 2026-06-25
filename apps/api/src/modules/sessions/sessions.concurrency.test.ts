import assert from "node:assert/strict";
import { ConflictException } from "@nestjs/common";
import { SessionStatus, TableStatus } from "@prisma/client";
import { SessionsService } from "./sessions.service.js";

async function main() {
  const service = new SessionsService(
    {
      table: {
        findUnique: async () => ({
          id: "table-1",
          status: TableStatus.AVAILABLE,
          branch: { tenantId: "tenant-1" },
        }),
        update: async () => undefined,
      },
      session: {
        findFirst: async () => null,
        create: async () => ({ id: "session-1" }),
      },
      $transaction: async () => {
        throw { code: "P2002" };
      },
    } as any,
    {
      enforceStartTableSession: async () => undefined,
    } as any,
  );

  await assert.rejects(
    () =>
      service.startSession({
        branchId: "branch-1",
        tableCode: "T1",
        guestCount: 2,
      }),
    ConflictException,
  );

  console.log("session concurrency tests passed");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
