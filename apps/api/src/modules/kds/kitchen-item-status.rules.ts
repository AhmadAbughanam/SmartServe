import { KitchenItemStatus } from "@prisma/client";

/**
 * Valid kitchen item status transitions.
 *
 * PENDING      → IN_PROGRESS (cook starts), CANCELLED (item cancelled)
 * IN_PROGRESS  → READY (cook done), CANCELLED
 * READY        → IN_PROGRESS (undo within time window)
 * CANCELLED    → (terminal)
 */
const transitions: Record<KitchenItemStatus, KitchenItemStatus[]> = {
  PENDING: [KitchenItemStatus.IN_PROGRESS, KitchenItemStatus.CANCELLED],
  IN_PROGRESS: [KitchenItemStatus.READY, KitchenItemStatus.CANCELLED],
  READY: [KitchenItemStatus.IN_PROGRESS], // undo support
  CANCELLED: [],
};

export function isValidKitchenItemTransition(
  from: KitchenItemStatus,
  to: KitchenItemStatus,
): boolean {
  return transitions[from]?.includes(to) ?? false;
}
