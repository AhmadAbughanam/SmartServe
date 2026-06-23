"use client";

import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useMemo } from "react";
import { authGet, authPatch, ApiError } from "../../../lib/api";
import { hasStaffSession, getStaffBranchId, getStaffName, getStaffPermissions, clearStaffToken } from "../../../lib/staff-auth";
import type { ServiceRequest, WaiterTableSummary, AttentionState, StaffNotification, WaiterReadyOrder } from "../../../lib/waiter-types";
import { useToast } from "../../../components/ui";

const POLL = 6000;
const sv = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const borderColor: Record<AttentionState, string> = {
  AVAILABLE: "var(--ink-200)", OCCUPIED: "var(--ok)", ASSISTANCE_NEEDED: "var(--accent)",
  ORDER_READY: "#22c55e", PAYMENT_PENDING: "#6366f1", TURNOVER_REQUIRED: "var(--warn)",
  RESERVED: "#a78bfa", CLEANING: "var(--warn)", OUT_OF_SERVICE: "var(--ink-300)",
};

const stateLabel: Record<AttentionState, string> = {
  AVAILABLE: "Available", OCCUPIED: "Occupied", ASSISTANCE_NEEDED: "Needs Service",
  ORDER_READY: "Ready", PAYMENT_PENDING: "Billing", TURNOVER_REQUIRED: "Turnover",
  RESERVED: "Reserved", CLEANING: "Cleaning", OUT_OF_SERVICE: "Off",
};

interface StaffSession {
  staffId: string;
  tenantId: string;
  branchId: string;
  primaryRole: string;
  permissions: string[];
}

function timeShort(d: string) { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); return m < 1 ? "<1m" : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60}m`; }
function timeAgo(d: string) { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); return m < 1 ? "just now" : m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`; }

