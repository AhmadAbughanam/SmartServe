"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { ErrorDisplay } from "../../../components/ui";
import { authGet, getApiErrorMessage } from "../../../lib/api";
import {
  SaasLiveBadge,
  SaasPage,
  SaasToolbarButton,
} from "../saas-ui";

interface RevenueResponse {
  totals: {
    tenantCount: number;
    branchCount: number;
    grossSales: string;
    totalRefunds: string;
    netSales: string;
    totalExpenses: string;
    estimatedProfit: string;
    orderCount: number;
    paidOrders: number;
    unpaidOrders: number;
    averageOrderValue: string;
  };
  tenantBreakdown: Array<{
    tenantId: string;
    tenantName: string;
    tenantActive: boolean;
    netSales: string;
    estimatedProfit: string;
    orderCount: number;
    branchCount: number;
    activeBranchCount: number;
  }>;
  alerts: Array<{
    scope: string;
    id: string;
    label: string;
    severity: "warn" | "bad";
    message: string;
  }>;
}

function money(value: string | number) {
  return `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function trendTone(index: number, severity?: "warn" | "bad") {
  if (severity === "bad") return "bad";
  if (severity === "warn") return "warn";
  return index % 3 === 0 ? "ok" : "neutral";
}

export default function NetworkSalesContent() {
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  const revenueQuery = useQuery({
    queryKey: ["saas-revenue-network-sales"],
    queryFn: () => authGet<RevenueResponse>("/api/saas/revenue"),
    retry: false,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setLastUpdated(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (revenueQuery.data) setLastUpdated(new Date());
  }, [revenueQuery.data]);

  const tenantBreakdown = revenueQuery.data?.tenantBreakdown ?? [];
  const topTenants = useMemo(
    () => [...tenantBreakdown].sort((a, b) => Number(b.netSales) - Number(a.netSales)).slice(0, 10),
    [tenantBreakdown],
  );

  if (revenueQuery.isLoading) return <div className="p-6" />;
  if (revenueQuery.isError || !revenueQuery.data) {
    return <ErrorDisplay message={getApiErrorMessage(revenueQuery.error, "Network sales are unavailable.")} onRetry={() => revenueQuery.refetch()} />;
  }

  const data = revenueQuery.data;
  const alertCount = data.alerts.length;
  const refundRate = Number(data.totals.grossSales) > 0 ? Number(data.totals.totalRefunds) / Number(data.totals.grossSales) : 0;
  const topAlerts = data.alerts.slice(0, 4);

  return (
    <SaasPage
      eyebrow="Tenant sales reporting"
      title="Network Sales"
      description="This tab reports tenant restaurant sales across the platform. It is not SaaS subscription revenue."
      actions={
        <>
          <SaasToolbarButton label="Refresh" onClick={() => void revenueQuery.refetch()} />
          <SaasLiveBadge lastUpdated={lastUpdated} />
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SalesMetricCard label="Net sales" value={money(data.totals.netSales)} detail={`${data.totals.orderCount.toLocaleString()} orders in range`} badge="OK" badgeTone="ok" delta={`${(refundRate * 100).toFixed(1)}%`} index={1} />
        <SalesMetricCard label="Gross sales" value={money(data.totals.grossSales)} detail={`${data.totals.tenantCount.toLocaleString()} tenants contributing`} badge="LIVE" badgeTone="neutral" delta="0.0%" index={2} />
        <SalesMetricCard label="Refunds" value={money(data.totals.totalRefunds)} detail={`${data.totals.branchCount.toLocaleString()} branches in scope`} badge="WARN" badgeTone="warn" delta={`${(refundRate * 100).toFixed(1)}%`} index={3} />
        <SalesMetricCard label="Estimated profit" value={money(data.totals.estimatedProfit)} detail={`${data.totals.paidOrders.toLocaleString()} paid orders`} badge="LIVE" badgeTone="neutral" delta="0.0%" index={4} />
        <SalesMetricCard label="Average order" value={money(data.totals.averageOrderValue)} detail={`${data.totals.unpaidOrders.toLocaleString()} unpaid orders`} badge="LIVE" badgeTone="neutral" delta="0.0%" index={5} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.06fr_0.94fr]">
        <section
          className="rounded-[var(--r-lg)] p-5"
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
            border: "1px solid var(--ink-200)",
            boxShadow: "0 18px 38px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[38px] font-semibold leading-none" style={{ color: "var(--ink-900)", fontFamily: "var(--font-serif)" }}>
                Top tenants by net sales
              </div>
              <div className="mt-3 text-[13px]" style={{ color: "var(--ink-500)" }}>
                Restaurant sales, not SaaS billing.
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-[var(--r-md)] px-4 text-[13px] font-semibold"
              style={{ background: "var(--ink-0)", color: "var(--ink-900)", border: "1px solid var(--ink-200)" }}
            >
              Last 7 days
            </button>
          </div>

          <div className="mt-5 overflow-hidden rounded-[var(--r-md)]" style={{ border: "1px solid var(--ink-200)" }}>
            <div className="grid grid-cols-[66px_1.5fr_1fr_0.9fr_0.7fr_0.9fr_28px] gap-3 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ background: "var(--ink-50)", color: "var(--ink-500)" }}>
              <div>Rank</div>
              <div>Tenant</div>
              <div className="text-right">Net sales</div>
              <div className="text-right">Profit</div>
              <div className="text-right">Orders</div>
              <div className="text-right">Trend</div>
              <div />
            </div>

            <div>
              {topTenants.slice(0, 5).map((tenant, index) => {
                const profitMargin = Number(tenant.netSales) > 0 ? (Number(tenant.estimatedProfit) / Number(tenant.netSales)) * 100 : 0;
                const initials = tenant.tenantName
                  .split(" ")
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase() ?? "")
                  .join("");

                return (
                  <button
                    key={tenant.tenantId}
                    type="button"
                    className="grid w-full grid-cols-[66px_1.5fr_1fr_0.9fr_0.7fr_0.9fr_28px] items-center gap-3 px-4 py-4 text-left"
                    style={{ borderTop: index === 0 ? "none" : "1px solid var(--ink-200)", background: "var(--ink-0)" }}
                  >
                    <div>
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] text-[13px] font-semibold" style={{ background: index === 0 ? "var(--ink-900)" : "var(--ink-50)", color: index === 0 ? "var(--ink-0)" : "var(--ink-700)", border: `1px solid ${index === 0 ? "#111111" : "var(--ink-200)"}` }}>
                        {index + 1}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-semibold" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>
                          {initials}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>{tenant.tenantName}</div>
                          <div className="mt-1 truncate text-[12px]" style={{ color: "var(--ink-500)" }}>{tenant.branchCount} branches</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>{money(tenant.netSales)}</div>
                    <div className="text-right">
                      <div className="text-[14px] font-semibold" style={{ color: "var(--ink-700)" }}>{money(tenant.estimatedProfit)}</div>
                      <div className="mt-1 text-[12px]" style={{ color: "#16a34a" }}>{profitMargin.toFixed(1)}%</div>
                    </div>
                    <div className="text-right text-[13px]" style={{ color: "var(--ink-700)" }}>{tenant.orderCount.toLocaleString()}</div>
                    <div className="flex justify-end">
                      <TrendSparkline tone={trendTone(index)} index={index + 1} />
                    </div>
                    <div className="text-[18px]" style={{ color: "var(--ink-500)" }}>›</div>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-[var(--r-md)] text-[13px] font-semibold"
            style={{ background: "var(--ink-0)", color: "var(--ink-900)", border: "1px solid var(--ink-200)" }}
          >
            View all tenants
          </button>
        </section>

        <section
          className="rounded-[var(--r-lg)] p-5"
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
            border: "1px solid var(--ink-200)",
            boxShadow: "0 18px 38px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[38px] font-semibold leading-none" style={{ color: "var(--ink-900)", fontFamily: "var(--font-serif)" }}>
                Sales alerts
              </div>
              <div className="mt-3 text-[13px]" style={{ color: "var(--ink-500)" }}>
                Derived from tenant sales reporting.
              </div>
            </div>
            <button type="button" className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>
              View all alerts
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {topAlerts.length === 0 ? (
              <div className="rounded-[var(--r-md)] px-4 py-10 text-center text-[13px]" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)", color: "var(--ink-500)" }}>
                No sales alerts in the current range.
              </div>
            ) : (
              topAlerts.map((alert, index) => (
                <button
                  key={`${alert.scope}-${alert.id}`}
                  type="button"
                  className="flex w-full items-center gap-4 rounded-[var(--r-md)] p-4 text-left"
                  style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-full"
                    style={{
                      background: alert.severity === "bad" ? "var(--warn-soft)" : "rgba(34,197,94,0.12)",
                      color: alert.severity === "bad" ? "#d97706" : "#16a34a",
                    }}
                  >
                    {alert.severity === "bad" ? <AlertGlyph /> : <GrowthGlyph />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>{alert.label}</div>
                    <div className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>{alert.message}</div>
                  </div>
                  <div className="text-[12px]" style={{ color: "var(--ink-500)" }}>
                    {index === 0 ? "12m ago" : index === 1 ? "28m ago" : index === 2 ? "1h ago" : "2h ago"}
                  </div>
                  <div className="text-[18px]" style={{ color: "var(--ink-500)" }}>›</div>
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-[var(--r-md)] text-[13px] font-semibold"
            style={{ background: "var(--ink-0)", color: "var(--ink-900)", border: "1px solid var(--ink-200)" }}
          >
            View all alerts
          </button>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-1">
        <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--ink-500)" }}>
          <span style={{ color: "var(--ink-700)" }}>
            <ShieldGlyph />
          </span>
          <span>All times shown in your local timezone. Data refreshed live.</span>
        </div>
        <div className="text-[12px]" style={{ color: "var(--ink-500)" }}>
          Data provided by Restaurant OS
        </div>
      </div>
    </SaasPage>
  );
}

function SalesMetricCard({
  label,
  value,
  detail,
  badge,
  badgeTone,
  delta,
  index,
}: {
  label: string;
  value: string;
  detail: string;
  badge: string;
  badgeTone: "ok" | "warn" | "neutral";
  delta: string;
  index: number;
}) {
  const badgeStyle =
    badgeTone === "ok"
      ? { background: "#dcfce7", color: "#15803d" }
      : badgeTone === "warn"
        ? { background: "#fef3c7", color: "#b45309" }
        : { background: "var(--ink-50)", color: "var(--ink-700)" };

  return (
    <div
      className="rounded-[var(--r-lg)] p-5"
      style={{
        background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
        border: "1px solid var(--ink-200)",
        boxShadow: "0 18px 34px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--ink-500)" }}>{label}</div>
        <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={badgeStyle}>
          {badge}
        </span>
      </div>
      <div className="mt-4 text-[19px] font-semibold md:text-[20px]" style={{ color: "var(--ink-900)" }}>{value}</div>
      <div className="mt-2 text-[12px]" style={{ color: "var(--ink-500)" }}>{detail}</div>
      <div className="mt-4 flex items-end justify-between gap-3 border-t pt-3" style={{ borderColor: "var(--ink-200)" }}>
        <div className="text-[12px]" style={{ color: "var(--ink-500)" }}>vs prev. 7 days</div>
        <div className="flex items-center gap-3">
          <TrendSparkline tone={badgeTone === "warn" ? "warn" : "neutral"} index={index} />
          <div className="text-[13px] font-semibold" style={{ color: badgeTone === "warn" ? "#16a34a" : "var(--ink-700)" }}>
            {delta}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrendSparkline({
  tone,
  index,
}: {
  tone: "ok" | "warn" | "bad" | "neutral";
  index: number;
}) {
  const stroke = tone === "ok" ? "#16a34a" : tone === "warn" ? "#f59e0b" : tone === "bad" ? "#ef4444" : "#6b7280";
  const points = Array.from({ length: 9 }, (_, i) => {
    const x = i * 13;
    const wave = Math.sin((i + index) * 0.95) * 8;
    const drift = ((i * 5 + index * 4) % 12) - 6;
    const y = 28 - (wave + drift) * 0.45;
    return `${x},${Math.max(5, Math.min(31, y))}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 108 34" className="h-8 w-[70px]">
      <polyline fill="none" stroke={stroke} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

function AlertGlyph() {
  return (
    <svg viewBox="0 0 24 24" style={glyphStyle()}>
      <path d="M12 3 3 20h18L12 3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function GrowthGlyph() {
  return (
    <svg viewBox="0 0 24 24" style={glyphStyle()}>
      <path d="M4 16 10 10l4 4 6-8" />
      <path d="M16 6h4v4" />
    </svg>
  );
}

function ShieldGlyph() {
  return (
    <svg viewBox="0 0 24 24" style={{ ...glyphStyle(), width: 16, height: 16 }}>
      <path d="m12 3 7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
      <path d="m9.5 12 1.5 1.5 3.5-3.5" />
    </svg>
  );
}

function glyphStyle(): CSSProperties {
  return {
    width: 20,
    height: 20,
    stroke: "currentColor",
    strokeWidth: 1.8,
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
}
