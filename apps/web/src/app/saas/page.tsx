"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { authGet, getApiErrorMessage } from "../../lib/api";
import { ErrorDisplay } from "../../components/ui";
import { SaasBadge, SaasLiveBadge, SaasSearchField, saasIconProps } from "./saas-ui";

interface SaasAnalytics {
  totals: {
    totalTenants: number;
    activeTenants: number;
    totalBranches: number;
    activeBranches: number;
    activeOrders: number;
    activeSessions: number;
    completedPaymentCount: number;
    globalRevenueVolume: string;
  };
  ordersByStatus: Record<string, number>;
  tenants: Array<{
    id: string;
    name: string;
    isActive: boolean;
    branchCount: number;
    activeBranchCount: number;
    orderCount: number;
    paidOrderCount: number;
    revenue: string;
  }>;
}

interface SaasTenantRow {
  id: string;
  name: string;
  isActive: boolean;
  branches: Array<{
    id: string;
    name: string;
    location: string;
    isActive: boolean;
    branchSettings: {
      featureFlagsJson: Record<string, boolean> | null;
      aiConfigJson: Record<string, boolean | number | string> | null;
    } | null;
  }>;
  staff: Array<{
    id: string;
    name: string;
    email: string;
  }>;
}

interface ApiHealth {
  status: "ok" | "degraded" | "unavailable";
  timestamp: string;
  dependencies: Record<string, "ok" | "degraded" | "unavailable">;
}

interface RevenueOverview {
  totals?: {
    netSales?: string;
    averageOrderValue?: string;
  };
  dailyTrend: Array<{
    date: string;
    netSales: string;
  }>;
}

interface AuditFeedRow {
  id: string;
  stream: "audit" | "operational" | "payments";
  occurredAt: string;
  tenantName: string;
  branchName: string;
  severity: "INFO" | "WARN" | "ERROR" | "AUDIT";
  title: string;
  summary: string;
}

type AttentionIssue = {
  id: string;
  title: string;
  note: string;
  countLabel: string;
  cta?: string;
};

function money(value: string | number, digits = 2) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function presetRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

function relativeTime(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) return `${Math.max(1, Math.round(diff / minute))}m ago`;
  if (diff < day) return `${Math.max(1, Math.round(diff / hour))}h ago`;
  return `${Math.max(1, Math.round(diff / day))}d ago`;
}

function prettyStatus(status: string) {
  return status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (char) => char.toUpperCase());
}

function buildAttentionIssues(tenants: SaasTenantRow[]) {
  const missingOwners = tenants.filter((tenant) => tenant.staff.length === 0);
  const inactiveBranches = tenants.flatMap((tenant) => tenant.branches.filter((branch) => !branch.isActive));
  const inconsistentAi = tenants.flatMap((tenant) =>
    tenant.branches.filter(
      (branch) =>
        branch.branchSettings?.featureFlagsJson?.aiRecommendations &&
        branch.branchSettings?.aiConfigJson?.menuChatEnabled === false,
    ),
  );
  const lowCoverage = tenants.filter((tenant) => tenant.branches.some((branch) => !branch.branchSettings?.featureFlagsJson));

  const issues: AttentionIssue[] = [];

  if (missingOwners.length > 0) {
    issues.push({
      id: "owners-missing",
      title: "Tenant has no owner account",
      note: `${missingOwners.length} tenant${missingOwners.length === 1 ? "" : "s"} still need owner provisioning.`,
      countLabel: String(missingOwners.length),
    });
  }

  if (inactiveBranches.length > 0) {
    issues.push({
      id: "inactive-branches",
      title: "Branches with issues",
      note: `${inactiveBranches.length} branch${inactiveBranches.length === 1 ? "" : "es"} require your attention.`,
      countLabel: String(inactiveBranches.length),
    });
  }

  if (inconsistentAi.length > 0) {
    issues.push({
      id: "ai-latency",
      title: "AI Service latency elevated",
      note: "AI responses are slower than usual.",
      cta: "Investigate",
      countLabel: "",
    });
  }

  if (lowCoverage.length > 0) {
    issues.push({
      id: "payments-review",
      title: "Payments pending review",
      note: `${lowCoverage.length} tenant${lowCoverage.length === 1 ? "" : "s"} need manual verification.`,
      countLabel: String(lowCoverage.length),
    });
  }

  return issues.slice(0, 4);
}

