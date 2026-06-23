"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { get, post, getApiErrorMessage } from "../../../../../lib/api";
import { useCart, cartSubtotal } from "../../../../../lib/cart-store";
import { RecommendedForYou } from "../../../../../components/recommendations/RecommendedForYou";
import { EmptyState, Cloche, InlineAlert } from "../../../../../components/ui";
import { resolveAssetUrl } from "../../../../../lib/media";
import type { Order, MenuCategory } from "../../../../../lib/types";

/* Burnished copper for the customer ordering screens. */
const COPPER = "#0c0a09";
const COPPER_SOFT = "#f5f5f4";
const COPPER_EDGE = "#e7e5e4";
const COPPER_INK = "#1c1917";

/* Cart preview rates — display only.
   Actual amounts are computed by the backend on order submission. These rates
   match the screenshots' standard service charge + VAT to give the customer a
   reasonable estimate before sending the order to the kitchen. */
const SERVICE_FEE_RATE = 0.03;
const VAT_RATE = 0.16;

const photoGradients = [
  "linear-gradient(135deg, #c2841d, #6b4014)",
  "linear-gradient(135deg, #b85c2c, #5a2e16)",
  "linear-gradient(135deg, #166534, #052e16)",
  "linear-gradient(135deg, #9a3412, #431407)",
  "linear-gradient(135deg, #713f12, #422006)",
];
function photoGrad(id: string) { let h = 0; for (const c of id) h = ((h << 5) - h + c.charCodeAt(0)) | 0; return photoGradients[Math.abs(h) % photoGradients.length]; }
function imgUrl(url: string | null | undefined) { return resolveAssetUrl(url); }

/* ── Top bar ──────────────────────────────────────── */
function TopBar({ cartCount, onBack }: { cartCount: number; onBack: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 pt-4">
      <button onClick={onBack} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-[12px]" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", boxShadow: "0 1px 2px rgba(12,10,9,0.04)" }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--ink-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      </button>
      <div className="flex flex-col items-center">
        <Cloche size={28} color={COPPER} />
        <div className="mt-1 font-serif text-[14px] font-semibold tracking-[0.22em]" style={{ color: "var(--ink-900)" }}>TASTE HOUSE</div>
        <div className="mt-0.5 font-serif text-[8px] font-medium tracking-[0.3em]" style={{ color: COPPER }}>CAFÉ &middot; KITCHEN</div>
      </div>
      <div className="relative flex h-10 w-10 items-center justify-center rounded-[12px]" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", boxShadow: "0 1px 2px rgba(12,10,9,0.04)" }}>
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={COPPER} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        {cartCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: COPPER }}>{cartCount}</span>
        )}
      </div>
    </div>
  );
}

/* ── Info pill ─────────────────────────────────────── */
function Pill({ icon, primary, label }: { icon: React.ReactNode; primary: string; label?: string }) {
  return (
    <div className="flex flex-1 items-center gap-2.5 rounded-[12px] px-2.5 py-2.5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ background: COPPER_SOFT, color: COPPER }}>{icon}</span>
      <div className="min-w-0 flex-1">
        {label && <div className="text-[9px] leading-none" style={{ color: "var(--ink-500)" }}>{label}</div>}
        <div className={`${label ? "mt-0.5" : ""} text-[12px] font-semibold leading-tight truncate`} style={{ color: "var(--ink-900)" }}>{primary}</div>
      </div>
    </div>
  );
}

/* ── Receipt-style row with dotted leader ─────────── */
function LineRow({ label, value, bold = false, subtle = false }: { label: string; value: string; bold?: boolean; subtle?: boolean }) {
  const labelColor = bold ? "var(--ink-900)" : subtle ? "var(--ink-500)" : "var(--ink-600)";
  const valueColor = bold ? "var(--ink-900)" : subtle ? "var(--ink-500)" : "var(--ink-700)";
  return (
    <div className="flex items-baseline gap-2">
      <span className={`text-[12px] ${bold ? "font-bold" : ""}`} style={{ color: labelColor }}>{label}</span>
      <div className="flex-1" style={{ borderTop: "1.5px dotted var(--ink-300)", marginBottom: 4 }} />
      <span className={`text-[12px] font-semibold ${bold ? "font-bold" : ""}`} style={{ color: valueColor }}>
        {value} <span className="text-[9px] font-normal" style={{ color: "var(--ink-500)" }}>JOD</span>
      </span>
    </div>
  );
}

