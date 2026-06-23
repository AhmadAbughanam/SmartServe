"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useMemo, type ReactNode } from "react";
import { authGet, getApiErrorMessage } from "../../../lib/api";
import { useAdminBranch } from "../branch-context";
import type { DashboardData, MenuPerformanceItem } from "../../../lib/admin-types";
import { BusinessInsightsPanel } from "../../../components/admin/ai/business-insights-panel";
import { DemandForecastPanel } from "../../../components/admin/ai/DemandForecastPanel";
import { DashboardCardSkeleton, ErrorDisplay, InlineAlert } from "../../../components/ui";

const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const Icons = {
  revenue: <svg {...iconProps}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  orders: <svg {...iconProps}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /></svg>,
  sessions: <svg {...iconProps}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></svg>,
  kitchen: <svg {...iconProps}><path d="M6 13.87A4 4 0 0 1 7.41 6a5 5 0 0 1 9.18 0A4 4 0 0 1 18 13.87V18H6Z" /><line x1="6" y1="22" x2="18" y2="22" /></svg>,
  tables: <svg {...iconProps}><path d="M5 7v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V7" /><path d="M5 7h14" /><line x1="8" y1="20" x2="8" y2="16" /><line x1="16" y1="20" x2="16" y2="16" /></svg>,
  service: <svg {...iconProps}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
  stock: <svg {...iconProps}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4Z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /></svg>,
  activity: <svg {...iconProps}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
  star: <svg {...iconProps}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>,
  trend: <svg {...iconProps}><path d="M3 17 9 11l4 4 8-8" /><path d="M14 7h7v7" /></svg>,
  check: <svg {...iconProps}><polyline points="20 6 9 17 4 12" /></svg>,
  alert: <svg {...iconProps}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>,
  arrow: <svg {...iconProps}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>,
};

interface LowStockItem {
  id: string;
  name: string;
  unit: string;
  currentStock: string;
  reorderLevel: string;
}

interface AuditEntry {
  id: string;
  actionCode: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  actor?: { name: string };
}

interface KdsOrder {
  id: string;
  orderStatus: string;
  orderDateTime: string;
  session?: { table?: { tableCode: string } | null } | null;
  orderItems: Array<{ id: string; quantity: number; menuItem?: { name: string } | null }>;
}

interface DailySnapshot {
  id: string;
  date: string;
  totalSales: string;
  totalOrders: number;
  averageOrderValue: string;
  averagePrepTime: number | null;
  cancelledOrders: number;
  topItem?: { name: string } | null;
}

interface Insights {
  kitchen: { avgPrepTimeMinutes: number | null; itemsCooked: number; currentDelayedOrders: number };
  reviews: { avgRating: number | null; totalReviews: number; topComplaints: Array<{ tag: string; count: number }> };
  operations: { openLowStockAlerts: number };
}

function money(value: string | number) {
  const amount = typeof value === "number" ? value : Number(value || 0);
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
  return `$${amount.toFixed(2)}`;
}

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (char) => char.toUpperCase());
}