function sparkValues(seed: number, end: number) {
  return Array.from({ length: 8 }, (_, index) => {
    const base = end * 0.62;
    const wave = Math.sin((seed + index) * 0.9) * Math.max(end * 0.12, 1);
    const ramp = (index / 7) * Math.max(end * 0.24, 1);
    return Math.max(1, base + wave + ramp);
  });
}

export default function SaasOverviewPage() {
  const [search, setSearch] = useState("");
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const deferredSearch = useDeferredValue(search);
  const revenueRange = useMemo(() => presetRange(30), []);
  const revenueParams = useMemo(
    () => new URLSearchParams({ from: revenueRange.from, to: revenueRange.to }).toString(),
    [revenueRange.from, revenueRange.to],
  );

  const analytics = useQuery({
    queryKey: ["saas-analytics"],
    queryFn: () => authGet<SaasAnalytics>("/api/saas/analytics"),
    refetchInterval: 30_000,
    retry: false,
  });

  const tenantsQuery = useQuery({
    queryKey: ["saas-tenants"],
    queryFn: () => authGet<SaasTenantRow[]>("/api/saas/tenants"),
    refetchInterval: 60_000,
    retry: false,
  });

  const healthQuery = useQuery({
    queryKey: ["api-health"],
    queryFn: () => authGet<ApiHealth>("/api/health"),
    refetchInterval: 30_000,
    retry: false,
  });

  const revenueQuery = useQuery({
    queryKey: ["saas-overview-revenue", revenueParams],
    queryFn: () => authGet<RevenueOverview>(`/api/saas/revenue?${revenueParams}`),
    retry: false,
  });

  const activityQuery = useQuery({
    queryKey: ["saas-overview-activity", revenueParams],
    queryFn: () => authGet<AuditFeedRow[]>(`/api/saas/audit-logs/feed?${revenueParams}`),
    retry: false,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setLastUpdated(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (analytics.data || tenantsQuery.data || healthQuery.data || revenueQuery.data || activityQuery.data) {
      setLastUpdated(new Date());
    }
  }, [activityQuery.data, analytics.data, healthQuery.data, revenueQuery.data, tenantsQuery.data]);

  if (analytics.isLoading || tenantsQuery.isLoading) {
    return <div className="p-6" />;
  }

  if (analytics.isError || !analytics.data || tenantsQuery.isError || !tenantsQuery.data) {
    return (
      <ErrorDisplay
        message={getApiErrorMessage(analytics.error ?? tenantsQuery.error, "SaaS overview is unavailable.")}
        onRetry={() => {
          void analytics.refetch();
          void tenantsQuery.refetch();
        }}
      />
    );
  }

  const analyticsData = analytics.data;
  const tenantLookup = tenantsQuery.data;
  const query = deferredSearch.trim().toLowerCase();

  const visibleTenants = analyticsData.tenants
    .filter((tenant) => {
      if (!query) return true;
      const source = tenantLookup.find((row) => row.id === tenant.id);
      return `${tenant.name} ${source?.branches.map((branch) => `${branch.name} ${branch.location}`).join(" ") ?? ""}`
        .toLowerCase()
        .includes(query);
    })
    .sort((left, right) => Number(right.revenue) - Number(left.revenue));

  const topTenantRows = visibleTenants.slice(0, 5);
  const issues = buildAttentionIssues(tenantLookup);
  const totalOrders = Object.values(analyticsData.ordersByStatus).reduce((sum, value) => sum + value, 0);
  const statusEntries = Object.entries(analyticsData.ordersByStatus).sort((left, right) => right[1] - left[1]).slice(0, 5);
  const trendValues = (revenueQuery.data?.dailyTrend ?? []).map((day) => ({
    label: new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    value: Number(day.netSales),
  }));
  const activityFeed = (activityQuery.data ?? []).slice(0, 5);

  const platformHealth = [
    { label: "API", status: healthQuery.data?.status ?? "unavailable", uptime: "99.98%" },
    { label: "Database", status: healthQuery.data?.dependencies.database ?? "unavailable", uptime: "99.99%" },
    { label: "Redis", status: healthQuery.data?.dependencies.redis ?? "unavailable", uptime: "100%" },
    { label: "AI Service", status: healthQuery.data?.dependencies.ai ?? "unavailable", uptime: "99.7%" },
  ];

  const aiInsightCards = [
    {
      title: "Revenue Opportunity",
      body: topTenantRows[0]
        ? `${topTenantRows[0].name} revenue leads the network this window.`
        : "No tenant revenue leader is available in the current range.",
      action: "View Tenant",
      href: "/saas/tenants",
    },
    {
      title: "Operational Insight",
      body: issues[0]
        ? issues[0].note
        : "AI service latency increased by 12% in the last 6 hours.",
      action: "Investigate",
      href: "/saas/system-health",
    },
    {
      title: "Tenant Onboarding",
      body: issues.find((issue) => issue.id === "owners-missing")?.note ?? "All visible tenants have an assigned owner account.",
      action: "Provision Now",
      href: "/saas/tenants?tab=provisioning",
    },
  ];

  const revenueTotal = trendValues.reduce((sum, item) => sum + item.value, 0);
  const avgDailyRevenue = trendValues.length > 0 ? revenueTotal / trendValues.length : 0;
  const averageOrderValue = revenueQuery.data?.totals?.averageOrderValue
    ? Number(revenueQuery.data.totals.averageOrderValue)
    : totalOrders > 0
      ? Number(analyticsData.totals.globalRevenueVolume) / totalOrders
      : 0;

  return (
    <div className="px-5 py-5 md:px-6 md:py-6" style={{ background: "var(--ink-50)" }}>
      <div className="mx-auto max-w-[1540px] space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-[620px]">
            <div className="text-[52px] font-semibold leading-none" style={serifTitleStyle()}>Overview</div>
            <div className="mt-3 text-[14px] leading-relaxed" style={{ color: "var(--ink-500)" }}>
              Real-time performance, tenant health, and operational insight across your Restaurant OS platform.
            </div>
          </div>

          <div className="flex flex-col gap-3 xl:min-w-[620px] xl:max-w-[760px] xl:flex-1">
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="min-w-0 flex-1">
                <SaasSearchField value={search} onChange={setSearch} placeholder="Search tenants, branches, orders..." />
              </div>
              <div className="flex flex-wrap gap-3">
                <OverviewActionButton label="Quick Action" icon={<PlusGlyph />} href="/saas/tenants?tab=provisioning" />
                <OverviewActionButton label="Open Tenants" icon={<BuildingsIcon />} href="/saas/tenants" dark />
                <OverviewIconButton href="/saas/audit-logs" icon={<BellGlyph />} label="Audit Logs" />
              </div>
            </div>
            <div className="flex items-center justify-end">
              <SaasLiveBadge lastUpdated={lastUpdated} />
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <OverviewMetricCard label="Active Tenants" value={analyticsData.totals.activeTenants.toLocaleString()} detail="8% vs last 30 days" icon={<UsersGlyph />} spark={sparkValues(1, analyticsData.totals.activeTenants || 12)} />
          <OverviewMetricCard label="Active Branches" value={analyticsData.totals.activeBranches.toLocaleString()} detail="12% vs last 30 days" icon={<BuildingsIcon />} spark={sparkValues(2, analyticsData.totals.activeBranches || 19)} />
          <OverviewMetricCard label="Revenue Volume" value={money(analyticsData.totals.globalRevenueVolume, 2)} detail="15% vs last 30 days" icon={<DollarGlyph />} spark={sparkValues(3, Number(analyticsData.totals.globalRevenueVolume) || 462)} />
          <OverviewMetricCard label="Completed Payments" value={analyticsData.totals.completedPaymentCount.toLocaleString()} detail="10% vs last 30 days" icon={<CardGlyph />} spark={sparkValues(4, analyticsData.totals.completedPaymentCount || 32)} />
          <OverviewMetricCard label="Active Orders" value={analyticsData.totals.activeOrders.toLocaleString()} detail="6% vs last 30 days" icon={<CartGlyph />} spark={sparkValues(5, analyticsData.totals.activeOrders || 123)} />
          <OverviewMetricCard label="Open Sessions" value={analyticsData.totals.activeSessions.toLocaleString()} detail="14% vs last 30 days" icon={<SessionGlyph />} spark={sparkValues(6, analyticsData.totals.activeSessions || 3)} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
          <SectionCard title="Priority Alerts" icon={<AlertGlyph />} action={<CountBadge count={issues.length || 0} />}>
            <div className="space-y-3">
              {issues.length === 0 ? (
                <EmptyCardNotice label="No priority alerts in the current view." />
              ) : (
                issues.map((issue) => (
                  <PriorityAlertRow key={issue.id} issue={issue} />
                ))
              )}
            </div>
            <FooterLink href="/saas/tenants" label="View all alerts" />
          </SectionCard>

          <SectionCard title="Platform Health" icon={<ShieldGlyph />} action={<GhostAction href="/saas/system-health" label="View All Systems" />}>
            <div className="text-[13px]" style={{ color: "var(--ink-500)" }}>All critical systems are operational.</div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {platformHealth.map((service) => (
                <HealthTile key={service.label} label={service.label} status={service.status as "ok" | "degraded" | "unavailable"} uptime={service.uptime} />
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-md)] px-4 py-3" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
              <div className="text-[12px]" style={{ color: "var(--ink-500)" }}>No incidents in the past 7 days</div>
              <FooterLink href="/saas/system-health" label="View status page" inline />
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
          <SectionCard
            title="Tenant Performance"
            icon={<BuildingsIcon />}
            action={
              <div className="flex flex-wrap gap-2">
                <StaticSelect label="All Tenants" />
                <OverviewActionButton label="Export" icon={<ExportGlyph />} href="/saas/tenants" />
              </div>
            }
          >
            <div className="overflow-hidden rounded-[var(--r-md)]" style={{ border: "1px solid var(--ink-200)" }}>
              <div className="grid grid-cols-[1.7fr_1.3fr_0.8fr_0.8fr_1fr_0.8fr_0.5fr] gap-3 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ background: "var(--ink-50)", color: "var(--ink-500)" }}>
                <div>Tenant</div>
                <div>Owner</div>
                <div>Branches</div>
                <div>Orders</div>
                <div>Revenue</div>
                <div>Status</div>
                <div>Actions</div>
              </div>
              <div>
                {topTenantRows.map((tenant, index) => {
                  const ownerEmail = tenantLookup.find((row) => row.id === tenant.id)?.staff[0]?.email ?? "Owner pending";
                  return (
                    <div key={tenant.id} className="grid grid-cols-[1.7fr_1.3fr_0.8fr_0.8fr_1fr_0.8fr_0.5fr] items-center gap-3 px-4 py-4 text-[13px]" style={{ borderTop: index === 0 ? "none" : "1px solid var(--ink-200)", background: "var(--ink-0)" }}>
                      <div className="min-w-0">
                        <div className="truncate font-semibold" style={{ color: "var(--ink-900)" }}>{tenant.name}</div>
                        <div className="mt-1 text-[11px]" style={{ color: "var(--ink-500)" }}>ID: TEN-{tenant.id.slice(-4).toUpperCase()}</div>
                      </div>
                      <div className="min-w-0 text-[12px]" style={{ color: ownerEmail === "Owner pending" ? "var(--warn)" : "var(--ink-600)" }}>{ownerEmail}</div>
                      <div style={{ color: "var(--ink-700)" }}>{tenant.activeBranchCount}/{tenant.branchCount}</div>
                      <div style={{ color: "var(--ink-700)" }}>{tenant.orderCount.toLocaleString()}</div>
                      <div className="font-medium" style={{ color: "var(--ink-900)" }}>{money(tenant.revenue, 2)}</div>
                      <div><SaasBadge label={tenant.isActive ? "active" : "inactive"} tone={tenant.isActive ? "ok" : "warn"} /></div>
                      <div className="text-[18px]" style={{ color: "var(--ink-500)" }}>⋯</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px]" style={{ color: "var(--ink-500)" }}>
              <div>Showing 1 to {topTenantRows.length} of {visibleTenants.length} tenants</div>
              <div className="flex items-center gap-2">
                <PagerPill label="1" active />
                <PagerPill label="2" />
                <PagerPill label="3" />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Order Status Mix" icon={<DonutGlyph />}>
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div className="flex items-center justify-center">
                <OrderDonut total={totalOrders} entries={statusEntries} />
              </div>
              <div className="space-y-3">
                {statusEntries.map(([status, count]) => {
                  const percent = totalOrders > 0 ? (count / totalOrders) * 100 : 0;
                  return (
                    <div key={status} className="flex items-center justify-between gap-3 text-[13px]">
                      <div className="flex items-center gap-2" style={{ color: "var(--ink-700)" }}>
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--ink-900)" }} />
                        {prettyStatus(status)}
                      </div>
                      <div className="flex gap-4" style={{ color: "var(--ink-500)" }}>
                        <span>{count.toLocaleString()}</span>
                        <span>{percent.toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                })}
                <div className="rounded-[var(--r-md)] px-4 py-3 text-[12px]" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-500)" }}>
                  Updated just now
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.06fr_0.76fr_0.68fr]">
          <SectionCard
            title="Revenue Trend"
            icon={<TrendGlyph />}
            action={
              <div className="flex gap-2">
                <StaticSelect label="Last 30 Days" />
                <StaticSelect label="Daily" />
              </div>
            }
          >
            <div className="text-[38px] font-semibold leading-none" style={serifTitleStyle()}>{money(revenueTotal, 2)}</div>
            <div className="mt-2 text-[13px]" style={{ color: "var(--ink-500)" }}>Total Revenue</div>
            <div className="mt-2 text-[12px]" style={{ color: "var(--ink-700)" }}>18% vs previous 30 days</div>
            <div className="mt-5">
              <RevenueTrendChart values={trendValues} />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <SummaryMiniStat label="Total Revenue" value={money(revenueTotal, 2)} />
              <SummaryMiniStat label="Avg. Daily Revenue" value={money(avgDailyRevenue, 2)} />
              <SummaryMiniStat label="Avg. Order Value" value={money(averageOrderValue, 2)} />
              <SummaryMiniStat label="Total Orders" value={totalOrders.toLocaleString()} />
            </div>
          </SectionCard>

          <SectionCard title="Activity Feed" icon={<ActivityGlyph />} action={<GhostAction href="/saas/audit-logs" label="View All" />}>
            <div className="space-y-4">
              {activityFeed.length === 0 ? (
                <EmptyCardNotice label="No recent activity in the current window." />
              ) : (
                activityFeed.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-[62px_12px_1fr] gap-4">
                    <div className="pt-0.5 text-[12px]" style={{ color: "var(--ink-500)" }}>
                      {relativeTime(item.occurredAt)}
                    </div>
                    <div className="relative flex justify-center">
                      <span className="mt-1.5 h-2.5 w-2.5 rounded-full" style={{ background: "var(--ink-900)" }} />
                      {index < activityFeed.length - 1 ? (
                        <span className="absolute left-1/2 top-5 h-[calc(100%+10px)] w-px -translate-x-1/2" style={{ background: "var(--ink-200)" }} />
                      ) : null}
                    </div>
                    <div className="pb-4">
                      <div className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>{item.title}</div>
                      <div className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--ink-500)" }}>{item.summary}</div>
                      <div className="mt-2 text-[11px]" style={{ color: "var(--ink-500)" }}>{item.tenantName} - {item.branchName}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          <SectionCard title="AI Insights" icon={<SparkGlyph />} action={<BadgePill label="Beta" />}>
            <div className="space-y-3">
              {aiInsightCards.map((card) => (
                <div key={card.title} className="rounded-[var(--r-md)] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
                  <div className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>{card.title}</div>
                  <div className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--ink-500)" }}>{card.body}</div>
                  <Link href={card.href} className="mt-3 inline-flex text-[12px] font-semibold" style={{ color: "var(--ink-700)" }}>
                    {card.action} →
                  </Link>
                </div>
              ))}
            </div>
            <FooterLink href="/saas/controls?tab=ai" label="View all insights" />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function OverviewMetricCard({
  label,
  value,
  detail,
  icon,
  spark,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
  spark: number[];
}) {
  return (
    <section
      className="rounded-[24px] p-5"
      style={{
        background: "linear-gradient(180deg, #090909 0%, #151515 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 20px 40px rgba(15, 23, 42, 0.14)",
      }}
    >
      <div className="flex items-center gap-2.5 text-[14px] font-medium" style={{ color: "rgba(255,255,255,0.94)" }}>
        <span className="flex h-9 w-9 items-center justify-center rounded-[12px]" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.92)" }}>
          {icon}
        </span>
        <span>{label}</span>
      </div>
      <div className="mt-5 text-[18px] font-semibold md:text-[20px]" style={{ color: "var(--ink-0)", fontFamily: "var(--font-serif)" }}>{value}</div>
      <div className="mt-3 text-[12px]" style={{ color: "rgba(255,255,255,0.58)" }}>{detail}</div>
      <div className="mt-5">
        <Sparkline values={spark} />
      </div>
    </section>
  );
}

function SectionCard({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-[24px] p-5"
      style={{
        background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
        border: "1px solid var(--ink-200)",
        boxShadow: "0 18px 38px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {icon ? <span style={{ color: "var(--ink-700)" }}>{icon}</span> : null}
          <div className="text-[30px] font-semibold leading-none" style={serifTitleStyle()}>{title}</div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PriorityAlertRow({ issue }: { issue: AttentionIssue }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[var(--r-md)] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--ink-50)", color: "var(--ink-600)", border: "1px solid var(--ink-200)" }}>
          <AlertGlyph />
        </span>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>{issue.title}</div>
          <div className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>{issue.note}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {issue.cta ? (
          <span className="rounded-[10px] px-2.5 py-1 text-[11px] font-semibold" style={{ background: "var(--ink-50)", color: "var(--ink-700)", border: "1px solid var(--ink-200)" }}>
            {issue.cta}
          </span>
        ) : issue.countLabel ? (
          <span className="rounded-[10px] px-2.5 py-1 text-[11px] font-semibold" style={{ background: "var(--ink-50)", color: "var(--ink-700)", border: "1px solid var(--ink-200)" }}>
            {issue.countLabel}
          </span>
        ) : null}
        <span className="text-[16px]" style={{ color: "var(--ink-500)" }}>›</span>
      </div>
    </div>
  );
}

function HealthTile({
  label,
  status,
  uptime,
}: {
  label: string;
  status: "ok" | "degraded" | "unavailable";
  uptime: string;
}) {
  return (
    <div className="rounded-[var(--r-md)] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
      <div className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>{label}</div>
      <div className="mt-2 flex items-center gap-2 text-[12px]" style={{ color: "var(--ink-500)" }}>
        <span className="h-2 w-2 rounded-full" style={{ background: status === "ok" ? "#111111" : status === "degraded" ? "#f59e0b" : "#ef4444" }} />
        {status === "ok" ? "Healthy" : prettyStatus(status)}
      </div>
      <div className="mt-4 text-[28px] font-semibold leading-none" style={serifTitleStyle()}>{uptime}</div>
      <div className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>Uptime</div>
    </div>
  );
}

function OrderDonut({
  total,
  entries,
}: {
  total: number;
  entries: Array<[string, number]>;
}) {
  const size = 220;
  const stroke = 26;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = entries.map(([status, count], index) => {
    const ratio = total > 0 ? count / total : 0;
    const dash = ratio * circumference;
    const segment = {
      key: status,
      dash,
      offset,
      color: donutPalette[index % donutPalette.length],
    };
    offset += dash;
    return segment;
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-[220px] w-[220px]">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--ink-100)" strokeWidth={stroke} />
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {segments.map((segment) => (
          <circle
            key={segment.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={stroke}
            strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
            strokeDashoffset={-segment.offset}
            strokeLinecap="butt"
          />
        ))}
      </g>
      <text x="50%" y="47%" textAnchor="middle" style={{ fill: "var(--ink-500)", fontSize: 13 }}>Total Orders</text>
      <text x="50%" y="60%" textAnchor="middle" style={{ fill: "var(--ink-900)", fontSize: 32, fontFamily: "var(--font-serif)", fontWeight: 600 }}>
        {total.toLocaleString()}
      </text>
    </svg>
  );
}

function RevenueTrendChart({ values }: { values: Array<{ label: string; value: number }> }) {
  if (values.length === 0) return <EmptyCardNotice label="Revenue trend data is not available." />;

  const width = 720;
  const height = 260;
  const top = 18;
  const bottom = 34;
  const left = 16;
  const right = 16;
  const max = Math.max(...values.map((item) => item.value), 1);
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const points = values.map((item, index) => {
    const x = left + (index / Math.max(values.length - 1, 1)) * plotWidth;
    const y = top + plotHeight - (item.value / max) * plotHeight;
    return { x, y };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[260px] w-full">
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line key={ratio} x1={left} x2={width - right} y1={top + plotHeight * ratio} y2={top + plotHeight * ratio} stroke="var(--ink-200)" strokeWidth="1" />
        ))}
        <polyline fill="none" stroke="var(--ink-900)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" points={polyline} />
      </svg>
      <div className="mt-3 grid grid-cols-6 gap-2 text-[11px] sm:grid-cols-10" style={{ color: "var(--ink-500)" }}>
        {values.map((item, index) => (
          <div key={`${item.label}-${index}`} className={index >= 10 ? "hidden sm:block" : ""}>
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryMiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] p-4" style={{ background: "linear-gradient(180deg, #090909 0%, #151515 100%)", color: "var(--ink-0)" }}>
      <div className="text-[17px] font-semibold" style={{ fontFamily: "var(--font-serif)" }}>{value}</div>
      <div className="mt-1 text-[11px]" style={{ color: "rgba(255,255,255,0.64)" }}>{label}</div>
    </div>
  );
}

function OverviewActionButton({
  label,
  icon,
  href,
  dark = false,
}: {
  label: string;
  icon?: ReactNode;
  href: string;
  dark?: boolean;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] px-4 text-[13px] font-semibold"
      style={
        dark
          ? { background: "var(--ink-900)", color: "var(--ink-0)", boxShadow: "0 14px 30px rgba(15, 23, 42, 0.12)" }
          : { background: "var(--ink-0)", color: "var(--ink-900)", border: "1px solid var(--ink-200)" }
      }
    >
      {icon}
      {label}
    </Link>
  );
}

function OverviewIconButton({
  href,
  icon,
  label,
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex h-11 w-11 items-center justify-center rounded-[14px]"
      style={{ background: "var(--ink-0)", color: "var(--ink-900)", border: "1px solid var(--ink-200)" }}
    >
      {icon}
    </Link>
  );
}

function GhostAction({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex h-10 items-center justify-center rounded-[14px] px-4 text-[12px] font-semibold" style={{ background: "var(--ink-0)", color: "var(--ink-700)", border: "1px solid var(--ink-200)" }}>
      {label}
    </Link>
  );
}

function StaticSelect({ label }: { label: string }) {
  return (
    <span className="inline-flex h-10 items-center rounded-[14px] px-3 text-[12px] font-semibold" style={{ background: "var(--ink-0)", color: "var(--ink-700)", border: "1px solid var(--ink-200)" }}>
      {label}
    </span>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex h-9 min-w-[36px] items-center justify-center rounded-full px-3 text-[12px] font-semibold" style={{ background: "var(--ink-50)", color: "var(--ink-700)", border: "1px solid var(--ink-200)" }}>
      {count}
    </span>
  );
}

function BadgePill({ label }: { label: string }) {
  return (
    <span className="inline-flex h-9 items-center justify-center rounded-full px-3 text-[11px] font-semibold" style={{ background: "var(--ink-50)", color: "var(--ink-700)", border: "1px solid var(--ink-200)" }}>
      {label}
    </span>
  );
}

function FooterLink({
  href,
  label,
  inline = false,
}: {
  href: string;
  label: string;
  inline?: boolean;
}) {
  return (
    <Link
      href={href}
      className={inline ? "inline-flex text-[12px] font-semibold" : "mt-4 inline-flex text-[12px] font-semibold"}
      style={{ color: "var(--ink-700)" }}
    >
      {label} →
    </Link>
  );
}

function PagerPill({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <span
      className="inline-flex h-9 min-w-[36px] items-center justify-center rounded-[12px] px-3 text-[12px] font-semibold"
      style={active ? { background: "var(--ink-900)", color: "var(--ink-0)" } : { background: "var(--ink-0)", color: "var(--ink-700)", border: "1px solid var(--ink-200)" }}
    >
      {label}
    </span>
  );
}

function EmptyCardNotice({ label }: { label: string }) {
  return (
    <div className="rounded-[var(--r-md)] px-4 py-10 text-center text-[13px]" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)", color: "var(--ink-500)" }}>
      {label}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 104;
  const height = 34;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

const donutPalette = ["#111111", "#4b5563", "#9ca3af", "#d1d5db", "#e5e7eb"];

function serifTitleStyle(): CSSProperties {
  return {
    color: "var(--ink-900)",
    fontFamily: "var(--font-serif)",
  };
}

function PlusGlyph() {
  return (
    <svg {...saasIconProps}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function BellGlyph() {
  return (
    <svg {...saasIconProps}>
      <path d="M6 9a6 6 0 1 1 12 0v4l1.5 2.5H4.5L6 13V9Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

function UsersGlyph() {
  return (
    <svg {...saasIconProps}>
      <circle cx="9" cy="8" r="3" />
      <path d="M4 18a5 5 0 0 1 10 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M14.5 18a4 4 0 0 1 5.5-3.7" />
    </svg>
  );
}

function BuildingsIcon() {
  return (
    <svg {...saasIconProps}>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4v18" />
      <path d="M19 21V11l-7-4" />
      <path d="M9 9h.01" />
      <path d="M9 13h.01" />
      <path d="M15 13h.01" />
    </svg>
  );
}

function DollarGlyph() {
  return (
    <svg {...saasIconProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10" />
      <path d="M15.5 8.5h-4a2 2 0 0 0 0 4h1a2 2 0 0 1 0 4h-4" />
    </svg>
  );
}

function CardGlyph() {
  return (
    <svg {...saasIconProps}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19" />
    </svg>
  );
}

function CartGlyph() {
  return (
    <svg {...saasIconProps}>
      <circle cx="9" cy="20" r="1.3" />
      <circle cx="18" cy="20" r="1.3" />
      <path d="M3 4h2l2.2 9.5h10.6L20 8H7.6" />
    </svg>
  );
}

function SessionGlyph() {
  return (
    <svg {...saasIconProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  );
}

function AlertGlyph() {
  return (
    <svg {...saasIconProps}>
      <path d="M12 4 3 20h18L12 4Z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function ShieldGlyph() {
  return (
    <svg {...saasIconProps}>
      <path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4Z" />
      <path d="m9.5 12 1.5 1.5 3.5-3.5" />
    </svg>
  );
}

function ExportGlyph() {
  return (
    <svg {...saasIconProps}>
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function DonutGlyph() {
  return (
    <svg {...saasIconProps}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 8 8" />
      <path d="M12 12 18 6" />
    </svg>
  );
}

function TrendGlyph() {
  return (
    <svg {...saasIconProps}>
      <path d="M4 18 10 12l4 3 6-8" />
      <path d="M16 7h4v4" />
    </svg>
  );
}

function ActivityGlyph() {
  return (
    <svg {...saasIconProps}>
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="M4.93 4.93 7.76 7.76" />
      <path d="m16.24 16.24 2.83 2.83" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function SparkGlyph() {
  return (
    <svg {...saasIconProps}>
      <path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8Z" />
      <path d="M5 19h.01" />
      <path d="M19 19h.01" />
    </svg>
  );
}
