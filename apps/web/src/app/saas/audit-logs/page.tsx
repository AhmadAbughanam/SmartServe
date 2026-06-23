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

type AuditStream = "all" | "audit" | "operational" | "payments";
type AuditSeverity = "all" | "AUDIT" | "INFO" | "WARN" | "ERROR";

interface AuditOverview {
  generatedAt: string;
  range: { from: string; to: string };
  totals: {
    totalEvents: number;
    auditEvents: number;
    operationalEvents: number;
    paymentEvents: number;
    warningEvents: number;
    errorEvents: number;
    uniqueTenants: number;
    uniqueBranches: number;
    uniqueActors: number;
  };
  issueBranches: Array<{
    tenantId: string;
    tenantName: string;
    branchId: string;
    branchName: string;
    count: number;
  }>;
  topActors: Array<{
    actorId: string;
    actorName: string;
    actorRole: string | null;
    count: number;
  }>;
}

interface AuditFeedRow {
  id: string;
  stream: "audit" | "operational" | "payments";
  occurredAt: string;
  tenantId: string;
  tenantName: string;
  branchId: string;
  branchName: string;
  actor: { id: string | null; name: string; role: string | null } | null;
  severity: "INFO" | "WARN" | "ERROR" | "AUDIT";
  code: string;
  title: string;
  summary: string;
  reference: string | null;
  entityType: string | null;
  entityId: string | null;
  sessionId: string | null;
  orderId: string | null;
  paymentId: string | null;
  paymentProvider: string | null;
  paymentStatus: string | null;
  amount: string | null;
  beforeJson: unknown;
  afterJson: unknown;
  metadata: unknown;
}

