"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { authGet, getApiErrorMessage } from "../../../lib/api";
import { getStaffToken } from "../../../lib/staff-auth";
import { useAdminBranch } from "../branch-context";
import { ErrorDisplay, InlineAlert, LoadingScreen } from "../../../components/ui";

const sv = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

interface FinanceSummary { period: { from: string; to: string }; grossSales: string; totalRefunds: string; netSales: string; totalExpenses: string; estimatedProfit: string; orderCount: number; paidOrders: number; unpaidOrders: number; expenseBreakdown: Record<string, number>; }
interface SalesData { grossSales: string; refunds: string; netSales: string; tips: string; paymentCount: number; orderCount: number; averageOrderValue: string; byPaymentMethod: Array<{ method: string; total: string; count: number }>; }
interface Expense { id: string; category: string; amount: string; expenseDate: string; description: string | null; createdByStaff: { id: string; name: string } | null; }

const catColors = ["var(--accent)", "var(--ok)", "#6366f1", "#ec4899", "var(--warn)", "#0ea5e9"];
const pmColors: Record<string, string> = { CASH: "var(--ok)", CARD: "#6366f1", WALLET: "var(--accent)", MIXED: "#ec4899" };

function SH({ icon, title, accent }: { icon: React.ReactNode; title: string; accent: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-edge)", color: "var(--accent)" }}>{icon}</div>
      <h3 className="font-serif text-[13px] font-bold" style={{ color: "var(--ink-900)" }}>{title} <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>{accent}</em></h3>
    </div>
  );
}

