export interface DashboardData {
  period: { from: string; to: string };
  totalSales: string;
  totalRefunds: string;
  netSales: string;
  totalOrders: number;
  cancelledOrders: number;
  averageOrderValue: string;
  activeSessions: number;
  completedSessions: number;
  averageSessionMinutes: number;
  tables: Record<string, number>;
  openServiceRequests: number;
  totalExpenses: string;
  estimatedProfit: string;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  primaryRole: string;
  isActive: boolean;
  branchId: string;
  createdAt: string;
}

export interface Shift {
  id: string;
  staffId: string;
  branchId: string;
  status: string;
  startTime: string;
  endTime: string | null;
  staff?: { id: string; name: string; primaryRole: string };
  tills: Array<{
    id: string;
    expectedCash: string;
    actualCash: string;
    difference: string;
  }>;
  attendance?: Array<{
    id: string;
    staffId: string;
    checkIn: string;
    checkOut: string | null;
    staff: { name: string; primaryRole: string };
  }>;
}

export interface MenuPerformanceItem {
  rank: number;
  menuItemId: string;
  name: string;
  category: string;
  quantitySold: number;
  revenue: string;
  orderCount: number;
}
