"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ErrorDisplay } from "../../../components/ui";
import { authGet, getApiErrorMessage } from "../../../lib/api";
import {
  SaasBadge,
  SaasLiveBadge,
  SaasMetricCard,
  SaasPage,
  SaasSearchField,
  SaasSectionHeader,
  SaasSurface,
  SaasSurfaceBody,
  SaasTableWrap,
  SaasToolbarButton,
} from "../saas-ui";

type SessionStatusCode = "ACTIVE" | "COMPLETED" | "CANCELLED";
type SessionAttentionCode = "healthy" | "watch" | "attention";

interface SessionsOverview {
  generatedAt: string;
  windowHours: number;
  totals: {
    visibleSessions: number;
    activeSessions: number;
    completedSessions: number;
    cancelledSessions: number;
    totalGuests: number;
    totalOrders: number;
    totalOpenRequests: number;
    fullyPaidSessions: number;
    attentionSessions: number;
  };
  attentionSessions: Array<{
    sessionId: string;
    tenantId: string;
    tenantName: string;
    branchId: string;
    branchName: string;
    tableCode: string;
    status: SessionStatusCode;
    attentionState: SessionAttentionCode;
    orderCount: number;
    openRequestCount: number;
    outstandingBalance: string;
    startedAt: string;
  }>;
}

interface SessionRow {
  sessionId: string;
  tenantId: string;
  tenantName: string;
  tenantActive: boolean;
  branchId: string;
  branchName: string;
  branchLocation: string;
  branchActive: boolean;
  tableId: string;
  tableCode: string;
  tableZone: string | null;
  tableCapacity: number;
  tableStatus: string;
  status: SessionStatusCode;
  guestCount: number;
  participantCount: number;
  orderCount: number;
  paymentCount: number;
  completedPaymentCount: number;
  openRequestCount: number;
  completedRequestCount: number;
  totalAmount: string;
  paidAmount: string;
  outstandingBalance: string;
  durationMinutes: number;
  startedAt: string;
  endedAt: string | null;
  customerName: string | null;
  customerPhone: string | null;
  createdByStaffName: string | null;
  createdByStaffRole: string | null;
  notes: string | null;
  attentionState: SessionAttentionCode;
}

interface SessionDetail {
  sessionId: string;
  tenantId: string;
  tenantName: string;
  tenantActive: boolean;
  branchId: string;
  branchName: string;
  branchLocation: string;
  branchActive: boolean;
  table: {
    id: string;
    tableCode: string;
    capacity: number;
    status: string;
    zone: string | null;
  };
  status: SessionStatusCode;
  guestCount: number;
  notes: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number;
  user: { id: string; name: string; phone: string } | null;
  createdByStaff: { id: string; name: string; primaryRole: string } | null;
  participants: Array<{ id: string; displayName: string | null; userId: string | null }>;
  totals: {
    orderCount: number;
    openRequestCount: number;
    totalAmount: string;
    paidAmount: string;
    outstandingBalance: string;
  };
  attentionState: SessionAttentionCode;
  orders: Array<{
    id: string;
    orderStatus: string;
    paymentStatus: string;
    totalAmount: string;
    orderDateTime: string;
    assignedWaiter: { id: string; name: string } | null;
  }>;
  serviceRequests: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
    claimedByStaff: { id: string; name: string } | null;
  }>;
  payments: Array<{
    id: string;
    amount: string;
    paymentStatus: string;
    paymentMethod: string;
    paymentDate: string;
    tipAmount: string | null;
  }>;
}

function attentionTone(code: SessionAttentionCode): "ok" | "warn" | "bad" {
  if (code === "healthy") return "ok";
  if (code === "watch") return "warn";
  return "bad";
}

function statusTone(code: SessionStatusCode): "ok" | "warn" | "bad" | "neutral" {
  if (code === "ACTIVE") return "ok";
  if (code === "COMPLETED") return "neutral";
  return "bad";
}

