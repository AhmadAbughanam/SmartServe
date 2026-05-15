import { Inject, Injectable } from "@nestjs/common";
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
  ServiceRequestStatus,
  SessionStatus,
  ShiftStatus,
  TableStatus,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../../prisma/prisma.service.js";

/** Default to today if no range provided. */
function parseDateRange(from?: string, to?: string) {
  const start = from
    ? new Date(from)
    : new Date(new Date().setHours(0, 0, 0, 0));
  const end = to
    ? new Date(new Date(to).setHours(23, 59, 59, 999))
    : new Date(new Date().setHours(23, 59, 59, 999));
  return { start, end };
}

@Injectable()
export class AnalyticsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ── Dashboard Summary ────────────────────────────────

  async getDashboard(tenantId: string, branchId: string, from?: string, to?: string) {
    const { start, end } = parseDateRange(from, to);
    const scope = { tenantId, branchId };

    const [
      payments,
      refunds,
      orders,
      cancelledOrders,
      activeSessions,
      completedSessions,
      tables,
      openServiceRequests,
      expenses,
    ] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { ...scope, paymentStatus: PaymentStatus.COMPLETED, paymentDate: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      this.prisma.refund.aggregate({
        where: { ...scope, status: RefundStatus.COMPLETED, createdAt: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      this.prisma.order.count({
        where: { ...scope, orderDateTime: { gte: start, lte: end } },
      }),
      this.prisma.order.count({
        where: { ...scope, orderStatus: OrderStatus.CANCELLED, orderDateTime: { gte: start, lte: end } },
      }),
      this.prisma.session.count({
        where: { ...scope, status: SessionStatus.ACTIVE },
      }),
      this.prisma.session.count({
        where: { ...scope, status: SessionStatus.COMPLETED, startTime: { gte: start, lte: end } },
      }),
      this.prisma.table.groupBy({
        by: ["status"],
        where: { branchId },
        _count: true,
      }),
      this.prisma.serviceRequest.count({
        where: { ...scope, status: { in: [ServiceRequestStatus.NEW, ServiceRequestStatus.CLAIMED] } },
      }),
      this.prisma.expense.aggregate({
        where: { ...scope, expenseDate: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
    ]);

    const totalSales = payments._sum.amount ?? new Decimal(0);
    const totalRefunds = refunds._sum.amount ?? new Decimal(0);
    const netSales = totalSales.sub(totalRefunds);
    const totalExpenses = expenses._sum.amount ?? new Decimal(0);
    const avgOrderValue = orders > 0 ? netSales.div(orders).toDecimalPlaces(2) : new Decimal(0);
    const tableStatusMap = Object.fromEntries(tables.map((t) => [t.status, t._count]));

    // Average session duration (completed sessions only, in minutes)
    const completedSessionData = await this.prisma.session.findMany({
      where: { ...scope, status: SessionStatus.COMPLETED, startTime: { gte: start, lte: end }, endTime: { not: null } },
      select: { startTime: true, endTime: true },
    });
    const avgSessionMinutes = completedSessionData.length > 0
      ? Math.round(completedSessionData.reduce((sum, s) => sum + (s.endTime!.getTime() - s.startTime.getTime()) / 60000, 0) / completedSessionData.length)
      : 0;

    return {
      period: { from: start.toISOString(), to: end.toISOString() },
      totalSales: totalSales.toString(),
      totalRefunds: totalRefunds.toString(),
      netSales: netSales.toString(),
      totalOrders: orders,
      cancelledOrders,
      averageOrderValue: avgOrderValue.toString(),
      activeSessions,
      completedSessions,
      averageSessionMinutes: avgSessionMinutes,
      tables: {
        occupied: tableStatusMap[TableStatus.OCCUPIED] ?? 0,
        available: tableStatusMap[TableStatus.AVAILABLE] ?? 0,
        cleaning: tableStatusMap[TableStatus.CLEANING] ?? 0,
        reserved: tableStatusMap[TableStatus.RESERVED] ?? 0,
        outOfService: tableStatusMap[TableStatus.OUT_OF_SERVICE] ?? 0,
      },
      openServiceRequests,
      totalExpenses: totalExpenses.toString(),
      estimatedProfit: netSales.sub(totalExpenses).toString(),
    };
  }

  // ── Sales Report ─────────────────────────────────────

  async getSalesReport(tenantId: string, branchId: string, from?: string, to?: string) {
    const { start, end } = parseDateRange(from, to);
    const scope = { tenantId, branchId };

    const [paymentAgg, refundAgg, orderCount, byMethod] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { ...scope, paymentStatus: PaymentStatus.COMPLETED, paymentDate: { gte: start, lte: end } },
        _sum: { amount: true, tipAmount: true },
        _count: true,
      }),
      this.prisma.refund.aggregate({
        where: { ...scope, status: RefundStatus.COMPLETED, createdAt: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
      this.prisma.order.count({
        where: { ...scope, orderDateTime: { gte: start, lte: end } },
      }),
      this.prisma.payment.groupBy({
        by: ["paymentMethod"],
        where: { ...scope, paymentStatus: PaymentStatus.COMPLETED, paymentDate: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const gross = paymentAgg._sum.amount ?? new Decimal(0);
    const refunds = refundAgg._sum.amount ?? new Decimal(0);
    const net = gross.sub(refunds);
    const tips = paymentAgg._sum.tipAmount ?? new Decimal(0);

    return {
      period: { from: start.toISOString(), to: end.toISOString() },
      grossSales: gross.toString(),
      refunds: refunds.toString(),
      netSales: net.toString(),
      tips: tips.toString(),
      paymentCount: paymentAgg._count,
      orderCount,
      averageOrderValue: orderCount > 0 ? net.div(orderCount).toDecimalPlaces(2).toString() : "0",
      byPaymentMethod: byMethod.map((m) => ({
        method: m.paymentMethod,
        total: (m._sum.amount ?? new Decimal(0)).toString(),
        count: m._count,
      })),
    };
  }

  // ── Order Metrics ────────────────────────────────────

  async getOrderMetrics(tenantId: string, branchId: string, from?: string, to?: string) {
    const { start, end } = parseDateRange(from, to);
    const scope = { tenantId, branchId };
    const dateFilter = { orderDateTime: { gte: start, lte: end } };

    const [total, byStatus, itemAgg, totalAgg] = await Promise.all([
      this.prisma.order.count({ where: { ...scope, ...dateFilter } }),
      this.prisma.order.groupBy({
        by: ["orderStatus"],
        where: { ...scope, ...dateFilter },
        _count: true,
      }),
      this.prisma.orderItem.aggregate({
        where: { ...scope, order: dateFilter },
        _count: true,
      }),
      this.prisma.order.aggregate({
        where: { ...scope, ...dateFilter },
        _sum: { totalAmount: true },
        _avg: { totalAmount: true },
      }),
    ]);

    return {
      period: { from: start.toISOString(), to: end.toISOString() },
      totalOrders: total,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.orderStatus, s._count])),
      totalItemsOrdered: itemAgg._count,
      averageItemsPerOrder: total > 0 ? Math.round(itemAgg._count / total * 10) / 10 : 0,
      totalOrderValue: (totalAgg._sum.totalAmount ?? new Decimal(0)).toString(),
      averageOrderTotal: (totalAgg._avg.totalAmount ?? new Decimal(0)).toDecimalPlaces(2).toString(),
    };
  }

  // ── Menu Performance ─────────────────────────────────

  async getMenuPerformance(tenantId: string, branchId: string, from?: string, to?: string) {
    const { start, end } = parseDateRange(from, to);

    const items = await this.prisma.orderItem.groupBy({
      by: ["menuItemId"],
      where: {
        tenantId,
        branchId,
        order: { orderDateTime: { gte: start, lte: end }, orderStatus: { not: OrderStatus.CANCELLED } },
      },
      _sum: { quantity: true, lineTotal: true },
      _count: true,
      orderBy: { _sum: { quantity: "desc" } },
      take: 20,
    });

    // Enrich with menu item names and categories
    const menuItemIds = items.map((i) => i.menuItemId);
    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
      select: { id: true, name: true, price: true, category: { select: { id: true, name: true } } },
    });
    const menuMap = new Map(menuItems.map((m) => [m.id, m]));

    const ranked = items.map((i, idx) => {
      const mi = menuMap.get(i.menuItemId);
      return {
        rank: idx + 1,
        menuItemId: i.menuItemId,
        name: mi?.name ?? "Unknown",
        category: mi?.category?.name ?? "Unknown",
        quantitySold: i._sum.quantity ?? 0,
        revenue: (i._sum.lineTotal ?? new Decimal(0)).toString(),
        orderCount: i._count,
      };
    });

    return {
      period: { from: start.toISOString(), to: end.toISOString() },
      items: ranked,
    };
  }

  // ── Table/Session Metrics ────────────────────────────

  async getTableMetrics(tenantId: string, branchId: string, from?: string, to?: string) {
    const { start, end } = parseDateRange(from, to);
    const scope = { tenantId, branchId };

    const [sessionCount, tableStatuses, sessionsByTable] = await Promise.all([
      this.prisma.session.count({ where: { ...scope, startTime: { gte: start, lte: end } } }),
      this.prisma.table.groupBy({ by: ["status"], where: { branchId }, _count: true }),
      this.prisma.session.groupBy({
        by: ["tableId"],
        where: { ...scope, startTime: { gte: start, lte: end } },
        _count: true,
      }),
    ]);

    const completedSessions = await this.prisma.session.findMany({
      where: { ...scope, status: SessionStatus.COMPLETED, startTime: { gte: start, lte: end }, endTime: { not: null } },
      select: { startTime: true, endTime: true },
    });

    const avgDuration = completedSessions.length > 0
      ? Math.round(completedSessions.reduce((s, x) => s + (x.endTime!.getTime() - x.startTime.getTime()) / 60000, 0) / completedSessions.length)
      : 0;

    // Enrich table turnovers
    const tableIds = sessionsByTable.map((t) => t.tableId);
    const tables = await this.prisma.table.findMany({
      where: { id: { in: tableIds } },
      select: { id: true, tableCode: true },
    });
    const tableMap = new Map(tables.map((t) => [t.id, t.tableCode]));

    return {
      period: { from: start.toISOString(), to: end.toISOString() },
      totalSessions: sessionCount,
      completedSessions: completedSessions.length,
      averageSessionMinutes: avgDuration,
      tableStatuses: Object.fromEntries(tableStatuses.map((t) => [t.status, t._count])),
      sessionsPerTable: sessionsByTable.map((t) => ({
        tableId: t.tableId,
        tableCode: tableMap.get(t.tableId) ?? "?",
        sessions: t._count,
      })),
    };
  }

  // ── Staff Metrics ────────────────────────────────────

  async getStaffMetrics(tenantId: string, branchId: string, from?: string, to?: string) {
    const { start, end } = parseDateRange(from, to);
    const scope = { tenantId, branchId };

    const [shifts, attendance, serviceRequests, statusChanges] = await Promise.all([
      this.prisma.shift.groupBy({
        by: ["staffId"],
        where: { ...scope, startTime: { gte: start, lte: end } },
        _count: true,
      }),
      this.prisma.staffAttendance.groupBy({
        by: ["staffId"],
        where: { ...scope, checkIn: { gte: start, lte: end } },
        _count: true,
      }),
      this.prisma.serviceRequest.groupBy({
        by: ["claimedByStaffId"],
        where: { ...scope, status: ServiceRequestStatus.COMPLETED, completedAt: { gte: start, lte: end }, claimedByStaffId: { not: null } },
        _count: true,
      }),
      this.prisma.orderStatusHistory.groupBy({
        by: ["changedByStaffId"],
        where: { ...scope, changedAt: { gte: start, lte: end }, changedByStaffId: { not: null } },
        _count: true,
      }),
    ]);

    // Collect all staff IDs
    const staffIds = new Set<string>();
    shifts.forEach((s) => staffIds.add(s.staffId));
    attendance.forEach((a) => staffIds.add(a.staffId));
    serviceRequests.forEach((r) => { if (r.claimedByStaffId) staffIds.add(r.claimedByStaffId); });
    statusChanges.forEach((c) => { if (c.changedByStaffId) staffIds.add(c.changedByStaffId); });

    const staffList = await this.prisma.staff.findMany({
      where: { id: { in: [...staffIds] } },
      select: { id: true, name: true, primaryRole: true },
    });
    const staffMap = new Map(staffList.map((s) => [s.id, s]));

    const shiftMap = new Map(shifts.map((s) => [s.staffId, s._count]));
    const attMap = new Map(attendance.map((a) => [a.staffId, a._count]));
    const srMap = new Map(serviceRequests.map((r) => [r.claimedByStaffId!, r._count]));
    const osMap = new Map(statusChanges.map((c) => [c.changedByStaffId!, c._count]));

    const metrics = [...staffIds].map((id) => {
      const s = staffMap.get(id);
      return {
        staffId: id,
        name: s?.name ?? "Unknown",
        role: s?.primaryRole ?? "UNKNOWN",
        shifts: shiftMap.get(id) ?? 0,
        attendanceDays: attMap.get(id) ?? 0,
        serviceRequestsCompleted: srMap.get(id) ?? 0,
        orderStatusChanges: osMap.get(id) ?? 0,
      };
    });

    return {
      period: { from: start.toISOString(), to: end.toISOString() },
      staff: metrics,
      _note: "Order creation attribution is tracked via Session.createdByStaffId, not directly on orders.",
    };
  }

  // ── Expense Summary ──────────────────────────────────

  async getExpenseSummary(tenantId: string, branchId: string, from?: string, to?: string) {
    const { start, end } = parseDateRange(from, to);

    const [total, byCategory] = await Promise.all([
      this.prisma.expense.aggregate({
        where: { tenantId, branchId, expenseDate: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.expense.groupBy({
        by: ["category"],
        where: { tenantId, branchId, expenseDate: { gte: start, lte: end } },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: "desc" } },
      }),
    ]);

    return {
      period: { from: start.toISOString(), to: end.toISOString() },
      totalExpenses: (total._sum.amount ?? new Decimal(0)).toString(),
      expenseCount: total._count,
      byCategory: byCategory.map((c) => ({
        category: c.category,
        total: (c._sum.amount ?? new Decimal(0)).toString(),
        count: c._count,
      })),
    };
  }

  // ── Daily Snapshot Generation ────────────────────────

  async generateDailySnapshot(tenantId: string, branchId: string, dateStr: string) {
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const scope = { tenantId, branchId };

    const [paymentAgg, refundAgg, orderCount, cancelledCount, sessionAgg, topItem] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { ...scope, paymentStatus: PaymentStatus.COMPLETED, paymentDate: { gte: date, lte: endOfDay } },
        _sum: { amount: true },
      }),
      this.prisma.refund.aggregate({
        where: { ...scope, status: RefundStatus.COMPLETED, createdAt: { gte: date, lte: endOfDay } },
        _sum: { amount: true },
      }),
      this.prisma.order.count({ where: { ...scope, orderDateTime: { gte: date, lte: endOfDay } } }),
      this.prisma.order.count({ where: { ...scope, orderStatus: OrderStatus.CANCELLED, orderDateTime: { gte: date, lte: endOfDay } } }),
      this.prisma.session.aggregate({
        where: { ...scope, startTime: { gte: date, lte: endOfDay } },
        _sum: { guestCount: true },
      }),
      this.prisma.orderItem.groupBy({
        by: ["menuItemId"],
        where: { ...scope, order: { orderDateTime: { gte: date, lte: endOfDay }, orderStatus: { not: OrderStatus.CANCELLED } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 1,
      }),
    ]);

    // Kitchen prep time: avg minutes from IN_KITCHEN to READY
    const kitchenEntries = await this.prisma.$queryRaw<Array<{ avg_minutes: number | null }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (r."changedAt" - k."changedAt")) / 60)::float AS avg_minutes
      FROM "OrderStatusHistory" k
      JOIN "OrderStatusHistory" r ON k."orderId" = r."orderId"
      WHERE k."toStatus" = 'IN_KITCHEN'
        AND r."toStatus" = 'READY'
        AND k."branchId" = ${branchId}
        AND k."tenantId" = ${tenantId}
        AND k."changedAt" >= ${date}
        AND k."changedAt" <= ${endOfDay}
    `;
    const avgPrepTime = kitchenEntries[0]?.avg_minutes
      ? Math.round(kitchenEntries[0].avg_minutes)
      : null;

    const gross = paymentAgg._sum.amount ?? new Decimal(0);
    const refunds = refundAgg._sum.amount ?? new Decimal(0);
    const totalSales = gross.sub(refunds);
    const avgOrder = orderCount > 0 ? totalSales.div(orderCount).toDecimalPlaces(2) : new Decimal(0);
    const covers = sessionAgg._sum.guestCount ?? 0;
    const topItemId = topItem[0]?.menuItemId ?? null;

    const snapshot = await this.prisma.analyticsDailyBranch.upsert({
      where: { tenantId_branchId_date: { tenantId, branchId, date } },
      update: {
        totalSales,
        totalOrders: orderCount,
        averageOrderValue: avgOrder,
        averagePrepTime: avgPrepTime,
        covers,
        cancelledOrders: cancelledCount,
        topItemId,
        notesJson: { generatedAt: new Date().toISOString(), refunds: refunds.toString() },
      },
      create: {
        tenantId,
        branchId,
        date,
        totalSales,
        totalOrders: orderCount,
        averageOrderValue: avgOrder,
        averagePrepTime: avgPrepTime,
        covers,
        cancelledOrders: cancelledCount,
        topItemId,
        notesJson: { generatedAt: new Date().toISOString(), refunds: refunds.toString() },
      },
      include: {
        topItem: { select: { id: true, name: true } },
      },
    });

    return snapshot;
  }

  async getDailySnapshots(tenantId: string, branchId: string, from?: string, to?: string) {
    const { start, end } = parseDateRange(from, to);
    return this.prisma.analyticsDailyBranch.findMany({
      where: { tenantId, branchId, date: { gte: start, lte: end } },
      orderBy: { date: "desc" },
      include: { topItem: { select: { id: true, name: true } } },
    });
  }

  /**
   * Combined insights: kitchen, menu, staff, table, customer, and review analytics.
   */
  async getInsights(tenantId: string, branchId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const where = { tenantId, branchId, orderDateTime: { gte: thirtyDaysAgo } };

    // ── Kitchen insights ──
    const orderItems = await this.prisma.orderItem.findMany({
      where: { tenantId, branchId, order: { ...where, orderStatus: { not: "CANCELLED" } } },
      select: { startedAt: true, readyAt: true, menuItemId: true, kitchenStatus: true },
    });
    const prepTimes = orderItems
      .filter((i) => i.startedAt && i.readyAt)
      .map((i) => (new Date(i.readyAt!).getTime() - new Date(i.startedAt!).getTime()) / 60_000);
    const avgPrepTime = prepTimes.length > 0 ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length * 10) / 10 : null;
    const delayedOrders = await this.prisma.order.count({
      where: { ...where, orderStatus: { in: ["PLACED", "CONFIRMED", "IN_KITCHEN"] }, orderDateTime: { lt: new Date(Date.now() - 20 * 60_000) } },
    });

    // ── Menu insights ──
    const topItems = await this.prisma.orderItem.groupBy({
      by: ["menuItemId"],
      where: { tenantId, branchId, order: { ...where, orderStatus: { not: "CANCELLED" } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    });
    const topMenuIds = topItems.map((t) => t.menuItemId);
    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: topMenuIds } },
      select: { id: true, name: true },
    });
    const menuMap = new Map(menuItems.map((m) => [m.id, m.name]));
    const topSellers = topItems.map((t, i) => ({
      rank: i + 1, menuItemId: t.menuItemId, name: menuMap.get(t.menuItemId) ?? "Unknown",
      quantitySold: t._sum.quantity ?? 0,
    }));

    // ── Staff insights ──
    const staffAttendance = await this.prisma.staffAttendance.findMany({
      where: { tenantId, branchId, checkIn: { gte: thirtyDaysAgo } },
      include: { staff: { select: { id: true, name: true } } },
    });
    const staffMap = new Map<string, { name: string; shifts: number; totalHours: number }>();
    for (const a of staffAttendance) {
      const entry = staffMap.get(a.staffId) ?? { name: a.staff.name, shifts: 0, totalHours: 0 };
      entry.shifts++;
      if (a.checkOut) entry.totalHours += (new Date(a.checkOut).getTime() - new Date(a.checkIn).getTime()) / 3_600_000;
      staffMap.set(a.staffId, entry);
    }
    const staffPerformance = Array.from(staffMap.entries()).map(([id, d]) => ({
      staffId: id, name: d.name, shifts: d.shifts, totalHours: Math.round(d.totalHours * 10) / 10,
    })).sort((a, b) => b.shifts - a.shifts);

    const serviceRequestStats = await this.prisma.serviceRequest.groupBy({
      by: ["claimedByStaffId"],
      where: { tenantId, branchId, status: "COMPLETED", createdAt: { gte: thirtyDaysAgo }, claimedByStaffId: { not: null } },
      _count: true,
    });
    const srMap = new Map(serviceRequestStats.map((s) => [s.claimedByStaffId!, s._count]));

    // ── Table insights ──
    const tables = await this.prisma.table.findMany({
      where: { branchId },
      select: { id: true, tableCode: true, totalOrders: true, status: true, zone: true },
    });
    const tableInsights = tables.map((t) => ({ tableCode: t.tableCode, zone: t.zone, totalOrders: t.totalOrders, status: t.status }))
      .sort((a, b) => b.totalOrders - a.totalOrders);

    // ── Review insights ──
    const reviews = await this.prisma.review.findMany({
      where: { tenantId, branchId, createdAt: { gte: thirtyDaysAgo } },
      select: { overallRating: true },
    });
    const avgRating = reviews.length > 0 ? Math.round(reviews.reduce((s, r) => s + r.overallRating, 0) / reviews.length * 10) / 10 : null;

    const issueTags = await this.prisma.reviewIssueTag.groupBy({
      by: ["tag"],
      where: { review: { tenantId, branchId, createdAt: { gte: thirtyDaysAgo } } },
      _count: true,
      orderBy: { _count: { tag: "desc" } },
      take: 10,
    });

    // ── Low stock ──
    const openAlerts = await this.prisma.lowStockAlert.count({
      where: { tenantId, branchId, status: "OPEN" },
    });

    return {
      kitchen: { avgPrepTimeMinutes: avgPrepTime, itemsCooked: prepTimes.length, currentDelayedOrders: delayedOrders },
      menu: { topSellers },
      staff: { performance: staffPerformance.slice(0, 10), serviceRequestsHandled: serviceRequestStats.map((s) => ({ staffId: s.claimedByStaffId, count: s._count })) },
      tables: { insights: tableInsights },
      reviews: { avgRating, totalReviews: reviews.length, topComplaints: issueTags.map((t) => ({ tag: t.tag, count: t._count })) },
      operations: { openLowStockAlerts: openAlerts },
    };
  }
}
