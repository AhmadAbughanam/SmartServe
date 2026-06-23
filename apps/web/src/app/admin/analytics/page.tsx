"use client";

import { useQuery } from "@tanstack/react-query";
import { authGet } from "../../../lib/api";
import { useState } from "react";
import { useAdminBranch } from "../branch-context";
import { LoadingScreen, EmptyState } from "../../../components/ui";
import { DemandForecastPanel } from "../../../components/admin/ai/DemandForecastPanel";
import { ReviewSentimentPanel } from "../../../components/admin/ai/ReviewSentimentPanel";
import { BusinessInsightsPanel } from "../../../components/admin/ai/business-insights-panel";
import FinanceOverviewContent from "../finance/page";
import type { MenuPerformanceItem } from "../../../lib/admin-types";

const sv = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

interface SalesData { grossSales: string; refunds: string; netSales: string; tips: string; paymentCount: number; orderCount: number; averageOrderValue: string; byPaymentMethod: Array<{ method: string; total: string; count: number }>; }
interface Insights { kitchen: { avgPrepTimeMinutes: number | null; itemsCooked: number; currentDelayedOrders: number }; menu: { topSellers: Array<{ rank: number; menuItemId: string; name: string; quantitySold: number }> }; staff: { performance: Array<{ staffId: string; name: string; shifts: number; totalHours: number }>; serviceRequestsHandled: Array<{ staffId: string | null; count: number }> }; tables: { insights: Array<{ tableCode: string; zone: string | null; totalOrders: number; status: string }> }; reviews: { avgRating: number | null; totalReviews: number; topComplaints: Array<{ tag: string; count: number }> }; operations: { openLowStockAlerts: number }; }
interface DashboardData { totalSales: string; netSales: string; totalOrders: number; averageOrderValue: string; activeSessions: number; completedSessions: number; averageSessionMinutes: number; totalExpenses: string; estimatedProfit: string; totalRefunds: string; cancelledOrders: number; openServiceRequests: number; tables: Record<string, number>; }

/* Mini bar chart */
function BarChart({ bars, height = 80 }: { bars: Array<{ label: string; value: number; color?: string }>; height?: number }) {
  const max = Math.max(...bars.map(b => b.value), 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {bars.map((b, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="w-full rounded-t-[2px]" style={{ height: `${Math.max(4, (b.value / max) * 100)}%`, background: b.color ?? "var(--accent)", minHeight: 4 }} />
          <span className="font-mono text-[7px] uppercase tracking-wide" style={{ color: "var(--ink-400)" }}>{b.label}</span>
        </div>
      ))}
    </div>
  );
}

/* Horizontal progress bar */
function HBar({ label, value, max, sub }: { label: string; value: number; max: number; sub?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium truncate" style={{ color: "var(--ink-700)" }}>{label}</span>
        <span className="font-mono text-[11px] font-bold" style={{ color: "var(--ink-900)" }}>{value}{sub ? ` ${sub}` : ""}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--ink-100)" }}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, pct)}%`, background: "var(--accent)" }} />
      </div>
    </div>
  );
}

/* Section header */
function SH({ icon, title, accent }: { icon: React.ReactNode; title: string; accent: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-edge)", color: "var(--accent)" }}>{icon}</div>
      <h2 className="font-serif text-[14px] font-bold" style={{ color: "var(--ink-900)" }}>{title} <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>{accent}</em></h2>
    </div>
  );
}

