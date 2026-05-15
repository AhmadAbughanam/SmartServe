import { OrderPaymentStatus, PaymentStatus, RefundStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Calculate the order-level payment status from payments and refunds.
 *
 * Rules:
 * - Sum all COMPLETED payment amounts (excluding tips).
 * - Sum all COMPLETED refund amounts.
 * - netPaid = completedPayments - completedRefunds.
 * - REFUNDED  if completedRefunds >= completedPayments AND completedPayments > 0
 * - PAID      if netPaid >= orderTotal
 * - PARTIALLY_PAID if netPaid > 0 AND netPaid < orderTotal
 * - UNPAID    otherwise
 */
export function calculateOrderPaymentStatus(
  orderTotal: Decimal,
  payments: Array<{ amount: Decimal; paymentStatus: PaymentStatus; tipAmount: Decimal | null }>,
  refunds: Array<{ amount: Decimal; status: RefundStatus }>,
): OrderPaymentStatus {
  const completedSum = payments
    .filter((p) => p.paymentStatus === PaymentStatus.COMPLETED)
    .reduce((sum, p) => sum.add(p.amount), new Decimal(0));

  const refundedSum = refunds
    .filter((r) => r.status === RefundStatus.COMPLETED)
    .reduce((sum, r) => sum.add(r.amount), new Decimal(0));

  if (completedSum.gt(0) && refundedSum.gte(completedSum)) {
    return OrderPaymentStatus.REFUNDED;
  }

  const netPaid = completedSum.sub(refundedSum);

  if (netPaid.gte(orderTotal)) {
    return OrderPaymentStatus.PAID;
  }

  if (netPaid.gt(0)) {
    return OrderPaymentStatus.PARTIALLY_PAID;
  }

  return OrderPaymentStatus.UNPAID;
}
