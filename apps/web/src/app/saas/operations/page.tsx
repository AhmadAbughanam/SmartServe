"use client";

import { Suspense, useDeferredValue, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { authGet, getApiErrorMessage } from "../../../lib/api";
import { ErrorDisplay } from "../../../components/ui";
import {
  SaasBadge,
  SaasLiveBadge,
  SaasPage,
  SaasSearchField,
  SaasSurface,
  SaasSurfaceBody,
  SaasToolbarButton,
} from "../saas-ui";
import SessionsContent from "../internal/SessionsContent";

type OperationsStatusCode = "healthy" | "watch" | "attention" | "inactive";
type OperationsMode = "branches" | "requests" | "orders";

interface OperationsOverview {
  generatedAt: string;
  windowHours: number;
  totals: {
    totalBranches: number;
    activeBranches: number;
    activeOrders: number;
    delayedOrders: number;
    activeSessions: number;
    openRequests: number;
    lowStockAlerts: number;
    openShifts: number;
    occupiedTables: number;
    readyOrders: number;
  };
  issueBranches: Array<{
    branchId: string;
    branchName: string;
    tenantId: string;
    tenantName: string;
    activeOrders: number;
    openRequests: number;
    lowStockAlerts: number;
    latestEventAt: string | null;
    status: { code: OperationsStatusCode; label: string; reason: string };
  }>;
}

interface OperationsBranchRow {
  tenantId: string;
  tenantName: string;
  branchId: string;
  branchName: string;
  branchLocation: string;
  branchActive: boolean;
  tableCount: number;
  staffCount: number;
  activeOrders: number;
  delayedOrders: number;
  readyOrders: number;
  activeSessions: number;
  openRequests: number;
  lowStockAlerts: number;
  openShifts: number;
  tableStatuses: {
    AVAILABLE: number;
    OCCUPIED: number;
    RESERVED: number;
    CLEANING: number;
    OUT_OF_SERVICE: number;
  };
  latestEventAt: string | null;
  latestEventType: string | null;
  latestEventMessage: string | null;
  latestEventSeverity: string | null;
  status: { code: OperationsStatusCode; label: string; reason: string };
}

interface OperationsBranchDetail {
  branchId: string;
  branchName: string;
  branchLocation: string;
  branchActive: boolean;
  tenantId: string;
  tenantName: string;
  tenantActive: boolean;
  windowHours: number;
  generatedAt: string;
  status: { code: OperationsStatusCode; label: string; reason: string };
  capacity: { tables: number; staff: number };
  live: {
    activeOrders: number;
    delayedOrders: number;
    readyOrders: number;
    activeSessions: number;
    openRequests: number;
    lowStockAlerts: number;
    openShifts: number;
  };
  tableStatuses: Record<string, number>;
  orderStatuses: Record<string, number>;
  requestTypes: Record<string, number>;
  recommendations: string[];
  recentEvents: Array<{
    id: string;
    eventType: string;
    severity: string;
    message: string;
    createdAt: string;
    sessionId: string | null;
    tableId: string | null;
    orderId: string | null;
  }>;
}

function statusTone(code: OperationsStatusCode): "neutral" | "ok" | "warn" | "bad" {
  if (code === "healthy") return "ok";
  if (code === "watch") return "warn";
  if (code === "attention") return "bad";
  return "neutral";
}

function timeLabel(value: string | null) {
  if (!value) return "No recent events";
  return new Date(value).toLocaleString("en-US");
}

function relativeTime(value: string | null) {
  if (!value) return "No recent events";
  const diff = Date.now() - new Date(value).getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < hour) return `${Math.max(1, Math.round(diff / minute))}m ago`;
  if (diff < day) return `${Math.max(1, Math.round(diff / hour))}h ago`;
  return `${Math.max(1, Math.round(diff / day))}d ago`;
}

function topEntries(input: Record<string, number>, limit = 5) {
  return Object.entries(input).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

function riskScoreForBranch(branch: Pick<OperationsBranchRow, "openRequests" | "activeSessions" | "delayedOrders" | "activeOrders" | "readyOrders" | "lowStockAlerts">) {
  const responseScore = Math.min(100, branch.openRequests * 12 + branch.activeSessions * 4);
  const kitchenScore = Math.min(100, branch.delayedOrders * 18 + branch.activeOrders * 2 + branch.readyOrders * 6);
  const stockScore = Math.min(100, branch.lowStockAlerts * 20);
  return Math.round(Math.min(100, responseScore * 0.4 + kitchenScore * 0.45 + stockScore * 0.15));
}

export default function SaasOperationsPage() {
  return (
    <Suspense fallback={<div className="p-6" />}>
      <SaasOperationsPageContent />
    </Suspense>
  );
}

function SaasOperationsPageContent() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab: "branches" | "requests" | "orders" | "sessions" =
    requestedTab === "sessions" || requestedTab === "requests" || requestedTab === "orders" ? requestedTab : "branches";

  return (
    <div className="space-y-4">
      <OperationsTabBar active={activeTab} />
      {activeTab === "sessions" ? <SessionsContent /> : <OperationsCommandContent mode={activeTab} />}
    </div>
  );
}