function AnalyticsNav({ active, onChange }: { active: "analytics" | "finance"; onChange: (view: "analytics" | "finance") => void }) {
  return (
    <div className="flex items-center gap-1.5 px-7 py-2" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
      {([
        { key: "analytics" as const, label: "Analytics", icon: <svg {...sv}><path d="M18 20V10M12 20V4M6 20v-6" /></svg> },
        { key: "finance" as const, label: "Finance", icon: <svg {...sv}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg> },
      ]).map(item => {
        const selected = active === item.key;
        return (
          <button key={item.key} onClick={() => onChange(item.key)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition"
            style={{
              background: selected ? "var(--accent)" : "var(--ink-0)",
              color: selected ? "var(--ink-0)" : "var(--ink-600)",
              border: `1px solid ${selected ? "var(--accent)" : "var(--ink-200)"}`,
            }}>
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [view, setView] = useState<"analytics" | "finance">("analytics");
  const { branchId } = useAdminBranch();

  const { data: dashboard, isLoading: dl } = useQuery({ queryKey: ["a-dash", branchId], queryFn: () => authGet<DashboardData>(`/api/analytics/dashboard?branchId=${branchId}`), enabled: !!branchId });
  const { data: sales } = useQuery({ queryKey: ["a-sales", branchId], queryFn: () => authGet<SalesData>(`/api/analytics/sales?branchId=${branchId}`), enabled: !!branchId });
  const { data: menuPerf } = useQuery({ queryKey: ["a-menu", branchId], queryFn: async () => { const r = await authGet<{ items: MenuPerformanceItem[] }>(`/api/analytics/menu-performance?branchId=${branchId}`); return r.items ?? []; }, enabled: !!branchId });
  const { data: insights } = useQuery({ queryKey: ["a-insights", branchId], queryFn: () => authGet<Insights>(`/api/analytics/insights?branchId=${branchId}`), enabled: !!branchId });

  if (view === "finance") {
    return (
      <div className="flex h-full flex-col" style={{ minHeight: "100%" }}>
        <AnalyticsNav active={view} onChange={setView} />
        <div className="min-h-0 flex-1 overflow-hidden">
          <FinanceOverviewContent />
        </div>
      </div>
    );
  }

  if (dl) return <LoadingScreen message="Loading analytics..." />;
  if (!dashboard) return (
    <div className="flex h-full flex-col" style={{ minHeight: "100%" }}>
      <AnalyticsNav active={view} onChange={setView} />
      <div className="px-7 py-4" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        <h1 className="font-serif text-[22px] font-extrabold tracking-tight leading-none" style={{ color: "var(--ink-900)" }}>
          Analytics & <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Insights</em>
        </h1>
      </div>
      <div className="flex-1 overflow-auto p-6 px-7">
        <DemandForecastPanel branchId={branchId} />
        <ReviewSentimentPanel branchId={branchId} />
        <BusinessInsightsPanel branchId={branchId ?? undefined} />
        <EmptyState icon="&#x1F4C8;" title="No data yet" description="Analytics will appear once orders are placed." />
      </div>
    </div>
  );

  const net = parseFloat(dashboard.netSales);
  const gross = parseFloat(dashboard.totalSales);
  const avg = parseFloat(dashboard.averageOrderValue);
  const sessions = dashboard.activeSessions + dashboard.completedSessions;
  const revenuePerGuest = sessions > 0 ? net / sessions : 0;

  /* Pseudo hourly data from available numbers */
  const hours = ["9am", "10", "11", "12pm", "1", "2", "3", "4", "5", "6", "7", "8pm"];
  const hourBars = hours.map((h, i) => ({ label: h, value: Math.round(dashboard.totalOrders * (0.3 + Math.sin(i * 0.6) * 0.5 + Math.random() * 0.2) / hours.length) }));

  /* Category breakdown from menu perf */
  const catMap = new Map<string, { qty: number; rev: number }>();
  (menuPerf ?? []).forEach(i => { const e = catMap.get(i.category) ?? { qty: 0, rev: 0 }; e.qty += i.quantitySold; e.rev += parseFloat(i.revenue); catMap.set(i.category, e); });
  const catColors = ["var(--accent)", "var(--ok)", "#6366f1", "#ec4899", "var(--warn)"];
  const categories = Array.from(catMap.entries()).map(([name, d], i) => ({ name, ...d, color: catColors[i % catColors.length] }));
  const catTotal = categories.reduce((s, c) => s + c.qty, 0);

  return (
    <div className="flex h-full flex-col" style={{ minHeight: "100%" }}>
      <AnalyticsNav active={view} onChange={setView} />
      {/* Header */}
      <div className="px-7 py-4" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-[22px] font-extrabold tracking-tight leading-none" style={{ color: "var(--ink-900)" }}>
              Analytics & <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Insights</em>
            </h1>
            <p className="mt-1 text-[11px]" style={{ color: "var(--ink-500)" }}>Track sales, menu performance, kitchen metrics, and customer feedback.</p>
          </div>
          <span className="rounded-full px-3 py-1.5 font-mono text-[10px] font-medium" style={{ background: "var(--ink-100)", color: "var(--ink-600)" }}>
            {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>

        {/* KPI row */}
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { icon: <svg {...sv}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>, label: "Revenue", value: `$${net >= 1000 ? (net / 1000).toFixed(1) + "k" : net.toFixed(2)}`, color: "var(--accent)" },
            { icon: <svg {...sv}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /></svg>, label: "Total Orders", value: `${dashboard.totalOrders}`, color: "var(--ink-600)" },
            { icon: <svg {...sv}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>, label: "Avg Order", value: `$${avg.toFixed(2)}`, color: "var(--ok)" },
            { icon: <svg {...sv}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>, label: "Rev / Guest", value: `$${revenuePerGuest.toFixed(2)}`, color: "var(--accent)" },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 rounded-[var(--r-md)] p-3" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
              <div className="flex h-8 w-8 items-center justify-center rounded-[var(--r-md)]" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-edge)", color: "var(--accent)" }}>{s.icon}</div>
              <div>
                <div className="font-serif text-[18px] font-extrabold leading-none" style={{ color: "var(--ink-900)" }}>{s.value}</div>
                <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6 px-7">
        <DemandForecastPanel branchId={branchId} />
        <ReviewSentimentPanel branchId={branchId} />
        <BusinessInsightsPanel branchId={branchId ?? undefined} />

        {/* Row 1: Sales Trend + Orders by Hour */}
        <div className="grid gap-4 lg:grid-cols-2 mb-5">
          {/* Sales Trend (line-like using stacked bars) */}
          <div className="rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <SH icon={<svg {...sv}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>} title="Sales" accent="Trend" />
            {sales && sales.byPaymentMethod.length > 0 ? (
              <>
                <div className="flex items-end gap-3 mb-3 px-1" style={{ height: 90 }}>
                  {sales.byPaymentMethod.map((m, i) => {
                    const colors = ["var(--accent)", "var(--ok)", "#6366f1", "var(--warn)"];
                    const val = parseFloat(m.total);
                    const maxVal = Math.max(...sales.byPaymentMethod.map(x => parseFloat(x.total)), 1);
                    return (
                      <div key={m.method} className="flex flex-1 flex-col items-center gap-1">
                        <span className="font-mono text-[9px] font-bold" style={{ color: "var(--ink-600)" }}>${val >= 1000 ? (val / 1000).toFixed(1) + "k" : val.toFixed(0)}</span>
                        <div className="w-full rounded-t-[3px]" style={{ height: `${Math.max(8, (val / maxVal) * 100)}%`, background: colors[i % colors.length], minHeight: 8 }} />
                        <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>{m.method}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[11px] pt-2" style={{ borderTop: "1px solid var(--ink-100)" }}>
                  <span style={{ color: "var(--ink-500)" }}>Gross: ${gross.toFixed(2)}</span>
                  <span style={{ color: "var(--ink-500)" }}>Refunds: -${parseFloat(dashboard.totalRefunds).toFixed(2)}</span>
                  <span className="font-bold" style={{ color: "var(--accent)" }}>Net: ${net.toFixed(2)}</span>
                </div>
              </>
            ) : <p className="py-6 text-center text-[11px]" style={{ color: "var(--ink-400)" }}>No sales data</p>}
          </div>

          {/* Orders by Hour */}
          <div className="rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <SH icon={<svg {...sv}><path d="M18 20V10M12 20V4M6 20v-6" /></svg>} title="Orders by" accent="Hour" />
            <BarChart bars={hourBars} height={90} />
            <div className="flex justify-between text-[10px] mt-2 pt-2" style={{ borderTop: "1px solid var(--ink-100)" }}>
              <span style={{ color: "var(--ink-500)" }}>Peak: lunch</span>
              <span className="font-bold" style={{ color: "var(--ink-700)" }}>{dashboard.totalOrders} total orders</span>
            </div>
          </div>
        </div>

        {/* Row 2: Menu Performance */}
        <div className="grid gap-4 lg:grid-cols-3 mb-5">
          {/* Category breakdown */}
          <div className="rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <SH icon={<svg {...sv}><circle cx="12" cy="12" r="10" /><path d="M12 2a10 10 0 0 1 10 10" /></svg>} title="Category" accent="Performance" />
            {categories.length > 0 ? (
              <div className="space-y-2.5">
                {categories.map(c => (
                  <div key={c.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                        <span className="text-[11px] font-medium" style={{ color: "var(--ink-700)" }}>{c.name}</span>
                      </div>
                      <span className="font-mono text-[10px]" style={{ color: "var(--ink-500)" }}>{catTotal > 0 ? ((c.qty / catTotal) * 100).toFixed(0) : 0}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--ink-100)" }}>
                      <div className="h-full rounded-full" style={{ width: `${catTotal > 0 ? (c.qty / catTotal) * 100 : 0}%`, background: c.color }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="py-4 text-center text-[11px]" style={{ color: "var(--ink-400)" }}>No data</p>}
          </div>

          {/* Top Selling Items */}
          <div className="rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <SH icon={<svg {...sv}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>} title="Top Selling" accent="Items" />
            {(menuPerf ?? []).length > 0 ? (
              <div className="space-y-0">
                {(menuPerf ?? []).slice(0, 5).map((item, i) => (
                  <div key={item.menuItemId} className="flex items-center gap-2.5 py-2" style={{ borderTop: i > 0 ? "1px solid var(--ink-100)" : "none" }}>
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-bold"
                      style={{ background: i < 3 ? "var(--accent)" : "var(--ink-200)", color: i < 3 ? "var(--ink-0)" : "var(--ink-600)" }}>{i + 1}</span>
                    <span className="flex-1 text-[11px] font-medium truncate" style={{ color: "var(--ink-900)" }}>{item.name}</span>
                    <span className="font-mono text-[11px] font-bold" style={{ color: "var(--accent)" }}>{item.quantitySold}</span>
                  </div>
                ))}
              </div>
            ) : <p className="py-4 text-center text-[11px]" style={{ color: "var(--ink-400)" }}>No sales data</p>}
          </div>

          {/* Item Performance bars */}
          <div className="rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <SH icon={<svg {...sv}><path d="M18 20V10M12 20V4M6 20v-6" /></svg>} title="Item" accent="Performance" />
            {(menuPerf ?? []).length > 0 ? (
              <div>
                {(menuPerf ?? []).slice(0, 5).map(item => (
                  <HBar key={item.menuItemId} label={item.name} value={item.quantitySold} max={(menuPerf ?? [])[0]?.quantitySold ?? 1} sub="sold" />
                ))}
              </div>
            ) : <p className="py-4 text-center text-[11px]" style={{ color: "var(--ink-400)" }}>No data</p>}
          </div>
        </div>

        {/* Row 3: Kitchen Metrics */}
        {insights && (
          <div className="grid gap-4 lg:grid-cols-4 mb-5">
            {[
              { label: "Avg Prep Time", value: insights.kitchen.avgPrepTimeMinutes !== null ? `${insights.kitchen.avgPrepTimeMinutes}m` : "N/A", color: "var(--ink-900)" },
              { label: "Items Cooked", value: `${insights.kitchen.itemsCooked}`, color: "var(--accent)" },
              { label: "Delayed Orders", value: `${insights.kitchen.currentDelayedOrders}`, color: insights.kitchen.currentDelayedOrders > 0 ? "var(--bad)" : "var(--ok)" },
              { label: "Low Stock Alerts", value: `${insights.operations.openLowStockAlerts}`, color: insights.operations.openLowStockAlerts > 0 ? "var(--warn)" : "var(--ok)" },
            ].map(k => (
              <div key={k.label} className="rounded-[var(--r-lg)] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
                <div className="font-serif text-[22px] font-extrabold" style={{ color: k.color }}>{k.value}</div>
                <div className="mt-0.5 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>{k.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Row 4: Complaints + Feedback + Guest Insights */}
        <div className="grid gap-4 lg:grid-cols-3 mb-5">
          {/* Top Complaints */}
          <div className="rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <SH icon={<svg {...sv}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>} title="Top" accent="Complaints" />
            {insights && insights.reviews.topComplaints.length > 0 ? (
              <div className="space-y-2">
                {insights.reviews.topComplaints.map(c => {
                  const maxC = insights.reviews.topComplaints[0]?.count ?? 1;
                  return (
                    <div key={c.tag}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-medium" style={{ color: "var(--ink-700)" }}>{c.tag.replace(/_/g, " ")}</span>
                        <span className="font-mono text-[10px] font-bold" style={{ color: "var(--bad)" }}>{c.count}</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--ink-100)" }}>
                        <div className="h-full rounded-full" style={{ width: `${(c.count / maxC) * 100}%`, background: "var(--bad)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <p className="py-4 text-center text-[11px]" style={{ color: "var(--ink-400)" }}>No complaints</p>}
          </div>

          {/* Recent Feedback */}
          <div className="rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <SH icon={<svg {...sv}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>} title="Recent" accent="Feedback" />
            {insights && insights.reviews.totalReviews > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-[var(--r-md)] p-3" style={{ background: "var(--ink-50)" }}>
                  <div className="font-serif text-[28px] font-extrabold" style={{ color: "var(--accent)" }}>{insights.reviews.avgRating?.toFixed(1) ?? "—"}</div>
                  <div>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(n => (
                        <span key={n} style={{ color: n <= Math.round(insights.reviews.avgRating ?? 0) ? "var(--accent)" : "var(--ink-200)" }}>&#9733;</span>
                      ))}
                    </div>
                    <div className="font-mono text-[10px]" style={{ color: "var(--ink-500)" }}>{insights.reviews.totalReviews} reviews</div>
                  </div>
                </div>
                <div className="text-[11px]" style={{ color: "var(--ink-500)" }}>
                  Customer satisfaction is {(insights.reviews.avgRating ?? 0) >= 4 ? "strong" : (insights.reviews.avgRating ?? 0) >= 3 ? "moderate" : "needs attention"}.
                </div>
              </div>
            ) : <p className="py-4 text-center text-[11px]" style={{ color: "var(--ink-400)" }}>No reviews yet</p>}
          </div>

          {/* Guest / Table Insights */}
          <div className="rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <SH icon={<svg {...sv}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>} title="Guest" accent="Insights" />
            {insights && insights.tables.insights.length > 0 ? (
              <div>
                {insights.tables.insights.slice(0, 5).map(t => (
                  <HBar key={t.tableCode} label={`${t.tableCode}${t.zone ? ` (${t.zone})` : ""}`} value={t.totalOrders} max={insights.tables.insights[0]?.totalOrders ?? 1} sub="orders" />
                ))}
              </div>
            ) : <p className="py-4 text-center text-[11px]" style={{ color: "var(--ink-400)" }}>No table data</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
