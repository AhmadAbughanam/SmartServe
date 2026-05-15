"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { authGet, authPost, authPatch, get } from "../../../../lib/api";
import { getStaffToken, getStaffBranchId, getStaffName } from "../../../../lib/staff-auth";
import type { TableDetail } from "../../../../lib/waiter-types";
import type { MenuCategory, MenuItem } from "../../../../lib/types";
import { useToast, LoadingScreen } from "../../../../components/ui";
import Link from "next/link";
import { MenuCategoryIcon, menuCategoryMeta } from "../../../../components/menu-category-icon";

const sv = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const grads = ["linear-gradient(135deg,#c2410c,#7c2d12)","linear-gradient(135deg,#15803d,#14532d)","linear-gradient(135deg,#b45309,#78350f)","linear-gradient(135deg,#0e7490,#164e63)","linear-gradient(135deg,#9333ea,#581c87)","linear-gradient(135deg,#dc2626,#7f1d1d)","linear-gradient(135deg,#ca8a04,#713f12)"];
function grad(id: string) { let h = 0; for (const c of id) h = ((h << 5) - h + c.charCodeAt(0)) | 0; return grads[Math.abs(h) % grads.length]; }
function timeShort(d: string): string { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60_000); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`; }

export default function TableWorkspacePage() {
  const { tableId } = useParams<{ tableId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [qaItems, setQaItems] = useState<Array<{ menuItemId: string; name: string; price: number; qty: number }>>([]);
  const [qaNotes, setQaNotes] = useState("");
  const { toast } = useToast();

  useEffect(() => { const t = getStaffToken("waiter"); if (!t) { router.push("/waiter/login"); return; } setToken(t); setBranchId(getStaffBranchId("waiter")); setStaffName(getStaffName("waiter") ?? ""); }, [router]);

  const { data: detail, isLoading } = useQuery({
    queryKey: ["waiter-table-detail", tableId],
    queryFn: () => authGet<TableDetail>(`/api/waiter/tables/${tableId}`, token!),
    enabled: !!token, refetchInterval: 6000,
  });

  const { data: menu } = useQuery({
    queryKey: ["waiter-menu", branchId],
    queryFn: () => get<MenuCategory[]>(`/api/menu?branchId=${branchId}&inStockOnly=true`),
    enabled: !!branchId,
  });

  const onMutated = () => { qc.invalidateQueries({ queryKey: ["waiter-table-detail"] }); };

  async function handleServe(orderId: string) { setBusy(orderId); try { await authPatch(`/api/waiter/orders/${orderId}/serve`, token!); toast("Order served"); onMutated(); } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); } finally { setBusy(null); } }

  async function handleClaim(orderId: string) { setBusy(`claim-${orderId}`); try { await authPatch(`/api/waiter/orders/${orderId}/claim`, token!); toast("Order assigned to you"); onMutated(); } catch (e) { toast(e instanceof Error ? e.message : "Failed to take order", "error"); } finally { setBusy(null); } }

  async function handleUpdateQty(itemId: string, qty: number) { if (!token) return; setBusy(itemId); try { await authPatch(`/api/waiter/order-items/${itemId}/quantity`, token, { quantity: qty }); toast("Quantity updated"); onMutated(); } catch (e) { toast(e instanceof Error ? e.message : "Only PENDING items can be edited", "error"); } finally { setBusy(null); } }

  async function handleCancelItem(itemId: string) { if (!token) return; setBusy(itemId); try { await authPatch(`/api/waiter/order-items/${itemId}/cancel`, token, { reason: "Waiter removed" }); toast("Item removed"); onMutated(); } catch (e) { toast(e instanceof Error ? e.message : "Only PENDING items can be removed", "error"); } finally { setBusy(null); } }

  async function handleUpdateNotes(orderId: string, notes: string) { if (!token) return; try { await authPatch(`/api/waiter/orders/${orderId}/notes`, token, { notes }); toast("Notes saved"); } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); } }

  async function handleSendToKitchen() {
    if (!qaItems.length || !token) return; setBusy("qa");
    try { await authPost(`/api/waiter/tables/${tableId}/quick-add`, token, { items: qaItems.map(i => ({ menuItemId: i.menuItemId, quantity: i.qty })), specialInstructions: qaNotes || undefined }); toast(`${qaItems.reduce((s, i) => s + i.qty, 0)} items sent to kitchen`); setQaItems([]); setQaNotes(""); onMutated(); }
    catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); } finally { setBusy(null); }
  }

  async function handleClear() { if (!token) return; setBusy("clr"); try { await authPost(`/api/waiter/tables/${tableId}/clear`, token); toast("Table cleared"); router.push("/waiter/dashboard"); } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); } finally { setBusy(null); } }

  function addToQa(mi: MenuItem) { setQaItems(p => { const e = p.find(x => x.menuItemId === mi.id); if (e) return p.map(x => x.menuItemId === mi.id ? { ...x, qty: x.qty + 1 } : x); return [...p, { menuItemId: mi.id, name: mi.name, price: parseFloat(mi.price), qty: 1 }]; }); }

  if (isLoading || !detail) return <LoadingScreen message="Loading table..." />;

  const session = detail.lastSession?.status === "ACTIVE" ? detail.lastSession : null;
  const orders = session?.orders ?? [];
  const allItems = orders.flatMap(o => o.orderItems).filter(oi => oi.kitchenStatus !== "CANCELLED");
  const subtotal = orders.reduce((s, o) => s + parseFloat(o.subtotalAmount), 0);
  const tax = orders.reduce((s, o) => s + parseFloat(o.taxAmount), 0);
  const total = orders.reduce((s, o) => s + parseFloat(o.totalAmount), 0);
  const categories = menu ?? [];
  const displayItems = activeCat ? categories.find(c => c.id === activeCat)?.menuItems ?? [] : categories.flatMap(c => c.menuItems);

  return (
    <main className="flex min-h-screen flex-col" style={{ background: "var(--ink-50)" }}>
      {/* ── Top bar ── */}
      <header className="flex items-center justify-between px-4 py-2" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] font-serif text-[11px] font-extrabold italic" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>R</div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold" style={{ color: "var(--ink-900)" }}>Waiter Dashboard</span>
              <span style={{ color: "var(--ink-300)" }}>/</span>
              <span className="text-[12px] font-bold" style={{ color: "var(--accent)" }}>Table {detail.tableCode} Workspace</span>
            </div>
            <p className="text-[8px]" style={{ color: "var(--ink-500)" }}>{detail.zone ?? "Main"} &middot; {detail.capacity} seats</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px]" style={{ color: "var(--ink-600)" }}>{staffName}</span>
          <div className="flex h-7 w-7 items-center justify-center rounded-full font-serif text-[10px] font-bold" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>{staffName.charAt(0) || "W"}</div>
        </div>
      </header>

      {/* ── Info bar ── */}
      <div className="flex items-center gap-4 px-4 py-2" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        <Link href="/waiter/dashboard" className="flex items-center gap-1 text-[10px] font-medium" style={{ color: "var(--ink-600)" }}>
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          Back to Dashboard
        </Link>
        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] font-serif text-[13px] font-extrabold" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>{detail.tableCode}</div>
        <span className="text-[10px]" style={{ color: "var(--ink-500)" }}>{detail.zone ?? "Main Hall"}</span>
        <div className="flex items-center gap-1 text-[10px]" style={{ color: "var(--ink-500)" }}>
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          {session?.guestCount ?? 0}
        </div>
        <div className="flex items-center gap-1 text-[10px]" style={{ color: "var(--ink-500)" }}>
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          {session ? timeShort(session.startTime) : "—"}
        </div>
        <span className="ml-auto text-[10px]" style={{ color: "var(--ink-500)" }}>{staffName}</span>
      </div>

      {/* ── Body: 3-column ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Category → Items flow */}
        <div className="hidden w-[220px] flex-shrink-0 flex-col lg:flex" style={{ background: "var(--ink-0)", borderRight: "1px solid var(--ink-200)" }}>
          {/* Header */}
          <div className="px-3 py-2.5 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid var(--ink-200)" }}>
            {activeCat ? (
              <>
                <button onClick={() => { setActiveCat(null); setQaItems([]); setQaNotes(""); }} className="flex items-center gap-1 text-[10px] font-medium" style={{ color: "var(--ink-600)" }}>
                  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
                  Back
                </button>
                <span className="text-[10px] font-bold" style={{ color: "var(--ink-900)" }}>{categories.find(c => c.id === activeCat)?.name}</span>
              </>
            ) : (
              <span className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Menu Categories</span>
            )}
          </div>

          <div className="flex-1 overflow-auto p-2.5">
            {/* Step 1: Show categories */}
            {!activeCat && (
              <div className="space-y-1.5">
                {categories.map(c => {
                  const itemCount = c.menuItems.filter(mi => !mi.isUnavailable).length;
                  const meta = menuCategoryMeta(c.name);
                  return (
                    <button key={c.id} onClick={() => setActiveCat(c.id)}
                      className="flex w-full items-center justify-between rounded-[var(--r-md)] p-3 text-left transition hover:shadow-sm active:scale-[0.98]"
                      style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--r-sm)]" style={{ background: meta.bg, color: meta.color, border: "1px solid rgba(15,23,42,0.08)" }}>
                          <MenuCategoryIcon name={c.name} size={17} />
                        </div>
                        <div>
                          <span className="text-[11px] font-semibold block" style={{ color: "var(--ink-900)" }}>{c.name}</span>
                          <span className="text-[8px]" style={{ color: meta.color }}>{itemCount} items</span>
                        </div>
                      </div>
                      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="var(--ink-400)" strokeWidth={2} strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Step 2: Show items from selected category */}
            {activeCat && (
              <div className="grid grid-cols-2 gap-1.5">
                {displayItems.filter(mi => !mi.isUnavailable).map(mi => {
                  const inCart = qaItems.find(x => x.menuItemId === mi.id);
                  return (
                    <button key={mi.id} onClick={() => addToQa(mi)}
                      className="rounded-[var(--r-md)] overflow-hidden text-left transition active:scale-[0.97]"
                      style={{ border: `1px solid ${inCart ? "var(--accent)" : "var(--ink-200)"}`, background: inCart ? "var(--accent-soft)" : "var(--ink-0)" }}>
                      <div className="h-14 w-full" style={{ background: mi.imageUrl ? `url(${mi.imageUrl.startsWith("/") ? "http://localhost:4000" + mi.imageUrl : mi.imageUrl}) center/cover` : grad(mi.id) }} />
                      <div className="p-1.5">
                        <div className="text-[9px] font-medium truncate" style={{ color: "var(--ink-900)" }}>{mi.name}</div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="font-mono text-[9px] font-bold" style={{ color: "var(--accent)" }}>${parseFloat(mi.price).toFixed(2)}</span>
                          {inCart && <span className="rounded-full px-1 text-[7px] font-bold" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>{inCart.qty}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* Cart summary with notes */}
          {qaItems.length > 0 && (
            <div className="p-2.5" style={{ borderTop: "1px solid var(--ink-200)" }}>
              {/* Items in cart */}
              <div className="space-y-1 mb-2">
                {qaItems.map(i => (
                  <div key={i.menuItemId} className="flex items-center justify-between text-[9px]">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="font-mono font-bold" style={{ color: "var(--ink-600)" }}>{i.qty}&times;</span>
                      <span className="truncate" style={{ color: "var(--ink-900)" }}>{i.name}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Notes for kitchen */}
              <input value={qaNotes} onChange={e => setQaNotes(e.target.value)} placeholder="Notes for kitchen (allergies, special requests...)"
                className="w-full rounded-[var(--r-sm)] px-2 py-1.5 text-[9px] outline-none mb-2" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)", background: "var(--ink-50)" }} />
              {/* Totals */}
              <div className="flex justify-between text-[10px] mb-1.5">
                <span style={{ color: "var(--ink-600)" }}>{qaItems.reduce((s, i) => s + i.qty, 0)} items</span>
                <span className="font-mono font-bold" style={{ color: "var(--accent)" }}>${qaItems.reduce((s, i) => s + i.price * i.qty, 0).toFixed(2)}</span>
              </div>
              <button onClick={handleSendToKitchen} disabled={busy === "qa"}
                className="w-full rounded-[var(--r-md)] py-2 text-[10px] font-semibold disabled:opacity-50"
                style={{ background: "var(--ok)", color: "var(--ink-0)" }}>
                {busy === "qa" ? "Sending..." : "Fire to Kitchen →"}
              </button>
              <button onClick={() => { setQaItems([]); setQaNotes(""); }} className="mt-1 w-full py-1 text-[8px]" style={{ color: "var(--ink-400)" }}>Clear</button>
            </div>
          )}
        </div>

        {/* Center: Orders / Courses */}
        <div className="flex-1 overflow-auto p-4">
          {orders.length === 0 && (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--ink-200)", color: "var(--ink-400)" }}>
                <svg {...sv}><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /></svg>
              </div>
              <p className="mt-3 text-[12px] font-medium" style={{ color: "var(--ink-500)" }}>No orders yet</p>
              <p className="mt-0.5 text-[10px]" style={{ color: "var(--ink-400)" }}>Select items from the menu to add</p>
            </div>
          )}

          {/* Course header */}
          {orders.length > 0 && (
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Current Order</span>
                <span className="font-mono text-[9px]" style={{ color: "var(--ink-400)" }}>Ticket</span>
                <span className="font-mono text-[9px] font-bold" style={{ color: "var(--ink-700)" }}>#{orders[0]?.id.slice(-4).toUpperCase()}</span>
              </div>
              <span className="rounded-full px-2 py-0.5 text-[8px] font-bold" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>
                {orders.every(o => o.orderStatus === "SERVED") ? "All Served" : orders.some(o => o.orderStatus === "READY") ? "Ready" : "In Progress"}
              </span>
            </div>
          )}

          {orders.filter(o => o.orderItems.some(oi => oi.kitchenStatus !== "CANCELLED")).map((o, oi) => {
            const isReady = o.orderStatus === "READY";
            const isServed = o.orderStatus === "SERVED";
            return (
              <div key={o.id} className="mb-3 rounded-[var(--r-lg)] overflow-hidden" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
                <div className="flex items-center justify-between px-4 py-2" style={{ background: isReady ? "var(--ok-soft)" : "var(--ink-50)", borderBottom: "1px solid var(--ink-200)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold" style={{ color: "var(--ink-900)" }}>Course {oi + 1}</span>
                    {o.source === "WAITER_QUICK_ADD" && <span className="text-[8px]" style={{ color: "var(--ink-400)" }}>Quick Add</span>}
                    {o.assignedWaiter ? (
                      <span className="rounded-full px-2 py-0.5 text-[8px] font-semibold" style={{ background: "var(--ink-100)", color: "var(--ink-600)" }}>
                        Taken by {o.assignedWaiter.name}
                      </span>
                    ) : (
                      !isServed && o.orderStatus !== "COMPLETED" && o.orderStatus !== "CANCELLED" && (
                        <button onClick={() => handleClaim(o.id)} disabled={busy === `claim-${o.id}`}
                          className="rounded-full px-2 py-0.5 text-[8px] font-bold disabled:opacity-50"
                          style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent-edge)" }}>
                          {busy === `claim-${o.id}` ? "Taking..." : "Take order"}
                        </button>
                      )
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full px-2 py-0.5 text-[8px] font-bold" style={{
                      background: isServed ? "var(--ink-100)" : isReady ? "var(--ok)" : o.orderStatus === "IN_KITCHEN" ? "var(--warn)" : "var(--ink-200)",
                      color: isServed ? "var(--ink-500)" : isReady ? "var(--ink-0)" : o.orderStatus === "IN_KITCHEN" ? "var(--ink-0)" : "var(--ink-600)",
                    }}>{o.orderStatus.replace(/_/g, " ")}</span>
                    <span className="font-mono text-[11px] font-bold" style={{ color: "var(--ink-700)" }}>${parseFloat(o.totalAmount).toFixed(2)}</span>
                  </div>
                </div>
                <div className="px-4">
                  {o.orderItems.map(oi => {
                    const isPending = oi.kitchenStatus === "PENDING";
                    const isCancelled = oi.kitchenStatus === "CANCELLED";
                    if (isCancelled) return null;
                    return (
                      <div key={oi.id} className="flex items-center gap-2 py-2" style={{ borderBottom: "1px solid var(--ink-100)" }}>
                        {/* Status indicator */}
                        <span className="rounded-full px-1.5 py-0.5 text-[7px] font-bold flex-shrink-0" style={{
                          background: oi.kitchenStatus === "READY" ? "var(--ok-soft)" : oi.kitchenStatus === "IN_PROGRESS" ? "var(--warn-soft)" : "var(--ink-100)",
                          color: oi.kitchenStatus === "READY" ? "var(--ok)" : oi.kitchenStatus === "IN_PROGRESS" ? "var(--warn)" : "var(--ink-500)",
                        }}>{oi.kitchenStatus === "READY" ? "✓" : oi.kitchenStatus === "IN_PROGRESS" ? "●" : "○"}</span>

                        {/* Quantity controls — editable only if PENDING */}
                        {isPending ? (
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button onClick={() => oi.quantity > 1 ? handleUpdateQty(oi.id, oi.quantity - 1) : handleCancelItem(oi.id)} disabled={busy === oi.id}
                              className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold disabled:opacity-30" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-600)" }}>&minus;</button>
                            <span className="w-5 text-center font-mono text-[10px] font-bold">{oi.quantity}</span>
                            <button onClick={() => handleUpdateQty(oi.id, oi.quantity + 1)} disabled={busy === oi.id}
                              className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold disabled:opacity-30" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-600)" }}>+</button>
                          </div>
                        ) : (
                          <span className="flex h-5 w-5 items-center justify-center rounded font-mono text-[9px] font-bold flex-shrink-0" style={{ background: "var(--ink-100)", color: "var(--ink-600)" }}>{oi.quantity}</span>
                        )}

                        {/* Item name */}
                        <span className="flex-1 text-[11px] font-medium" style={{ color: "var(--ink-900)" }}>{oi.menuItem?.name ?? "Item"}</span>

                        {/* Price */}
                        <span className="font-mono text-[11px] font-bold" style={{ color: "var(--ink-700)" }}>${parseFloat(oi.lineTotal).toFixed(2)}</span>

                        {/* Remove button — only for PENDING items */}
                        {isPending && (
                          <button onClick={() => handleCancelItem(oi.id)} disabled={busy === oi.id}
                            className="flex h-5 w-5 items-center justify-center rounded text-[9px] flex-shrink-0 disabled:opacity-30" style={{ color: "var(--bad)" }}>
                            &times;
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Show existing notes if any */}
                {o.specialInstructions && (
                  <div className="px-4 py-1.5" style={{ background: "var(--warn-soft)", borderTop: "1px solid #fde68a" }}>
                    <span className="font-mono text-[8px] font-bold uppercase tracking-widest" style={{ color: "var(--warn)" }}>Note: </span>
                    <span className="text-[9px] italic" style={{ color: "#78350f" }}>{o.specialInstructions}</span>
                  </div>
                )}
                {isReady && (
                  <div className="px-4 py-2" style={{ background: "var(--ok-soft)" }}>
                    <button onClick={() => handleServe(o.id)} disabled={busy === o.id}
                      className="w-full rounded-[var(--r-md)] py-2 text-[10px] font-semibold disabled:opacity-50"
                      style={{ background: "var(--ok)", color: "var(--ink-0)" }}>
                      {busy === o.id ? "..." : "Mark Course as Served"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Bill Summary */}
        <div className="hidden w-[240px] flex-shrink-0 flex-col lg:flex" style={{ borderLeft: "1px solid var(--ink-200)", background: "var(--ink-0)" }}>
          {/* Bill */}
          <div className="flex-1 overflow-auto px-3 py-3">
            <span className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Bill Summary</span>
            <div className="mt-2 space-y-1">
              {allItems.map(oi => (
                <div key={oi.id} className="flex items-center justify-between text-[10px]">
                  <span style={{ color: "var(--ink-700)" }}>{oi.quantity}&times; {oi.menuItem?.name}</span>
                  <span className="font-mono font-bold" style={{ color: "var(--ink-900)" }}>${parseFloat(oi.lineTotal).toFixed(2)}</span>
                </div>
              ))}
            </div>
            {allItems.length > 0 && (
              <div className="mt-3 space-y-1 pt-2" style={{ borderTop: "1px solid var(--ink-200)" }}>
                <div className="flex justify-between text-[10px]"><span style={{ color: "var(--ink-500)" }}>Subtotal</span><span className="font-mono" style={{ color: "var(--ink-700)" }}>${subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between text-[10px]"><span style={{ color: "var(--ink-500)" }}>Tax</span><span className="font-mono" style={{ color: "var(--ink-700)" }}>${tax.toFixed(2)}</span></div>
                <div className="flex justify-between text-[12px] font-bold pt-1.5" style={{ borderTop: "1px solid var(--ink-200)" }}>
                  <span style={{ color: "var(--ink-900)" }}>Total</span>
                  <span className="font-serif text-[16px]" style={{ color: "var(--accent)" }}>${total.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
          <div className="p-3 space-y-2" style={{ borderTop: "1px solid var(--ink-200)" }}>
            {session && total > 0 && (
              <Link href={`/waiter/checkout/${tableId}`}
                className="flex w-full items-center justify-center rounded-[var(--r-md)] py-2.5 text-[11px] font-semibold"
                style={{ background: "var(--accent)", color: "var(--ink-0)" }}>
                Start Payment &rarr;
              </Link>
            )}
            <button onClick={handleClear} disabled={busy === "clr"}
              className="w-full rounded-[var(--r-md)] py-2.5 text-[11px] font-semibold disabled:opacity-50"
              style={{ background: "var(--bad)", color: "var(--ink-0)" }}>
              Close Table
            </button>
          </div>
        </div>
      </div>

    </main>
  );
}
