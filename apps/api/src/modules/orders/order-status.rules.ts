import { OrderStatus } from "@prisma/client";

/**
 * Valid order status transitions.
 *
 * PLACED      → CONFIRMED (staff confirms), CANCELLED (staff/customer cancels)
 * CONFIRMED   → IN_KITCHEN (sent to kitchen), CANCELLED
 * IN_KITCHEN  → READY (kitchen done), CANCELLED
 * READY       → SERVED (waiter delivers)
 * SERVED      → COMPLETED (session close / billing)
 * COMPLETED   → (terminal)
 * CANCELLED   → (terminal)
 */
const transitions: Record<OrderStatus, OrderStatus[]> = {
  PLACED: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.IN_KITCHEN, OrderStatus.CANCELLED],
  IN_KITCHEN: [OrderStatus.READY, OrderStatus.CANCELLED],
  READY: [OrderStatus.SERVED],
  SERVED: [OrderStatus.COMPLETED],
  COMPLETED: [],
  CANCELLED: [],
};

export function isValidOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return transitions[from]?.includes(to) ?? false;
}
