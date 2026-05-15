"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { get, authPost } from "../../../lib/api";
import { getStaffToken, getStaffName, getStaffBranchId, getStaffRole, clearStaffToken } from "../../../lib/staff-auth";
import { useAdminBranch } from "../branch-context";
import { LoadingScreen, EmptyState, useToast } from "../../../components/ui";
import type { MenuCategory, Order } from "../../../lib/types";
import { usePathname, useRouter } from "next/navigation";
import { CashierNav } from "../../waiter/cashier-nav";
import { MenuCategoryIcon, menuCategoryMeta } from "../../../components/menu-category-icon";

interface PosCartItem { menuItemId: string; name: string; price: number; quantity: number; additions: Array<{ additionId: string; name: string; priceImpact: number }>; }

/* gradient placeholders for items without images */
const grads = [
  "linear-gradient(135deg, #c2410c, #7c2d12)", "linear-gradient(135deg, #15803d, #14532d)",
  "linear-gradient(135deg, #b45309, #78350f)", "linear-gradient(135deg, #0e7490, #164e63)",
  "linear-gradient(135deg, #9333ea, #581c87)", "linear-gradient(135deg, #dc2626, #7f1d1d)",
  "linear-gradient(135deg, #ca8a04, #713f12)", "linear-gradient(135deg, #0284c7, #0c4a6e)",
];
function grad(id: string) { let h = 0; for (const c of id) h = ((h << 5) - h + c.charCodeAt(0)) | 0; return grads[Math.abs(h) % grads.length]; }

/* SVG icons */
const sv = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const IcoCart = <svg {...sv}><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>;
const IcoCheck = <svg {...sv}><polyline points="20 6 9 17 4 12" /></svg>;
const IcoCash = <svg {...sv}><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>;
const IcoPlus = <svg {...sv}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;