function dateInput(daysAgo: number) {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function tone(severity: Exclude<AuditSeverity, "all">): "neutral" | "ok" | "warn" | "bad" {
  if (severity === "AUDIT") return "neutral";
  if (severity === "INFO") return "ok";
  if (severity === "WARN") return "warn";
  return "bad";
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("en-US");
}

function prettyJson(value: unknown) {
  if (value == null) return null;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function SaasAuditLogsPage() {
  const [from, setFrom] = useState(dateInput(7));
  const [to, setTo] = useState(dateInput(0));
  const [stream, setStream] = useState<AuditStream>("all");
  const [severity, setSeverity] = useState<AuditSeverity>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const deferredSearch = useDeferredValue(search);

  const params = useMemo(() => new URLSearchParams({ from, to }).toString(), [from, to]);

  const overviewQuery = useQuery({
    queryKey: ["saas-audit-logs-overview", params],
    queryFn: () => authGet<AuditOverview>(`/api/saas/audit-logs/overview?${params}`),
    retry: false,
  });

  const feedQuery = useQuery({
    queryKey: ["saas-audit-logs-feed", params],
    queryFn: () => authGet<AuditFeedRow[]>(`/api/saas/audit-logs/feed?${params}`),
    retry: false,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setLastUpdated(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (overviewQuery.data || feedQuery.data) {
      setLastUpdated(new Date());
    }
  }, [feedQuery.data, overviewQuery.data]);

  const overview = overviewQuery.data;
  const feed = feedQuery.data ?? [];
  const query = deferredSearch.trim().toLowerCase();
  const visibleRows = useMemo(
    () =>
      feed.filter((row) => {
        if (stream !== "all" && row.stream !== stream) return false;
        if (severity !== "all" && row.severity !== severity) return false;
        if (
          query &&
          !`${row.title} ${row.summary} ${row.code} ${row.tenantName} ${row.branchName} ${row.actor?.name ?? ""} ${row.reference ?? ""}`
            .toLowerCase()
            .includes(query)
        ) {
          return false;
        }
        return true;
      }),
    [feed, query, severity, stream],
  );

  useEffect(() => {
    if (visibleRows.length === 0) {
      setSelectedId("");
      return;
    }
    if (!selectedId || !visibleRows.some((row) => row.id === selectedId)) {
      setSelectedId(visibleRows[0].id);
    }
  }, [selectedId, visibleRows]);

  if (overviewQuery.isLoading || feedQuery.isLoading) {
    return (
      <div className="p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-[132px] animate-pulse rounded-[var(--r-lg)]" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }} />
          ))}
        </div>
      </div>
    );
  }

  if (overviewQuery.isError || feedQuery.isError || !overview) {
    return (
      <ErrorDisplay
        message={getApiErrorMessage(overviewQuery.error ?? feedQuery.error, "Audit log data is unavailable.")}
        onRetry={() => {
          void overviewQuery.refetch();
          void feedQuery.refetch();
        }}
      />
    );
  }

  const selected = visibleRows.find((row) => row.id === selectedId) ?? feed.find((row) => row.id === selectedId) ?? null;

  return (
    <SaasPage
      eyebrow="Audit and investigation command"
      title="Audit Logs"
      description="Review global audit, operational, and payment events across all tenants and branches, with stream filters and event-level drill-down."
      actions={
        <>
          <SaasToolbarButton label="Refresh" onClick={() => { void overviewQuery.refetch(); void feedQuery.refetch(); }} />
          <SaasLiveBadge lastUpdated={lastUpdated} />
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SaasMetricCard label="Total events" value={overview.totals.totalEvents.toLocaleString()} detail="Combined audit, operational, and payment streams" />
        <SaasMetricCard label="Audit changes" value={overview.totals.auditEvents.toLocaleString()} detail={`${overview.totals.uniqueActors.toLocaleString()} unique actors`} tone="neutral" />
        <SaasMetricCard label="Operational events" value={overview.totals.operationalEvents.toLocaleString()} detail={`${overview.totals.warningEvents.toLocaleString()} warnings in range`} tone={overview.totals.warningEvents > 0 ? "warn" : "ok"} />
        <SaasMetricCard label="Payment events" value={overview.totals.paymentEvents.toLocaleString()} detail={`${overview.totals.errorEvents.toLocaleString()} errors in range`} tone={overview.totals.errorEvents > 0 ? "bad" : "ok"} />
        <SaasMetricCard label="Coverage" value={overview.totals.uniqueBranches.toLocaleString()} detail={`${overview.totals.uniqueTenants.toLocaleString()} tenants contributed events`} />
      </div>

      <SaasSurface>
        <SaasSurfaceBody>
          <div className="grid gap-3 xl:grid-cols-[1.3fr_repeat(4,minmax(0,0.8fr))]">
            <SaasSearchField value={search} onChange={setSearch} placeholder="Search codes, actors, tenants, branches, references..." />
            <input value={from} onChange={(event) => setFrom(event.target.value)} type="date" className="h-10 rounded-[var(--r-md)] px-3 text-[13px] outline-none md:h-11" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
            <input value={to} onChange={(event) => setTo(event.target.value)} type="date" className="h-10 rounded-[var(--r-md)] px-3 text-[13px] outline-none md:h-11" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
            <select value={stream} onChange={(event) => setStream(event.target.value as AuditStream)} className="h-10 rounded-[var(--r-md)] px-3 text-[13px] outline-none md:h-11" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}>
              <option value="all">All streams</option>
              <option value="audit">Audit</option>
              <option value="operational">Operational</option>
              <option value="payments">Payments</option>
            </select>
            <select value={severity} onChange={(event) => setSeverity(event.target.value as AuditSeverity)} className="h-10 rounded-[var(--r-md)] px-3 text-[13px] outline-none md:h-11" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}>
              <option value="all">All severities</option>
              <option value="AUDIT">Audit</option>
              <option value="INFO">Info</option>
              <option value="WARN">Warn</option>
              <option value="ERROR">Error</option>
            </select>
          </div>
        </SaasSurfaceBody>
      </SaasSurface>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SaasSurface>
          <SaasSurfaceBody>
            <SaasSectionHeader title="Global activity feed" subtitle={`${visibleRows.length} events match the current filters`} />
            <SaasTableWrap>
              <table className="min-w-full text-left">
                <thead style={{ background: "var(--ink-50)" }}>
                  <tr className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--ink-500)" }}>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Stream</th>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Scope</th>
                    <th className="px-4 py-3">Actor</th>
                    <th className="px-4 py-3">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      style={{
                        borderTop: "1px solid var(--ink-200)",
                        background: row.id === selectedId ? "var(--ink-50)" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <td className="px-4 py-3 text-[12px]" style={{ color: "var(--ink-500)" }}>{formatTime(row.occurredAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <SaasBadge label={row.stream} tone="neutral" />
                          <SaasBadge label={row.severity.toLowerCase()} tone={tone(row.severity)} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>{row.code}</div>
                        <div className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>{row.title}</div>
                      </td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "var(--ink-700)" }}>{row.tenantName} - {row.branchName}</td>
                      <td className="px-4 py-3 text-[12px]" style={{ color: "var(--ink-700)" }}>{row.actor?.name ?? "System"}</td>
                      <td className="px-4 py-3 font-mono text-[11px]" style={{ color: "var(--ink-500)" }}>{row.reference ?? "-"}</td>
                    </tr>
                  ))}
                  {visibleRows.length === 0 && (
                    <tr style={{ borderTop: "1px solid var(--ink-200)" }}>
                      <td colSpan={6} className="px-4 py-10 text-center text-[13px]" style={{ color: "var(--ink-500)" }}>
                        No events match the current filters.
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
              title={selected ? selected.code : "Event detail"}
              subtitle={selected ? `${selected.tenantName} - ${selected.branchName}` : "Select an event to inspect its trail and payload."}
              action={selected ? <SaasBadge label={selected.severity.toLowerCase()} tone={tone(selected.severity)} /> : undefined}
            />
            {!selected ? (
              <div className="rounded-[var(--r-md)] px-4 py-12 text-center text-[13px]" style={{ background: "var(--ink-50)", color: "var(--ink-500)", border: "1px solid var(--ink-200)" }}>
                No event selected.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetricMini label="Stream" value={selected.stream} />
                  <MetricMini label="Severity" value={selected.severity.toLowerCase()} tone={tone(selected.severity)} />
                  <MetricMini label="Actor" value={selected.actor?.name ?? "System"} />
                  <MetricMini label="Reference" value={selected.reference ?? "-"} />
                </div>

                <div className="rounded-[var(--r-md)] p-4" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
                  <div className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>{selected.title}</div>
                  <div className="mt-2 text-[12px]" style={{ color: "var(--ink-700)" }}>{selected.summary}</div>
                  <div className="mt-3 grid gap-2 text-[12px]" style={{ color: "var(--ink-700)" }}>
                    <div>Occurred: <strong style={{ color: "var(--ink-900)" }}>{formatTime(selected.occurredAt)}</strong></div>
                    <div>Actor role: <strong style={{ color: "var(--ink-900)" }}>{selected.actor?.role ?? "System"}</strong></div>
                    <div>Branch: <strong style={{ color: "var(--ink-900)" }}>{selected.branchName}</strong></div>
                    {selected.paymentProvider && <div>Provider: <strong style={{ color: "var(--ink-900)" }}>{selected.paymentProvider}</strong></div>}
                    {selected.amount && <div>Amount: <strong style={{ color: "var(--ink-900)" }}>${selected.amount}</strong></div>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link href="/saas/system-health" className="inline-flex h-10 items-center justify-center rounded-[var(--r-md)] px-4 text-[12px] font-semibold" style={{ background: "var(--ink-100)", color: "var(--ink-900)" }}>
                    Open System Health
                  </Link>
                  <Link href="/saas/operations" className="inline-flex h-10 items-center justify-center rounded-[var(--r-md)] px-4 text-[12px] font-semibold" style={{ background: "var(--ink-0)", color: "var(--ink-900)", border: "1px solid var(--ink-200)" }}>
                    Open Operations
                  </Link>
                </div>

                <JsonPanel title="Metadata" value={selected.metadata} emptyLabel="No metadata payload on this event." />
                <JsonPanel title="Before" value={selected.beforeJson} emptyLabel="No before snapshot on this event." />
                <JsonPanel title="After" value={selected.afterJson} emptyLabel="No after snapshot on this event." />
              </div>
            )}
          </SaasSurfaceBody>
        </SaasSurface>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <SaasSurface>
          <SaasSurfaceBody>
            <SaasSectionHeader title="Top actors" subtitle="Staff accounts generating the most tracked events in the selected range." />
            <div className="space-y-2">
              {overview.topActors.length === 0 ? (
                <div className="rounded-[var(--r-sm)] px-3 py-8 text-center text-[12px]" style={{ background: "var(--ink-50)", color: "var(--ink-500)", border: "1px solid var(--ink-200)" }}>
                  No actor activity recorded in this range.
                </div>
              ) : (
                overview.topActors.map((actor) => (
                  <div key={actor.actorId} className="flex items-center justify-between rounded-[var(--r-sm)] px-3 py-2 text-[12px]" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
                    <div>
                      <div style={{ color: "var(--ink-900)" }}>{actor.actorName}</div>
                      <div style={{ color: "var(--ink-500)" }}>{actor.actorRole ?? "Unknown role"}</div>
                    </div>
                    <div className="font-semibold" style={{ color: "var(--ink-900)" }}>{actor.count.toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>
          </SaasSurfaceBody>
        </SaasSurface>

        <SaasSurface>
          <SaasSurfaceBody>
            <SaasSectionHeader title="Noisy branches" subtitle="Branches generating the largest event volume in the selected range." />
            <div className="space-y-2">
              {overview.issueBranches.length === 0 ? (
                <div className="rounded-[var(--r-sm)] px-3 py-8 text-center text-[12px]" style={{ background: "var(--ink-50)", color: "var(--ink-500)", border: "1px solid var(--ink-200)" }}>
                  No branch event concentration detected in this range.
                </div>
              ) : (
                overview.issueBranches.map((branch) => (
                  <div key={branch.branchId} className="flex items-center justify-between rounded-[var(--r-sm)] px-3 py-2 text-[12px]" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
                    <div>
                      <div style={{ color: "var(--ink-900)" }}>{branch.tenantName} - {branch.branchName}</div>
                      <div style={{ color: "var(--ink-500)" }}>{branch.count} events in range</div>
                    </div>
                    <Link href="/saas/tenants" className="font-semibold" style={{ color: "var(--ink-700)" }}>
                      View
                    </Link>
                  </div>
                ))
              )}
            </div>
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
      <div className="text-[18px] font-semibold" style={{ color }}>{value}</div>
      <div className="mt-1 text-[11px]" style={{ color: "var(--ink-500)" }}>{label}</div>
    </div>
  );
}

function JsonPanel({
  title,
  value,
  emptyLabel,
}: {
  title: string;
  value: unknown;
  emptyLabel: string;
}) {
  const content = prettyJson(value);

  return (
    <div className="rounded-[var(--r-md)] p-4" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
      <div className="mb-3 text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>{title}</div>
      {!content ? (
        <div className="rounded-[var(--r-sm)] px-3 py-2 text-[12px]" style={{ background: "var(--ink-0)", color: "var(--ink-500)", border: "1px solid var(--ink-200)" }}>
          {emptyLabel}
        </div>
      ) : (
        <pre className="overflow-x-auto rounded-[var(--r-sm)] px-3 py-3 text-[11px]" style={{ background: "var(--ink-0)", color: "var(--ink-700)", border: "1px solid var(--ink-200)" }}>
          {content}
        </pre>
      )}
    </div>
  );
}