function SrIcon({ type }: { type: string }) {
  const s = { width: 12, height: 12, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const };
  if (type.includes("WATER") || type.includes("CUTLERY")) return <svg {...s}><path d="M17 8h1a4 4 0 1 1 0 8h-1" /><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" /></svg>;
  if (type.includes("BILL")) return <svg {...s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
  return <svg {...s}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
}

export default function WaiterDashboardPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [branchId, setBranchId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let active = true;
    async function loadSession() {
    const permissions = getStaffPermissions("waiter");
    const canUseWaiter = ["tables:read", "sessions:read", "service-requests:read"].every((p) => permissions.includes(p));
    if (!hasStaffSession("waiter") || !canUseWaiter) {
      clearStaffToken("waiter");
      router.push("/waiter/login");
      return;
    }
      try {
        const session = await authGet<StaffSession>("/api/auth/me");
        const serverCanUseWaiter = ["tables:read", "sessions:read", "service-requests:read"].every((p) => session.permissions.includes(p));
        if (!serverCanUseWaiter) throw new ApiError(403, { message: "Wrong workspace session" });
        if (!active) return;
        setBranchId(session.branchId || getStaffBranchId("waiter"));
        setName(getStaffName("waiter") ?? "");
      } catch {
        clearStaffToken("waiter");
        if (active) router.push("/waiter/login");
      }
    }
    void loadSession();
    return () => { active = false; };
  }, [router]);

  const { data: tables = [] } = useQuery({
    queryKey: ["waiter-floor", branchId],
    queryFn: async () => { if (!branchId) return []; try { return await authGet<WaiterTableSummary[]>(`/api/waiter/floor?branchId=${branchId}`); } catch (e) { if (e instanceof ApiError && (e.status === 401 || e.status === 403)) { clearStaffToken("waiter"); router.push("/waiter/login"); } return []; } },
    enabled: !!branchId, refetchInterval: POLL,
  });
  const { data: requests = [] } = useQuery({
    queryKey: ["waiter-requests", branchId],
    queryFn: async () => { if (!branchId) return []; try { return await authGet<ServiceRequest[]>(`/api/service-requests?branchId=${branchId}`); } catch (e) { if (e instanceof ApiError && (e.status === 401 || e.status === 403)) { clearStaffToken("waiter"); router.push("/waiter/login"); } return []; } },
    enabled: !!branchId, refetchInterval: POLL,
  });
  const { data: notifications = [] } = useQuery({
    queryKey: ["waiter-notifications", branchId],
    queryFn: async () => { if (!branchId) return []; try { return await authGet<StaffNotification[]>("/api/notifications?unreadOnly=true"); } catch (e) { if (e instanceof ApiError && (e.status === 401 || e.status === 403)) { clearStaffToken("waiter"); router.push("/waiter/login"); } return []; } },
    enabled: !!branchId, refetchInterval: POLL,
  });
  const { data: readyOrders = [] } = useQuery({
    queryKey: ["waiter-ready-orders", branchId],
    queryFn: async () => { if (!branchId) return []; try { return await authGet<WaiterReadyOrder[]>(`/api/waiter/ready-orders?branchId=${branchId}`); } catch (e) { if (e instanceof ApiError && (e.status === 401 || e.status === 403)) { clearStaffToken("waiter"); router.push("/waiter/login"); } return []; } },
    enabled: !!branchId, refetchInterval: POLL,
  });

  const onMutated = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["waiter-floor"] });
    qc.invalidateQueries({ queryKey: ["waiter-requests"] });
    qc.invalidateQueries({ queryKey: ["waiter-notifications"] });
    qc.invalidateQueries({ queryKey: ["waiter-ready-orders"] });
  }, [qc]);
  const activeReqs = requests.filter(r => r.status === "NEW" || r.status === "CLAIMED");
  const readyNotifications = notifications.filter(n => n.type === "ORDER_STATUS");

  const zones = useMemo(() => Array.from(new Set(tables.map(t => t.zone ?? "Main Floor"))), [tables]);
  const filteredTables = activeZone ? tables.filter(t => (t.zone ?? "Main Floor") === activeZone) : tables;

  // KPI stats (matches reference design)
  const totalTables = tables.length;
  const availableCount = tables.filter(t => t.attentionState === "AVAILABLE").length;
  const activeOrders = tables.reduce((s, t) => s + (t.session?.orderCount ?? 0), 0);
  const pendingService = activeReqs.length;
  const readyToServe = readyOrders.length;
  const totalRevenue = tables.reduce((s, t) => s + (t.session?.totalAmount ?? 0), 0);

  /** Tap behavior on a table card. CLEANING / TURNOVER_REQUIRED tables flip to AVAILABLE
   *  in place — everything else opens the workspace. */
  async function handleTableTap(t: WaiterTableSummary) {
    const isCleaning = t.attentionState === "CLEANING" || t.attentionState === "TURNOVER_REQUIRED";
    if (!isCleaning) {
      router.push(`/waiter/table/${t.id}`);
      return;
    }
    try {
      await authPatch(`/api/tables/${t.id}/status`, undefined, { status: "AVAILABLE" });
      toast(`${t.tableCode} ready`);
      onMutated();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to mark ready", "error");
    }
  }

  async function handleTakeReadyOrder(order: WaiterReadyOrder) {
    try {
      if (!order.assignedWaiterId) {
        await authPatch(`/api/waiter/orders/${order.id}/claim`, undefined);
      }
      router.push(`/waiter/table/${order.tableId}`);
      onMutated();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to take order", "error");
    }
  }

  if (!branchId) return null;

  return (
    <main className="flex h-screen flex-col overflow-hidden" style={{ background: "var(--ink-50)" }}>
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-5 py-2.5 flex-shrink-0" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-[6px] font-serif text-sm font-extrabold italic" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>R</div>
          <div>
            <h1 className="font-serif text-[15px] font-bold leading-none" style={{ color: "var(--ink-900)" }}>Waiter Dashboard</h1>
            <p className="text-[9px] mt-0.5" style={{ color: "var(--ink-500)" }}>Manage your floor, tables, orders, and payments in real time.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-semibold" style={{ background: "var(--ok-soft)", color: "var(--ok)", border: "1px solid #bbf7d0" }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ok)", animation: "pulse-dot 2s infinite" }} />Online
          </span>
          <span className="text-[11px] font-medium" style={{ color: "var(--ink-700)" }}>{name}</span>
          <div className="flex h-7 w-7 items-center justify-center rounded-full font-serif text-[10px] font-bold" style={{ background: "linear-gradient(135deg, var(--accent), #9a3412)", color: "var(--ink-0)" }}>{name.charAt(0) || "W"}</div>
          <button onClick={() => { clearStaffToken("waiter"); router.push("/waiter/login"); }} className="rounded px-2 py-1 text-[9px] font-semibold" style={{ background: "var(--ink-100)", color: "var(--ink-500)" }}>End Shift</button>
        </div>
      </header>

      {/* ── KPI Stats Row ── */}
      <div className="flex gap-2.5 overflow-x-auto px-5 py-3 flex-shrink-0" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        {[
          { icon: <svg {...sv}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>, label: "Tables", value: totalTables, sub: `${availableCount} open`, color: "var(--ink-700)" },
          { icon: <svg {...sv}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /></svg>, label: "Active Orders", value: activeOrders, sub: "in progress", color: "var(--ok)" },
          { icon: <svg {...sv}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>, label: "Pending Service", value: pendingService, sub: "requests", color: "var(--accent)" },
          { icon: <svg {...sv}><polyline points="20 6 9 17 4 12" /></svg>, label: "Ready to Serve", value: readyToServe, sub: "orders", color: "#22c55e" },
          { icon: <svg {...sv}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>, label: "Revenue", value: `$${totalRevenue >= 1000 ? (totalRevenue / 1000).toFixed(1) + "k" : totalRevenue.toFixed(2)}`, sub: "today", color: "var(--accent)" },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2.5 rounded-[var(--r-md)] px-3 py-2 flex-shrink-0" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)", minWidth: 138 }}>
            <div className="flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] flex-shrink-0" style={{ background: `${s.color}14`, color: s.color }}>{s.icon}</div>
            <div className="min-w-0">
              <div className="font-serif text-[16px] font-extrabold leading-none" style={{ color: "var(--ink-900)" }}>{s.value}</div>
              <div className="font-mono text-[7.5px] uppercase tracking-widest mt-0.5" style={{ color: "var(--ink-500)" }}>{s.label}</div>
              <div className="text-[8px]" style={{ color: s.color }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Center area: Floor map header + tables grid + bottom action bar */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Floor Map header: zone tabs + legend */}
          <div className="flex flex-wrap items-center gap-3 px-5 py-2.5 flex-shrink-0" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Floor Map</span>
            <div className="flex gap-1">
              <button onClick={() => setActiveZone(null)} className="rounded-full px-2.5 py-1 text-[10px] font-semibold transition"
                style={{ background: !activeZone ? "var(--ink-900)" : "var(--ink-0)", color: !activeZone ? "var(--ink-0)" : "var(--ink-600)", border: `1px solid ${!activeZone ? "var(--ink-900)" : "var(--ink-200)"}` }}>
                All Zones
              </button>
              {zones.map(z => (
                <button key={z} onClick={() => setActiveZone(activeZone === z ? null : z)} className="rounded-full px-2.5 py-1 text-[10px] font-semibold transition"
                  style={{ background: activeZone === z ? "var(--ink-900)" : "var(--ink-0)", color: activeZone === z ? "var(--ink-0)" : "var(--ink-600)", border: `1px solid ${activeZone === z ? "var(--ink-900)" : "var(--ink-200)"}` }}>
                  {z}
                </button>
              ))}
            </div>
            <div className="ml-auto hidden md:flex items-center gap-3 font-mono text-[8px]" style={{ color: "var(--ink-500)" }}>
              {[
                { c: "var(--ink-200)", l: "Available" },
                { c: "var(--ok)", l: "Occupied" },
                { c: "#a78bfa", l: "Reserved" },
                { c: "var(--accent)", l: "Needs Service" },
                { c: "#22c55e", l: "Ready" },
              ].map(g => (
                <span key={g.l} className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: g.c }} />{g.l}
                </span>
              ))}
            </div>
          </div>

          {/* Tables grid */}
          <div className="flex-1 overflow-auto p-4">
            {filteredTables.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                <p className="text-[12px] font-medium" style={{ color: "var(--ink-500)" }}>No tables in this zone</p>
                <p className="text-[10px] mt-1" style={{ color: "var(--ink-400)" }}>Try selecting a different zone</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                {filteredTables.map(t => {
                  const bc = borderColor[t.attentionState];
                  const has = !!t.session;
                  const isUrgent = t.attentionState === "ASSISTANCE_NEEDED";
                  const isReady = t.session?.hasReadyOrders;
                  const isCleaning = t.attentionState === "CLEANING" || t.attentionState === "TURNOVER_REQUIRED";
                  return (
                    <button key={t.id} onClick={() => handleTableTap(t)}
                      className="relative rounded-[var(--r-lg)] p-3.5 text-left transition hover:shadow-md active:scale-[0.97]"
                      title={isCleaning ? `Tap to mark ${t.tableCode} ready` : undefined}
                      style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", borderLeftWidth: 4, borderLeftColor: bc, boxShadow: isUrgent ? `0 0 0 2px ${bc}30` : "0 1px 3px rgba(0,0,0,0.04)" }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-serif text-[18px] font-extrabold" style={{ color: "var(--ink-900)" }}>{t.tableCode}</span>
                        <span className="h-3 w-3 rounded-full" style={{ background: bc, animation: isUrgent ? "pulse-dot 1.5s infinite" : isReady ? "pulse-dot 2s infinite" : "none" }} />
                      </div>
                      {has ? (
                        <>
                          <div className="flex items-center gap-3 mb-2">
                            <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--ink-600)" }}>
                              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                              {t.session!.guestCount}
                            </span>
                            <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--ink-500)" }}>
                              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                              {timeShort(t.session!.startTime)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-serif text-[15px] font-extrabold" style={{ color: "var(--accent)" }}>${t.session!.totalAmount.toFixed(2)}</span>
                            {isReady ? (
                              <span className="rounded-full px-2 py-0.5 text-[8px] font-bold" style={{ background: "#22c55e", color: "var(--ink-0)" }}>READY</span>
                            ) : t.session!.orderCount > 0 ? (
                              <span className="rounded-full px-2 py-0.5 text-[8px] font-bold" style={{ background: "var(--ink-100)", color: "var(--ink-600)" }}>{t.session!.orderCount} orders</span>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px]" style={{ color: "var(--ink-400)" }}>{t.capacity} seats</span>
                            <span className="text-[8px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: "var(--ink-50)", color: "var(--ink-500)" }}>{stateLabel[t.attentionState]}</span>
                          </div>
                          {isCleaning && (
                            <div className="mt-1.5 text-[8.5px] font-semibold flex items-center gap-1" style={{ color: "var(--ok)" }}>
                              <svg width={9} height={9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                              Tap to mark ready
                            </div>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* ── Right Panel: Service Queue (full height) ── */}
        <div className="hidden w-[280px] flex-shrink-0 flex-col lg:flex" style={{ background: "var(--ink-0)", borderLeft: "1px solid var(--ink-200)" }}>
          {/* Service Queue header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Service Queue</span>
            {activeReqs.length > 0 && <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>{activeReqs.length}</span>}
          </div>

          {readyOrders.length > 0 && (
            <div className="px-4 pb-2">
              <div className="rounded-[8px] p-2.5" style={{ background: "var(--ok-soft)", border: "1px solid #bbf7d0" }}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-widest" style={{ color: "var(--ok)" }}>
                    <svg {...sv} width={12} height={12}><polyline points="20 6 9 17 4 12" /></svg>
                    Kitchen ready
                  </span>
                  <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold" style={{ background: "var(--ok)", color: "var(--ink-0)" }}>{readyOrders.length}</span>
                </div>
                <div className="space-y-1.5">
                  {readyOrders.slice(0, 5).map(order => (
                    <button key={order.id} onClick={() => handleTakeReadyOrder(order)}
                      className="flex w-full items-center gap-2 rounded-[6px] p-2 text-left transition active:scale-[0.98]"
                      style={{ background: "var(--ink-0)", border: `1px solid ${order.isMine ? "#bbf7d0" : order.assignedWaiterId ? "#fde68a" : "var(--ink-200)"}` }}>
                      <div className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: order.isMine ? "var(--ok)" : "var(--ink-900)", color: "var(--ink-0)" }}>
                        {order.tableCode}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[10px] font-semibold" style={{ color: "var(--ink-900)" }}>
                          Order #{order.id.slice(-4).toUpperCase()}
                        </div>
                        <div className="text-[8px]" style={{ color: "var(--ink-500)" }}>
                          {order.totalItems} items · {timeAgo(order.orderDateTime)}
                          {order.assignedWaiterName ? ` · ${order.assignedWaiterName}` : ""}
                        </div>
                      </div>
                      <span className="rounded px-2 py-0.5 text-[8px] font-bold" style={{
                        background: order.isMine ? "var(--ok-soft)" : order.assignedWaiterId ? "var(--warn-soft)" : "var(--accent-soft)",
                        color: order.isMine ? "var(--ok)" : order.assignedWaiterId ? "var(--warn)" : "var(--accent)",
                      }}>
                        {order.isMine ? "Open" : order.assignedWaiterId ? "View" : "Take"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {readyNotifications.length > 0 && (
            <div className="px-4 pb-2">
              <div className="rounded-[8px] p-2.5" style={{ background: "var(--ok-soft)", border: "1px solid #bbf7d0" }}>
                <div className="mb-1.5 flex items-center gap-1.5">
                  <svg {...sv} width={12} height={12} style={{ color: "var(--ok)" }}><polyline points="20 6 9 17 4 12" /></svg>
                  <span className="font-mono text-[8px] font-bold uppercase tracking-widest" style={{ color: "var(--ok)" }}>Ready for you</span>
                </div>
                <div className="space-y-1.5">
                  {readyNotifications.slice(0, 3).map(n => (
                    <div key={n.id} className="rounded-[6px] p-2" style={{ background: "var(--ink-0)", border: "1px solid #dcfce7" }}>
                      <div className="text-[10px] font-semibold" style={{ color: "var(--ink-900)" }}>{n.title}</div>
                      <div className="mt-0.5 text-[8px]" style={{ color: "var(--ink-500)" }}>{n.body}</div>
                      <button onClick={async () => { try { await authPatch(`/api/notifications/${n.id}/read`); onMutated(); } catch { toast("Could not dismiss notification", "error"); } }}
                        className="mt-1.5 rounded px-2 py-0.5 text-[8px] font-bold"
                        style={{ background: "var(--ok)", color: "var(--ink-0)" }}>
                        Dismiss
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Scrollable list — fills remaining height */}
          <div className="flex-1 overflow-auto px-4 pb-3">
            {activeReqs.length === 0 ? (
              <div className="py-6 text-center text-[10px] font-serif italic" style={{ color: "var(--ink-400)" }}>All caught up.</div>
            ) : (
              <div className="space-y-1.5">
                {activeReqs.map(r => (
                  <div key={r.id} className="flex items-center gap-2 rounded-[6px] px-2.5 py-2" style={{ background: r.status === "NEW" ? "var(--accent-soft)" : "var(--ink-50)", border: `1px solid ${r.status === "NEW" ? "var(--accent-edge)" : "var(--ink-100)"}` }}>
                    <div className="flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0" style={{ background: r.status === "NEW" ? "var(--accent)" : "var(--ink-200)", color: r.status === "NEW" ? "var(--ink-0)" : "var(--ink-600)" }}>
                      <SrIcon type={r.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-semibold" style={{ color: "var(--ink-900)" }}>{r.table.tableCode}</div>
                      <div className="text-[8px]" style={{ color: "var(--ink-500)" }}>{r.type.replace(/_/g, " ").toLowerCase()}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[7px]" style={{ color: "var(--ink-400)" }}>{timeAgo(r.createdAt)}</span>
                      <button onClick={async () => { try { await authPatch(`/api/service-requests/${r.id}/${r.status === "NEW" ? "claim" : "complete"}`); toast(r.status === "NEW" ? "Claimed" : "Done"); onMutated(); } catch (err) { toast(err instanceof Error ? err.message : "Failed", "error"); } }}
                        className="rounded px-2 py-0.5 text-[8px] font-bold" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>
                        {r.status === "NEW" ? "Claim" : "Done"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 flex-shrink-0" style={{ borderTop: "1px solid var(--ink-200)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[8px]" style={{ color: "var(--ink-400)" }}>Auto-refresh {POLL / 1000}s</span>
              <span className="flex items-center gap-1 text-[8px]" style={{ color: "var(--ok)" }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ok)", animation: "pulse-dot 2s infinite" }} />Live
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
