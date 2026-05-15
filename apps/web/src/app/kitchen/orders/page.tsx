"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { authGet, authPatch, authPost, ApiError, getApiErrorMessage } from "../../../lib/api";
import { getStaffToken, getStaffBranchId, getStaffName, getStaffPermissions, getStaffRole, clearStaffToken } from "../../../lib/staff-auth";
import type { KdsOrder, KdsOrderItem, KitchenStation } from "../../../lib/kds-types";
import { EmptyState, InlineAlert, LoadingScreen, PermissionDeniedState } from "../../../components/ui";

const CACHE_KEY = "kds_queue_cache";
const POLL_MS = 5_000;
const DELAY_MIN = 15;
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
const KITCHEN_ACTIVE_STATUSES = new Set(["PLACED", "CONFIRMED", "IN_KITCHEN", "READY"]);

function minsAgo(d: string) { return Math.floor((Date.now() - new Date(d).getTime()) / 60_000); }
function fmtTimer(d: string) { const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }

const sv = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

interface StaffSession {
  staffId: string;
  tenantId: string;
  branchId: string;
  primaryRole: string;
  permissions: string[];
}

interface BranchRealtimeEvent {
  name: string;
  payload?: {
    orderId?: string;
    sessionId?: string;
    status?: string;
  };
}

function isKitchenActiveOrder(order: KdsOrder) {
  return KITCHEN_ACTIVE_STATUSES.has(order.orderStatus);
}

