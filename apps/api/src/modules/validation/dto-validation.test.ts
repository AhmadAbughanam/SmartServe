import "reflect-metadata";
import assert from "node:assert/strict";
import { BadRequestException, ValidationPipe, type ArgumentMetadata } from "@nestjs/common";
import { OrderStatus, PaymentMethod, SplitType } from "@prisma/client";
import { CreateOrderDto } from "../orders/dto/create-order.dto.js";
import { CreatePaymentIntentDto } from "../payments/dto/create-payment-intent.dto.js";
import { SplitPaymentRequestDto } from "../payments/dto/split-payment.dto.js";
import { CreateInventoryItemDto } from "../inventory/dto/inventory.dto.js";
import { UpdateOrderStatusDto } from "../orders/dto/update-order-status.dto.js";
import { DemandForecastQueryDto } from "../demand-forecasting/dto/demand-forecast-query.dto.js";

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

async function transform<T>(value: unknown, metatype: new () => T, type: ArgumentMetadata["type"] = "body") {
  return pipe.transform(value, { type, metatype, data: undefined }) as Promise<T>;
}

async function rejectsValidation(fn: () => Promise<unknown>) {
  let thrown: unknown;
  try {
    await fn();
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown instanceof BadRequestException, `Expected BadRequestException, got ${String(thrown)}`);
}

async function main() {
  await rejectsValidation(() => transform({
    tenantId: "attacker-tenant",
    branchId: "attacker-branch",
    source: "POS_DASHBOARD",
    status: "SERVED",
    paymentStatus: "PAID",
    total: 0.01,
    items: [{ menuItemId: "item-1", quantity: 1 }],
  }, CreateOrderDto));

  await rejectsValidation(() => transform({
    items: [{ menuItemId: "item-1", quantity: 0 }],
  }, CreateOrderDto));

  const order = await transform({
    items: [{ menuItemId: "item-1", quantity: "2", additions: [{ additionId: "add-1" }] }],
    idempotencyKey: "idem-1",
  }, CreateOrderDto);
  assert.equal(order.items[0]?.quantity, 2);
  assert.equal(typeof order.items[0]?.quantity, "number");

  await rejectsValidation(() => transform({
    paymentMethod: PaymentMethod.CARD,
    amount: 1,
    tenantId: "attacker-tenant",
    paymentStatus: "COMPLETED",
  }, CreatePaymentIntentDto));

  await rejectsValidation(() => transform({
    paymentMethod: "BITCOIN",
  }, CreatePaymentIntentDto));

  const split = await transform({
    splitType: SplitType.BY_PEOPLE,
    count: "3",
  }, SplitPaymentRequestDto);
  assert.equal(split.count, 3);
  assert.equal(typeof split.count, "number");

  await rejectsValidation(() => transform({
    splitType: SplitType.BY_PEOPLE,
    count: 1,
  }, SplitPaymentRequestDto));

  await rejectsValidation(() => transform({
    branchId: "branch-1",
    name: "Tomatoes",
    unit: "kg",
    currentStock: -1,
    reorderLevel: 0,
  }, CreateInventoryItemDto));

  await rejectsValidation(() => transform({
    status: "DELIVERED",
  }, UpdateOrderStatusDto));

  const status = await transform({ status: OrderStatus.CONFIRMED }, UpdateOrderStatusDto);
  assert.equal(status.status, OrderStatus.CONFIRMED);

  const query = await transform({
    branchId: "branch-1",
    date: "2026-05-11",
    lookbackDays: "30",
    weatherAdjustment: "1.25",
  }, DemandForecastQueryDto, "query");
  assert.equal(query.lookbackDays, 30);
  assert.equal(typeof query.lookbackDays, "number");
  assert.equal(query.weatherAdjustment, 1.25);

  console.log("DTO validation hardening tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
