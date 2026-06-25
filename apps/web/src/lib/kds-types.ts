export interface KdsOrderItem {
  id: string;
  menuItemId: string;
  quantity: number;
  kitchenStatus: string;
  specializationsJson: unknown;
  startedAt: string | null;
  readyAt: string | null;
  menuItem: { id: string; name: string; prepTimeMinutes: number | null };
  station: { id: string; code: string; name: string } | null;
}

export interface KdsOrder {
  id: string;
  orderStatus: string;
  orderDateTime: string;
  specialInstructions: string | null;
  source: string;
  session: {
    id: string;
    table: { id: string; tableCode: string };
  };
  orderItems: KdsOrderItem[];
}

export interface KitchenStation {
  id: string;
  code: string;
  name: string;
}

export interface StaffLoginResponse {
  staff: {
    id: string;
    name: string;
    email: string;
    tenantId: string;
    branchId: string;
    primaryRole: string;
    permissions: string[];
  };
}
