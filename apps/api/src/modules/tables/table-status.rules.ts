import { TableStatus } from "@prisma/client";

/**
 * Valid table status transitions.
 *
 * Rules:
 * - AVAILABLE  → OCCUPIED (session start), RESERVED (reservation), OUT_OF_SERVICE (maintenance)
 * - RESERVED   → OCCUPIED (party arrives / session start), AVAILABLE (reservation cancelled), OUT_OF_SERVICE
 * - OCCUPIED   → CLEANING (session ends)
 * - CLEANING   → AVAILABLE (table ready for next guests), OUT_OF_SERVICE
 * - OUT_OF_SERVICE → AVAILABLE (restored to service)
 */
const transitions: Record<TableStatus, TableStatus[]> = {
  AVAILABLE: [TableStatus.OCCUPIED, TableStatus.RESERVED, TableStatus.OUT_OF_SERVICE],
  RESERVED: [TableStatus.OCCUPIED, TableStatus.AVAILABLE, TableStatus.OUT_OF_SERVICE],
  OCCUPIED: [TableStatus.CLEANING],
  CLEANING: [TableStatus.AVAILABLE, TableStatus.OUT_OF_SERVICE],
  OUT_OF_SERVICE: [TableStatus.AVAILABLE],
};

export function isValidTransition(
  from: TableStatus,
  to: TableStatus,
): boolean {
  return transitions[from]?.includes(to) ?? false;
}

/** Statuses from which a new session can be started. */
export const SESSION_STARTABLE_STATUSES: TableStatus[] = [
  TableStatus.AVAILABLE,
  TableStatus.RESERVED,
];