function OperationsCommandContent({ mode }: { mode: OperationsMode }) {
  const [hours, setHours] = useState(24);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | OperationsStatusCode>("all");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const deferredSearch = useDeferredValue(search);

  const overviewQuery = useQuery({
    queryKey: ["saas-operations-overview", hours],
    queryFn: () => authGet<OperationsOverview>(`/api/saas/operations/overview?hours=${hours}`),
    retry: false,
  });

  const branchesQuery = useQuery({
    queryKey: ["saas-operations-branches", hours],
    queryFn: () => authGet<OperationsBranchRow[]>(`/api/saas/operations/branches?hours=${hours}`),
    retry: false,
  });

  const detailQuery = useQuery({
    queryKey: ["saas-operations-branch-detail", selectedBranchId, hours],
    queryFn: () => authGet<OperationsBranchDetail>(`/api/saas/operations/branches/${selectedBranchId}?hours=${hours}`),
    enabled: !!selectedBranchId,
    retry: false,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setLastUpdated(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (overviewQuery.data || branchesQuery.data || detailQuery.data) setLastUpdated(new Date());
  }, [overviewQuery.data, branchesQuery.data, detailQuery.data]);

  const overview = overviewQuery.data;
  const branches = branchesQuery.data ?? [];
  const query = deferredSearch.trim().toLowerCase();
  const visibleBranches = useMemo(
    () =>
      branches.filter((branch) => {
        if (statusFilter !== "all" && branch.status.code !== statusFilter) return false;
        if (query && !`${branch.tenantName} ${branch.branchName} ${branch.branchLocation}`.toLowerCase().includes(query)) return false;
        return true;
      }),
    [branches, query, statusFilter],
  );

  useEffect(() => {
    if (visibleBranches.length === 0) {
      setSelectedBranchId("");
      return;
    }
    if (!selectedBranchId || !visibleBranches.some((branch) => branch.branchId === selectedBranchId)) {
      setSelectedBranchId(visibleBranches[0].branchId);
    }
  }, [selectedBranchId, visibleBranches]);

  if (overviewQuery.isLoading || branchesQuery.isLoading) {
    return <div className="p-6" />;
  }

  if (overviewQuery.isError || !overview || branchesQuery.isError || !branchesQuery.data) {
    return (
      <ErrorDisplay
        message={getApiErrorMessage(overviewQuery.error ?? branchesQuery.error, "Operations data is unavailable.")}
        onRetry={() => {
          void overviewQuery.refetch();
          void branchesQuery.refetch();
        }}
      />
    );
  }

  const selectedBranch =
    visibleBranches.find((branch) => branch.branchId === selectedBranchId) ??
    branches.find((branch) => branch.branchId === selectedBranchId) ??
    null;
  const detail = detailQuery.data ?? null;

  const watchBranches = [...visibleBranches].sort((a, b) => {
    const scoreA = a.delayedOrders * 4 + a.openRequests * 3 + a.lowStockAlerts * 2 + (a.status.code === "attention" ? 8 : a.status.code === "watch" ? 4 : 0);
    const scoreB = b.delayedOrders * 4 + b.openRequests * 3 + b.lowStockAlerts * 2 + (b.status.code === "attention" ? 8 : b.status.code === "watch" ? 4 : 0);
    return scoreB - scoreA;
  });

  const requestPressure = watchBranches.filter((branch) => branch.openRequests > 0 || branch.status.code !== "healthy");
  const orderPressure = watchBranches.filter((branch) => branch.activeOrders > 0 || branch.delayedOrders > 0 || branch.readyOrders > 0);
  const selectedList = mode === "requests" ? requestPressure : mode === "orders" ? orderPressure : watchBranches;
  const priorityBranches = selectedList.slice(0, 6);
  const listTitle = mode === "requests" ? "Request pressure board" : mode === "orders" ? "Order pressure board" : "Branch command board";
  const listSubtitle =
    mode === "requests"
      ? "Cross-tenant service demand, hand-raise load, and branches falling behind on table response."
      : mode === "orders"
        ? "Kitchen and handoff pressure across the platform, with delayed and ready order concentration."
        : "Live branch operating risk across orders, requests, service load, and stock strain.";

  const requestMix = detail ? topEntries(detail.requestTypes, 6) : [];
  const orderMix = detail ? topEntries(detail.orderStatuses, 6) : [];
  const tableMix = detail ? topEntries(detail.tableStatuses, 6) : [];
  const highRiskBranches = overview.issueBranches.slice(0, 5);
  const liveCards = buildModeCards(mode, overview);
  const coverageBranches = selectedList.slice(6, 18);
  const commandPills = selectedBranch
    ? [
        `${selectedBranch.status.label} state`,
        `${selectedBranch.activeOrders} active orders`,
        `${selectedBranch.openRequests} open requests`,
      ]
    : [];

  return (
    <SaasPage
      eyebrow="Live platform operations"
      title={mode === "requests" ? "Requests Command" : mode === "orders" ? "Orders Command" : "Operations Command"}
      description={
        mode === "requests"
          ? "Watch table-service pressure, unresolved branch demand, and where guest-facing response is drifting outside healthy bounds."
          : mode === "orders"
            ? "Track branch-by-branch kitchen throughput, delayed handoff risk, and where live order load is stacking up."
            : "Monitor branch activity, table service, kitchen pressure, staffing coverage, and platform operating risk from one SaaS-wide command surface."
      }
      actions={
        <>
          <SaasToolbarButton
            label="Refresh"
            onClick={() => {
              void overviewQuery.refetch();
              void branchesQuery.refetch();
              void detailQuery.refetch();
            }}
          />
          <SaasLiveBadge lastUpdated={lastUpdated} />
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {liveCards.map((card, index) => (
          <OpsTopMetricCard key={card.label} label={card.label} value={card.value} detail={card.detail} tone={card.tone} seed={index + card.value.length} />
        ))}
      </div>

      <SaasSurface>
        <SaasSurfaceBody>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_180px_180px_auto]">
            <SaasSearchField
              value={search}
              onChange={setSearch}
              placeholder={mode === "branches" ? "Search tenants or branches..." : mode === "requests" ? "Search branches with request pressure..." : "Search branches with order pressure..."}
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | OperationsStatusCode)}
              className="h-10 rounded-[var(--r-md)] px-3 text-[13px] outline-none md:h-11"
              style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
            >
              <option value="all">All states</option>
              <option value="healthy">Healthy</option>
              <option value="watch">Watch</option>
              <option value="attention">Needs attention</option>
              <option value="inactive">Inactive</option>
            </select>
            <select
              value={hours}
              onChange={(event) => setHours(Number(event.target.value))}
              className="h-10 rounded-[var(--r-md)] px-3 text-[13px] outline-none md:h-11"
              style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
            >
              <option value={6}>Last 6 hours</option>
              <option value={24}>Last 24 hours</option>
              <option value={72}>Last 72 hours</option>
              <option value={168}>Last 7 days</option>
            </select>
            <div className="flex items-center rounded-[var(--r-md)] px-3 text-[12px] font-semibold md:h-11" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>
              Window: {overview.windowHours}h
            </div>
          </div>
        </SaasSurfaceBody>
      </SaasSurface>

      <SaasSurface style={{ overflow: "hidden", boxShadow: "0 18px 48px rgba(15, 23, 42, 0.08)" }}>
        <SaasSurfaceBody className="space-y-5">
          <div
            className="rounded-[var(--r-lg)] p-5 md:p-6"
            style={{
              background: "radial-gradient(circle at top right, rgba(255,255,255,0.12), transparent 28%), linear-gradient(135deg, #050816 0%, #0f172a 42%, #101826 100%)",
              boxShadow: "0 28px 60px rgba(15, 23, 42, 0.18)",
            }}
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "rgba(248, 250, 252, 0.72)" }}>
                  Command focus
                </div>
                <div className="mt-2 text-[28px] font-semibold leading-tight md:text-[34px]" style={{ color: "var(--ink-0)" }}>
                  {selectedBranch ? `${selectedBranch.tenantName} · ${selectedBranch.branchName}` : "No branch selected"}
                </div>
                <div className="mt-2 text-[13px] leading-relaxed md:text-[14px]" style={{ color: "rgba(248, 250, 252, 0.76)" }}>
                  {selectedBranch
                    ? selectedBranch.status.reason
                    : "Select a branch from the command board to inspect live pressure, response posture, and latest events."}
                </div>
                {commandPills.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {commandPills.map((pill) => (
                      <HeroPill key={pill} label={pill} />
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedBranch ? (
                  <>
                    <Link href="/saas/tenants" className="inline-flex h-10 items-center justify-center rounded-[var(--r-md)] px-4 text-[12px] font-semibold md:h-11 md:text-[13px]" style={{ background: "rgba(248, 250, 252, 0.96)", color: "var(--ink-900)" }}>
                      Open Tenant View
                    </Link>
                    <Link href={`/saas/controls?tab=modules`} className="inline-flex h-10 items-center justify-center rounded-[var(--r-md)] px-4 text-[12px] font-semibold md:h-11 md:text-[13px]" style={{ background: "rgba(15, 23, 42, 0.35)", color: "var(--ink-0)", border: "1px solid rgba(248, 250, 252, 0.14)" }}>
                      Open Controls
                    </Link>
                  </>
                ) : null}
              </div>
            </div>
            {selectedBranch ? (
              <div className="mt-6 grid gap-3 border-t pt-5 md:grid-cols-2 xl:grid-cols-4" style={{ borderColor: "rgba(248, 250, 252, 0.14)" }}>
                <HeroStat label="Orders" value={selectedBranch.activeOrders.toLocaleString()} />
                <HeroStat label="Requests" value={selectedBranch.openRequests.toLocaleString()} />
                <HeroStat label="Alerts" value={selectedBranch.lowStockAlerts.toLocaleString()} />
                <HeroStat label="Latest event" value={relativeTime(selectedBranch.latestEventAt)} />
              </div>
            ) : null}
          </div>
        </SaasSurfaceBody>
      </SaasSurface>

      <div className="space-y-4">
        <PanelCard title={listTitle} subtitle={listSubtitle} icon={<GlyphRadar />} action={<GhostAction href="/saas/operations?tab=branches" label="View all branches" />}>
          {selectedList.length === 0 ? (
            <EmptyPanel message="No branches match the current command filters." />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 xl:grid-cols-3">
                {priorityBranches.map((branch) => (
                  <OperationsBranchCard
                    key={branch.branchId}
                    branch={branch}
                    isSelected={branch.branchId === selectedBranchId}
                    mode={mode}
                    onSelect={() => setSelectedBranchId(branch.branchId)}
                  />
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
                <div className="rounded-[var(--r-md)] p-4" style={{ background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", border: "1px solid var(--ink-200)", boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)" }}>
                  <div className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>Branch navigator</div>
                  <div className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>
                    Jump to any branch without expanding the command board into a long list.
                  </div>
                  <select
                    value={selectedBranchId}
                    onChange={(event) => setSelectedBranchId(event.target.value)}
                    className="mt-4 h-11 w-full rounded-[var(--r-md)] px-3 text-[13px] outline-none"
                    style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
                  >
                    {selectedList.map((branch) => (
                      <option key={branch.branchId} value={branch.branchId}>
                        {branch.tenantName} · {branch.branchName}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedBranchId) setSelectedBranchId(selectedBranchId);
                    }}
                    className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-[var(--r-md)] text-[13px] font-semibold"
                    style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}
                  >
                    Go to branch
                  </button>
                </div>

                <div className="rounded-[var(--r-md)] p-4" style={{ background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", border: "1px solid var(--ink-200)" }}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>Network coverage</div>
                      <div className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>
                        Remaining branches stay reachable here without competing with the priority board.
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {coverageBranches.map((branch) => (
                      <div key={branch.branchId} className="rounded-[var(--r-sm)] px-3 py-2.5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
                        <div className="flex items-start gap-2">
                          <span className="mt-[5px] h-2 w-2 shrink-0 rounded-full" style={{ background: branch.status.code === "attention" ? "#ef4444" : branch.status.code === "watch" ? "#f59e0b" : "#22c55e" }} />
                          <div className="min-w-0">
                            <div className="truncate text-[12px] font-semibold" style={{ color: "var(--ink-900)" }}>{branch.branchName}</div>
                            <div className="mt-1 truncate text-[11px]" style={{ color: "var(--ink-500)" }}>{branch.tenantName}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {coverageBranches.length === 0 ? (
                      <div className="rounded-[var(--r-sm)] px-3 py-2.5 text-[12px]" style={{ background: "var(--ink-0)", color: "var(--ink-500)", border: "1px solid var(--ink-200)" }}>
                        Priority view already includes the full filtered set.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )}
        </PanelCard>

        <PanelCard title="Command detail" subtitle={selectedBranch ? `${selectedBranch.tenantName} · ${selectedBranch.branchName}` : "Select a branch to inspect live detail."} icon={<GlyphGrid />}>
          {!selectedBranch ? (
            <EmptyPanel message="No branch selected." />
          ) : detailQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-[var(--r-md)]" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }} />
              ))}
            </div>
          ) : detailQuery.isError || !detail ? (
            <ErrorDisplay message={getApiErrorMessage(detailQuery.error, "Branch operations detail is unavailable.")} onRetry={() => detailQuery.refetch()} />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <SignalCard label="Active sessions" value={detail.live.activeSessions.toLocaleString()} caption="dining sessions running now" />
                <SignalCard label="Open shifts" value={detail.live.openShifts.toLocaleString()} caption="staff shifts still active" />
                <SignalCard label="Delayed orders" value={detail.live.delayedOrders.toLocaleString()} caption="orders beyond healthy window" tone={detail.live.delayedOrders > 0 ? "bad" : "ok"} />
                <SignalCard label="Open requests" value={detail.live.openRequests.toLocaleString()} caption="guest service pressure" tone={detail.live.openRequests > 0 ? "warn" : "ok"} />
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-4">
                  <SubPanel title="Guidance">
                    <div className="space-y-2">
                      {detail.recommendations.map((item) => (
                        <div key={item} className="rounded-[var(--r-sm)] px-3 py-2 text-[12px]" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>
                          {item}
                        </div>
                      ))}
                    </div>
                  </SubPanel>

                  <SubPanel title={mode === "requests" ? "Request mix" : mode === "orders" ? "Order mix" : "Operational mix"}>
                    <div className="grid gap-3 md:grid-cols-3">
                      <ListPanel title="Table states" items={tableMix} emptyLabel="No table state data." />
                      <ListPanel title="Order states" items={orderMix} emptyLabel="No active order state data." />
                      <ListPanel title="Request types" items={requestMix} emptyLabel="No open request data." />
                    </div>
                  </SubPanel>
                </div>

                <SubPanel title="Recent events">
                  <div className="space-y-3">
                    {detail.recentEvents.length === 0 ? (
                      <EmptyPanel message="No recent operational events in this window." compact />
                    ) : (
                      detail.recentEvents.slice(0, 8).map((event) => (
                        <div key={event.id} className="rounded-[var(--r-md)] p-3" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>{event.eventType}</div>
                              <div className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>{event.message}</div>
                            </div>
                            <SaasBadge label={event.severity.toLowerCase()} tone={event.severity === "ERROR" ? "bad" : event.severity === "WARN" ? "warn" : "neutral"} />
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px]" style={{ color: "var(--ink-600)" }}>
                            <Tag>{relativeTime(event.createdAt)}</Tag>
                            {event.orderId ? <Tag>Order linked</Tag> : null}
                            {event.sessionId ? <Tag>Session linked</Tag> : null}
                            {event.tableId ? <Tag>Table linked</Tag> : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </SubPanel>
              </div>
            </div>
          )}
        </PanelCard>

        <PanelCard title={mode === "requests" ? "Service demand queue" : mode === "orders" ? "Order pressure queue" : "Attention queue"} subtitle="Branches currently outside the healthy range." icon={<GlyphPulse />}>
          {highRiskBranches.length === 0 ? (
            <EmptyPanel message="No operational issues are active right now." />
          ) : (
            <div className="space-y-3">
              {highRiskBranches.map((branch) => (
                <button
                  key={branch.branchId}
                  type="button"
                  onClick={() => setSelectedBranchId(branch.branchId)}
                  className="w-full rounded-[var(--r-md)] p-4 text-left"
                  style={{ background: "linear-gradient(180deg, #fffefe 0%, #fff7f7 100%)", border: "1px solid #fecaca", boxShadow: "0 10px 24px rgba(239, 68, 68, 0.06)" }}
                >
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_170px_110px_110px_110px_24px] xl:items-center">
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>{branch.tenantName} · {branch.branchName}</div>
                      <div className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>{branch.status.reason}</div>
                    </div>
                    <div className="flex xl:justify-center">
                      <SaasBadge label={branch.status.label} tone={statusTone(branch.status.code)} />
                    </div>
                    <InfoBlock label="Orders" value={branch.activeOrders.toLocaleString()} />
                    <InfoBlock label="Requests" value={branch.openRequests.toLocaleString()} />
                    <InfoBlock label="Alerts" value={branch.lowStockAlerts.toLocaleString()} />
                    <div className="text-[18px] font-semibold" style={{ color: "var(--ink-500)" }} aria-hidden>
                      ›
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </PanelCard>
      </div>
    </SaasPage>
  );
}

function buildModeCards(mode: OperationsMode, overview: OperationsOverview) {
  if (mode === "requests") {
    return [
      { label: "Open requests", value: overview.totals.openRequests.toLocaleString(), detail: `${overview.totals.activeSessions.toLocaleString()} active sessions in scope`, tone: overview.totals.openRequests > 0 ? ("warn" as const) : ("ok" as const) },
      { label: "Issue branches", value: overview.issueBranches.length.toLocaleString(), detail: "Branches with service pressure outside healthy range", tone: overview.issueBranches.length > 0 ? ("bad" as const) : ("ok" as const) },
      { label: "Occupied tables", value: overview.totals.occupiedTables.toLocaleString(), detail: "Tables likely to generate fresh service demand", tone: "neutral" as const },
      { label: "Open shifts", value: overview.totals.openShifts.toLocaleString(), detail: "Staffing availability for service response", tone: "neutral" as const },
      { label: "Low stock alerts", value: overview.totals.lowStockAlerts.toLocaleString(), detail: "Inventory strain that can slow guest handling", tone: overview.totals.lowStockAlerts > 0 ? ("warn" as const) : ("ok" as const) },
    ];
  }

  if (mode === "orders") {
    return [
      { label: "Active orders", value: overview.totals.activeOrders.toLocaleString(), detail: `${overview.totals.readyOrders.toLocaleString()} ready to handoff`, tone: overview.totals.activeOrders > 0 ? ("ok" as const) : ("neutral" as const) },
      { label: "Delayed orders", value: overview.totals.delayedOrders.toLocaleString(), detail: "Orders older than the healthy kitchen window", tone: overview.totals.delayedOrders > 0 ? ("bad" as const) : ("ok" as const) },
      { label: "Ready orders", value: overview.totals.readyOrders.toLocaleString(), detail: "Orders waiting for table or pickup handoff", tone: overview.totals.readyOrders > 0 ? ("warn" as const) : ("ok" as const) },
      { label: "Active branches", value: overview.totals.activeBranches.toLocaleString(), detail: `${overview.totals.totalBranches.toLocaleString()} total branches in the network`, tone: "neutral" as const },
      { label: "Open shifts", value: overview.totals.openShifts.toLocaleString(), detail: "Staffing posture behind current order load", tone: "neutral" as const },
    ];
  }

  return [
    { label: "Active orders", value: overview.totals.activeOrders.toLocaleString(), detail: `${overview.totals.readyOrders.toLocaleString()} ready to handoff`, tone: overview.totals.delayedOrders > 0 ? ("warn" as const) : ("ok" as const) },
    { label: "Delayed orders", value: overview.totals.delayedOrders.toLocaleString(), detail: "Orders older than the healthy kitchen window", tone: overview.totals.delayedOrders > 0 ? ("bad" as const) : ("ok" as const) },
    { label: "Open requests", value: overview.totals.openRequests.toLocaleString(), detail: `${overview.totals.activeSessions.toLocaleString()} active sessions`, tone: overview.totals.openRequests > 0 ? ("warn" as const) : ("ok" as const) },
    { label: "Low stock alerts", value: overview.totals.lowStockAlerts.toLocaleString(), detail: `${overview.totals.occupiedTables.toLocaleString()} occupied tables`, tone: overview.totals.lowStockAlerts > 0 ? ("warn" as const) : ("ok" as const) },
    { label: "Open shifts", value: overview.totals.openShifts.toLocaleString(), detail: `${overview.totals.activeBranches.toLocaleString()} active branches`, tone: "neutral" as const },
  ];
}

function OperationsTabBar({ active }: { active: "branches" | "requests" | "orders" | "sessions" }) {
  return (
    <div className="px-5 pt-5 md:px-6 md:pt-6">
      <div className="mx-auto flex max-w-[1520px] flex-wrap gap-2">
        {[
          { key: "branches", label: "Branches", href: "/saas/operations?tab=branches" },
          { key: "requests", label: "Requests", href: "/saas/operations?tab=requests" },
          { key: "orders", label: "Orders", href: "/saas/operations?tab=orders" },
          { key: "sessions", label: "Sessions", href: "/saas/operations?tab=sessions" },
        ].map((tab) => {
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className="inline-flex h-10 items-center justify-center rounded-[var(--r-md)] px-4 text-[12px] font-semibold md:text-[13px]"
              style={isActive ? { background: "var(--ink-900)", color: "var(--ink-0)", boxShadow: "0 10px 24px rgba(15, 23, 42, 0.14)" } : { background: "var(--ink-0)", color: "var(--ink-700)", border: "1px solid var(--ink-200)" }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function PanelCard({
  title,
  subtitle,
  icon,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-[var(--r-lg)] p-4 md:p-5"
      style={{
        background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        border: "1px solid var(--ink-200)",
        boxShadow: "0 14px 32px rgba(15, 23, 42, 0.05)",
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-3 border-b pb-4" style={{ borderColor: "rgba(148, 163, 184, 0.18)" }}>
        <div className="flex items-start gap-3">
          {icon ? (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-[var(--r-md)]"
              style={{
                background: "linear-gradient(180deg, #ffffff 0%, #eef2ff 100%)",
                color: "var(--ink-700)",
                border: "1px solid rgba(148, 163, 184, 0.22)",
              }}
            >
              {icon}
            </div>
          ) : null}
          <div>
            <div className="text-[17px] font-semibold" style={{ color: "var(--ink-900)" }}>{title}</div>
            {subtitle ? <div className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>{subtitle}</div> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function GhostAction({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex h-10 items-center justify-center rounded-[var(--r-md)] px-3 text-[12px] font-semibold" style={{ background: "var(--ink-0)", color: "var(--ink-700)", border: "1px solid var(--ink-200)" }}>
      {label}
    </Link>
  );
}

function OpsTopMetricCard({
  label,
  value,
  detail,
  tone,
  seed,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "ok" | "warn" | "bad";
  seed: number;
}) {
  const badge =
    tone === "ok"
      ? { label: "OK", background: "#dcfce7", color: "#15803d" }
      : tone === "warn"
        ? { label: "WARN", background: "#fef3c7", color: "#b45309" }
        : tone === "bad"
          ? { label: "BAD", background: "#fee2e2", color: "#dc2626" }
          : { label: "LIVE", background: "#f1f5f9", color: "#475569" };

  return (
    <div className="rounded-[var(--r-lg)] p-4 md:p-5" style={{ background: "linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)", border: "1px solid var(--ink-200)", boxShadow: "0 14px 30px rgba(15, 23, 42, 0.04)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--ink-500)" }}>{label}</div>
        <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: badge.background, color: badge.color }}>
          {badge.label}
        </span>
      </div>
      <div className="mt-5 text-[17px] font-semibold md:text-[18px]" style={{ color: "var(--ink-900)" }}>{value}</div>
      <div className="mt-2 min-h-[34px] text-[12px] leading-relaxed" style={{ color: "var(--ink-500)" }}>{detail}</div>
      <div className="mt-4">
        <Sparkline tone={tone} seed={seed} />
      </div>
    </div>
  );
}

function SubPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[var(--r-md)] p-4" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
      <div className="mb-3 text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>{title}</div>
      {children}
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--r-md)] px-4 py-3" style={{ background: "rgba(248,250,252,0.08)", border: "1px solid rgba(248,250,252,0.14)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}>
      <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "rgba(248,250,252,0.62)" }}>{label}</div>
      <div className="mt-2 text-[20px] font-semibold" style={{ color: "var(--ink-0)" }}>{value}</div>
    </div>
  );
}

function HeroPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: "rgba(248,250,252,0.08)", color: "rgba(248,250,252,0.9)", border: "1px solid rgba(248,250,252,0.12)" }}>
      {label}
    </span>
  );
}

function Sparkline({
  tone,
  seed,
}: {
  tone: "neutral" | "ok" | "warn" | "bad";
  seed: number;
}) {
  const stroke = tone === "ok" ? "#22c55e" : tone === "warn" ? "#f59e0b" : tone === "bad" ? "#ef4444" : "#111827";
  const points = Array.from({ length: 9 }, (_, index) => {
    const x = index * 18;
    const wave = Math.sin((index + seed) * 0.9) * 10;
    const drift = ((index * 7 + seed * 3) % 14) - 7;
    const y = 34 - (wave + drift) * 0.45;
    return `${x},${Math.max(8, Math.min(42, y))}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 144 46" className="h-10 w-full">
      <polyline fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

function CompactSignal({
  label,
  value,
  inverted = false,
}: {
  label: string;
  value: string;
  inverted?: boolean;
}) {
  return (
    <div className="rounded-[var(--r-sm)] px-3 py-2.5" style={{ background: inverted ? "rgba(248,250,252,0.08)" : "var(--ink-100)" }}>
      <div className="text-[13px] font-semibold" style={{ color: inverted ? "var(--ink-0)" : "var(--ink-900)" }}>{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.14em]" style={{ color: inverted ? "rgba(248,250,252,0.64)" : "var(--ink-500)" }}>{label}</div>
    </div>
  );
}

function OperationsBranchCard({
  branch,
  isSelected,
  mode,
  onSelect,
}: {
  branch: OperationsBranchRow;
  isSelected: boolean;
  mode: OperationsMode;
  onSelect: () => void;
}) {
  const responseScore = Math.min(100, branch.openRequests * 12 + branch.activeSessions * 4);
  const kitchenScore = Math.min(100, branch.delayedOrders * 18 + branch.activeOrders * 2 + branch.readyOrders * 6);
  const rowTone =
    mode === "requests"
      ? { label: "Service load", score: responseScore, detail: `${branch.openRequests} open · ${branch.activeSessions} sessions` }
      : mode === "orders"
        ? { label: "Kitchen load", score: kitchenScore, detail: `${branch.delayedOrders} delayed · ${branch.readyOrders} ready` }
        : { label: "Risk index", score: riskScoreForBranch(branch), detail: `${branch.lowStockAlerts} stock alerts` };

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-[var(--r-md)] p-4 text-left transition duration-200"
      style={{
        background: isSelected ? "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)" : "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        color: isSelected ? "var(--ink-0)" : "var(--ink-900)",
        border: isSelected ? "1px solid #243446" : "1px solid var(--ink-200)",
        boxShadow: isSelected ? "0 18px 40px rgba(15, 23, 42, 0.18)" : "0 10px 24px rgba(15, 23, 42, 0.05)",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold tracking-[0.01em]">{branch.branchName}</div>
          <div className="mt-1 truncate text-[12px]" style={{ color: isSelected ? "rgba(248,250,252,0.76)" : "var(--ink-500)" }}>
            {branch.tenantName} · {branch.branchLocation}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <SaasBadge label={branch.status.label} tone={statusTone(branch.status.code)} />
          <div className="text-[11px] font-medium" style={{ color: isSelected ? "rgba(248,250,252,0.7)" : "var(--ink-500)" }}>
            {relativeTime(branch.latestEventAt)}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div className="space-y-3">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: isSelected ? "rgba(248,250,252,0.68)" : "var(--ink-500)" }}>
                {rowTone.label}
              </span>
              <span className="text-[12px] font-semibold" style={{ color: isSelected ? "var(--ink-0)" : "var(--ink-900)" }}>
                {Math.round(rowTone.score)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full" style={{ background: isSelected ? "rgba(248,250,252,0.12)" : "var(--ink-100)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${rowTone.score}%`,
                  background:
                    rowTone.score >= 70
                      ? "linear-gradient(90deg, #fb7185 0%, #f97316 100%)"
                      : rowTone.score >= 35
                        ? "linear-gradient(90deg, #f59e0b 0%, #facc15 100%)"
                        : "linear-gradient(90deg, #22c55e 0%, #38bdf8 100%)",
                }}
              />
            </div>
            <div className="mt-2 text-[12px]" style={{ color: isSelected ? "rgba(248,250,252,0.74)" : "var(--ink-600)" }}>
              {rowTone.detail}
            </div>
          </div>

          <div className="text-[11px]" style={{ color: isSelected ? "rgba(248,250,252,0.64)" : "var(--ink-500)" }}>
            {branch.latestEventAt ? relativeTime(branch.latestEventAt) : "No recent events"}
          </div>
        </div>

        <div className="grid gap-2 grid-cols-5">
          <MiniMetricPill label="Orders" value={branch.activeOrders.toLocaleString()} inverted={isSelected} />
          <MiniMetricPill label="Requests" value={branch.openRequests.toLocaleString()} inverted={isSelected} />
          <MiniMetricPill label="Alerts" value={branch.lowStockAlerts.toLocaleString()} inverted={isSelected} />
          <MiniMetricPill label="Sessions" value={branch.activeSessions.toLocaleString()} inverted={isSelected} />
          <MiniMetricPill label="Open shifts" value={branch.openShifts.toLocaleString()} inverted={isSelected} />
        </div>
      </div>
    </button>
  );
}

function MiniMetricPill({
  label,
  value,
  inverted = false,
}: {
  label: string;
  value: string;
  inverted?: boolean;
}) {
  return (
    <div className="rounded-[var(--r-sm)] px-2.5 py-2" style={{ background: inverted ? "rgba(248,250,252,0.08)" : "var(--ink-100)" }}>
      <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: inverted ? "rgba(248,250,252,0.64)" : "var(--ink-500)" }}>
        {label}
      </div>
      <div className="mt-1 text-[13px] font-semibold" style={{ color: inverted ? "var(--ink-0)" : "var(--ink-900)" }}>
        {value}
      </div>
    </div>
  );
}

function DetailStat({
  label,
  value,
  inverted = false,
  accent = "neutral",
}: {
  label: string;
  value: string;
  inverted?: boolean;
  accent?: "neutral" | "warn" | "bad";
}) {
  const color = accent === "bad" ? "var(--bad)" : accent === "warn" ? "var(--warn)" : inverted ? "var(--ink-0)" : "var(--ink-900)";
  return (
    <div className="rounded-[var(--r-sm)] px-3 py-2.5" style={{ background: inverted ? "rgba(248,250,252,0.06)" : "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", border: `1px solid ${inverted ? "rgba(248,250,252,0.08)" : "var(--ink-200)"}` }}>
      <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: inverted ? "rgba(248,250,252,0.6)" : "var(--ink-500)" }}>
        {label}
      </div>
      <div className="mt-1 text-[14px] font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function SignalCard({
  label,
  value,
  caption,
  tone = "neutral",
}: {
  label: string;
  value: string;
  caption: string;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  const palette =
    tone === "ok"
      ? { background: "var(--ok-soft)", border: "#bbf7d0", title: "var(--ok)" }
      : tone === "warn"
        ? { background: "var(--warn-soft)", border: "#fde68a", title: "var(--warn)" }
        : tone === "bad"
          ? { background: "var(--bad-soft)", border: "#fecaca", title: "var(--bad)" }
          : { background: "var(--ink-50)", border: "var(--ink-200)", title: "var(--ink-900)" };
  return (
    <div className="rounded-[var(--r-md)] p-4" style={{ background: palette.background, border: `1px solid ${palette.border}`, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65)" }}>
      <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--ink-500)" }}>{label}</div>
      <div className="mt-2 text-[18px] font-semibold" style={{ color: palette.title }}>{value}</div>
      <div className="mt-1 text-[12px]" style={{ color: "var(--ink-600)" }}>{caption}</div>
    </div>
  );
}

function ListPanel({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: Array<[string, number]>;
  emptyLabel: string;
}) {
  return (
    <div className="rounded-[var(--r-md)] p-4" style={{ background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", border: "1px solid var(--ink-200)" }}>
      <div className="mb-3 text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>{title}</div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-[var(--r-sm)] px-3 py-2 text-[12px]" style={{ background: "var(--ink-0)", color: "var(--ink-500)", border: "1px solid var(--ink-200)" }}>
            {emptyLabel}
          </div>
        ) : (
          items.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between rounded-[var(--r-sm)] px-3 py-2 text-[12px]" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
              <span style={{ color: "var(--ink-700)" }}>{titleCase(label)}</span>
              <span className="font-semibold" style={{ color: "var(--ink-900)" }}>{value.toLocaleString()}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--r-sm)] px-3 py-2.5" style={{ background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", border: "1px solid var(--ink-200)" }}>
      <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--ink-500)" }}>{label}</div>
      <div className="mt-1 text-[12px] font-medium" style={{ color: "var(--ink-900)" }}>{value}</div>
    </div>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-1" style={{ background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)", border: "1px solid var(--ink-200)" }}>
      {children}
    </span>
  );
}

function EmptyPanel({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div className={`rounded-[var(--r-md)] text-center text-[13px] ${compact ? "px-3 py-4" : "px-4 py-10"}`} style={{ background: "var(--ink-50)", color: "var(--ink-500)", border: "1px solid var(--ink-200)" }}>
      {message}
    </div>
  );
}

function GlyphRadar() {
  return (
    <svg viewBox="0 0 24 24" style={glyphStyle()}>
      <path d="M6 12a6 6 0 1 1 6 6" />
      <path d="M12 2a10 10 0 1 1-10 10" />
      <path d="m12 12 7 7" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function GlyphGrid() {
  return (
    <svg viewBox="0 0 24 24" style={glyphStyle()}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function GlyphPulse() {
  return (
    <svg viewBox="0 0 24 24" style={glyphStyle()}>
      <path d="M3 12h4l2.5-6 5 12 2.5-6H21" />
    </svg>
  );
}

function glyphStyle(): React.CSSProperties {
  return {
    width: 18,
    height: 18,
    stroke: "currentColor",
    strokeWidth: 1.8,
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
}