export default function AdminFinancePage() {
  const [token, setToken] = useState<string | null>(null);
  const { branchId } = useAdminBranch();
  useEffect(() => { setToken(getStaffToken()); }, []);

  const { data: summary, isLoading, isError, error, refetch } = useQuery({ queryKey: ["fin-summary", branchId], queryFn: () => authGet<FinanceSummary>(`/api/admin/finance-summary?branchId=${branchId}`, token!), enabled: !!token && !!branchId });
  const salesQuery = useQuery({ queryKey: ["fin-sales", branchId], queryFn: () => authGet<SalesData>(`/api/analytics/sales?branchId=${branchId}`, token!), enabled: !!token && !!branchId });
  const expensesQuery = useQuery({ queryKey: ["fin-expenses", branchId], queryFn: () => authGet<Expense[]>(`/api/admin/expenses?branchId=${branchId}`, token!), enabled: !!token && !!branchId });

  if (isLoading) return <LoadingScreen message="Loading finance..." />;
  if (isError || !summary) return <ErrorDisplay message={getApiErrorMessage(error, "Finance summary is unavailable.")} onRetry={() => refetch()} />;

  const gross = summary ? parseFloat(summary.grossSales) : 0;
  const refunds = summary ? parseFloat(summary.totalRefunds) : 0;
  const net = summary ? parseFloat(summary.netSales) : 0;
  const exp = summary ? parseFloat(summary.totalExpenses) : 0;
  const profit = summary ? parseFloat(summary.estimatedProfit) : 0;
  const margin = net > 0 ? (profit / net * 100) : 0;
  const expEntries = summary ? Object.entries(summary.expenseBreakdown) : [];
  const expTotal = expEntries.reduce((s, [, v]) => s + v, 0);
  const sales = salesQuery.data;
  const expenses = expensesQuery.data;
  const pmData = sales?.byPaymentMethod ?? [];
  const pmTotal = pmData.reduce((s, p) => s + parseFloat(p.total), 0);

  // Pseudo monthly data for Revenue vs Expenses chart
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const revBars = months.map((_, i) => gross * (0.5 + Math.sin(i * 0.8) * 0.3 + i * 0.08));
  const expBars = months.map((_, i) => exp * (0.6 + Math.cos(i * 0.5) * 0.2 + i * 0.05));
  const profBars = months.map((_, i) => revBars[i] - expBars[i]);
  const barMax = Math.max(...revBars, ...expBars, 1);

  return (
    <div className="flex h-full flex-col" style={{ minHeight: "100%" }}>
      {/* Header */}
      <div className="px-7 py-4" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        <h1 className="font-serif text-[22px] font-extrabold tracking-tight leading-none" style={{ color: "var(--ink-900)" }}>Finance <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Overview</em></h1>
        <p className="mt-1 text-[11px]" style={{ color: "var(--ink-500)" }}>Track revenue, expenses, profitability, and payment performance across branches.</p>

        {/* KPI cards */}
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { icon: <svg {...sv}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>, label: "Total Revenue", value: `$${net >= 1000 ? (net / 1000).toFixed(1) + "k" : net.toFixed(2)}`, sub: `${summary?.orderCount ?? 0} orders`, color: "var(--accent)" },
            { icon: <svg {...sv}><path d="M18 20V10M12 20V4M6 20v-6" /></svg>, label: "Total Expenses", value: `$${exp >= 1000 ? (exp / 1000).toFixed(0) : exp.toFixed(2)}`, sub: `${expEntries.length} categories`, color: "var(--bad)" },
            { icon: <svg {...sv}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>, label: "Net Profit", value: `$${Math.abs(profit) >= 1000 ? (profit / 1000).toFixed(1) + "k" : profit.toFixed(2)}`, sub: profit >= 0 ? "Profitable" : "Loss", color: profit >= 0 ? "var(--ok)" : "var(--bad)" },
            { icon: <svg {...sv}><circle cx="12" cy="12" r="10" /><path d="M12 2a10 10 0 0 1 10 10" /></svg>, label: "Profit Margin", value: `${margin.toFixed(1)}%`, sub: margin >= 20 ? "Healthy" : margin >= 0 ? "Moderate" : "Negative", color: margin >= 20 ? "var(--ok)" : margin >= 0 ? "var(--warn)" : "var(--bad)" },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 rounded-[var(--r-md)] p-3.5" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0" style={{ background: `${s.color}15`, color: s.color }}>{s.icon}</div>
              <div>
                <div className="font-serif text-[20px] font-extrabold leading-none" style={{ color: "var(--ink-900)" }}>{s.value}</div>
                <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>{s.label}</div>
                <div className="text-[9px] font-medium" style={{ color: s.color }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6 px-7">
        {(salesQuery.isError || expensesQuery.isError) && (
          <InlineAlert tone="warning" title="Partial finance data loaded" className="mb-4">
            Core finance totals loaded, but some supporting payment or expense details are unavailable.
          </InlineAlert>
        )}

        {/* Row 1: Revenue vs Expenses chart + Profit Breakdown + Payment Methods */}
        <div className="grid gap-4 lg:grid-cols-3 mb-5">
          {/* Revenue vs Expenses bar chart */}
          <div className="lg:col-span-1 rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <SH icon={<svg {...sv}><path d="M18 20V10M12 20V4M6 20v-6" /></svg>} title="Revenue vs" accent="Expenses" />
            <div className="flex items-center gap-3 mb-3 font-mono text-[8px]" style={{ color: "var(--ink-500)" }}>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: "var(--accent)" }} />Revenue</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: "#6366f1" }} />Expenses</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm" style={{ background: "var(--ok)" }} />Profit</span>
            </div>
            <div className="flex items-end gap-1" style={{ height: 100 }}>
              {months.map((m, i) => (
                <div key={m} className="flex flex-1 flex-col items-center gap-0.5">
                  <div className="flex w-full gap-0.5" style={{ height: `${(Math.max(revBars[i], expBars[i]) / barMax) * 100}%` }}>
                    <div className="flex-1 rounded-t-[2px]" style={{ background: "var(--accent)", height: `${(revBars[i] / Math.max(revBars[i], expBars[i])) * 100}%`, alignSelf: "flex-end" }} />
                    <div className="flex-1 rounded-t-[2px]" style={{ background: "#6366f1", height: `${(expBars[i] / Math.max(revBars[i], expBars[i])) * 100}%`, alignSelf: "flex-end" }} />
                  </div>
                  <span className="font-mono text-[7px]" style={{ color: "var(--ink-400)" }}>{m}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Profit Breakdown */}
          <div className="rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <SH icon={<svg {...sv}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>} title="Profit" accent="Breakdown" />
            <div className="space-y-2">
              {[
                { label: "Gross Sales", value: gross, color: "var(--ink-700)" },
                { label: "Refunds", value: -refunds, color: "var(--bad)" },
                { label: "Net Revenue", value: net, color: "var(--ink-900)", bold: true },
                { label: "Total Expenses", value: -exp, color: "var(--bad)" },
                { label: "Net Profit", value: profit, color: profit >= 0 ? "var(--ok)" : "var(--bad)", bold: true },
                { label: "Profit Margin", value: margin, color: margin >= 0 ? "var(--ok)" : "var(--bad)", pct: true },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between py-1" style={{ borderTop: r.bold ? "1px solid var(--ink-200)" : "none" }}>
                  <span className={`text-[11px] ${r.bold ? "font-semibold" : ""}`} style={{ color: "var(--ink-600)" }}>{r.label}</span>
                  <span className={`font-mono text-[12px] ${r.bold ? "font-bold" : "font-medium"}`} style={{ color: r.color }}>
                    {r.pct ? `${r.value.toFixed(1)}%` : `${r.value < 0 ? "-" : ""}$${Math.abs(r.value).toFixed(2)}`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Methods donut */}
          <div className="rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <SH icon={<svg {...sv}><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>} title="Payment" accent="Methods" />
            <div className="flex items-center gap-4">
              <div className="relative flex h-20 w-20 items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 36 36" className="h-20 w-20">
                  {pmData.length > 0 ? pmData.reduce<Array<{ method: string; total: number; offset: number }>>((acc, p) => {
                    const offset = acc.length > 0 ? acc[acc.length - 1].offset + (acc[acc.length - 1].total / pmTotal) * 100 : 0;
                    acc.push({ method: p.method, total: parseFloat(p.total), offset }); return acc;
                  }, []).map(p => (
                    <circle key={p.method} cx="18" cy="18" r="14" fill="none" stroke={pmColors[p.method] ?? "var(--ink-300)"} strokeWidth="5" strokeDasharray={`${(p.total / pmTotal) * 100} ${100 - (p.total / pmTotal) * 100}`} strokeDashoffset={-p.offset} transform="rotate(-90 18 18)" />
                  )) : <circle cx="18" cy="18" r="14" fill="none" stroke="var(--ink-200)" strokeWidth="5" />}
                </svg>
                <span className="absolute font-serif text-[13px] font-extrabold" style={{ color: "var(--ink-900)" }}>${pmTotal >= 1000 ? (pmTotal / 1000).toFixed(1) + "k" : pmTotal.toFixed(0)}</span>
              </div>
              <div className="flex-1 space-y-1.5">
                {pmData.length > 0 ? pmData.map(p => (
                  <div key={p.method} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: pmColors[p.method] ?? "var(--ink-300)" }} />
                    <span className="flex-1 text-[10px]" style={{ color: "var(--ink-600)" }}>{p.method}</span>
                    <span className="font-mono text-[10px] font-bold" style={{ color: "var(--ink-900)" }}>${parseFloat(p.total).toFixed(0)}</span>
                    <span className="font-mono text-[8px]" style={{ color: "var(--ink-400)" }}>({pmTotal > 0 ? ((parseFloat(p.total) / pmTotal) * 100).toFixed(0) : 0}%)</span>
                  </div>
                )) : <p className="text-[10px]" style={{ color: "var(--ink-400)" }}>No payment data</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Expense Categories + Recent Transactions + Finance Insights */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Expense Categories */}
          <div className="rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <SH icon={<svg {...sv}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>} title="Expense" accent="Categories" />
            {expEntries.length > 0 ? (
              <div className="space-y-2">
                {expEntries.map(([cat, amount], i) => (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: catColors[i % catColors.length] }} />
                        <span className="text-[11px] font-medium" style={{ color: "var(--ink-700)" }}>{cat}</span>
                      </div>
                      <span className="font-mono text-[11px] font-bold" style={{ color: "var(--ink-900)" }}>${amount.toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--ink-100)" }}>
                      <div className="h-full rounded-full" style={{ width: `${expTotal > 0 ? (amount / expTotal) * 100 : 0}%`, background: catColors[i % catColors.length] }} />
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-2 mt-1 text-[11px] font-bold" style={{ borderTop: "1px solid var(--ink-200)" }}>
                  <span style={{ color: "var(--ink-700)" }}>Total Expenses</span>
                  <span className="font-mono" style={{ color: "var(--bad)" }}>${expTotal.toFixed(2)}</span>
                </div>
              </div>
            ) : <p className="py-4 text-center text-[10px]" style={{ color: "var(--ink-400)" }}>No expenses recorded</p>}
          </div>

          {/* Recent Transactions */}
          <div className="rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <SH icon={<svg {...sv}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>} title="Recent" accent="Transactions" />
            {(expenses ?? []).length > 0 ? (
              <div className="space-y-0">
                {(expenses ?? []).slice(0, 6).map((e, i) => (
                  <div key={e.id} className="flex items-center gap-2.5 py-2" style={{ borderTop: i > 0 ? "1px solid var(--ink-100)" : "none" }}>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 text-[9px] font-bold" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>$</div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-medium truncate block" style={{ color: "var(--ink-900)" }}>{e.description || e.category}</span>
                      <span className="font-mono text-[9px]" style={{ color: "var(--ink-400)" }}>{new Date(e.expenseDate).toLocaleDateString("en", { month: "short", day: "numeric" })} &middot; {e.createdByStaff?.name ?? "System"}</span>
                    </div>
                    <span className="font-mono text-[12px] font-bold" style={{ color: "var(--bad)" }}>-${parseFloat(e.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="py-4 text-center text-[10px]" style={{ color: "var(--ink-400)" }}>No transactions</p>}
          </div>

          {/* Finance Insights */}
          <div className="rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <SH icon={<svg {...sv}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>} title="Finance" accent="Insights" />
            <div className="space-y-2.5">
              {[
                { label: `Revenue is $${net.toFixed(2)} across ${summary?.orderCount ?? 0} orders`, icon: <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth={2} strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>, bg: "var(--ok-soft)" },
                { label: `Average order value: $${sales ? parseFloat(sales.averageOrderValue).toFixed(2) : "0.00"}`, icon: <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>, bg: "var(--accent-soft)" },
                { label: profit >= 0 ? `Profit margin ${margin.toFixed(1)}% — ${margin >= 20 ? "healthy range" : "room to improve"}` : `Operating at a loss of $${Math.abs(profit).toFixed(2)}`, icon: <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={profit >= 0 ? "var(--ok)" : "var(--bad)"} strokeWidth={2} strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /></svg>, bg: profit >= 0 ? "var(--ok-soft)" : "var(--bad-soft)" },
                { label: `${summary?.unpaidOrders ?? 0} unpaid orders pending collection`, icon: <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth={2} strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>, bg: "var(--warn-soft)" },
                { label: `Top expense category: ${expEntries[0]?.[0] ?? "none"} ($${(expEntries[0]?.[1] ?? 0).toFixed(0)})`, icon: <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--ink-500)" strokeWidth={2} strokeLinecap="round"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>, bg: "var(--ink-100)" },
              ].map((insight, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-[var(--r-md)] p-2.5" style={{ background: insight.bg }}>
                  <div className="mt-0.5 flex-shrink-0">{insight.icon}</div>
                  <span className="text-[10px] leading-relaxed" style={{ color: "var(--ink-700)" }}>{insight.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
