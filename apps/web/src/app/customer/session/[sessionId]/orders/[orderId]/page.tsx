"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { get, post, getApiErrorMessage } from "../../../../../../lib/api";
import { useCart } from "../../../../../../lib/cart-store";
import { LoadingScreen, Cloche, InlineAlert } from "../../../../../../components/ui";
import { OrderReviewForm } from "../../../../../../components/customer/OrderReviewForm";
import type { Order, Review, Recommendation, MenuCategory, SessionBill } from "../../../../../../lib/types";

/* Burnished copper — matches the customer ordering screens. */
const COPPER = "#c2841d";
const COPPER_SOFT = "#fdf2e2";
const COPPER_EDGE = "#f1d9a8";
const COPPER_INK = "#7c5511";

const photoGradients = [
  "linear-gradient(135deg, #c2841d, #6b4014)",
  "linear-gradient(135deg, #b85c2c, #5a2e16)",
  "linear-gradient(135deg, #166534, #052e16)",
  "linear-gradient(135deg, #9a3412, #431407)",
  "linear-gradient(135deg, #713f12, #422006)",
];
function photoGrad(id: string) { let h = 0; for (const c of id) h = ((h << 5) - h + c.charCodeAt(0)) | 0; return photoGradients[Math.abs(h) % photoGradients.length]; }
function imgUrl(url: string | null | undefined) { if (!url) return null; return url.startsWith("/") ? `http://localhost:4000${url}` : url; }

/* ── Top bar ──────────────────────────────────────── */
function TopBar({ cartCount, onBack, onCart }: { cartCount: number; onBack: () => void; onCart: () => void }) {
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
      <button onClick={onCart} aria-label="View cart" className="relative flex h-10 w-10 items-center justify-center rounded-[12px]" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", boxShadow: "0 1px 2px rgba(12,10,9,0.04)" }}>
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={COPPER} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        {cartCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: COPPER }}>{cartCount}</span>
        )}
      </button>
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
function LineRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  const labelColor = bold ? "var(--ink-900)" : "var(--ink-500)";
  const valueColor = bold ? "var(--ink-900)" : "var(--ink-700)";
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
      <rect x="20" y="14" width="44" height="58" rx="4" fill={COPPER_SOFT} stroke={COPPER} strokeWidth={1.6} />
      <rect x="30" y="10" width="22" height="9" rx="2" fill={COPPER} stroke={COPPER} strokeWidth={1.4} />
      <line x1="28" y1="34" x2="50" y2="34" stroke={COPPER} strokeWidth={1.4} strokeLinecap="round" />
      <line x1="28" y1="42" x2="56" y2="42" stroke={COPPER} strokeWidth={1.4} strokeLinecap="round" />
      <line x1="28" y1="50" x2="46" y2="50" stroke={COPPER} strokeWidth={1.4} strokeLinecap="round" />
      <line x1="28" y1="58" x2="52" y2="58" stroke={COPPER} strokeWidth={1.4} strokeLinecap="round" />
      <path d="M58 60 Q66 56 72 48" stroke="#22c55e" strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <ellipse cx="63" cy="58" rx="3.5" ry="1.8" transform="rotate(-25 63 58)" fill="#22c55e" opacity="0.9" />
      <ellipse cx="68" cy="53" rx="4" ry="2" transform="rotate(-30 68 53)" fill="#22c55e" opacity="0.75" />
      <ellipse cx="71" cy="48" rx="3.5" ry="1.8" transform="rotate(-40 71 48)" fill="#22c55e" opacity="0.6" />
    </svg>
  );
}

