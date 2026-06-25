import crypto from "node:crypto";
import type {
  PaymentGateway,
  PaymentIntentInput,
  PaymentIntentResult,
  RefundInput,
  RefundResult,
  WebhookEvent,
} from "../../../contracts/payment-gateway.js";

const STRIPE_API = "https://api.stripe.com/v1";

/**
 * Stripe payment gateway using Checkout Sessions (hosted checkout).
 * No card data touches our servers — Stripe handles the checkout form.
 *
 * Requires:
 *   STRIPE_SECRET_KEY    — sk_test_... or sk_live_...
 *   STRIPE_WEBHOOK_SECRET — whsec_...
 *   PAYMENT_PROVIDER=stripe
 */
export class StripePaymentGateway implements PaymentGateway {
  readonly name = "stripe";

  private getSecretKey() {
    const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    return secretKey;
  }

  async createIntent(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    const secretKey = this.getSecretKey();
    const returnUrl = input.returnUrl ?? "http://localhost:3000/customer/payment/success";
    const cancelUrl = input.cancelUrl ?? "http://localhost:3000/customer/payment/cancel";

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("payment_method_types[0]", "card");
    params.set("line_items[0][price_data][currency]", input.currency.toLowerCase());
    params.set("line_items[0][price_data][unit_amount]", String(input.amountMinor));
    params.set("line_items[0][price_data][product_data][name]", `Order ${input.reference}`);
    params.set("line_items[0][quantity]", "1");
    params.set("success_url", `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`);
    params.set("cancel_url", cancelUrl);
    params.set("client_reference_id", input.reference);
    if (input.metadata) {
      for (const [k, v] of Object.entries(input.metadata)) {
        params.set(`metadata[${k}]`, v);
      }
    }

    const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": input.idempotencyKey ?? input.reference,
      },
      body: params.toString(),
    });

    const session = await res.json() as { id?: string; url?: string; error?: { message?: string } };

    if (!res.ok) {
      throw new Error(`Stripe error: ${session.error?.message ?? JSON.stringify(session)}`);
    }

    return {
      provider: "stripe",
      externalId: session.id ?? "",
      checkoutUrl: session.url,
      status: "pending" as const,
    };
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    const secretKey = this.getSecretKey();

    const sessionResponse = await fetch(
      `${STRIPE_API}/checkout/sessions/${encodeURIComponent(input.paymentReference)}`,
      {
        headers: {
          Authorization: `Bearer ${secretKey}`,
        },
      },
    );
    const session = await sessionResponse.json() as {
      id?: string;
      payment_intent?: string;
      error?: { message?: string };
    };

    if (!sessionResponse.ok || !session.payment_intent) {
      throw new Error(
        `Stripe checkout session lookup failed: ${session.error?.message ?? JSON.stringify(session)}`,
      );
    }

    const params = new URLSearchParams();
    params.set("payment_intent", session.payment_intent);
    params.set("amount", String(input.amountMinor));
    if (input.reason) {
      params.set("metadata[reason]", input.reason);
    }

    const refundResponse = await fetch(`${STRIPE_API}/refunds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": input.idempotencyKey ?? `${input.paymentReference}:${input.amountMinor}`,
      },
      body: params.toString(),
    });
    const refund = await refundResponse.json() as {
      id?: string;
      status?: string;
      failure_reason?: string | null;
      error?: { message?: string };
    };

    if (!refundResponse.ok) {
      throw new Error(`Stripe refund failed: ${refund.error?.message ?? JSON.stringify(refund)}`);
    }

    return {
      provider: "stripe",
      externalId: refund.id,
      status:
        refund.status === "succeeded"
          ? "completed"
          : refund.status === "failed" || refund.status === "canceled"
            ? "failed"
            : "pending",
      providerStatus: refund.status,
      failureReason: refund.failure_reason ?? undefined,
    };
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
    if (!webhookSecret || !signature) return false;

    // Parse Stripe signature header: t=timestamp,v1=hash
    const parts = new Map<string, string>();
    for (const part of signature.split(",")) {
      const [key, value] = part.split("=", 2);
      if (key && value) parts.set(key, value);
    }

    const timestamp = parts.get("t");
    const v1 = parts.get("v1");
    if (!timestamp || !v1) return false;

    // Stripe signs: timestamp + "." + payload
    const signedPayload = `${timestamp}.${payload}`;
    const expected = crypto
      .createHmac("sha256", webhookSecret)
      .update(signedPayload)
      .digest("hex");

    try {
      return crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  parseWebhookEvent(payload: string): WebhookEvent {
    const event = JSON.parse(payload);
    const obj = event.data?.object;

    let type: WebhookEvent["type"] = "payment.completed";
    if (event.type === "checkout.session.completed") {
      type = obj?.payment_status === "paid" ? "payment.completed" : "payment.failed";
    } else if (event.type === "checkout.session.expired") {
      type = "payment.failed";
    } else if (event.type === "charge.refunded") {
      type = "payment.refunded";
    }

    return {
      type,
      externalId: obj?.id ?? event.id,
      amount: obj?.amount_total,
      currency: obj?.currency,
      metadata: obj?.metadata,
    };
  }
}
