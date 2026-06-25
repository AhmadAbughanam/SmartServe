import crypto from "node:crypto";
import type {
  PaymentGateway,
  PaymentIntentInput,
  PaymentIntentResult,
  RefundInput,
  RefundResult,
  WebhookEvent,
} from "../../../contracts/payment-gateway.js";

/**
 * Mock payment gateway for development and testing.
 * Generates fake checkout URLs and accepts dev webhook signatures.
 */
export class MockPaymentGateway implements PaymentGateway {
  readonly name = "mock";

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    const idSource = input.idempotencyKey ?? input.reference;
    const externalId = `mock_${crypto.createHash("sha256").update(idSource).digest("hex").slice(0, 16)}`;
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

  async refund(input: RefundInput): Promise<RefundResult> {
    return {
      provider: "mock",
      externalId: `mock_refund_${crypto.createHash("sha256").update(input.idempotencyKey ?? `${input.paymentReference}:${input.amountMinor}`).digest("hex").slice(0, 16)}`,
      status: "completed",
      providerStatus: "succeeded",
      failureReason: input.amountMinor <= 0 ? "invalid_amount" : undefined,
    };
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const mockSecret = process.env.PAYMENT_WEBHOOK_SECRET ?? "dev-webhook-secret";
    // Dev: accept simple HMAC-SHA256 or the literal dev secret
    if (signature === mockSecret) return true;

    const expected = crypto
      .createHmac("sha256", mockSecret)
      .update(payload)
      .digest("hex");
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (signatureBuffer.length !== expectedBuffer.length) return false;
    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
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