/* ── Decorative clipboard + leaf SVG ──────────────── */
function ClipboardLeaf() {
  return (
    <svg width={64} height={64} viewBox="0 0 80 80" fill="none" aria-hidden>
      {/* clipboard */}
      <rect x="20" y="14" width="44" height="58" rx="4" fill={COPPER_SOFT} stroke={COPPER} strokeWidth={1.6} />
      <rect x="30" y="10" width="22" height="9" rx="2" fill={COPPER} stroke={COPPER} strokeWidth={1.4} />
      {/* lines */}
      <line x1="28" y1="34" x2="50" y2="34" stroke={COPPER} strokeWidth={1.4} strokeLinecap="round" />
      <line x1="28" y1="42" x2="56" y2="42" stroke={COPPER} strokeWidth={1.4} strokeLinecap="round" />
      <line x1="28" y1="50" x2="46" y2="50" stroke={COPPER} strokeWidth={1.4} strokeLinecap="round" />
      <line x1="28" y1="58" x2="52" y2="58" stroke={COPPER} strokeWidth={1.4} strokeLinecap="round" />
      {/* leaf sprig */}
      <path d="M58 60 Q66 56 72 48" stroke="#22c55e" strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <ellipse cx="63" cy="58" rx="3.5" ry="1.8" transform="rotate(-25 63 58)" fill="#22c55e" opacity="0.9" />
      <ellipse cx="68" cy="53" rx="4" ry="2" transform="rotate(-30 68 53)" fill="#22c55e" opacity="0.75" />
      <ellipse cx="71" cy="48" rx="3.5" ry="1.8" transform="rotate(-40 71 48)" fill="#22c55e" opacity="0.6" />
    </svg>
  );
}