/* ── Order Card ── */
function OrderCard({ order, token, lane, onMutated, onAuthFailure }: { order: KdsOrder; token: string; lane: "new" | "cooking" | "ready"; onMutated: () => void; onAuthFailure: () => void }) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const mins = minsAgo(order.orderDateTime);
  const isDelayed = mins > DELAY_MIN && lane !== "ready";
  const items = order.orderItems.filter(i => i.kitchenStatus !== "CANCELLED");

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      onMutated();
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        onAuthFailure();
        return;
      }
      setActionError(getApiErrorMessage(error, "Kitchen action failed. Please retry."));
    } finally {
      setBusy(false);
    }
  }

  const borderColor = lane === "new" ? "#3b82f6" : lane === "cooking" ? "var(--accent)" : "var(--ok)";

  return (
    <div className="rounded-[var(--r-lg)] overflow-hidden mb-3" style={{ background: "var(--ink-0)", border: `1px solid ${isDelayed ? "var(--bad)" : "var(--ink-200)"}`, boxShadow: isDelayed ? "0 0 0 2px #fecaca" : "0 1px 3px rgba(0,0,0,0.04)" }}>
      {/* Card header */}
      <div className="flex items-center justify-between px-3.5 py-2.5" style={{ background: isDelayed ? "var(--bad-soft)" : "var(--ink-50)", borderBottom: "1px solid var(--ink-200)" }}>
        <div className="flex items-center gap-2.5">
          <span className="font-serif text-[18px] font-extrabold" style={{ color: borderColor }}>#{order.id.slice(-4).toUpperCase()}</span>
          <span className="rounded-[var(--r-md)] px-2 py-0.5 text-[10px] font-bold" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>{order.session.table.tableCode}</span>
          {order.source === "WAITER_QUICK_ADD" && <span className="rounded px-1.5 py-0.5 text-[8px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>WAITER</span>}
          {isDelayed && <span className="rounded px-1.5 py-0.5 text-[8px] font-bold" style={{ background: "var(--bad)", color: "var(--ink-0)" }}>DELAYED</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-bold" style={{ color: isDelayed ? "var(--bad)" : "var(--ink-500)" }}>{fmtTimer(order.orderDateTime)}</span>
        </div>
      </div>

      {/* Items */}
      <div className="px-3.5 py-2">
        {order.specialInstructions && (
          <div className="mb-2 rounded-[var(--r-sm)] px-2.5 py-1.5" style={{ background: "var(--warn-soft)", border: "1px solid #fde68a" }}>
            <span className="text-[9px] font-bold uppercase" style={{ color: "var(--warn)" }}>NOTE: </span>
            <span className="text-[10px] italic" style={{ color: "#78350f" }}>{order.specialInstructions}</span>
          </div>
        )}
        {items.map(item => {
          const specs = Array.isArray(item.specializationsJson) ? item.specializationsJson as Array<{ name: string }> : [];
          return (
            <div key={item.id} className="flex items-center gap-2.5 py-2" style={{ borderBottom: "1px solid var(--ink-100)" }}>
              <span className="flex h-6 w-6 items-center justify-center rounded-[var(--r-sm)] font-mono text-[11px] font-bold" style={{ background: "var(--ink-100)", color: "var(--ink-700)" }}>{item.quantity}</span>
              <div className="flex-1 min-w-0">
                <span className="text-[12px] font-semibold" style={{ color: "var(--ink-900)" }}>{item.menuItem.name}</span>
                {specs.length > 0 && <div className="text-[9px] italic" style={{ color: "var(--ink-500)" }}>{specs.map(s => s.name).join(", ")}</div>}
                {item.station && <span className="ml-1 rounded px-1 py-0.5 text-[7px] font-bold uppercase" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>{item.station.name}</span>}
              </div>
              {/* Per-item actions */}
              {lane === "new" && item.kitchenStatus === "PENDING" && (
                <button onClick={() => act(() => authPatch(`/api/kds/order-items/${item.id}/status`, token, { status: "IN_PROGRESS" }))} disabled={busy}
                  className="rounded-[var(--r-md)] px-3 py-1.5 text-[10px] font-bold transition disabled:opacity-40"
                  style={{ background: "#3b82f6", color: "var(--ink-0)" }}>Fire</button>
              )}
              {lane === "cooking" && item.kitchenStatus === "IN_PROGRESS" && (
                <button onClick={() => act(async () => {
                  await authPatch(`/api/kds/order-items/${item.id}/status`, token, { status: "READY" });
                  // If this was the last non-ready item, auto-mark order as ready
                  const otherPending = items.filter(i => i.id !== item.id && i.kitchenStatus !== "READY");
                  if (otherPending.length === 0) {
                    try { await authPatch(`/api/kds/orders/${order.id}/ready`, token); } catch {}
                  }
                })} disabled={busy}
                  className="rounded-[var(--r-md)] px-3 py-1.5 text-[10px] font-bold transition disabled:opacity-40"
                  style={{ background: "var(--accent)", color: "var(--ink-0)" }}>Done</button>
              )}
              {lane === "cooking" && item.kitchenStatus === "PENDING" && (
                <button onClick={() => act(() => authPatch(`/api/kds/order-items/${item.id}/status`, token, { status: "IN_PROGRESS" }))} disabled={busy}
                  className="rounded-[var(--r-md)] px-3 py-1.5 text-[10px] font-bold transition disabled:opacity-40"
                  style={{ border: "1px solid #3b82f6", color: "#3b82f6" }}>Fire</button>
              )}
              {item.kitchenStatus === "READY" && <span className="rounded-full px-2 py-0.5 text-[8px] font-bold" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>✓</span>}
            </div>
          );
        })}
      </div>

      {/* Card footer action */}
      <div className="px-3.5 py-2" style={{ borderTop: "1px solid var(--ink-100)" }}>
        {actionError && (
          <InlineAlert tone="error" title="Action failed" className="mb-2">
            {actionError}
          </InlineAlert>
        )}
        {lane === "new" && (
          <button onClick={() => act(() => authPatch(`/api/kds/orders/${order.id}/start`, token))} disabled={busy}
            className="w-full rounded-[var(--r-md)] py-2.5 text-[11px] font-bold transition disabled:opacity-40"
            style={{ background: "#3b82f6", color: "var(--ink-0)" }}>
            {busy ? "..." : "Fire All →"}
          </button>
        )}
        {lane === "cooking" && items.every(i => i.kitchenStatus === "READY") && (
          <button onClick={() => act(() => authPatch(`/api/kds/orders/${order.id}/ready`, token))} disabled={busy}
            className="w-full rounded-[var(--r-md)] py-2.5 text-[11px] font-bold transition disabled:opacity-40"
            style={{ background: "var(--ok)", color: "var(--ink-0)" }}>
            {busy ? "..." : "Mark Ready ✓"}
          </button>
        )}
        {lane === "cooking" && !items.every(i => i.kitchenStatus === "READY") && (
          <div className="flex items-center justify-between">
            <span className="text-[9px]" style={{ color: "var(--ink-400)" }}>{items.filter(i => i.kitchenStatus === "READY").length}/{items.length} items done</span>
            <div className="h-1.5 flex-1 mx-3 rounded-full overflow-hidden" style={{ background: "var(--ink-100)" }}>
              <div className="h-full rounded-full" style={{ width: `${(items.filter(i => i.kitchenStatus === "READY").length / items.length) * 100}%`, background: "var(--accent)" }} />
            </div>
          </div>
        )}
        {lane === "ready" && (
          <div className="text-center">
            <span className="font-mono text-[10px] font-bold" style={{ color: "var(--ok)" }}>Ready for pickup</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function KdsOrdersPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [staffName, setLocalName] = useState("");
  const [isOffline, setIsOffline] = useState(false);
  const [cachedOrders, setCachedOrders] = useState<KdsOrder[]>([]);
  const [stationFilter, setStationFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadSession() {
    const t = getStaffToken("kitchen"); const b = getStaffBranchId("kitchen");
    if (!t) { router.push("/kitchen/login"); return; }
    const role = getStaffRole("kitchen");
    const permissions = getStaffPermissions("kitchen");
    const canUseKds =
      ["CHEF", "KITCHEN_LEAD", "OWNER", "MANAGER"].includes(role ?? "") &&
      permissions.includes("kds:read") &&
      permissions.includes("kds:write");
    if (!canUseKds) {
      if (active) setPermissionDenied(true);
      return;
    }
      try {
        const session = await authGet<StaffSession>("/api/auth/me", t);
        const serverCanUseKds =
          ["CHEF", "KITCHEN_LEAD", "OWNER", "MANAGER"].includes(session.primaryRole) &&
          session.permissions.includes("kds:read") &&
          session.permissions.includes("kds:write");
        if (!serverCanUseKds) throw new ApiError(403, { message: "Wrong workspace session" });
        if (!active) return;
        setToken(t); setBranchId(session.branchId || b); setLocalName(getStaffName("kitchen") ?? "");
        try { const c = localStorage.getItem(CACHE_KEY); if (c) setCachedOrders(JSON.parse(c)); } catch {}
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
          if (active) setPermissionDenied(true);
          return;
        }
        clearStaffToken("kitchen");
        localStorage.removeItem(CACHE_KEY);
        if (active) router.push("/kitchen/login");
      }
    }
    void loadSession();
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    let wl: WakeLockSentinel | null = null;
    async function req() { try { if ("wakeLock" in navigator) wl = await navigator.wakeLock.request("screen"); } catch {} }
    req(); const vis = () => { if (document.visibilityState === "visible") req(); };
    document.addEventListener("visibilitychange", vis);
    return () => { document.removeEventListener("visibilitychange", vis); wl?.release().catch(() => {}); };
  }, []);

  const stationQuery = stationFilter ? `&stationId=${stationFilter}` : "";
  const { data: orders, refetch } = useQuery({
    queryKey: ["kds-queue", branchId, stationFilter],
    queryFn: async () => {
      if (!token || !branchId) return [];
      try {
        const d = await authGet<KdsOrder[]>(`/api/kds/orders?branchId=${branchId}${stationQuery}`, token);
        const activeOrders = d.filter(isKitchenActiveOrder);
        setIsOffline(false);
        localStorage.setItem(CACHE_KEY, JSON.stringify(activeOrders));
        setCachedOrders(activeOrders);
        return activeOrders;
      }
      catch (e) { if (e instanceof ApiError && e.status === 401) { clearStaffToken("kitchen"); router.push("/kitchen/login"); return []; } setIsOffline(true); return cachedOrders; }
    },
    enabled: !!token && !!branchId, refetchInterval: POLL_MS,
  });

  const { data: stations = [] } = useQuery({
    queryKey: ["kds-stations", branchId],
    queryFn: async () => { if (!token || !branchId) return []; try { return await authGet<KitchenStation[]>(`/api/kds/stations?branchId=${branchId}`, token); } catch { return []; } },
    enabled: !!token && !!branchId,
  });

  // KDS stats from backend (real avg prep time, today only)
  interface KdsStats { avgPrepMinutes: number; completedToday: number; totalToday: number; date: string }
  const { data: stats } = useQuery({
    queryKey: ["kds-stats", branchId],
    queryFn: async () => { if (!token || !branchId) return null; try { return await authGet<KdsStats>(`/api/kds/stats?branchId=${branchId}`, token); } catch { return null; } },
    enabled: !!token && !!branchId, refetchInterval: POLL_MS,
  });

  const handleMutated = useCallback(() => { refetch(); }, [refetch]);
  const removeServedOrderFromCache = useCallback((orderId: string) => {
    setCachedOrders((current) => {
      const next = current.filter((order) => order.id !== orderId);
      localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);
  const handleAuthFailure = useCallback(() => {
    clearStaffToken("kitchen");
    localStorage.removeItem(CACHE_KEY);
    router.push("/kitchen/login");
  }, [router]);

  useEffect(() => {
    if (!token || !branchId) return;

    const source = new EventSource(`${API_BASE}/api/realtime/branches/${encodeURIComponent(branchId)}/events?token=${encodeURIComponent(token)}`);

    const handleOrderServed = (event: MessageEvent) => {
      try {
        const realtimeEvent = JSON.parse(event.data) as BranchRealtimeEvent;
        const orderId = realtimeEvent.payload?.orderId;
        if (orderId) removeServedOrderFromCache(orderId);
      } catch {}
      void refetch();
    };

    const handleOrderRefresh = () => {
      void refetch();
    };

    source.addEventListener("ORDER_SERVED", handleOrderServed);
    source.addEventListener("ORDER_UPDATED", handleOrderRefresh);
    source.addEventListener("ORDER_READY", handleOrderRefresh);
    source.addEventListener("ORDER_PLACED", handleOrderRefresh);

    return () => {
      source.removeEventListener("ORDER_SERVED", handleOrderServed);
      source.removeEventListener("ORDER_UPDATED", handleOrderRefresh);
      source.removeEventListener("ORDER_READY", handleOrderRefresh);
      source.removeEventListener("ORDER_PLACED", handleOrderRefresh);
      source.close();
    };
  }, [token, branchId, refetch, removeServedOrderFromCache]);

  const display = (orders ?? cachedOrders).filter(isKitchenActiveOrder);
  const q = searchQuery.toLowerCase();
  const filtered = q ? display.filter(o => o.id.toLowerCase().includes(q) || o.session.table.tableCode.toLowerCase().includes(q)) : display;

  const newOrders = filtered.filter(o => o.orderStatus === "PLACED" || o.orderStatus === "CONFIRMED");
  const cookingOrders = filtered.filter(o => o.orderStatus === "IN_KITCHEN");
  const readyOrders = filtered.filter(o => o.orderStatus === "READY");
  const delayedCount = display.filter(o => minsAgo(o.orderDateTime) > DELAY_MIN && o.orderStatus !== "READY").length;
  const totalOpen = display.filter(o => o.orderStatus !== "READY").length;
  const avgPrep = stats?.avgPrepMinutes ?? 0;

  const now = new Date();

  if (permissionDenied) {
    return <PermissionDeniedState title="Kitchen access required" description="This account cannot use the kitchen display for the selected branch." />;
  }

  if (!token) return <LoadingScreen message="Opening kitchen display..." />;

  // Offline state
  if (isOffline && cachedOrders.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center p-12 text-center" style={{ background: "var(--ink-50)" }}>
        <div className="rounded-[var(--r-xl)] p-8" style={{ background: "var(--bad-soft)", border: "2px solid #fecaca" }}>
          <h1 className="font-serif text-[32px] font-extrabold" style={{ color: "var(--bad)" }}>Connection Lost</h1>
          <p className="mt-2 text-[13px]" style={{ color: "#991b1b" }}>The station lost contact. Tickets on-screen are safe.</p>
          <button onClick={() => refetch()} className="mt-4 rounded-[var(--r-md)] px-6 py-3 text-sm font-bold" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>Retry &rarr;</button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col" style={{ background: "var(--ink-50)" }}>
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-5 py-2 flex-shrink-0" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] font-bold" style={{ color: "var(--accent)" }}>{now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
          <span className="font-mono text-[10px]" style={{ color: "var(--ink-400)" }}>{now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] font-serif text-[11px] font-extrabold italic" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>R</div>
          <span className="font-serif text-[12px] font-bold hidden sm:block" style={{ color: "var(--ink-900)" }}>Kitchen <em className="italic font-medium" style={{ color: "var(--accent)" }}>Display</em></span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] hidden md:block" style={{ color: "var(--ink-500)" }}>Kitchen Display 1</span>
          <span className="flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold" style={{ background: isOffline ? "var(--bad-soft)" : "var(--ok-soft)", color: isOffline ? "var(--bad)" : "var(--ok)", border: `1px solid ${isOffline ? "#fecaca" : "#bbf7d0"}` }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: isOffline ? "var(--bad)" : "var(--ok)", animation: isOffline ? "none" : "pulse-dot 2s infinite" }} />
            {isOffline ? "Offline" : "Online"}
          </span>
          <span className="text-[10px]" style={{ color: "var(--ink-600)" }}>{staffName}</span>
          <button onClick={() => { clearStaffToken("kitchen"); localStorage.removeItem(CACHE_KEY); router.push("/kitchen/login"); }} className="rounded-[var(--r-sm)] px-2 py-1 text-[9px] font-semibold" style={{ background: "var(--ink-100)", color: "var(--ink-500)" }}>Exit</button>
        </div>
      </header>

      {/* ── Control bar ── */}
      <div className="flex items-center gap-2 px-5 py-2 flex-shrink-0 flex-wrap" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        {/* Station filter */}
        <select value={stationFilter ?? ""} onChange={e => setStationFilter(e.target.value || null)}
          className="rounded-[var(--r-md)] px-2.5 py-1.5 text-[10px] font-semibold outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>
          <option value="">All Stations</option>
          {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {/* Search */}
        <div className="flex items-center gap-1.5 rounded-[var(--r-md)] px-2.5 py-1.5" style={{ border: "1px solid var(--ink-200)" }}>
          <svg {...sv} style={{ color: "var(--ink-400)" }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search orders..." className="w-24 bg-transparent text-[10px] outline-none" style={{ color: "var(--ink-900)" }} />
        </div>
        {/* 86 */}
        <button className="rounded-[var(--r-md)] px-2.5 py-1.5 text-[10px] font-bold" style={{ background: "var(--bad-soft)", color: "var(--bad)", border: "1px solid #fecaca" }}>86 Items</button>
        <div className="ml-auto flex items-center gap-2">
          {/* Fullscreen */}
          <button onClick={() => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {})} className="rounded-[var(--r-md)] px-2 py-1.5 text-[10px] font-semibold" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-600)" }}>
            <svg {...sv}><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>
          </button>
          {/* Refresh */}
          <button onClick={() => refetch()} className="rounded-[var(--r-md)] px-2 py-1.5 text-[10px] font-semibold" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-600)" }}>
            <svg {...sv}><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
          </button>
        </div>
      </div>

      {(isOffline || bulkError) && (
        <div className="px-5 py-2" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
          {isOffline && (
            <InlineAlert tone="warning" title="Offline mode">
              Showing the last saved kitchen queue. New tickets and updates will sync when the connection returns.
            </InlineAlert>
          )}
          {bulkError && (
            <InlineAlert tone="error" title="Bulk action failed" className={isOffline ? "mt-2" : ""}>
              {bulkError}
            </InlineAlert>
          )}
        </div>
      )}

      {/* ── KPI row ── */}
      <div className="flex items-center gap-3 px-5 py-2.5 flex-shrink-0" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        {[
          { label: "Live Orders", value: totalOpen, color: "var(--accent)", icon: <svg {...sv}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /></svg> },
          { label: "Delayed", value: delayedCount, color: delayedCount > 0 ? "var(--bad)" : "var(--ok)", icon: <svg {...sv}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg> },
          { label: "Avg Prep", value: `${avgPrep} min`, color: "var(--ink-700)", icon: <svg {...sv}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> },
          { label: "Ready", value: readyOrders.length, color: "var(--ok)", icon: <svg {...sv}><polyline points="20 6 9 17 4 12" /></svg> },
        ].map(k => (
          <div key={k.label} className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0" style={{ background: `${k.color}12`, color: k.color }}>{k.icon}</div>
            <div>
              <div className="font-serif text-[16px] font-extrabold leading-none" style={{ color: k.color }}>{k.value}</div>
              <div className="font-mono text-[8px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>{k.label}</div>
            </div>
          </div>
        ))}
        {/* Delayed alert */}
        {delayedCount > 0 && (
          <div className="ml-auto flex items-center gap-2 rounded-[var(--r-md)] px-3 py-1.5" style={{ background: "var(--bad-soft)", border: "1px solid #fecaca" }}>
            <span className="text-[10px] font-bold" style={{ color: "var(--bad)" }}>{delayedCount} ORDERS ARE DELAYED</span>
            <button className="rounded-[var(--r-sm)] px-2 py-0.5 text-[9px] font-bold" style={{ background: "var(--bad)", color: "var(--ink-0)" }}>View Delayed</button>
          </div>
        )}
      </div>

      {/* ── 3-Lane Board ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* NEW */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ borderRight: "1px solid var(--ink-200)" }}>
          <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0" style={{ background: "#eff6ff", borderBottom: "2px solid #3b82f6" }}>
            <div className="flex items-center gap-2">
              <span className="font-serif text-[14px] font-extrabold" style={{ color: "#1d4ed8" }}>NEW</span>
              <span className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold" style={{ background: "#3b82f6", color: "var(--ink-0)" }}>{newOrders.length}</span>
            </div>
            {newOrders.length > 0 && (
              <button onClick={async () => {
                setBulkBusy(true);
                setBulkError(null);
                try {
                  for (const o of newOrders) {
                    await authPatch(`/api/kds/orders/${o.id}/start`, token!);
                  }
                  handleMutated();
                } catch (error) {
                  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
                    handleAuthFailure();
                    return;
                  }
                  setBulkError(getApiErrorMessage(error, "Could not fire all orders. Please retry."));
                } finally {
                  setBulkBusy(false);
                }
              }}
                disabled={bulkBusy}
                className="rounded-[var(--r-md)] px-3 py-1.5 text-[9px] font-bold disabled:opacity-50" style={{ background: "#3b82f6", color: "var(--ink-0)" }}>{bulkBusy ? "Firing..." : "Fire All"}</button>
            )}
          </div>
          <div className="flex-1 overflow-auto p-3" style={{ background: "#fafbff" }}>
            {newOrders.length === 0 && <div className="flex flex-col items-center py-12 text-center"><span className="text-[11px]" style={{ color: "var(--ink-400)" }}>No new orders</span></div>}
            {newOrders.map(o => <OrderCard key={o.id} order={o} token={token!} lane="new" onMutated={handleMutated} onAuthFailure={handleAuthFailure} />)}
          </div>
        </div>

        {/* COOKING */}
        <div className="flex-1 flex flex-col overflow-hidden" style={{ borderRight: "1px solid var(--ink-200)" }}>
          <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0" style={{ background: "var(--accent-soft)", borderBottom: "2px solid var(--accent)" }}>
            <div className="flex items-center gap-2">
              <span className="font-serif text-[14px] font-extrabold" style={{ color: "var(--accent-ink)" }}>COOKING</span>
              <span className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>{cookingOrders.length}</span>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-3" style={{ background: "#fffcf8" }}>
            {cookingOrders.length === 0 && <div className="flex flex-col items-center py-12 text-center"><span className="text-[11px]" style={{ color: "var(--ink-400)" }}>Nothing cooking</span></div>}
            {cookingOrders.map(o => <OrderCard key={o.id} order={o} token={token!} lane="cooking" onMutated={handleMutated} onAuthFailure={handleAuthFailure} />)}
          </div>
        </div>

        {/* READY */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0" style={{ background: "var(--ok-soft)", borderBottom: "2px solid var(--ok)" }}>
            <div className="flex items-center gap-2">
              <span className="font-serif text-[14px] font-extrabold" style={{ color: "#166534" }}>READY</span>
              <span className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold" style={{ background: "var(--ok)", color: "var(--ink-0)" }}>{readyOrders.length}</span>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-3" style={{ background: "#f8fdf9" }}>
            {readyOrders.length === 0 && (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full mb-3" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>
                  <svg {...sv}><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <span className="text-[12px] font-medium" style={{ color: "var(--ok)" }}>Ready for Pickup</span>
                <span className="text-[9px] mt-0.5" style={{ color: "var(--ink-400)" }}>Completed orders will appear here</span>
              </div>
            )}
            {readyOrders.map(o => <OrderCard key={o.id} order={o} token={token!} lane="ready" onMutated={handleMutated} onAuthFailure={handleAuthFailure} />)}
          </div>
        </div>
      </div>

      {filtered.length === 0 && display.length === 0 && !isOffline && (
        <div className="pointer-events-none absolute inset-x-0 top-[190px] z-10 flex justify-center">
          <div className="pointer-events-auto rounded-[var(--r-lg)] px-8" style={{ background: "rgba(255,255,255,0.92)", border: "1px solid var(--ink-200)" }}>
            <EmptyState icon="*" title="No active kitchen orders" description="New, cooking, and ready orders will appear here automatically." />
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="flex items-center justify-between px-5 py-1.5 flex-shrink-0" style={{ background: "var(--ink-0)", borderTop: "1px solid var(--ink-200)" }}>
        <div className="flex items-center gap-2">
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
          <span className="text-[9px]" style={{ color: "var(--ink-500)" }}>Secure connection</span>
          <span className="text-[9px]" style={{ color: "var(--ink-400)" }}>&middot; Auto-refresh {POLL_MS / 1000}s</span>
          <span className="text-[9px]" style={{ color: "var(--ink-400)" }}>&middot; Last synced {now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[8px]" style={{ color: "var(--ink-400)" }}>F: Fire All</span>
          <span className="font-mono text-[8px]" style={{ color: "var(--ink-400)" }}>D: Done All</span>
          <span className="font-mono text-[8px]" style={{ color: "var(--ink-400)" }}>R: Ready All</span>
          <span className="font-mono text-[8px]" style={{ color: "var(--ink-400)" }}>?: Help</span>
        </div>
      </div>
    </main>
  );
}