export default function PosPage() {
  const [token, setToken] = useState<string | null>(null);
  const { branchId: adminBranchId } = useAdminBranch();
  const [staffBranchId, setStaffBranchIdLocal] = useState("");
  const branchId = adminBranchId || staffBranchId;
  const pathname = usePathname();
  const router = useRouter();
  const [staffName, setStaffNameLocal] = useState("");
  const [role, setRole] = useState("");
  const [tableCode, setTableCode] = useState("T1");
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [paymentDone, setPaymentDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [posFilters, setPosFilters] = useState<Record<string, boolean>>({});
  const [guestCount, setGuestCount] = useState(1);
  const [notes, setNotes] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const scope = pathname.startsWith("/waiter") ? "waiter" : "default";
    const t = getStaffToken(scope);
    const r = getStaffRole(scope) ?? "";
    if (!t) { router.push("/waiter/login"); return; }
    if (pathname.startsWith("/admin") && r !== "CASHIER") return;
    setToken(t);
    setStaffBranchIdLocal(getStaffBranchId(scope) ?? "");
    setStaffNameLocal(getStaffName(scope) ?? "");
    setRole(r);
  }, [pathname, router]);

  const { data: categories, isLoading } = useQuery({ queryKey: ["pos-menu", branchId], queryFn: () => get<MenuCategory[]>(`/api/menu?branchId=${branchId}`), enabled: !!branchId });

  function addToCart(item: { id: string; name: string; price: string }) {
    const existing = cart.find((c) => c.menuItemId === item.id);
    if (existing) setCart(cart.map((c) => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    else setCart([...cart, { menuItemId: item.id, name: item.name, price: parseFloat(item.price), quantity: 1, additions: [] }]);
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const allItems = categories?.flatMap(c => c.menuItems.filter(i => !i.isUnavailable)) ?? [];
  const activeCategory = activeCat ? categories?.find(c => c.id === activeCat) ?? null : null;
  const toggleFilter = (k: string) => setPosFilters(f => ({ ...f, [k]: !f[k] }));
  const activeFilterCount = Object.values(posFilters).filter(Boolean).length;

  const displayItems = (activeCategory?.menuItems.filter(i => !i.isUnavailable) ?? [])
    .filter(i => {
      if (posFilters.vegetarian && !i.isVegetarian) return false;
      if (posFilters.spicy && !i.isSpicy) return false;
      if (posFilters.quick && (i.prepTimeMinutes ?? 99) > 10) return false;
      if (posFilters.customizable && i.additions.length === 0) return false;
      return true;
    });

  async function handleCreateOrder() {
    if (!token || !branchId || cart.length === 0) return;
    setBusy(true); setError(null);
    try {
      const result = await authPost<Order>("/api/pos/orders", token, {
        branchId, tableCode, guestCount,
        items: cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity, additions: c.additions.map((a) => ({ additionId: a.additionId })) })),
        specialInstructions: notes || undefined,
        idempotencyKey: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      });
      setOrder(result); setCart([]); setNotes(""); setPayAmount(result.totalAmount);
      toast("Order created");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed"); toast("Order failed", "error"); }
    finally { setBusy(false); }
  }

  async function handlePayment() {
    if (!token || !order) return;
    setBusy(true); setError(null);
    try { await authPost(`/api/orders/${order.id}/payments`, token, { amount: parseFloat(payAmount), paymentMethod: payMethod }); setPaymentDone(true); toast("Payment recorded"); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Payment failed"); toast("Payment failed", "error"); }
    finally { setBusy(false); }
  }

  async function handleCreateAndPay() {
    if (!token || !branchId || cart.length === 0) return;
    setBusy(true); setError(null);
    try {
      const result = await authPost<Order>("/api/pos/orders", token, {
        branchId, tableCode, guestCount,
        items: cart.map((c) => ({ menuItemId: c.menuItemId, quantity: c.quantity, additions: c.additions.map((a) => ({ additionId: a.additionId })) })),
        specialInstructions: notes || undefined,
        idempotencyKey: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      });
      await authPost(`/api/orders/${result.id}/payments`, token, { amount: parseFloat(result.totalAmount), paymentMethod: payMethod });
      setOrder(result); setPaymentDone(true);
      setCart([]); setNotes("");
      toast("Order created & payment recorded");
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed"); toast("Failed", "error"); }
    finally { setBusy(false); }
  }

  function handleNewOrder() { setOrder(null); setPaymentDone(false); setCart([]); setError(null); setPayAmount(""); }

  function imageBg(url: string | null | undefined, id: string) {
    if (!url) return grad(id);
    const resolved = url.startsWith("/") ? `http://localhost:4000${url}` : url;
    return `url(${resolved}) center/cover`;
  }

  /* ── Payment confirmed ── */
  if (paymentDone && order) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-[var(--r-xl)] p-8 text-center" style={{ background: "var(--ok-soft)", border: "2px solid #bbf7d0" }}>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "var(--ok)", color: "#fff" }}>{IcoCheck}</div>
          <h2 className="mt-4 font-serif text-2xl font-bold" style={{ color: "var(--ink-900)" }}>Payment Recorded</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-500)" }}>Order <span className="font-mono font-bold">#{order.id.slice(-6).toUpperCase()}</span></p>
          <p className="font-serif text-3xl font-extrabold mt-1" style={{ color: "var(--ok)" }}>${parseFloat(order.totalAmount).toFixed(2)}</p>
          <p className="text-xs mt-1" style={{ color: "var(--ink-500)" }}>{payMethod} payment</p>
          <button onClick={handleNewOrder} className="mt-6 rounded-[var(--r-md)] px-8 py-3 text-sm font-semibold transition" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>New Order</button>
        </div>
      </div>
    );
  }

  /* ── Payment step ── */
  if (order) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <h2 className="font-serif text-2xl font-bold" style={{ color: "var(--ink-900)" }}>Record <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>payment</em></h2>
        <div className="mt-4 rounded-[var(--r-lg)] p-5 text-center" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <p className="font-mono text-[11px]" style={{ color: "var(--ink-500)" }}>Order #{order.id.slice(-6).toUpperCase()}</p>
          <p className="font-serif text-4xl font-extrabold mt-1" style={{ color: "var(--ink-900)" }}>${parseFloat(order.totalAmount).toFixed(2)}</p>
          <p className="font-mono text-[11px] mt-1" style={{ color: "var(--ink-500)" }}>Tax: ${parseFloat(order.taxAmount).toFixed(2)}</p>
        </div>
        <div className="mt-6 space-y-4">
          <div>
            <label className="font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>Amount</label>
            <div className="relative mt-1.5">
              <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-400)" }}>$</span>
              <input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                className="w-full rounded-[var(--r-md)] py-3.5 pl-8 pr-4 text-xl font-bold outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
            </div>
          </div>
          <div>
            <label className="font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>Method</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {["CASH", "CARD", "WALLET"].map((m) => (
                <button key={m} onClick={() => setPayMethod(m)}
                  className="rounded-[var(--r-md)] py-3.5 text-sm font-bold transition"
                  style={{ border: payMethod === m ? "2px solid var(--ink-900)" : "1px solid var(--ink-200)", background: payMethod === m ? "var(--ink-50)" : "var(--ink-0)", color: "var(--ink-900)" }}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
        {error && <div className="mt-4 rounded-[var(--r-md)] p-3 text-sm" style={{ background: "var(--bad-soft)", border: "1px solid #fecaca", color: "var(--bad)" }}>{error}</div>}
        <button onClick={handlePayment} disabled={busy}
          className="mt-6 w-full rounded-[var(--r-md)] py-4 text-sm font-semibold transition disabled:opacity-50"
          style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>
          {busy ? "Processing..." : `Record ${payMethod} Payment`}
        </button>
        <button onClick={handleNewOrder} className="mt-2 w-full py-2.5 text-sm" style={{ color: "var(--ink-500)" }}>Skip / New order</button>
      </div>
    );
  }

  /* ── POS: Menu Grid + Cart Sidebar ── */
  if (isLoading) return <LoadingScreen message="Loading menu..." />;
  if ((pathname.startsWith("/admin") && role !== "CASHIER") || (pathname.startsWith("/waiter") && token && role !== "CASHIER")) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="max-w-sm rounded-[var(--r-lg)] p-6" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <h1 className="font-serif text-[22px] font-extrabold" style={{ color: "var(--ink-900)" }}>Cashier access required</h1>
          <p className="mt-2 text-[12px]" style={{ color: "var(--ink-500)" }}>POS is available only to cashier staff from the waiter screen login.</p>
          <button onClick={() => { clearStaffToken(); router.push("/waiter/login"); }} className="mt-4 rounded-[var(--r-md)] px-4 py-2 text-[12px] font-semibold" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>Open Cashier Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" style={{ minHeight: "100%" }}>
      {pathname.startsWith("/waiter") && <CashierNav />}
      {/* Top header bar */}
      <div className="flex items-center justify-between px-6 py-2.5" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        <div>
          <h1 className="font-serif text-[18px] font-extrabold tracking-tight leading-none" style={{ color: "var(--ink-900)" }}>
            POS / <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Cashier</em>
          </h1>
          <p className="mt-0.5 text-[10px]" style={{ color: "var(--ink-500)" }}>Tap items quickly, build cart, create orders, and record payments.</p>
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <div className="flex items-center gap-2 rounded-[var(--r-md)] px-3 py-2" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>Table</span>
            <input value={tableCode} onChange={(e) => setTableCode(e.target.value)}
              className="w-14 bg-transparent font-mono text-sm font-bold outline-none" style={{ color: "var(--ink-900)" }} />
          </div>
          {staffName && <span className="font-mono text-[11px]" style={{ color: "var(--ink-400)" }}>{staffName}</span>}
        </div>
      </div>

      {/* Body: Menu + Cart */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Menu area ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Category-first navigation */}
          <div className="flex items-center gap-2 overflow-x-auto px-5 py-2" style={{ borderBottom: "1px solid var(--ink-200)", background: "var(--ink-0)" }}>
            {activeCategory ? (
              <>
                <button onClick={() => { setActiveCat(null); setPosFilters({}); }}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-[var(--r-md)] px-3 py-1.5 text-[11px] font-semibold transition"
                  style={{ background: "var(--ink-0)", color: "var(--ink-700)", border: "1px solid var(--ink-200)" }}>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                  Categories
                </button>
                <div className="min-w-0">
                  <div className="font-serif text-[16px] font-bold leading-none" style={{ color: "var(--ink-900)" }}>{activeCategory.name}</div>
                  <div className="mt-0.5 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>{activeCategory.menuItems.filter(i => !i.isUnavailable).length} available items</div>
                </div>
              </>
            ) : (
              <div>
                <div className="font-serif text-[16px] font-bold leading-none" style={{ color: "var(--ink-900)" }}>Choose a category</div>
                <div className="mt-0.5 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>{categories?.length ?? 0} database categories / {allItems.length} available items</div>
              </div>
            )}
          </div>

          {/* Filters */}
          {activeCategory && <div className="flex items-center gap-1.5 overflow-x-auto px-5 py-1.5" style={{ background: "var(--ink-50)", borderBottom: "1px solid var(--ink-200)" }}>
            <span className="flex-shrink-0 font-mono text-[8px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Filter</span>
            {([
              { key: "vegetarian", label: "Vegetarian", icon: <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M12 22c4-4 8-8 8-14a2 2 0 0 0-2-2c-3 0-5 1-6 4-1-3-3-4-6-4a2 2 0 0 0-2 2c0 6 4 10 8 14z" /></svg> },
              { key: "spicy", label: "Spicy", icon: <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M12 2c1 3 4 6 4 10a6 6 0 0 1-12 0c0-4 3-7 4-10" /><path d="M12 12a2 2 0 0 0-2 2" /></svg> },
              { key: "quick", label: "Quick (<10m)", icon: <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> },
              { key: "customizable", label: "Has add-ons", icon: <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg> },
            ]).map(({ key, label, icon }) => {
              const on = !!posFilters[key];
              return (
                <button key={key} onClick={() => toggleFilter(key)}
                  className="flex items-center gap-1 whitespace-nowrap rounded-[var(--r-sm)] px-2 py-1 text-[10px] font-medium transition"
                  style={{
                    background: on ? "var(--accent-soft)" : "var(--ink-0)",
                    color: on ? "var(--accent-ink)" : "var(--ink-600)",
                    border: `1px solid ${on ? "var(--accent-edge)" : "var(--ink-200)"}`,
                  }}>
                  <span style={{ color: on ? "var(--accent)" : "var(--ink-400)" }}>{icon}</span>
                  {label}
                </button>
              );
            })}
            {activeFilterCount > 0 && (
              <button onClick={() => setPosFilters({})} className="flex-shrink-0 font-mono text-[9px] underline underline-offset-2" style={{ color: "var(--ink-500)" }}>
                Clear
              </button>
            )}
          </div>}

          {/* Category or item grid */}
          <div className="flex-1 overflow-auto p-5" style={{ background: "var(--ink-50)" }}>
            {!activeCategory ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {(categories ?? []).map((category) => {
                  const available = category.menuItems.filter(i => !i.isUnavailable);
                  const meta = menuCategoryMeta(category.name);
                  return (
                    <button key={category.id} onClick={() => setActiveCat(category.id)}
                      className="group overflow-hidden rounded-[var(--r-lg)] text-left transition active:scale-[0.98]"
                      style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
                      <div className="relative flex h-28 flex-col justify-between p-3" style={{ background: meta.bg, color: meta.color }}>
                        <div className="flex items-start justify-between gap-2">
                          <span className="flex h-11 w-11 items-center justify-center rounded-[var(--r-md)]" style={{ background: "rgba(255,255,255,0.62)", border: "1px solid rgba(15,23,42,0.08)" }}>
                            <MenuCategoryIcon name={category.name} size={25} />
                          </span>
                          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition group-hover:scale-110" style={{ background: "var(--ink-0)", color: meta.color }}>
                            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                          </span>
                        </div>
                        <div className="flex w-full items-end justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-[15px] font-bold" style={{ color: "var(--ink-900)" }}>{category.name}</div>
                            <div className="mt-0.5 font-mono text-[9px] uppercase tracking-widest" style={{ color: meta.color }}>{available.length} items</div>
                          </div>
                        </div>
                      </div>
                      <div className="px-3 py-2">
                        <p className="truncate text-[11px]" style={{ color: "var(--ink-500)" }}>{available.slice(0, 3).map(i => i.name).join(", ") || "No available items"}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                  {displayItems.map((item) => {
                    const inCart = cart.find(c => c.menuItemId === item.id);
                    return (
                      <button key={item.id} onClick={() => addToCart(item)}
                        className="group relative overflow-hidden rounded-[var(--r-lg)] text-left transition active:scale-[0.97]"
                        style={{ background: "var(--ink-0)", border: `1px solid ${inCart ? "var(--accent)" : "var(--ink-200)"}` }}>
                        <div className="relative flex h-24 w-full items-end overflow-hidden p-2"
                          style={{ background: imageBg(item.imageUrl, item.id) }}>
                          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.4), transparent)" }} />
                          <div className="relative ml-auto flex h-6 w-6 items-center justify-center rounded-full transition group-hover:scale-110" style={{ background: "var(--ink-0)", color: "var(--accent)" }}>
                            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                          </div>
                          {inCart && (
                            <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full font-mono text-[9px] font-bold" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>{inCart.quantity}</span>
                          )}
                        </div>
                        <div className="p-2.5 pb-3">
                          <p className="text-[12px] font-semibold truncate" style={{ color: "var(--ink-900)" }}>{item.name}</p>
                          <p className="mt-0.5 font-serif text-[15px] font-bold" style={{ color: "var(--accent)" }}>${parseFloat(item.price).toFixed(2)}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {displayItems.length === 0 && <EmptyState icon="&#x1F37D;&#xFE0F;" title="No menu items" description="No available items in this category." />}
              </>
            )}
            {!activeCategory && (categories ?? []).length === 0 && <EmptyState icon="&#x1F37D;&#xFE0F;" title="No categories" description="Add menu categories in Menu management." />}

            {/* Item count footer */}
            <p className="mt-4 text-center font-mono text-[10px]" style={{ color: "var(--ink-400)" }}>
              {activeCategory ? `Showing ${displayItems.length} of ${activeCategory.menuItems.filter(i => !i.isUnavailable).length} items in ${activeCategory.name}` : "Select a category to show its items"}
            </p>
          </div>
        </div>

        {/* ── Cart sidebar ── */}
        <div className="hidden w-[320px] flex-shrink-0 flex-col md:flex" style={{ background: "var(--ink-0)", borderLeft: "1px solid var(--ink-200)" }}>
          <div className="flex-1 overflow-auto">

            {/* Staff info */}
            <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: "1px solid var(--ink-200)" }}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full font-serif text-sm font-bold" style={{ background: "linear-gradient(135deg, var(--accent), #9a3412)", color: "var(--ink-0)" }}>{staffName.charAt(0) || "S"}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold truncate" style={{ color: "var(--ink-900)" }}>{staffName || "Staff"}</div>
                <div className="font-mono text-[10px]" style={{ color: "var(--ink-500)" }}>POS Terminal</div>
              </div>
              <span className="flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] font-medium" style={{ background: "var(--ok-soft)", color: "var(--ok)", border: "1px solid #bbf7d0" }}>
                <span className="h-1 w-1 rounded-full" style={{ background: "var(--ok)" }} />Online
              </span>
            </div>

            {/* Table + Guests row — both values saved to DB via CreatePosOrderDto */}
            <div className="flex items-center gap-4 px-5 py-4" style={{ borderBottom: "1px solid var(--ink-200)" }}>
              <div className="flex-1">
                <div className="font-mono text-[9px] font-medium uppercase tracking-widest mb-1.5" style={{ color: "var(--ink-500)" }}>Table</div>
                <select value={tableCode} onChange={(e) => setTableCode(e.target.value)}
                  className="w-full rounded-[var(--r-md)] px-3 py-2 text-[13px] font-semibold outline-none"
                  style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)", background: "var(--ink-0)" }}>
                  {["T1", "T2", "T3", "T4", "T5"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <div className="font-mono text-[9px] font-medium uppercase tracking-widest mb-1.5" style={{ color: "var(--ink-500)" }}>Guests</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                    className="flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] text-sm font-bold" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-600)" }}>&minus;</button>
                  <span className="w-6 text-center font-serif text-[15px] font-bold" style={{ color: "var(--ink-900)" }}>{guestCount}</span>
                  <button onClick={() => setGuestCount(guestCount + 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] text-sm font-bold" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-600)" }}>+</button>
                </div>
              </div>
            </div>

            {/* Cart header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>Cart <span style={{ color: "var(--ink-400)" }}>({cartCount} items)</span></div>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="flex items-center gap-1 text-[11px] font-medium" style={{ color: "var(--bad)" }}>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                  Clear Cart
                </button>
              )}
            </div>

            {/* Cart items */}
            <div className="px-4 pb-3 space-y-1">
              {cart.length === 0 && (
                <div className="flex flex-col items-center py-8 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--ink-100)", color: "var(--ink-400)" }}>{IcoCart}</div>
                  <p className="mt-2 text-[11px]" style={{ color: "var(--ink-400)" }}>Tap menu items to add</p>
                </div>
              )}
              {cart.map((item) => (
                <div key={item.menuItemId} className="flex items-center gap-2.5 py-2.5" style={{ borderBottom: "1px solid var(--ink-100)" }}>
                  <div className="h-10 w-10 flex-shrink-0 rounded-[var(--r-md)] overflow-hidden" style={{ background: grad(item.menuItemId) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold truncate" style={{ color: "var(--ink-900)" }}>{item.name}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCart(cart.map((c) => c.menuItemId === item.menuItemId ? { ...c, quantity: Math.max(0, c.quantity - 1) } : c).filter((c) => c.quantity > 0))}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-600)" }}>&minus;</button>
                    <span className="w-5 text-center font-mono text-[12px] font-bold">{item.quantity}</span>
                    <button onClick={() => setCart(cart.map((c) => c.menuItemId === item.menuItemId ? { ...c, quantity: c.quantity + 1 } : c))}
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-600)" }}>+</button>
                  </div>
                  <span className="w-14 text-right font-mono text-[12px] font-bold" style={{ color: "var(--ink-900)" }}>${(item.price * item.quantity).toFixed(2)}</span>
                  <button onClick={() => setCart(cart.filter((c) => c.menuItemId !== item.menuItemId))}
                    className="flex h-5 w-5 items-center justify-center text-[11px]" style={{ color: "var(--ink-400)" }}>&times;</button>
                </div>
              ))}
            </div>

            {/* Notes — saved to Order.specialInstructions via CreatePosOrderDto */}
            <div className="px-5 pb-4">
              <input value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Add a note or special instructions..."
                className="w-full rounded-[var(--r-md)] px-3 py-2.5 text-[11px] outline-none"
                style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
            </div>
          </div>

          {/* ── Bottom: Totals + Actions ── */}
          <div className="px-5 py-4" style={{ borderTop: "1px solid var(--ink-200)" }}>
            {/* Totals */}
            <div className="space-y-1.5 mb-4">
              <div className="flex justify-between text-[12px]"><span style={{ color: "var(--ink-500)" }}>Subtotal</span><span className="font-mono font-semibold" style={{ color: "var(--ink-900)" }}>${subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-[12px]"><span style={{ color: "var(--ink-500)" }}>Tax</span><span className="font-mono" style={{ color: "var(--ink-400)" }}>calculated at checkout</span></div>
              <div className="flex justify-between items-baseline pt-2.5 mt-1" style={{ borderTop: "1px solid var(--ink-200)" }}>
                <span className="text-[14px] font-bold" style={{ color: "var(--ink-900)" }}>Total</span>
                <span className="font-serif text-[20px] font-extrabold" style={{ color: "var(--accent)" }}>${subtotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment method — maps to PaymentMethod enum: CASH, CARD, WALLET */}
            <div className="mb-4">
              <div className="font-mono text-[9px] font-medium uppercase tracking-widest mb-2" style={{ color: "var(--ink-500)" }}>Payment Method</div>
              <div className="grid grid-cols-3 gap-1.5">
                {(["CASH", "CARD", "WALLET"] as const).map((m) => {
                  const icons: Record<string, React.ReactNode> = {
                    CASH: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><rect x="1" y="6" width="22" height="12" rx="2" /><circle cx="12" cy="12" r="3" /></svg>,
                    CARD: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>,
                    WALLET: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2" /><path d="M1 10h22" /><circle cx="18" cy="15" r="1" /></svg>,
                  };
                  return (
                    <button key={m} onClick={() => setPayMethod(m)}
                      className="flex flex-col items-center gap-1 rounded-[var(--r-md)] py-2.5 transition"
                      style={{
                        background: payMethod === m ? "var(--accent)" : "var(--ink-0)",
                        color: payMethod === m ? "var(--ink-0)" : "var(--ink-600)",
                        border: `1px solid ${payMethod === m ? "var(--accent)" : "var(--ink-200)"}`,
                      }}>
                      {icons[m]}
                      <span className="font-mono text-[8px] font-medium uppercase tracking-wider">{m}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && <p className="mb-2 text-[11px]" style={{ color: "var(--bad)" }}>{error}</p>}

            {/* Action buttons */}
            <div className="space-y-2">
              <button onClick={handleCreateAndPay} disabled={busy || cart.length === 0}
                className="w-full rounded-[var(--r-md)] py-3 text-[12px] font-semibold transition disabled:opacity-40"
                style={{ background: "var(--accent)", color: "var(--ink-0)" }}>
                {busy ? "Processing..." : "Create Order & Record Payment"}
              </button>
              <button onClick={handleCreateOrder} disabled={busy || cart.length === 0}
                className="w-full rounded-[var(--r-md)] py-3 text-[12px] font-semibold transition disabled:opacity-40"
                style={{ background: "var(--ink-0)", color: "var(--ink-900)", border: "1px solid var(--ink-200)" }}>
                Create Order (No Payment)
              </button>
            </div>

            {/* Clear cart */}
            {cart.length > 0 && (
              <button onClick={() => { setCart([]); setNotes(""); }} className="mt-3 flex w-full items-center justify-center gap-1 text-[10px] font-medium" style={{ color: "var(--ink-500)" }}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                Clear Cart
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
