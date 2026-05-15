export interface PaymentIntentInput {
  amountMinor: number;
  currency: string;
  reference: string;
  returnUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  provider: string;
  checkoutUrl?: string;
  externalId: string;
  status: "pending" | "authorized" | "paid" | "failed";
}

export interface WebhookEvent {
  type: "payment.completed" | "payment.failed" | "payment.refunded";
  externalId: string;
  /** Provider-reported amount in minor units, such as cents. */
  amount?: number;
  currency?: string;
  metadata?: Record<string, string>;
}

export interface PaymentGateway {
  readonly name: string;
  createIntent(input: PaymentIntentInput): Promise<PaymentIntentResult>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
  parseWebhookEvent(payload: string): WebhookEvent;
}