function minutesAgo(timestamp: string) {
  const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[var(--r-lg)] p-5 ${className}`} style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
      {children}
    </section>
  );
}

function SectionHead({ icon, title, action }: { icon: ReactNode; title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-[var(--r-md)]" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-edge)", color: "var(--accent)" }}>
          {icon}
        </span>
        <h2 className="font-serif text-[16px] font-bold" style={{ color: "var(--ink-900)" }}>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function MetricCard({ icon, label, value, sub, tone = "accent" }: { icon: ReactNode; label: string; value: string; sub: string; tone?: "accent" | "ok" | "warn" | "bad" }) {
  const toneMap = {
    accent: { bg: "var(--accent-soft)", fg: "var(--accent)", border: "var(--accent-edge)" },
    ok: { bg: "var(--ok-soft)", fg: "var(--ok)", border: "#bbf7d0" },
    warn: { bg: "var(--warn-soft)", fg: "var(--warn)", border: "#fde68a" },
    bad: { bg: "var(--bad-soft)", fg: "var(--bad)", border: "#fecaca" },
  }[tone];

  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-[var(--r-md)]" style={{ background: toneMap.bg, color: toneMap.fg, border: `1px solid ${toneMap.border}` }}>
          {icon}
        </span>
        <span className="rounded-full px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider" style={{ background: "var(--ink-50)", color: "var(--ink-500)" }}>
          Today
        </span>
      </div>
      <div className="mt-5 font-serif text-[30px] font-extrabold leading-none" style={{ color: "var(--ink-900)" }}>{value}</div>
      <div className="mt-1.5 font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>{label}</div>
      <div className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>{sub}</div>
    </Panel>
  );
}

function LivePill({ label, value, tone = "accent" }: { label: string; value: string | number; tone?: "accent" | "ok" | "warn" | "bad" }) {
  const color = tone === "ok" ? "var(--ok)" : tone === "warn" ? "var(--warn)" : tone === "bad" ? "var(--bad)" : "var(--accent)";
  return (
    <div className="rounded-[var(--r-md)] px-3 py-2" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
      <div className="font-serif text-[22px] font-extrabold leading-none" style={{ color }}>{value}</div>
      <div className="mt-1 font-mono text-[8px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>{label}</div>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-[var(--r-md)] px-3 py-6 text-center text-[12px]" style={{ background: "var(--ink-50)", color: "var(--ink-400)" }}>{text}</div>;
}

export default function AdminDashboardPage() {
  const { branchId } = useAdminBranch();

  const today = useMemo(() => dateOnly(new Date()), []);
  const weekStart = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return dateOnly(start);
  }, []);

  const dashboard = useQuery({
    queryKey: ["admin-dashboard-live", branchId],
    queryFn: () => authGet<DashboardData>(`/api/analytics/dashboard?branchId=${branchId}`),
    enabled: !!branchId,
    refetchInterval: 15_000,
  });

  const kdsQueue = useQuery({
    queryKey: ["admin-dashboard-kds", branchId],
    queryFn: () => authGet<KdsOrder[]>(`/api/kds/orders?branchId=${branchId}`),
    enabled: !!branchId,
    refetchInterval: 10_000,
    retry: false,
  });

  const insights = useQuery({
    queryKey: ["admin-dashboard-insights", branchId],
    queryFn: () => authGet<Insights>(`/api/analytics/insights?branchId=${branchId}`),
    enabled: !!branchId,
    refetchInterval: 30_000,
  });

  const topItems = useQuery({
    queryKey: ["admin-dashboard-top-items", branchId],
    queryFn: async () => {
      const result = await authGet<{ items: MenuPerformanceItem[] }>(`/api/analytics/menu-performance?branchId=${branchId}`);
      return result.items ?? [];
    },
    enabled: !!branchId,
    refetchInterval: 45_000,
  });

  const lowStock = useQuery({
    queryKey: ["admin-dashboard-low-stock", branchId],
    queryFn: () => authGet<LowStockItem[]>(`/api/inventory/low-stock?branchId=${branchId}`),
    enabled: !!branchId,
    refetchInterval: 30_000,
  });

  const recentLogs = useQuery({
    queryKey: ["admin-dashboard-activity", branchId],
    queryFn: () => authGet<AuditEntry[]>(`/api/admin/audit-logs?branchId=${branchId}&limit=6`),
    enabled: !!branchId,
    refetchInterval: 20_000,
  });

  const snapshots = useQuery({
    queryKey: ["admin-dashboard-snapshots", branchId, weekStart, today],
    queryFn: () => authGet<DailySnapshot[]>(`/api/analytics/snapshots/daily?branchId=${branchId}&from=${weekStart}&to=${today}`),
    enabled: !!branchId,
    refetchInterval: 60_000,
  });

  if (dashboard.isLoading) {
    return (
      <div className="p-6 px-7">
        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DashboardCardSkeleton />
          <DashboardCardSkeleton />
          <DashboardCardSkeleton />
          <DashboardCardSkeleton />
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
          <DashboardCardSkeleton lines={5} />
          <DashboardCardSkeleton lines={4} />
        </div>
      </div>
    );
  }

  if (dashboard.isError || !dashboard.data) {
    return <ErrorDisplay message={getApiErrorMessage(dashboard.error, "Dashboard metrics are unavailable.")} onRetry={() => dashboard.refetch()} />;
  }

  const data = dashboard.data;
  const liveOrders = kdsQueue.data ?? [];
  const placed = liveOrders.filter((order) => order.orderStatus === "PLACED").length;
  const cooking = liveOrders.filter((order) => order.orderStatus === "CONFIRMED" || order.orderStatus === "IN_KITCHEN").length;
  const ready = liveOrders.filter((order) => order.orderStatus === "READY").length;
  const delayed = liveOrders.filter((order) => Date.now() - new Date(order.orderDateTime).getTime() > 20 * 60_000 && order.orderStatus !== "READY").length;

  const tableTotal = Object.values(data.tables).reduce((sum, value) => sum + Number(value), 0);
  const occupiedTables = data.tables.occupied ?? 0;
  const occupancy = tableTotal > 0 ? Math.round((occupiedTables / tableTotal) * 100) : 0;
  const netSales = Number(data.netSales || 0);
  const grossSales = Number(data.totalSales || 0);
  const avgCheck = Number(data.averageOrderValue || 0);
  const profit = Number(data.estimatedProfit || 0);
  const lowStockCount = lowStock.data?.length ?? insights.data?.operations.openLowStockAlerts ?? 0;
  const reviewPulse = insights.data?.reviews;
  const topComplaint = reviewPulse?.topComplaints[0];
  const latestOrders = liveOrders.slice(0, 5);

  const activeAlerts = [
    data.openServiceRequests > 0 ? `${data.openServiceRequests} service request${data.openServiceRequests === 1 ? "" : "s"}` : null,
    delayed > 0 ? `${delayed} delayed kitchen order${delayed === 1 ? "" : "s"}` : null,
    lowStockCount > 0 ? `${lowStockCount} low stock item${lowStockCount === 1 ? "" : "s"}` : null,
    data.cancelledOrders > 0 ? `${data.cancelledOrders} cancellation${data.cancelledOrders === 1 ? "" : "s"} today` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="px-7 py-6" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="font-serif text-[28px] font-extrabold tracking-tight leading-none md:text-[34px]" style={{ color: "var(--ink-900)" }}>
              Live <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Dashboard</em>
            </h1>
            <p className="mt-2 max-w-2xl text-[13px]" style={{ color: "var(--ink-500)" }}>
              Operational snapshots for what is happening right now. Full reports and AI analysis stay in Analytics.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider" style={{ background: "var(--ok-soft)", color: "var(--ok)", border: "1px solid #bbf7d0" }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ok)", animation: "pulse-dot 2s infinite" }} />
              Live refresh
            </span>
            <span className="rounded-full px-3 py-1.5 font-mono text-[10px] font-medium" style={{ background: "var(--ink-100)", color: "var(--ink-600)" }}>
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
            <Link href="/admin/analytics" className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>
              Analytics {Icons.arrow}
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 px-7">
        {(kdsQueue.isError || insights.isError || topItems.isError || lowStock.isError || recentLogs.isError || snapshots.isError) && (
          <InlineAlert tone="warning" title="Partial data loaded" className="mb-4">
            Some live widgets could not refresh. Core dashboard metrics are still available.
          </InlineAlert>
        )}

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Icons.revenue} label="Net sales" value={money(netSales)} sub={`Gross ${money(grossSales)} / profit ${money(profit)}`} tone={profit < 0 ? "bad" : "accent"} />
          <MetricCard icon={Icons.orders} label="Orders" value={`${data.totalOrders}`} sub={`${liveOrders.length} active in kitchen flow`} tone={delayed > 0 ? "warn" : "accent"} />
          <MetricCard icon={Icons.sessions} label="Active sessions" value={`${data.activeSessions}`} sub={`${data.completedSessions} completed today`} tone="ok" />
          <MetricCard icon={Icons.tables} label="Table occupancy" value={`${occupancy}%`} sub={`${occupiedTables}/${tableTotal || 0} tables occupied`} tone={occupancy > 85 ? "warn" : "accent"} />
        </div>

        <div className="mb-6 grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
          <Panel>
            <SectionHead
              icon={Icons.kitchen}
              title="Live Order Flow"
              action={<span className="font-mono text-[10px]" style={{ color: "var(--ink-400)" }}>refreshes every 10s</span>}
            />
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              <LivePill label="New" value={placed} />
              <LivePill label="Cooking" value={cooking} tone={cooking > 0 ? "warn" : "accent"} />
              <LivePill label="Ready" value={ready} tone="ok" />
              <LivePill label="Delayed" value={delayed} tone={delayed > 0 ? "bad" : "ok"} />
            </div>

            <div className="mt-4">
              {kdsQueue.isLoading ? (
                <EmptyLine text="Loading kitchen queue..." />
              ) : kdsQueue.isError ? (
                <EmptyLine text="Kitchen live queue is unavailable. Try refreshing this widget." />
              ) : latestOrders.length === 0 ? (
                <EmptyLine text="No active kitchen orders right now." />
              ) : (
                <div className="space-y-2">
                  {latestOrders.map((order) => (
                    <div key={order.id} className="flex items-center gap-3 rounded-[var(--r-md)] px-3 py-3" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full font-mono text-[10px] font-bold" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>
                        #{order.id.slice(-4).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>
                          {order.session?.table?.tableCode ? `Table ${order.session.table.tableCode}` : "Direct order"} - {order.orderItems.length} item{order.orderItems.length === 1 ? "" : "s"}
                        </div>
                        <div className="text-[11px]" style={{ color: "var(--ink-500)" }}>{minutesAgo(order.orderDateTime)} ago</div>
                      </div>
                      <span className="rounded-full px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider" style={{ background: order.orderStatus === "READY" ? "var(--ok-soft)" : "var(--accent-soft)", color: order.orderStatus === "READY" ? "var(--ok)" : "var(--accent)" }}>
                        {formatStatus(order.orderStatus)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>

          <Panel>
            <SectionHead icon={Icons.alert} title="Attention Now" />
            {activeAlerts.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>{Icons.check}</span>
                <p className="mt-3 text-[13px] font-semibold" style={{ color: "var(--ok)" }}>All clear</p>
                <p className="mt-1 text-[11px]" style={{ color: "var(--ink-400)" }}>No live operational issues need action.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeAlerts.map((alert) => (
                  <div key={alert} className="flex items-center gap-2.5 rounded-[var(--r-md)] px-3 py-3" style={{ background: "var(--warn-soft)", border: "1px solid #fde68a", color: "var(--warn)" }}>
                    {Icons.alert}
                    <span className="text-[12px] font-semibold">{alert}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <LivePill label="Avg check" value={money(avgCheck)} />
              <LivePill label="Open requests" value={data.openServiceRequests} tone={data.openServiceRequests > 0 ? "warn" : "ok"} />
            </div>
          </Panel>
        </div>

        <div className="mb-6">
          <DemandForecastPanel branchId={branchId ?? ""} />
        </div>

        <div className="mb-6">
          <BusinessInsightsPanel branchId={branchId ?? undefined} />
        </div>

        <div className="mb-6 grid gap-4 xl:grid-cols-3">
          <Panel>
            <SectionHead icon={Icons.trend} title="Analytics Snapshot" action={<Link href="/admin/analytics" className="text-[11px] font-semibold" style={{ color: "var(--accent)" }}>Open reports</Link>} />
            <div className="space-y-2.5">
              <div className="flex items-center justify-between rounded-[var(--r-md)] px-3 py-3" style={{ background: "var(--ink-50)" }}>
                <span className="text-[12px]" style={{ color: "var(--ink-600)" }}>Average prep</span>
                <span className="font-mono text-[13px] font-bold" style={{ color: "var(--ink-900)" }}>{insights.isError ? "Unavailable" : `${insights.data?.kitchen.avgPrepTimeMinutes ?? 0} min`}</span>
              </div>
              <div className="flex items-center justify-between rounded-[var(--r-md)] px-3 py-3" style={{ background: "var(--ink-50)" }}>
                <span className="text-[12px]" style={{ color: "var(--ink-600)" }}>Items cooked</span>
                <span className="font-mono text-[13px] font-bold" style={{ color: "var(--ink-900)" }}>{insights.isError ? "Unavailable" : insights.data?.kitchen.itemsCooked ?? 0}</span>
              </div>
              <div className="flex items-center justify-between rounded-[var(--r-md)] px-3 py-3" style={{ background: "var(--ink-50)" }}>
                <span className="text-[12px]" style={{ color: "var(--ink-600)" }}>Review pulse</span>
                <span className="font-mono text-[13px] font-bold" style={{ color: "var(--ink-900)" }}>{insights.isError ? "Unavailable" : reviewPulse?.avgRating ? `${reviewPulse.avgRating}/5` : "No reviews"}</span>
              </div>
              <div className="rounded-[var(--r-md)] px-3 py-3" style={{ background: topComplaint ? "var(--bad-soft)" : "var(--ink-50)", border: topComplaint ? "1px solid #fecaca" : "1px solid transparent" }}>
                <div className="text-[11px]" style={{ color: "var(--ink-500)" }}>Top complaint</div>
                <div className="mt-0.5 text-[13px] font-semibold" style={{ color: topComplaint ? "var(--bad)" : "var(--ink-500)" }}>
                  {topComplaint ? `${formatStatus(topComplaint.tag)} (${topComplaint.count})` : "No complaint tags in recent reviews"}
                </div>
              </div>
            </div>
          </Panel>

          <Panel>
            <SectionHead icon={Icons.star} title="Top Items Today" action={<Link href="/admin/menu" className="text-[11px] font-semibold" style={{ color: "var(--accent)" }}>Menu</Link>} />
            {topItems.isLoading ? (
              <EmptyLine text="Loading top sellers..." />
            ) : topItems.isError ? (
              <EmptyLine text="Top items are unavailable. Core totals still loaded." />
            ) : !topItems.data || topItems.data.length === 0 ? (
              <EmptyLine text="Top sellers appear once orders are placed." />
            ) : (
              <div className="space-y-2">
                {topItems.data.slice(0, 5).map((item, index) => (
                  <div key={item.menuItemId} className="flex items-center gap-3 rounded-[var(--r-md)] px-3 py-2.5" style={{ background: "var(--ink-50)" }}>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full font-mono text-[10px] font-bold" style={{ background: index < 3 ? "var(--accent)" : "var(--ink-200)", color: index < 3 ? "var(--ink-0)" : "var(--ink-600)" }}>{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-semibold" style={{ color: "var(--ink-900)" }}>{item.name}</div>
                      <div className="font-mono text-[9px]" style={{ color: "var(--ink-400)" }}>{item.quantitySold} sold</div>
                    </div>
                    <span className="font-mono text-[12px] font-bold" style={{ color: "var(--accent)" }}>{money(item.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel>
            <SectionHead icon={Icons.activity} title="Recent Activity" />
            {recentLogs.isLoading ? (
              <EmptyLine text="Loading activity..." />
            ) : recentLogs.isError ? (
              <EmptyLine text="Recent activity is unavailable for this branch." />
            ) : !recentLogs.data || recentLogs.data.length === 0 ? (
              <EmptyLine text="No recent branch activity." />
            ) : (
              <div className="space-y-2">
                {recentLogs.data.slice(0, 6).map((log) => (
                  <div key={log.id} className="flex items-center gap-3 rounded-[var(--r-md)] px-3 py-2.5" style={{ background: "var(--ink-50)" }}>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{Icons.activity}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-semibold" style={{ color: "var(--ink-900)" }}>{formatStatus(log.actionCode)}</div>
                      <div className="truncate text-[10px]" style={{ color: "var(--ink-500)" }}>{log.entityType}{log.actor?.name ? ` by ${log.actor.name}` : ""}</div>
                    </div>
                    <span className="font-mono text-[10px]" style={{ color: "var(--ink-400)" }}>{minutesAgo(log.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Panel>
            <SectionHead icon={Icons.tables} title="Table Snapshot" />
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(data.tables).map(([status, count]) => (
                <LivePill key={status} label={formatStatus(status)} value={count} tone={status === "occupied" ? "accent" : status === "cleaning" || status === "outOfService" ? "warn" : "ok"} />
              ))}
            </div>
          </Panel>

          <Panel>
            <SectionHead icon={Icons.trend} title="Recent Daily Snapshots" action={<Link href="/admin/analytics" className="text-[11px] font-semibold" style={{ color: "var(--accent)" }}>Details</Link>} />
            {snapshots.isLoading ? (
              <EmptyLine text="Loading snapshots..." />
            ) : snapshots.isError ? (
              <EmptyLine text="Daily snapshots are unavailable." />
            ) : !snapshots.data || snapshots.data.length === 0 ? (
              <EmptyLine text="No saved daily snapshots yet. Generate them from Analytics." />
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {snapshots.data.slice(0, 3).map((snapshot) => (
                  <div key={snapshot.id} className="rounded-[var(--r-md)] px-3 py-3" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
                    <div className="font-mono text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--ink-400)" }}>{dateOnly(new Date(snapshot.date))}</div>
                    <div className="mt-2 font-serif text-[22px] font-extrabold leading-none" style={{ color: "var(--ink-900)" }}>{money(snapshot.totalSales)}</div>
                    <div className="mt-1 text-[11px]" style={{ color: "var(--ink-500)" }}>{snapshot.totalOrders} orders / avg {money(snapshot.averageOrderValue)}</div>
                    <div className="mt-2 truncate text-[11px] font-semibold" style={{ color: "var(--accent)" }}>{snapshot.topItem?.name ?? "No top item"}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
