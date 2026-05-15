import { ServiceRequestStatus } from "@prisma/client";

/**
 * Valid service request status transitions.
 *
 * NEW       → CLAIMED (waiter picks up), COMPLETED (instant resolve), CANCELLED
 * CLAIMED   → COMPLETED (waiter finishes), CANCELLED
 * COMPLETED → (terminal)
 * CANCELLED → (terminal)
 */
const transitions: Record<ServiceRequestStatus, ServiceRequestStatus[]> = {
  NEW: [
    ServiceRequestStatus.CLAIMED,
    ServiceRequestStatus.COMPLETED,
    ServiceRequestStatus.CANCELLED,
  ],
  CLAIMED: [
    ServiceRequestStatus.COMPLETED,
    ServiceRequestStatus.CANCELLED,
  ],
  COMPLETED: [],
  CANCELLED: [],
};

export function isValidServiceRequestTransition(
  from: ServiceRequestStatus,
  to: ServiceRequestStatus,
): boolean {
  return transitions[from]?.includes(to) ?? false;
}