export default function CartPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { state, dispatch } = useCart();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [specialRequest, setSpecialRequest] = useState("");
  const [requestExpanded, setRequestExpanded] = useState(true);
  const subtotal = cartSubtotal(state.items);
  const branchId = state.branchId ?? "seed-branch-1";

  const { data: categories } = useQuery({
    queryKey: ["menu", branchId],
    queryFn: () => get<MenuCategory[]>(`/api/menu?branchId=${branchId}`),
    enabled: state.items.length > 0,
  });

  const menuItemMap = useMemo(() => {
    const m = new Map<string, { imageUrl: string | null; prepTimeMinutes: number | null }>();
    categories?.forEach(c => c.menuItems.forEach(mi => m.set(mi.id, { imageUrl: mi.imageUrl, prepTimeMinutes: mi.prepTimeMinutes })));
    return m;
  }, [categories]);

  const allMenuItems = useMemo(
    () => categories?.flatMap(c => c.menuItems) ?? [],
    [categories],
  );

  const prepRange = useMemo(() => {
    const max = state.items.reduce((m, i) => {
      const t = menuItemMap.get(i.menuItemId)?.prepTimeMinutes;
      return t && t > m ? t : m;
    }, 0);
    if (max === 0) return "15–20 min";
    return `${max}–${max + 5} min`;
  }, [state.items, menuItemMap]);

  // Preview math — actual amounts computed by backend on submission
  const serviceFee = subtotal * SERVICE_FEE_RATE;
  const vat = subtotal * VAT_RATE;
  const total = subtotal + serviceFee + vat;

  function getIdempotencyKey(): string {
    const storageKey = `pending-order-${sessionId}`;
    const existing = typeof window !== "undefined" ? sessionStorage.getItem(storageKey) : null;
    if (existing) return existing;
    const key = `order-${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (typeof window !== "undefined") sessionStorage.setItem(storageKey, key);
    return key;
  }
  function clearPendingKey() { if (typeof window !== "undefined") sessionStorage.removeItem(`pending-order-${sessionId}`); }

  async function handleSubmit() {
    if (state.items.length === 0 || submitting) return;
    setSubmitting(true); setError(null);
    const idempotencyKey = getIdempotencyKey();
    try {
      const order = await post<Order>(`/api/sessions/${sessionId}/orders`, {
        items: state.items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity, additions: i.additions.map(a => ({ additionId: a.additionId })) })),
        specialInstructions: specialRequest.trim() || undefined,
        idempotencyKey,
      });
      clearPendingKey();
      dispatch({ type: "CLEAR" });
      router.push(`/customer/session/${sessionId}/orders/${order.id}`);
    } catch (e) {
      clearPendingKey();
      setError(getApiErrorMessage(e, "Failed to send order. Please review the cart and retry."));
    } finally { setSubmitting(false); }
  }

  if (state.items.length === 0) {
    return (
      <main className="flex min-h-screen flex-col" style={{ background: "var(--ink-50)" }}>
        <div className="px-4 pt-4">
          <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-[12px]" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--ink-700)" strokeWidth={2} strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center px-5">
          <EmptyState icon="○" title="Your cart is empty" description="Add items from the menu to get started."
            action={<button onClick={() => router.push(`/customer/session/${sessionId}/menu`)} className="rounded-[12px] px-5 py-3 text-[13px] font-semibold text-white" style={{ background: COPPER }}>Browse Menu</button>} />
        </div>
      </main>
    );
  }

  const cartCount = state.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <main className="flex min-h-screen flex-col" style={{ background: "var(--ink-50)" }}>
      <div className="mx-auto w-full max-w-md flex-1 flex flex-col">
        <TopBar cartCount={cartCount} onBack={() => router.back()} />

        {/* Info pills */}
        <div className="mt-4 flex gap-2 px-4">
          <Pill
            icon={<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-6 9 6v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></svg>}
            primary={state.branchName ?? "Branch"}
          />
          <Pill
            icon={<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M5 7v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V7" /><path d="M5 7h14" /><line x1="8" y1="20" x2="8" y2="16" /><line x1="16" y1="20" x2="16" y2="16" /></svg>}
            label="Table"
            primary={state.tableCode ?? "—"}
          />
          <Pill
            icon={<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
            primary={`${state.guestCount ?? 1} Guest${(state.guestCount ?? 1) === 1 ? "" : "s"}`}
          />
        </div>

        {/* Heading */}
        <div className="mt-5 px-4 text-center">
          <h1 className="font-serif text-[30px] font-extrabold leading-tight" style={{ color: "var(--ink-900)" }}>Your Cart</h1>
          <p className="mt-1.5 text-[12px] leading-snug" style={{ color: "var(--ink-500)" }}>Review your items before sending<br />the order to the kitchen.</p>
        </div>

        {/* Items */}
        <div className="mt-4 flex-1 px-4 pb-44">
          <div className="space-y-3">
            {state.items.map((item, idx) => {
              const photo = imgUrl(menuItemMap.get(item.menuItemId)?.imageUrl);
              const addTotal = item.additions.reduce((s, a) => s + a.priceImpact, 0);
              const lineUnit = item.price + addTotal;
              return (
                <div key={`${item.menuItemId}-${idx}`} className="flex gap-3 rounded-[14px] p-2.5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
                  <div className="h-[76px] w-[76px] flex-shrink-0 rounded-[10px]" style={{ background: photo ? `url(${photo}) center/cover` : photoGrad(item.menuItemId) }} />
                  <div className="flex flex-1 flex-col min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-[14px] font-semibold leading-tight" style={{ color: "var(--ink-900)" }}>{item.name}</h4>
                      <button onClick={() => dispatch({ type: "REMOVE_ITEM", menuItemId: item.menuItemId })} aria-label="Remove" className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[8px]" style={{ color: "var(--ink-400)", background: "var(--ink-50)" }}>
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                      </button>
                    </div>
                    {item.additions.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.additions.map(a => (
                          <span key={a.additionId} className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: COPPER_SOFT, color: COPPER_INK, border: `1px solid ${COPPER_EDGE}` }}>{a.name}</span>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-0.5 text-[11px]" style={{ color: "var(--ink-400)" }}>No customizations</div>
                    )}
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="font-semibold text-[14px]" style={{ color: "var(--ink-900)" }}>{lineUnit.toFixed(2)} <span className="text-[10px] font-normal" style={{ color: "var(--ink-500)" }}>JOD</span></span>
                      <div className="inline-flex items-center gap-2.5 rounded-[10px] px-2.5 py-1" style={{ border: "1px solid var(--ink-200)" }}>
                        <button onClick={() => dispatch({ type: "UPDATE_QTY", menuItemId: item.menuItemId, quantity: item.quantity - 1 })} aria-label="decrease" className="text-[14px] font-semibold" style={{ color: "var(--ink-700)" }}>−</button>
                        <span className="font-semibold text-[12px] w-4 text-center">{item.quantity}</span>
                        <button onClick={() => dispatch({ type: "UPDATE_QTY", menuItemId: item.menuItemId, quantity: item.quantity + 1 })} aria-label="increase" className="text-[14px] font-semibold" style={{ color: "var(--ink-700)" }}>+</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <RecommendedForYou
            branchId={branchId}
            sessionId={sessionId}
            cartItems={state.items}
            menuItems={allMenuItems}
            onAddToCart={(item) => dispatch({ type: "ADD_ITEM", item })}
            mode="list"
            title="Popular with this order"
          />

          {/* Special Request */}
          <div className="mt-4 rounded-[14px] p-3.5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: COPPER_SOFT, color: COPPER }}>
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>Special Request</div>
                <div className="text-[11px] mt-0.5 leading-snug" style={{ color: "var(--ink-500)" }}>Add a note or special instructions for the kitchen</div>
              </div>
            </div>
            <div className="mt-3 flex items-center rounded-[10px] px-3 py-2.5" style={{ background: COPPER_SOFT, border: `1px solid ${COPPER_EDGE}` }}>
              <input
                type="text"
                value={specialRequest}
                onChange={e => setSpecialRequest(e.target.value)}
                onFocus={() => setRequestExpanded(true)}
                placeholder="Please make the pasta mild spicy. Thank you!"
                className="flex-1 bg-transparent text-[12px] outline-none placeholder:opacity-70"
                style={{ color: COPPER_INK }}
                maxLength={200}
              />
              <button type="button" onClick={() => setRequestExpanded(!requestExpanded)} aria-label="Toggle request" style={{ color: COPPER }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          </div>

          {/* Totals card */}
          <div className="mt-4 flex items-stretch gap-3 rounded-[14px] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <div className="flex-1 space-y-2.5">
              <LineRow label="Subtotal" value={subtotal.toFixed(2)} subtle />
              <LineRow label="Service Fee (3%)" value={serviceFee.toFixed(2)} subtle />
              <LineRow label="VAT (16%)" value={vat.toFixed(2)} subtle />
              <div className="pt-2.5" style={{ borderTop: "1px solid var(--ink-200)" }}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[16px] font-bold" style={{ color: "var(--ink-900)" }}>Total</span>
                  <span className="font-bold text-[18px]" style={{ color: "var(--ink-900)" }}>{total.toFixed(2)} <span className="text-[10px] font-normal" style={{ color: "var(--ink-500)" }}>JOD</span></span>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 self-start"><ClipboardLeaf /></div>
          </div>

          {/* Estimated prep time chip */}
          <div className="mt-3.5 flex items-center justify-center gap-2 rounded-[10px] py-3" style={{ background: COPPER_SOFT, border: `1px solid ${COPPER_EDGE}` }}>
            <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: COPPER_EDGE, color: COPPER_INK }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </span>
            <span className="text-[12px]" style={{ color: COPPER_INK }}>Estimated prep time:</span>
            <span className="text-[12px] font-bold" style={{ color: COPPER }}>{prepRange}</span>
          </div>

          {error && (
            <InlineAlert tone="error" title="Order not sent" className="mt-3">
              {error}
            </InlineAlert>
          )}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="mx-auto max-w-md px-3 pb-4 pt-3" style={{ background: "linear-gradient(to top, var(--ink-50) 75%, transparent 100%)" }}>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex w-full items-center justify-center gap-3 rounded-[14px] py-4 text-[14px] font-semibold text-white transition disabled:opacity-50 active:scale-[0.98]"
            style={{ background: COPPER, boxShadow: "0 12px 28px -8px rgba(194,132,29,0.55)" }}>
            {submitting ? (
              "Sending..."
            ) : (
              <>
                <Cloche size={18} color="#fff" />
                Send to Kitchen
              </>
            )}
          </button>
          <button onClick={() => router.push(`/customer/session/${sessionId}/menu`)}
            className="mt-2 w-full text-center text-[12px] font-semibold underline underline-offset-[3px]" style={{ color: COPPER }}>
            Continue Browsing
          </button>
        </div>
      </div>
    </main>
  );
}
