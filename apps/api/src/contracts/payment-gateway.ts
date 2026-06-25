export interface PaymentIntentInput {
  amountMinor: number;
  currency: string;
  reference: string;
  idempotencyKey?: string;
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

export interface RefundInput {
  paymentReference: string;
  amountMinor: number;
  idempotencyKey?: string;
  reason?: string;
}

export interface RefundResult {
  provider: string;
  externalId?: string;
  status: "pending" | "completed" | "failed";
  providerStatus?: string;
  failureReason?: string;
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
  refund(input: RefundInput): Promise<RefundResult>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
  parseWebhookEvent(payload: string): WebhookEvent;
}
