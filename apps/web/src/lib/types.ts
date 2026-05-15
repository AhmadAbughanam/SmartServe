/* Lightweight frontend types matching backend response shapes. */

export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  ingredients: string | null;
  price: string;
  dietaryInfo: string | null;
  allergensJson: string[] | null;
  isVegetarian: boolean;
  isSpicy: boolean;
  prepTimeMinutes: number | null;
  imageUrl: string | null;
  taxClass?: string;
  isUnavailable: boolean;
  isActive: boolean;
  additions: MenuAddition[];
}

export interface MenuAddition {
  id: string;
  name: string;
  priceImpact: string;
  isRequired: boolean;
  maxSelectable: number | null;
}

export interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
  menuItems: MenuItem[];
}

export interface Session {
  id: string;
  tenantId: string;
  branchId: string;
  tableId: string;
  status: string;
  guestCount: number;
  table?: { tableCode: string };
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  quantity: number;
  itemBasePrice: string;
  lineTotal: string;
  kitchenStatus: string;
  specializationsJson: unknown;
  menuItem?: { id: string; name: string; imageUrl: string | null };
}

export interface Order {
  id: string;
  orderStatus: string;
  paymentStatus: string;
  subtotalAmount: string;
  taxAmount: string;
  totalAmount: string;
  orderDateTime: string;
  specialInstructions: string | null;
  orderItems: OrderItem[];
  statusHistory?: Array<{
    fromStatus: string | null;
    toStatus: string;
    changedAt: string;
  }>;
}

export interface SessionBillOrder {
  id: string;
  orderStatus: string;
  paymentStatus: string;
  orderDateTime: string;
  subtotalAmount: string;
  taxAmount: string;
  serviceChargeAmount: string;
  discountAmount: string;
  totalAmount: string;
  paidAmount: string;
  remainingAmount: string;
}

export interface SessionBill {
  sessionId: string;
  tenantId: string;
  branchId: string;
  orderCount: number;
  subtotalAmount: string;
  taxAmount: string;
  serviceChargeAmount: string;
  discountAmount: string;
  totalAmount: string;
  paidAmount: string;
  remainingAmount: string;
  paymentStatus: string;
  orders: SessionBillOrder[];
  pendingServiceOrderCount?: number;
}

export interface Recommendation {
  menuItemId: string;
  name: string;
  price: string;
  reason: string;
  score: number;
}

export interface Review {
  id: string;
  overallRating: number;
  comment: string | null;
  createdAt: string;
  issueTags: Array<{ id: string; tag: string }>;
  itemReviews: Array<{ id: string; menuItemId: string; rating: number; comment: string | null; menuItem?: { id: string; name: string } }>;
}

export interface TableAccessResult {
  branchId: string;
  tableId: string | null;
  tableCode: string | null;
  tagType: string;
  branch: { name: string; location: string };
}

export interface CustomerTableOption {
  id: string;
  tableCode: string;
  capacity: number;
  status: string;
  zone: string | null;
  locationDescription: string | null;
}

export interface BranchTablesResult {
  branchId: string;
  branch: { name: string; location: string };
  tables: CustomerTableOption[];
}

/* Cart types — client-only. */
export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  additions: Array<{ additionId: string; name: string; priceImpact: number }>;
}
