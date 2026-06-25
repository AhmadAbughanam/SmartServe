import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import { BadRequestException } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { StripePaymentGateway } from "./gateways/stripe.gateway.js";
import { MockPaymentGateway } from "./gateways/mock.gateway.js";
import { PaymentsController } from "./payments.controller.js";
import { PaymentsService } from "./payments.service.js";

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
      undefined,
      "invalid",
    ),
    BadRequestException,
  );

  await expectRejectsWith(
    () => controller.handleWebhook(
      "unknown",
      { body: "{}" } as any,
      undefined,
      "anything",
    ),
    BadRequestException,
  );
}

async function httpRequest(input: {
  port: number;
  path: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}) {
  return await new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: input.port,
        path: input.path,
        method: input.method,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(input.body).toString(),
          ...input.headers,
        },
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            body: data,
          });
        });
      },
    );
    req.on("error", reject);
    req.write(input.body);
    req.end();
  });
}

async function testHttpWebhookUsesRawBody() {
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_http_test";

  @Module({
    controllers: [PaymentsController],
    providers: [
      {
        provide: PaymentsService,
        useValue: {
          handleWebhookEvent: async (event: unknown) => ({ ok: true, event }),
        },
      },
    ],
  })
  class TestModule {}

  const app = await NestFactory.create(TestModule, { rawBody: true, logger: false });
  app.setGlobalPrefix("api");
  await app.init();
  await app.listen(0, "127.0.0.1");

  try {
    const address = app.getHttpServer().address();
    const port = typeof address === "object" && address ? address.port : 0;

    const rawPayload = '{\n  "id": "evt_http_1",\n  "type": "checkout.session.completed",\n  "data": {\n    "object": {\n      "id": "cs_http_1",\n      "payment_status": "paid",\n      "amount_total": 2500,\n      "currency": "usd",\n      "metadata": {\n        "orderId": "order-1",\n        "note": "A  B"\n      }\n    }\n  }\n}';
    const signature = stripeSignature(rawPayload, "whsec_http_test");

    const ok = await httpRequest({
      port,
      path: "/api/payments/webhook/stripe",
      method: "POST",
      headers: { "stripe-signature": signature },
      body: rawPayload,
    });
    assert.equal(ok.statusCode, 201);

    const mutatedPayload = JSON.stringify(JSON.parse(rawPayload));
    assert.notEqual(mutatedPayload, rawPayload);
    const bad = await httpRequest({
      port,
      path: "/api/payments/webhook/stripe",
      method: "POST",
      headers: { "stripe-signature": stripeSignature(mutatedPayload, "whsec_http_test") },
      body: rawPayload,
    });
    assert.equal(bad.statusCode, 400);
  } finally {
    await app.close();
    if (originalSecret === undefined) {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    } else {
      process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
    }
  }
}

async function main() {
  await testStripeGatewaySignature();
  await testMockGatewaySignature();
  await testControllerRejectsBadSignature();
  await testHttpWebhookUsesRawBody();
  console.log("webhook signature tests passed");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
