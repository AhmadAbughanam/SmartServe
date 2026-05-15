export interface BranchTable {
  id: string;
  branchId: string;
  tableCode: string;
  capacity: number;
  status: string;
  locationDescription: string | null;
  lastOccupiedTime: string | null;
  totalOrders: number;
  lastSession: {
    id: string;
    status: string;
    guestCount: number;
    startTime: string;
  } | null;
}

export interface ServiceRequest {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  claimedByStaffId: string | null;
  table: { id: string; tableCode: string };
  session: { id: string; guestCount: number };
  claimedByStaff: { id: string; name: string } | null;
}

export interface Attendance {
  id: string;
  staffId: string;
  checkIn: string;
  checkOut: string | null;
  shiftId: string | null;
}

/* ── Waiter aggregate types ─────────────────────────── */

export type AttentionState =
  | "AVAILABLE"
  | "OCCUPIED"
  | "ASSISTANCE_NEEDED"
  | "ORDER_READY"
  | "PAYMENT_PENDING"
  | "TURNOVER_REQUIRED"
  | "RESERVED"
  | "CLEANING"
  | "OUT_OF_SERVICE";

export interface WaiterTableSummary {
  id: string;
  tableCode: string;
  capacity: number;
  status: string;
  zone: string | null;
  posX: number | null;
  posY: number | null;
  shape: string | null;
  locationDescription: string | null;
  attentionState: AttentionState;
  session: {
    id: string;
    guestCount: number;
    startTime: string;
    orderCount: number;
    hasReadyOrders: boolean;
    hasDelayedOrders: boolean;
    paymentPending: boolean;
    totalAmount: number;
    paidAmount: number;
  } | null;
  activeRequests: number;
}

export interface TableDetail {
  id: string;
  tableCode: string;
  capacity: number;
  status: string;
  zone: string | null;
  locationDescription: string | null;
  lastSession: {
    id: string;
    status: string;
    guestCount: number;
    startTime: string;
    endTime: string | null;
    orders: Array<{
      id: string;
      orderStatus: string;
      paymentStatus: string;
      totalAmount: string;
      subtotalAmount: string;
      taxAmount: string;
      orderDateTime: string;
      specialInstructions: string | null;
      source: string;
      assignedWaiterId: string | null;
      assignedWaiter: { id: string; name: string } | null;
      orderItems: Array<{
        id: string;
        quantity: number;
        lineTotal: string;
        kitchenStatus: string;
        menuItem: { id: string; name: string } | null;
      }>;
    }>;
  } | null;
  serviceRequests: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: string;
    claimedByStaff: { id: string; name: string } | null;
  }>;
}

export interface StaffNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface WaiterReadyOrder {
  id: string;
  sessionId: string;
  tableId: string;
  tableCode: string;
  orderDateTime: string;
  assignedWaiterId: string | null;
  assignedWaiterName: string | null;
  itemCount: number;
  totalItems: number;
  totalAmount: number;
  isMine: boolean;
}
