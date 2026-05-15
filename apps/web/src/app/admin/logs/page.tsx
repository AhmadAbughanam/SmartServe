"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { authGet } from "../../../lib/api";
import { getSelectedBranchId, getStaffBranchId, getStaffRole, getStaffToken } from "../../../lib/staff-auth";

type Tab = "operational" | "payments" | "audit";

interface LogRow {
  id: string;
  eventType?: string;
  actionCode?: string;
  severity?: string;
  message?: string;
  entityType?: string;
  entityId?: string;
  orderId?: string | null;
  sessionId?: string | null;
  paymentId?: string | null;
  amount?: string | null;
  status?: string | null;
  createdAt?: string;
  timestamp?: string;
  branch?: { id: string; name: string };
  actorStaff?: { id: string; name: string; primaryRole: string };
  metadata?: unknown;
}

const tabLabels: Record<Tab, string> = {
  operational: "Operational",
  payments: "Payments",
  audit: "Audit",
};

function dateInput(daysAgo: number) {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminLogsPage() {
  const [tab, setTab] = useState<Tab>("operational");
  const [from, setFrom] = useState(dateInput(7));
  const [to, setTo] = useState(dateInput(0));
  const token = typeof window !== "undefined" ? getStaffToken() : null;
  const role = typeof window !== "undefined" ? getStaffRole() : null;
  const branchId = typeof window !== "undefined" ? (getSelectedBranchId() ?? getStaffBranchId()) : null;
  const canViewTenant = role === "OWNER" || role === "MANAGER";

  const path = useMemo(() => {
    const params = new URLSearchParams({ from, to });
    if (!canViewTenant && branchId) params.set("branchId", branchId);
    return `/api/admin/logs/${tab}?${params.toString()}`;
  }, [branchId, canViewTenant, from, tab, to]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-logs", path],
    queryFn: () => authGet<LogRow[]>(path, token!),
    enabled: !!token,
  });

  const rows = data ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-serif text-[28px] font-extrabold" style={{ color: "var(--ink-900)" }}>
            Activity Logs
          </h1>
          <p className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>
            Review tenant-scoped audit, operational, and payment events.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input value={from} onChange={(e) => setFrom(e.target.value)} type="date" className="rounded-[var(--r-md)] px-3 py-2 text-[12px]" style={{ border: "1px solid var(--ink-200)", background: "var(--ink-0)" }} />
          <input value={to} onChange={(e) => setTo(e.target.value)} type="date" className="rounded-[var(--r-md)] px-3 py-2 text-[12px]" style={{ border: "1px solid var(--ink-200)", background: "var(--ink-0)" }} />
        </div>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto">
        {(Object.keys(tabLabels) as Tab[]).map((key) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="rounded-[var(--r-md)] px-4 py-2 text-[12px] font-semibold"
              style={{
                background: active ? "var(--ink-900)" : "var(--ink-0)",
                color: active ? "var(--ink-0)" : "var(--ink-700)",
                border: `1px solid ${active ? "var(--ink-900)" : "var(--ink-200)"}`,
              }}
            >
              {tabLabels[key]}
            </button>
          );
        })}
      </div>

      <div className="mt-5 overflow-hidden rounded-[var(--r-lg)]" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
        {isLoading ? (
          <div className="p-8 text-center text-[12px]" style={{ color: "var(--ink-500)" }}>Loading logs...</div>
        ) : error ? (
          <div className="p-8 text-center text-[12px]" style={{ color: "var(--bad)" }}>{error.message}</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-[12px]" style={{ color: "var(--ink-500)" }}>No logs found for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[12px]">
              <thead style={{ background: "var(--ink-50)", color: "var(--ink-500)" }}>
                <tr>
                  <th className="px-4 py-3 font-semibold">Time</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Branch</th>
                  <th className="px-4 py-3 font-semibold">Message</th>
                  <th className="px-4 py-3 font-semibold">Actor</th>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} style={{ borderTop: "1px solid var(--ink-100)" }}>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--ink-600)" }}>{formatDate(row.createdAt ?? row.timestamp)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2 py-1 text-[10px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
                        {row.eventType ?? row.actionCode}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-700)" }}>{row.branch?.name ?? "-"}</td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-800)" }}>{row.message ?? `${row.entityType ?? "Entity"} ${row.entityId ?? ""}`}</td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>{row.actorStaff?.name ?? "-"}</td>
                    <td className="px-4 py-3 font-mono text-[10px]" style={{ color: "var(--ink-500)" }}>
                      {row.paymentId ?? row.orderId ?? row.sessionId ?? row.entityId ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
