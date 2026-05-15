import assert from "node:assert/strict";
import { StaffRoleCode } from "@prisma/client";
import { PERMISSIONS_KEY } from "../auth/decorators/require-permissions.decorator.js";
import { WaiterController } from "./waiter.controller.js";

const cashPermissions = Reflect.getMetadata(
  PERMISSIONS_KEY,
  WaiterController.prototype.confirmCash,
) as string[] | undefined;
const terminalPermissions = Reflect.getMetadata(
  PERMISSIONS_KEY,
  WaiterController.prototype.confirmTerminal,
) as string[] | undefined;

assert.deepEqual(cashPermissions, ["payments:write"]);
assert.deepEqual(terminalPermissions, ["payments:write"]);

assert.equal(StaffRoleCode.WAITER, "WAITER");

console.log("Waiter payment route permission metadata checks passed");
