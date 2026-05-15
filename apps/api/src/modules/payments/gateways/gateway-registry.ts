import type { PaymentGateway } from "../../../contracts/payment-gateway.js";
import { MockPaymentGateway } from "./mock.gateway.js";
import { StripePaymentGateway } from "./stripe.gateway.js";

const providers: Record<string, () => PaymentGateway> = {
  mock: () => new MockPaymentGateway(),
  stripe: () => new StripePaymentGateway(),
};

let instance: PaymentGateway | null = null;

/**
 * Get the configured payment gateway instance.
 * Provider is selected via PAYMENT_PROVIDER env var (default: mock).
 */
export function getPaymentGateway(): PaymentGateway {
  if (instance) return instance;

  const providerName = process.env.PAYMENT_PROVIDER ?? "mock";
  const factory = providers[providerName];

  if (!factory) {
    throw new Error(
      `Unknown payment provider: ${providerName}. Available: ${Object.keys(providers).join(", ")}`,
    );
  }

  instance = factory();
  return instance;
}

/** Get gateway by specific provider name (for webhooks). */
export function getGatewayByName(name: string): PaymentGateway | null {
  const factory = providers[name];
  return factory ? factory() : null;
}
