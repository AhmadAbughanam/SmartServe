import assert from "node:assert/strict";
import { BadGatewayException } from "@nestjs/common";
import { env } from "../../config/env.js";
import { CustomerAuthService } from "./customer-auth.service.js";
import { SmsService } from "./sms.service.js";
import { MetricsService } from "../metrics/metrics.service.js";

async function testSmsNoop() {
  const originalProvider = env.smsProvider;
  env.smsProvider = "noop";
  const service = new SmsService(new MetricsService());

  await service.send({
    to: "+15550001111",
    purpose: "CUSTOMER_OTP",
    body: "Your code is 123456",
  });

  env.smsProvider = originalProvider;
}

async function testTwilioSend() {
  const original = {
    provider: env.smsProvider,
    sid: env.twilioAccountSid,
    token: env.twilioAuthToken,
    from: env.twilioFromNumber,
    fetch: globalThis.fetch,
  };
  env.smsProvider = "twilio";
  env.twilioAccountSid = "AC_test_account";
  env.twilioAuthToken = "test_auth_token";
  env.twilioFromNumber = "+15550000000";

  let calledUrl = "";
  let calledBody = "";
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calledUrl = String(url);
    calledBody = String(init?.body ?? "");
    return new Response("{}", { status: 201 });
  }) as typeof fetch;

  const service = new SmsService(new MetricsService());
  await service.send({
    to: "+15550001111",
    purpose: "CUSTOMER_OTP",
    body: "Your Smart Restaurant verification code is 123456.",
  });

  assert.match(calledUrl, /AC_test_account\/Messages\.json$/);
  assert.match(calledBody, /To=%2B15550001111/);
  assert.match(calledBody, /From=%2B15550000000/);
  env.smsProvider = original.provider;
  env.twilioAccountSid = original.sid;
  env.twilioAuthToken = original.token;
  env.twilioFromNumber = original.from;
  globalThis.fetch = original.fetch;
}

async function testTwilioFailure() {
  const original = {
    provider: env.smsProvider,
    sid: env.twilioAccountSid,
    token: env.twilioAuthToken,
    from: env.twilioFromNumber,
    fetch: globalThis.fetch,
  };
  env.smsProvider = "twilio";
  env.twilioAccountSid = "AC_test_account";
  env.twilioAuthToken = "test_auth_token";
  env.twilioFromNumber = "+15550000000";
  globalThis.fetch = (async () => new Response("bad", { status: 500 })) as typeof fetch;

  const service = new SmsService(new MetricsService());
  await assert.rejects(
    () => service.send({ to: "+15550001111", purpose: "CUSTOMER_OTP", body: "code" }),
    BadGatewayException,
  );

  env.smsProvider = original.provider;
  env.twilioAccountSid = original.sid;
  env.twilioAuthToken = original.token;
  env.twilioFromNumber = original.from;
  globalThis.fetch = original.fetch;
}

async function testCustomerOtpSendsSms() {
  let sentBody = "";
  const prisma = {
    otpRequest: {
      create: async (input: unknown) => input,
    },
  };
  const sms = {
    send: async (input: { body: string }) => {
      sentBody = input.body;
    },
  };
  const service = new CustomerAuthService(prisma as any, {} as any, sms as any, new MetricsService());
  const result = await service.requestOtp("+15550001111");

  assert.equal(result.message, "OTP sent");
  assert.equal(result.expiresInSeconds, 300);
  assert.match(sentBody, /verification code is \d{6}/);
}

async function main() {
  await testSmsNoop();
  await testTwilioSend();
  await testTwilioFailure();
  await testCustomerOtpSendsSms();
  console.log("otp sms tests passed");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
