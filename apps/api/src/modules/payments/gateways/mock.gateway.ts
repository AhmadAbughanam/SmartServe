import crypto from "node:crypto";
import type {
  PaymentGateway,
  PaymentIntentInput,
  PaymentIntentResult,
  WebhookEvent,
} from "../../../contracts/payment-gateway.js";

const MOCK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET ?? "dev-webhook-secret";

/**
 * Mock payment gateway for development and testing.
 * Generates fake checkout URLs and accepts dev webhook signatures.
 */
export class MockPaymentGateway implements PaymentGateway {
  readonly name = "mock";

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    const externalId = `mock_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const baseUrl = input.returnUrl
      ? new URL(input.returnUrl).origin
      : "http://localhost:3000";

    return {
      provider: "mock",
      externalId,
      checkoutUrl: `${baseUrl}/customer/payment/success?ref=${externalId}&amount=${input.amountMinor}&currency=${input.currency}`,
      status: "pending",
    };
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    // Dev: accept simple HMAC-SHA256 or the literal dev secret
    if (signature === MOCK_SECRET) return true;

    const expected = crypto
      .createHmac("sha256", MOCK_SECRET)
      .update(payload)
      .digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    );
  }

  parseWebhookEvent(payload: string): WebhookEvent {
    const data = JSON.parse(payload);
    return {
      type: data.type ?? "payment.completed",
      externalId: data.externalId ?? data.reference,
      amount: data.amount,
      currency: data.currency,
      metadata: data.metadata,
    };
  }
}