function formatMoney(value: string) {
  return `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "Still open";
  return new Date(value).toLocaleString("en-US");
}

function formatMinutes(value: number) {
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

export default function SessionsContent() {
  const [hours, setHours] = useState(24);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SessionStatusCode>("all");
  const [attentionFilter, setAttentionFilter] = useState<"all" | SessionAttentionCode>("all");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const deferredSearch = useDeferredValue(search);

  const overviewQuery = useQuery({
    queryKey: ["saas-sessions-overview", hours],
    queryFn: () => authGet<SessionsOverview>(`/api/saas/sessions/overview?hours=${hours}`),
    retry: false,
  });

  const sessionsQuery = useQuery({
    queryKey: ["saas-sessions-list", hours],
    queryFn: () => authGet<SessionRow[]>(`/api/saas/sessions?hours=${hours}`),
    retry: false,
  });

  const detailQuery = useQuery({
    queryKey: ["saas-session-detail", selectedSessionId],
    queryFn: () => authGet<SessionDetail>(`/api/saas/sessions/${selectedSessionId}`),
    enabled: !!selectedSessionId,
    retry: false,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setLastUpdated(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (overviewQuery.data || sessionsQuery.data || detailQuery.data) {
      setLastUpdated(new Date());
    }
  }, [detailQuery.data, overviewQuery.data, sessionsQuery.data]);

  const overview = overviewQuery.data;
  const sessions = sessionsQuery.data ?? [];
  const query = deferredSearch.trim().toLowerCase();
  const visibleSessions = useMemo(
    () =>
      sessions.filter((session) => {
        if (statusFilter !== "all" && session.status !== statusFilter) return false;
        if (attentionFilter !== "all" && session.attentionState !== attentionFilter) return false;
        if (
          query &&
          !`${session.tenantName} ${session.branchName} ${session.branchLocation} ${session.tableCode} ${session.customerName ?? ""}`
            .toLowerCase()
            .includes(query)
        ) {
          return false;
        }
        return true;
      }),
    [attentionFilter, query, sessions, statusFilter],
  );

  useEffect(() => {
    if (visibleSessions.length === 0) {
      setSelectedSessionId("");
      return;
    }
    if (!selectedSessionId || !visibleSessions.some((session) => session.sessionId === selectedSessionId)) {
      setSelectedSessionId(visibleSessions[0].sessionId);
    }
  }, [selectedSessionId, visibleSessions]);

  if (overviewQuery.isLoading || sessionsQuery.isLoading) {
    return (
      <div className="p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-[132px] animate-pulse rounded-[var(--r-lg)]"
              style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (overviewQuery.isError || !overview || sessionsQuery.isError || !sessionsQuery.data) {
    return (
      <ErrorDisplay
        message={getApiErrorMessage(
          overviewQuery.error ?? sessionsQuery.error,
          "Sessions data is unavailable.",
        )}
        onRetry={() => {
          void overviewQuery.refetch();
          void sessionsQuery.refetch();
        }}
      />
    );
  }

  const selectedSession =
    visibleSessions.find((session) => session.sessionId === selectedSessionId) ??
    sessions.find((session) => session.sessionId === selectedSessionId) ??
    null;
  const detail = detailQuery.data ?? null;

  return (
    <SaasPage
      eyebrow="Dining flow command"
      title="Sessions Command"
      description="Track dining sessions across every tenant and branch, including guest volume, order flow, service requests, collection status, and tables that need intervention."
      actions={
        <>
          <SaasToolbarButton
            label="Refresh"
            onClick={() => {
              void overviewQuery.refetch();
              void sessionsQuery.refetch();
              void detailQuery.refetch();
            }}
          />
          <SaasLiveBadge lastUpdated={lastUpdated} />
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SaasMetricCard
          label="Active sessions"
          value={overview.totals.activeSessions.toLocaleString()}
          detail={`${overview.totals.visibleSessions.toLocaleString()} visible in the selected window`}
          tone={overview.totals.activeSessions > 0 ? "ok" : "neutral"}
        />
        <SaasMetricCard
          label="Guest count"
          value={overview.totals.totalGuests.toLocaleString()}
          detail={`${overview.totals.totalOrders.toLocaleString()} orders linked to active and recent sessions`}
        />
        <SaasMetricCard
          label="Open requests"
          value={overview.totals.totalOpenRequests.toLocaleString()}
          detail="Unresolved table-service demand across the platform"
          tone={overview.totals.totalOpenRequests > 0 ? "warn" : "ok"}
        />
        <SaasMetricCard
          label="Fully paid"
          value={overview.totals.fullyPaidSessions.toLocaleString()}
          detail={`${overview.totals.completedSessions.toLocaleString()} completed sessions in range`}
          tone={overview.totals.fullyPaidSessions === overview.totals.visibleSessions ? "ok" : "neutral"}
        />
        <SaasMetricCard
          label="Needs attention"
          value={overview.totals.attentionSessions.toLocaleString()}
          detail={`${overview.totals.cancelledSessions.toLocaleString()} cancelled sessions also in view`}
          tone={overview.totals.attentionSessions > 0 ? "bad" : "ok"}
        />
      </div>

      <SaasSurface>
        <SaasSurfaceBody>
          <div className="grid gap-3 xl:grid-cols-[1.35fr_0.85fr_0.85fr_0.85fr_auto]">
            <SaasSearchField
              value={search}
              onChange={setSearch}
              placeholder="Search tenant, branch, table, or guest..."
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | SessionStatusCode)}
              className="h-10 rounded-[var(--r-md)] px-3 text-[13px] outline-none md:h-11"
              style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
            >
              <option value="all">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <select
              value={attentionFilter}
              onChange={(event) => setAttentionFilter(event.target.value as "all" | SessionAttentionCode)}
              className="h-10 rounded-[var(--r-md)] px-3 text-[13px] outline-none md:h-11"
              style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
            >
              <option value="all">All health states</option>
              <option value="healthy">Healthy</option>
              <option value="watch">Watch</option>
              <option value="attention">Needs attention</option>
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
            <div
              className="flex items-center rounded-[var(--r-md)] px-3 text-[12px] font-semibold md:h-11"
              style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}
            >
              Window: {overview.windowHours}h
            </div>
          </div>
        </SaasSurfaceBody>
      </SaasSurface>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <SaasSurface>
          <SaasSurfaceBody>
            <SaasSectionHeader
              title="Session watchlist"
              subtitle={`${visibleSessions.length} sessions match the current filters`}
            />
            <SaasTableWrap>
              <table className="min-w-full text-left">
                <thead style={{ background: "var(--ink-50)" }}>
                  <tr className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--ink-500)" }}>
                    <th className="px-4 py-3">Session</th>
                    <th className="px-4 py-3">State</th>
                    <th className="px-4 py-3 text-right">Guests</th>
                    <th className="px-4 py-3 text-right">Orders</th>
                    <th className="px-4 py-3 text-right">Outstanding</th>
                    <th className="px-4 py-3">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSessions.map((session) => (
                    <tr
                      key={session.sessionId}
                      onClick={() => setSelectedSessionId(session.sessionId)}
                      style={{
                        borderTop: "1px solid var(--ink-200)",
                        background: session.sessionId === selectedSessionId ? "var(--ink-50)" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>
                          {session.tenantName} - {session.branchName}
                        </div>
                        <div className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>
                          Table {session.tableCode}
                          {session.tableZone ? ` - ${session.tableZone}` : ""} | {session.customerName ?? "Walk-in guest"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <SaasBadge label={session.status.toLowerCase()} tone={statusTone(session.status)} />
                          <SaasBadge label={session.attentionState === "attention" ? "needs attention" : session.attentionState} tone={attentionTone(session.attentionState)} />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-[13px]" style={{ color: "var(--ink-900)" }}>
                        {session.guestCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-[13px]" style={{ color: "var(--ink-700)" }}>
                        {session.orderCount.toLocaleString()}
                        {session.openRequestCount > 0 && (
                          <div className="text-[11px]" style={{ color: "var(--warn)" }}>
                            {session.openRequestCount} open requests
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-[13px]" style={{ color: "var(--ink-900)" }}>
                        {formatMoney(session.outstandingBalance)}
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "var(--ink-500)" }}>
                        {formatDateTime(session.startedAt)}
                      </td>
                    </tr>
                  ))}
                  {visibleSessions.length === 0 && (
                    <tr style={{ borderTop: "1px solid var(--ink-200)" }}>
                      <td colSpan={6} className="px-4 py-10 text-center text-[13px]" style={{ color: "var(--ink-500)" }}>
                        No sessions match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </SaasTableWrap>
          </SaasSurfaceBody>
        </SaasSurface>

        <SaasSurface>
          <SaasSurfaceBody>
            <SaasSectionHeader
              title={selectedSession ? `${selectedSession.tenantName} - Table ${selectedSession.tableCode}` : "Session detail"}
              subtitle={selectedSession ? `${selectedSession.branchName} | ${selectedSession.branchLocation}` : "Select a session to inspect guests, requests, and payment state."}
              action={
                selectedSession ? (
                  <SaasBadge
                    label={selectedSession.attentionState === "attention" ? "needs attention" : selectedSession.attentionState}
                    tone={attentionTone(selectedSession.attentionState)}
                  />
                ) : undefined
              }
            />
            {!selectedSession ? (
              <div className="rounded-[var(--r-md)] px-4 py-12 text-center text-[13px]" style={{ background: "var(--ink-50)", color: "var(--ink-500)", border: "1px solid var(--ink-200)" }}>
                No session selected.
              </div>
            ) : detailQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-20 animate-pulse rounded-[var(--r-md)]" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }} />
                ))}
              </div>
            ) : detailQuery.isError || !detail ? (
              <ErrorDisplay
                message={getApiErrorMessage(detailQuery.error, "Session detail is unavailable.")}
                onRetry={() => detailQuery.refetch()}
              />
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetricMini label="Duration" value={formatMinutes(detail.durationMinutes)} />
                  <MetricMini label="Guests" value={detail.guestCount.toLocaleString()} />
                  <MetricMini label="Collected" value={formatMoney(detail.totals.paidAmount)} tone="ok" />
                  <MetricMini label="Outstanding" value={formatMoney(detail.totals.outstandingBalance)} tone={Number(detail.totals.outstandingBalance) > 0 ? "warn" : "neutral"} />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link href="/saas/operations" className="inline-flex h-10 items-center justify-center rounded-[var(--r-md)] px-4 text-[12px] font-semibold" style={{ background: "var(--ink-100)", color: "var(--ink-900)" }}>
                    Open Operations
                  </Link>
                  <Link href={`/saas/tenants`} className="inline-flex h-10 items-center justify-center rounded-[var(--r-md)] px-4 text-[12px] font-semibold" style={{ background: "var(--ink-0)", color: "var(--ink-900)", border: "1px solid var(--ink-200)" }}>
                    Open Tenant View
                  </Link>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <InfoPanel
                    title="Session context"
                    rows={[
                      ["Status", detail.status.toLowerCase()],
                      ["Started", formatDateTime(detail.startedAt)],
                      ["Ended", formatDateTime(detail.endedAt)],
                      ["Table", `${detail.table.tableCode}${detail.table.zone ? ` - ${detail.table.zone}` : ""}`],
                      ["Table state", detail.table.status.replaceAll("_", " ").toLowerCase()],
                    ]}
                  />
                  <InfoPanel
                    title="People"
                    rows={[
                      ["Guest", detail.user?.name ?? "Walk-in guest"],
                      ["Phone", detail.user?.phone ?? "No phone on file"],
                      ["Started by", detail.createdByStaff?.name ?? "Unknown staff member"],
                      ["Starter role", detail.createdByStaff?.primaryRole ?? "Unknown role"],
                      ["Participants", detail.participants.length.toLocaleString()],
                    ]}
                  />
                </div>

                {detail.notes && (
                  <div className="rounded-[var(--r-md)] p-4 text-[12px]" style={{ background: "var(--ink-50)", color: "var(--ink-700)", border: "1px solid var(--ink-200)" }}>
                    {detail.notes}
                  </div>
                )}
              </div>
            )}
          </SaasSurfaceBody>
        </SaasSurface>
      </div>
    </SaasPage>
  );
}

function MetricMini({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  const color =
    tone === "ok"
      ? "var(--ok)"
      : tone === "warn"
        ? "var(--warn)"
        : tone === "bad"
          ? "var(--bad)"
          : "var(--ink-900)";

  return (
    <div className="rounded-[var(--r-md)] p-3" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
      <div className="text-[18px] font-semibold" style={{ color }}>
        {value}
      </div>
      <div className="mt-1 text-[11px]" style={{ color: "var(--ink-500)" }}>
        {label}
      </div>
    </div>
  );
}

function InfoPanel({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="rounded-[var(--r-md)] p-4" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
      <div className="mb-3 text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>
        {title}
      </div>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 text-[12px]">
            <span style={{ color: "var(--ink-500)" }}>{label}</span>
            <span className="text-right" style={{ color: "var(--ink-900)" }}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
