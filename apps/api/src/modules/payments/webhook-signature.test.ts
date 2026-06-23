import assert from "node:assert/strict";
import crypto from "node:crypto";
import { BadRequestException } from "@nestjs/common";
import { StripePaymentGateway } from "./gateways/stripe.gateway.js";
import { MockPaymentGateway } from "./gateways/mock.gateway.js";
import { PaymentsController } from "./payments.controller.js";

function stripeSignature(payload: string, secret: string, timestamp = "1781197600") {
  const digest = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

function mockSignature(payload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

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

async function testStripeGatewaySignature() {
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";

  const payload = JSON.stringify({
    id: "evt_1",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_1",
        payment_status: "paid",
        amount_total: 2500,
        currency: "usd",
        metadata: { orderId: "order-1" },
      },
    },
  });
  const gateway = new StripePaymentGateway();

  assert.equal(gateway.verifyWebhookSignature(payload, stripeSignature(payload, "whsec_test_secret")), true);
  assert.equal(gateway.verifyWebhookSignature(payload, stripeSignature(payload, "wrong_secret")), false);
  assert.equal(gateway.verifyWebhookSignature(payload, "t=1781197600,v1=bad"), false);

  const event = gateway.parseWebhookEvent(payload);
  assert.equal(event.type, "payment.completed");
  assert.equal(event.externalId, "cs_test_1");
  assert.equal(event.amount, 2500);
  assert.equal(event.currency, "usd");

  if (originalSecret === undefined) {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  } else {
    process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
  }
}

async function testMockGatewaySignature() {
  const originalSecret = process.env.PAYMENT_WEBHOOK_SECRET;
  process.env.PAYMENT_WEBHOOK_SECRET = "mock_webhook_secret";

  const payload = JSON.stringify({
    type: "payment.completed",
    externalId: "mock_1",
    amount: 1500,
    currency: "USD",
  });
  const gateway = new MockPaymentGateway();

  assert.equal(gateway.verifyWebhookSignature(payload, "mock_webhook_secret"), true);
  assert.equal(gateway.verifyWebhookSignature(payload, mockSignature(payload, "mock_webhook_secret")), true);
  assert.equal(gateway.verifyWebhookSignature(payload, "bad"), false);

  if (originalSecret === undefined) {
    delete process.env.PAYMENT_WEBHOOK_SECRET;
  } else {
    process.env.PAYMENT_WEBHOOK_SECRET = originalSecret;
  }
}

async function testControllerRejectsBadSignature() {
  const controller = new PaymentsController({
    handleWebhookEvent: async () => ({ ok: true }),
  } as any);

  await expectRejectsWith(
    () => controller.handleWebhook(
      "mock",
      { body: { type: "payment.completed", externalId: "mock_1", amount: 1000, currency: "USD" } } as any,
      "invalid",
    ),
    BadRequestException,
  );

  await expectRejectsWith(
    () => controller.handleWebhook(
      "unknown",
      { body: "{}" } as any,
      "anything",
    ),
    BadRequestException,
  );
}

async function main() {
  await testStripeGatewaySignature();
  await testMockGatewaySignature();
  await testControllerRejectsBadSignature();
  console.log("webhook signature tests passed");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