/* ── Order stepper ─────────────────────────────────── */
function OrderStepper({ activeIndex }: { activeIndex: number }) {
  const steps = [
    { label: "Sent", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg> },
    { label: "Accepted", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="3" width="12" height="18" rx="2" /><polyline points="9 12 11 14 15 10" /></svg> },
    { label: "Preparing", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V18H6Z" /><line x1="6" y1="22" x2="18" y2="22" /></svg> },
    { label: "Served", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M3 14h18M5 14a7 7 0 0 1 14 0M12 7v3M2 19h20" /></svg> },
  ];

  return (
    <div className="flex items-start">
      {steps.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        const future = i > activeIndex;
        const circleBg = active ? COPPER : future ? "var(--ink-100)" : "var(--ink-0)";
        const circleStroke = active ? COPPER : done ? COPPER_EDGE : "var(--ink-200)";
        const iconColor = active ? "#fff" : done ? COPPER : "var(--ink-400)";
        const labelColor = active ? COPPER : done ? "var(--ink-700)" : "var(--ink-400)";

        return (
          <div key={s.label} className="flex flex-1 flex-col items-center">
            <div className="relative flex w-full items-center">
              <div className="h-[2px] flex-1" style={{ background: i === 0 ? "transparent" : (done || active ? COPPER : "var(--ink-200)") }} />
              <div
                className="relative flex h-12 w-12 items-center justify-center rounded-full"
                style={{
                  background: circleBg,
                  border: `2px solid ${circleStroke}`,
                  color: iconColor,
                  boxShadow: active ? `0 6px 16px -4px ${COPPER}55` : "none",
                }}>
                {s.icon}
                {done && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full" style={{ background: "#16a34a", border: "2px solid var(--ink-50)" }}>
                    <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </span>
                )}
              </div>
              <div className="h-[2px] flex-1" style={{ background: i === steps.length - 1 ? "transparent" : (done ? COPPER : "var(--ink-200)") }} />
            </div>
            <div className="mt-2 text-[11px] font-semibold" style={{ color: labelColor }}>{s.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function statusToStepIndex(status: string): number {
  switch (status) {
    case "PLACED": return 0;
    case "CONFIRMED": return 1;
    case "IN_KITCHEN":
    case "READY":
      return 2;
    case "SERVED":
    case "COMPLETED":
      return 3;
    default: return 0;
  }
}

const STATUS_PILL: Record<string, { label: string; bg: string; fg: string; ring?: string }> = {
  PLACED:     { label: "Sent",      bg: COPPER_SOFT,        fg: COPPER_INK },
  CONFIRMED:  { label: "Accepted",  bg: COPPER_SOFT,        fg: COPPER_INK },
  IN_KITCHEN: { label: "Preparing", bg: COPPER_SOFT,        fg: COPPER_INK },
  READY:      { label: "Ready",     bg: "var(--ok-soft)",   fg: "var(--ok)" },
  SERVED:     { label: "Served",    bg: "var(--ok-soft)",   fg: "var(--ok)" },
  COMPLETED:  { label: "Completed", bg: "var(--ok-soft)",   fg: "var(--ok)" },
  CANCELLED:  { label: "Cancelled", bg: "var(--bad-soft)",  fg: "var(--bad)" },
};

/* ── Pay Online Button ─────────────────────────────── */
function PayOnlineButton({ orderId, sessionId, totalAmount }: { orderId: string; sessionId: string; totalAmount: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handle() {
    setLoading(true); setError(null);
    try {
      const intent = await post<{ paymentId: string; checkoutUrl?: string; externalId: string; amount: string; orderId?: string }>(`/api/sessions/${sessionId}/payments/intent`, { paymentMethod: "CARD" });
      if (intent.checkoutUrl) {
        const url = new URL(intent.checkoutUrl);
        url.searchParams.set("paymentId", intent.paymentId);
        url.searchParams.set("sessionId", sessionId);
        url.searchParams.set("orderId", intent.orderId ?? orderId);
        url.searchParams.set("amount", intent.amount ?? totalAmount);
        router.push(url.pathname + url.search);
      }
    } catch (e) { setError(getApiErrorMessage(e, "Payment is temporarily unavailable. Please try again or ask staff for help.")); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <button onClick={handle} disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-[12px] py-3 text-[12px] font-semibold text-white transition disabled:opacity-50 active:scale-[0.98]"
        style={{ background: COPPER }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
        {loading ? "Creating..." : `Pay Online · ${parseFloat(totalAmount).toFixed(2)} JOD`}
      </button>
      {error && <p className="mt-1.5 text-[10px]" style={{ color: "var(--bad)" }}>{error}</p>}
    </div>
  );
}

/* ── Service Quick Buttons ─────────────────────────── */
const SERVICE_COOLDOWN: Record<string, number> = { WATER: 180, CUTLERY: 180, BILL_REQUEST: 300 };
function cooldownKey(sessionId: string, type: string) { return `service-req-${sessionId}-${type}`; }
function readSentAt(sessionId: string, type: string): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(cooldownKey(sessionId, type));
  return raw ? parseInt(raw, 10) || 0 : 0;
}
function writeSentAt(sessionId: string, type: string) { if (typeof window !== "undefined") localStorage.setItem(cooldownKey(sessionId, type), String(Date.now())); }
function clearSentAt(sessionId: string, type: string) { if (typeof window !== "undefined") localStorage.removeItem(cooldownKey(sessionId, type)); }
function fmtCountdown(s: number): string { const m = Math.floor(s / 60); const sec = s % 60; return m > 0 ? `${m}:${sec.toString().padStart(2, "0")}` : `${sec}s`; }

function ServiceButtons({ sessionId }: { sessionId: string }) {
  const [now, setNow] = useState(() => Date.now());
  const [justSent, setJustSent] = useState<string | null>(null);

  const items = [
    { type: "WATER", label: "Water", icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M12 2v6M12 22a7 7 0 0 1-7-7c0-3 7-13 7-13s7 10 7 13a7 7 0 0 1-7 7z" /></svg> },
    { type: "CUTLERY", label: "Cutlery", icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M6 2v8a3 3 0 0 0 3 3v8M9 5v8M14 2v20M18 2c-1 0-2 2-2 5v6h2v9" /></svg> },
    { type: "BILL_REQUEST", label: "Request Bill", icon: <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg> },
  ];

  useEffect(() => {
    const anyActive = items.some(it => (SERVICE_COOLDOWN[it.type] ?? 0) - Math.floor((now - readSentAt(sessionId, it.type)) / 1000) > 0);
    if (!anyActive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, sessionId]);

  async function send(type: string) {
    const remaining = (SERVICE_COOLDOWN[type] ?? 0) - Math.floor((Date.now() - readSentAt(sessionId, type)) / 1000);
    if (remaining > 0) return;
    try {
      await post(`/api/sessions/${sessionId}/service-requests`, { type });
      writeSentAt(sessionId, type); setJustSent(type); setNow(Date.now());
      setTimeout(() => setJustSent(prev => prev === type ? null : prev), 1500);
    } catch { clearSentAt(sessionId, type); }
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(r => {
        const sentAt = readSentAt(sessionId, r.type);
        const remaining = sentAt ? Math.max(0, (SERVICE_COOLDOWN[r.type] ?? 0) - Math.floor((now - sentAt) / 1000)) : 0;
        const onCooldown = remaining > 0;
        const isJustSent = justSent === r.type;
        return (
          <button key={r.type} onClick={() => send(r.type)} disabled={onCooldown}
            className="flex flex-col items-center gap-1 rounded-[12px] py-3 transition active:scale-[0.97] disabled:active:scale-100"
            style={{
              background: isJustSent ? "var(--ok-soft)" : onCooldown ? "var(--ink-50)" : "var(--ink-0)",
              color: isJustSent ? "var(--ok)" : onCooldown ? "var(--ink-400)" : "var(--ink-700)",
              border: `1px solid ${isJustSent ? "#bbf7d0" : "var(--ink-200)"}`,
              cursor: onCooldown ? "not-allowed" : "pointer",
            }}
            aria-label={onCooldown ? `${r.label} — wait ${fmtCountdown(remaining)}` : r.label}
            title={onCooldown ? `Available again in ${fmtCountdown(remaining)}` : undefined}>
            {r.icon}
            <span className="text-[10px] font-semibold leading-none">{isJustSent ? "Sent" : onCooldown ? `Wait ${fmtCountdown(remaining)}` : r.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Main ──────────────────────────────────────────── */
export default function OrderStatusPage() {
  const { sessionId, orderId } = useParams<{ sessionId: string; orderId: string }>();
  const router = useRouter();
  const { state: cartState, dispatch } = useCart();

  const { data: order, isLoading, error, refetch } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => get<Order>(`/api/sessions/${sessionId}/orders/${orderId}`),
    refetchInterval: 10_000,
  });

  const { data: sessionBill, refetch: refetchBill } = useQuery({
    queryKey: ["session-bill", sessionId],
    queryFn: () => get<SessionBill>(`/api/sessions/${sessionId}/bill`),
    refetchInterval: 10_000,
    enabled: !!sessionId,
  });

  const branchId = cartState.branchId ?? "seed-branch-1";
  const { data: categories } = useQuery({
    queryKey: ["menu", branchId],
    queryFn: () => get<MenuCategory[]>(`/api/menu?branchId=${branchId}`),
    enabled: !!order,
  });

  const menuImageMap = useMemo(() => {
    const m = new Map<string, string | null>();
    categories?.forEach(c => c.menuItems.forEach(mi => m.set(mi.id, mi.imageUrl)));
    return m;
  }, [categories]);

  const isServed = order && (order.orderStatus === "COMPLETED" || order.orderStatus === "SERVED");
  const isCompleted = isServed;
  const canReview = !!isServed;
  const { data: existingReview, refetch: refetchReview } = useQuery({
    queryKey: ["review", orderId],
    queryFn: () => get<Review | null>(`/api/sessions/${sessionId}/orders/${orderId}/reviews`),
    enabled: !!canReview,
  });

  const { data: postRecs } = useQuery({
    queryKey: ["post-recs", branchId],
    queryFn: () => get<{ recommendations: Recommendation[] }>(`/api/ai/recommendations?branchId=${branchId}&limit=3`),
    enabled: !!isCompleted,
  });

  if (isLoading) return <LoadingScreen message="Loading order..." />;
  if (error || !order) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5" style={{ background: "var(--ink-50)" }}>
        <div className="rounded-[14px] p-5 text-center" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <p className="text-[12px]" style={{ color: "var(--bad)" }}>{getApiErrorMessage(error, "Order not found or this table session has expired.")}</p>
          <button onClick={() => router.push(`/customer/session/${sessionId}/menu`)} className="mt-3 rounded-[10px] px-4 py-2 text-[11px] font-semibold text-white" style={{ background: COPPER }}>Back to Menu</button>
        </div>
      </main>
    );
  }

  const stepIdx = statusToStepIndex(order.orderStatus);
  const statusInfo = STATUS_PILL[order.orderStatus] ?? STATUS_PILL.PLACED;
  const orderNumber = `TH-${orderId.slice(-4).toUpperCase()}`;
  const placedAt = new Date(order.orderDateTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const billRemaining = parseFloat(sessionBill?.remainingAmount ?? order.totalAmount);
  const showPayment = !!isServed && billRemaining > 0.005;
  const billOrderCount = sessionBill?.orderCount ?? 1;
  const billSubtotal = parseFloat(sessionBill?.subtotalAmount ?? order.subtotalAmount);
  const billTax = parseFloat(sessionBill?.taxAmount ?? order.taxAmount);
  const billServiceCharge = parseFloat(sessionBill?.serviceChargeAmount ?? "0");
  const billDiscount = parseFloat(sessionBill?.discountAmount ?? "0");
  const billTotal = parseFloat(sessionBill?.remainingAmount ?? order.totalAmount);

  function handleReorder() {
    if (!order) return;
    for (const item of order.orderItems) {
      const additions = Array.isArray(item.specializationsJson)
        ? (item.specializationsJson as Array<{ additionId?: string; name: string; priceImpact?: number }>).filter(a => a.additionId).map(a => ({ additionId: a.additionId!, name: a.name, priceImpact: a.priceImpact ?? 0 }))
        : [];
      dispatch({
        type: "ADD_ITEM",
        item: { menuItemId: item.menuItemId, name: item.menuItem?.name ?? "Item", price: parseFloat(item.itemBasePrice), quantity: item.quantity, additions },
      });
    }
    router.push(`/customer/session/${sessionId}/cart`);
  }

  const cartCount = cartState.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <main className="flex min-h-screen flex-col" style={{ background: "var(--ink-50)" }}>
      <div className="mx-auto w-full max-w-md flex-1 flex flex-col">
        <TopBar cartCount={cartCount} onBack={() => router.push(`/customer/session/${sessionId}/menu`)} onCart={() => router.push(`/customer/session/${sessionId}/cart`)} />

        {/* Info pills */}
        <div className="mt-4 flex gap-2 px-4">
          <Pill icon={<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-6 9 6v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></svg>} primary={cartState.branchName ?? "Branch"} />
          <Pill icon={<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M5 7v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V7" /><path d="M5 7h14" /><line x1="8" y1="20" x2="8" y2="16" /><line x1="16" y1="20" x2="16" y2="16" /></svg>} label="Table" primary={cartState.tableCode ?? "—"} />
          <Pill icon={<svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>} primary={`${cartState.guestCount ?? 1} Guest${(cartState.guestCount ?? 1) === 1 ? "" : "s"}`} />
        </div>

        {/* Heading */}
        <div className="mt-5 px-4 text-center">
          <h1 className="font-serif text-[30px] font-extrabold leading-tight" style={{ color: "var(--ink-900)" }}>Order Details</h1>
          <p className="mt-1.5 text-[12px] leading-snug" style={{ color: "var(--ink-500)" }}>Track your order status and review<br />what was sent to the kitchen.</p>
        </div>

        {/* Order # card with stepper */}
        <div className="mx-4 mt-5 rounded-[14px] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <div className="flex items-center justify-between">
            <div className="text-[16px] font-bold" style={{ color: "var(--ink-900)" }}>Order #{orderNumber}</div>
            <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: statusInfo.bg, color: statusInfo.fg }}>
              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V18H6Z" /></svg>
              {statusInfo.label}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]" style={{ color: "var(--ink-500)" }}>
            <span className="flex items-center gap-1.5">
              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              Placed at {placedAt}
            </span>
            <span>Est. time: <span className="font-semibold" style={{ color: COPPER }}>15–20 min</span></span>
          </div>
          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--ink-100)" }}>
            <OrderStepper activeIndex={stepIdx} />
          </div>
        </div>

        {/* Items in this order */}
        <div className="mt-5 px-4">
          <h3 className="mb-3 text-[15px] font-bold" style={{ color: "var(--ink-900)" }}>Items in this order</h3>
          <div className="space-y-2">
            {order.orderItems.map(it => {
              const photo = imgUrl(menuImageMap.get(it.menuItemId));
              const customs = Array.isArray(it.specializationsJson) ? (it.specializationsJson as Array<{ name: string }>) : [];
              return (
                <div key={it.id} className="flex items-center gap-3 rounded-[14px] p-2.5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
                  <div className="h-[58px] w-[58px] flex-shrink-0 rounded-[10px]" style={{ background: photo ? `url(${photo}) center/cover` : photoGrad(it.menuItemId) }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold leading-tight" style={{ color: "var(--ink-900)" }}>{it.menuItem?.name ?? "Item"}</div>
                    {customs.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {customs.map((c, idx) => <span key={idx} className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: COPPER_SOFT, color: COPPER_INK, border: `1px solid ${COPPER_EDGE}` }}>{c.name}</span>)}
                      </div>
                    ) : (
                      <div className="mt-0.5 text-[11px]" style={{ color: "var(--ink-400)" }}>No customizations</div>
                    )}
                  </div>
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[8px] font-mono text-[12px] font-bold" style={{ background: "var(--ink-50)", color: "var(--ink-700)", border: "1px solid var(--ink-200)" }}>{it.quantity}</div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-semibold text-[13px]" style={{ color: "var(--ink-900)" }}>{parseFloat(it.lineTotal).toFixed(2)} <span className="text-[9px] font-normal" style={{ color: "var(--ink-500)" }}>JOD</span></div>
                    {it.quantity > 1 && <div className="text-[9px]" style={{ color: "var(--ink-400)" }}>{parseFloat(it.itemBasePrice).toFixed(2)} JOD each</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Totals card with clipboard-leaf */}
        <div className="mx-4 mt-4 flex items-stretch gap-3 rounded-[14px] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <div className="flex-1 space-y-2.5">
            <LineRow label={billOrderCount > 1 ? `Unpaid orders (${billOrderCount})` : "Unpaid order"} value={billTotal.toFixed(2)} />
            <LineRow label="Subtotal" value={billSubtotal.toFixed(2)} />
            {billTax > 0 && <LineRow label="Tax" value={billTax.toFixed(2)} />}
            {billServiceCharge > 0 && <LineRow label="Service charge" value={billServiceCharge.toFixed(2)} />}
            {billDiscount > 0 && <LineRow label="Discount" value={`-${billDiscount.toFixed(2)}`} />}
            <div className="pt-2.5" style={{ borderTop: "1px solid var(--ink-200)" }}>
              <div className="flex items-baseline justify-between">
                <span className="text-[16px] font-bold" style={{ color: "var(--ink-900)" }}>Total due</span>
                <span className="font-bold text-[18px]" style={{ color: "var(--ink-900)" }}>{billTotal.toFixed(2)} <span className="text-[10px] font-normal" style={{ color: "var(--ink-500)" }}>JOD</span></span>
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 self-start"><ClipboardLeaf /></div>
        </div>

        {/* Special request banner */}
        {order.specialInstructions && (
          <div className="mx-4 mt-4 flex items-start gap-2.5 rounded-[12px] p-3" style={{ background: COPPER_SOFT, border: `1px solid ${COPPER_EDGE}` }}>
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full" style={{ background: COPPER_EDGE, color: COPPER_INK }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
            </span>
            <span className="text-[11.5px] leading-snug" style={{ color: COPPER_INK }}>
              <strong>Special request sent:</strong> {order.specialInstructions}
            </span>
          </div>
        )}

        {/* Payment block (only when unpaid) */}
        {!isServed && (
          <div className="mx-4 mt-4 rounded-[14px] p-4" style={{ background: COPPER_SOFT, border: `1px solid ${COPPER_EDGE}` }}>
            <h3 className="text-[13px] font-semibold" style={{ color: COPPER_INK }}>Payment opens after service</h3>
            <p className="mt-1 text-[11px] leading-snug" style={{ color: COPPER_INK }}>You can pay after your order has been served at the table.</p>
          </div>
        )}

        {showPayment && (
          <div className="mx-4 mt-4 rounded-[14px] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <h3 className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>Payment</h3>
            {!sessionBill && (
              <InlineAlert tone="warning" title="Bill estimate unavailable" className="mt-2">
                The final amount will be confirmed by the server before payment starts.
              </InlineAlert>
            )}
            {billOrderCount > 1 && <p className="mt-1 text-[11px] font-semibold" style={{ color: COPPER }}>This bill includes all unpaid orders from your table session.</p>}
            {(sessionBill?.paymentStatus === "PARTIALLY_PAID" || order.paymentStatus === "PARTIALLY_PAID") && <p className="mt-1 text-[11px] font-semibold" style={{ color: "var(--warn)" }}>Partial payment received. Remaining balance due.</p>}
            <div className="mt-3">
              <PayOnlineButton orderId={orderId} sessionId={sessionId} totalAmount={billTotal.toFixed(2)} />
            </div>
          </div>
        )}

        {isServed && !showPayment && (
          <div className="mx-4 mt-4 flex items-center gap-2.5 rounded-[12px] p-3" style={{ background: "var(--ok-soft)", border: "1px solid #bbf7d0" }}>
            <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "var(--ok)", color: "#fff" }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
            </span>
            <div>
              <div className="text-[12px] font-semibold" style={{ color: "var(--ok)" }}>Payment Complete</div>
              <div className="text-[10px]" style={{ color: "#15803d" }}>Thank you for dining with us.</div>
            </div>
          </div>
        )}

        {/* Need help — service buttons */}
        <div className="mx-4 mt-5">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>Need help?</h3>
          <ServiceButtons sessionId={sessionId} />
        </div>

        {/* Post-order recommendations */}
        {isCompleted && postRecs && postRecs.recommendations.length > 0 && (
          <div className="mx-4 mt-4 rounded-[14px] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <h3 className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>How about something else?</h3>
            <div className="-mx-1 mt-2.5 flex gap-2 overflow-x-auto px-1 pb-1">
              {postRecs.recommendations.map(r => (
                <div key={r.menuItemId} className="min-w-[110px] flex-shrink-0 rounded-[10px] p-2.5" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
                  <div className="text-[11px] font-semibold leading-tight truncate" style={{ color: "var(--ink-900)" }}>{r.name}</div>
                  <div className="mt-1 font-semibold text-[12px]" style={{ color: COPPER }}>{parseFloat(r.price).toFixed(2)} <span className="text-[9px] font-normal" style={{ color: "var(--ink-500)" }}>JOD</span></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Existing review */}
        {existingReview && (
          <div className="mx-4 mt-4 rounded-[14px] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <div className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>Your Review</div>
            <div className="mt-1 flex gap-0.5">
              {[1, 2, 3, 4, 5].map(s => (
                <svg key={s} width={16} height={16} viewBox="0 0 24 24" fill={s <= existingReview.overallRating ? "#f59e0b" : "none"} stroke={s <= existingReview.overallRating ? "#f59e0b" : "var(--ink-300)"} strokeWidth={1.5}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
              ))}
            </div>
            {existingReview.comment && <p className="mt-1.5 text-[11px]" style={{ color: "var(--ink-600)" }}>{existingReview.comment}</p>}
          </div>
        )}

        {canReview && !existingReview && (
          <div className="mx-4 mt-4">
            <OrderReviewForm order={order} sessionId={sessionId} onSubmitted={() => refetchReview()} />
          </div>
        )}

        {isCompleted && (
          <button onClick={handleReorder}
            className="mx-4 mt-3 flex items-center justify-center gap-2 rounded-[12px] py-2.5 text-[12px] font-semibold"
            style={{ background: "var(--ink-0)", color: COPPER_INK, border: `1px solid ${COPPER_EDGE}` }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><polyline points="3 3 3 8 8 8" /></svg>
            Reorder this order
          </button>
        )}

        {/* Bottom CTAs */}
        <div className="mx-4 mt-5 mb-2">
          <button onClick={() => post(`/api/sessions/${sessionId}/service-requests`, { type: "CALL_WAITER" }).catch(() => {})}
            className="flex w-full items-center justify-center gap-2.5 rounded-[14px] py-4 text-[14px] font-semibold text-white transition active:scale-[0.98]"
            style={{ background: COPPER, boxShadow: "0 12px 28px -8px rgba(194,132,29,0.55)" }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
            Call Staff
          </button>

          <button onClick={() => router.push(`/customer/session/${sessionId}/menu`)}
            className="mt-2.5 w-full text-center text-[13px] font-semibold underline underline-offset-[3px]" style={{ color: COPPER }}>
            Order More
          </button>
        </div>

        <p className="mx-4 mt-2 mb-3 flex items-center justify-center gap-1.5 text-center text-[10px]" style={{ color: "var(--ink-500)" }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={COPPER} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.91 5.84L20 11l-6.09 2.16L12 19l-1.91-5.84L4 11l6.09-2.16z" />
          </svg>
          You can continue browsing while your order is being prepared.
        </p>

        <button onClick={() => { void refetch(); void refetchBill(); }} className="mx-4 mb-6 w-auto self-center text-center text-[10px]" style={{ color: "var(--ink-400)" }}>
          Refresh status
        </button>
      </div>
    </main>
  );
}
