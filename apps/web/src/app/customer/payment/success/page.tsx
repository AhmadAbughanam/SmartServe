"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { get, post } from "../../../../lib/api";
import { Cloche, Sprig } from "../../../../components/ui";
import { OrderReviewForm } from "../../../../components/customer/OrderReviewForm";
import type { Order, Review } from "../../../../lib/types";

const COPPER = "#c2841d";
const COPPER_SOFT = "#fdf2e2";
const COPPER_EDGE = "#f1d9a8";
const OK = "#16a34a";
const OK_DARK = "#15803d";

function fmtMoney(v: string) { return parseFloat(v || "0").toFixed(2); }

/* ── Receipt-style row with dotted leader + icon ──── */
function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center" style={{ color: COPPER }}>{icon}</span>
      <span className="text-[12px]" style={{ color: "var(--ink-500)" }}>{label}</span>
      <div className="flex-1" style={{ borderTop: "1.5px dotted var(--ink-300)", marginBottom: 4 }} />
      <span className="text-[12px]" style={{ color: "var(--ink-700)" }}>{value}</span>
    </div>
  );
}

/* ── Status stepper for the success page ──────────── */
function PaymentStatusStepper({ activeIndex, placedAt, paidAt }: { activeIndex: number; placedAt: string; paidAt: string }) {
  const steps = [
    { label: "Order Placed", sub: placedAt, icon: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>, doneColor: OK },
    { label: "Payment Complete", sub: paidAt, icon: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>, doneColor: OK },
    { label: "In Progress", sub: "Preparing", icon: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V18H6Z" /><line x1="6" y1="22" x2="18" y2="22" /></svg>, doneColor: COPPER },
    { label: "Ready", sub: "Soon", icon: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M3 14h18M5 14a7 7 0 0 1 14 0M12 7v3M2 19h20" /></svg>, doneColor: "var(--ink-300)" },
  ];

  return (
    <div className="flex items-start">
      {steps.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        const future = i > activeIndex;

        const circleBg = active ? COPPER : "var(--ink-0)";
        const circleStroke = active ? COPPER : done ? OK : "var(--ink-200)";
        const iconColor = active ? "#fff" : done ? OK : "var(--ink-400)";
        const labelColor = active ? COPPER : done ? OK_DARK : "var(--ink-400)";

        return (
          <div key={s.label} className="flex flex-1 flex-col items-center">
            <div className="relative flex w-full items-center">
              <div className="h-[2px] flex-1" style={{ background: i === 0 ? "transparent" : (done || active ? OK : "var(--ink-200)") }} />
              <div
                className="relative flex h-11 w-11 items-center justify-center rounded-full"
                style={{
                  background: circleBg,
                  border: `2px solid ${circleStroke}`,
                  color: iconColor,
                  boxShadow: active ? `0 6px 16px -4px ${COPPER}55` : "none",
                }}>
                {s.icon}
              </div>
              <div className="h-[2px] flex-1" style={{ background: i === steps.length - 1 ? "transparent" : (done ? OK : "var(--ink-200)") }} />
            </div>
            <div className="mt-1.5 text-[11px] font-semibold leading-tight text-center" style={{ color: labelColor }}>{s.label}</div>
            <div className="text-[9.5px] mt-0.5 text-center" style={{ color: future ? "var(--ink-400)" : "var(--ink-500)" }}>{s.sub}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Brand mark header ─────────────────────────────── */
function Brand() {
  return (
    <div className="text-center">
      <Cloche size={32} color={COPPER} />
      <div className="mt-1.5 font-serif text-[15px] font-semibold tracking-[0.22em]" style={{ color: "var(--ink-900)" }}>TASTE HOUSE</div>
      <div className="mt-0.5 font-serif text-[8px] font-medium tracking-[0.3em]" style={{ color: COPPER }}>CAFÉ &middot; KITCHEN</div>
    </div>
  );
}

function VisaLogo() {
  return (
    <span className="inline-flex items-center justify-center rounded-[3px] px-1.5 py-0.5 text-[9px] font-extrabold italic tracking-tight" style={{ background: "#1A1F71", color: "#fff" }}>VISA</span>
  );
}

function SuccessInner() {
  const params = useSearchParams();
  const router = useRouter();
  const ref = params.get("ref");
  const paymentId = params.get("paymentId");
  const sessionId = params.get("sessionId");
  const orderId = params.get("orderId");
  const amount = params.get("amount") ?? "";

  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: order, refetch: refetchOrder } = useQuery({
    queryKey: ["payment-success-order", orderId],
    queryFn: () => get<Order>(`/api/sessions/${sessionId}/orders/${orderId}`),
    enabled: completed && !!sessionId && !!orderId,
  });

  const { data: existingReview, refetch: refetchReview } = useQuery({
    queryKey: ["payment-success-review", orderId],
    queryFn: () => get<Review | null>(`/api/sessions/${sessionId}/orders/${orderId}/reviews`),
    enabled: completed && !!sessionId && !!orderId,
  });

  async function simulate() {
    if (!paymentId) return;
    setCompleting(true); setError(null);
    try {
      await post(`/api/payments/${paymentId}/mock-complete`);
      setCompleted(true);
      void refetchOrder();
      void refetchReview();
    }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to simulate payment"); }
    finally { setCompleting(false); }
  }

  const orderNumber = orderId ? `TH-${orderId.slice(-4).toUpperCase()}` : "—";
  const txnId = ref ? ref.slice(0, 12).toUpperCase() : (paymentId ? `TXN-${paymentId.slice(-6).toUpperCase()}` : "—");
  const now = new Date();
  const dateLine = now.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const placedTime = new Date(now.getTime() - 60_000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const paidTime = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  /* Pre-success state — keeps the mock-gateway "Simulate" path for demo flows. */
  if (!completed) {
    return (
      <main className="flex min-h-screen flex-col" style={{ background: "var(--ink-50)" }}>
        <div className="mx-auto w-full max-w-md px-5 pb-8 pt-8">
          <Brand />
          <div className="mt-6 rounded-[16px] p-6 text-center" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ background: COPPER_SOFT, color: COPPER }}>
              <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
            </div>
            <h2 className="mt-3 font-serif text-[22px] font-extrabold" style={{ color: "var(--ink-900)" }}>Mock Gateway</h2>
            <p className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>This screen simulates your payment provider. In production, the gateway would handle the checkout.</p>
            {error && <div className="mt-3 rounded-[10px] px-3 py-2 text-[11px]" style={{ background: "var(--bad-soft)", color: "var(--bad)", border: "1px solid #fecaca" }}>{error}</div>}
            <button onClick={simulate} disabled={completing || !paymentId}
              className="mt-4 w-full rounded-[12px] py-3 text-[13px] font-semibold text-white transition disabled:opacity-50 active:scale-[0.98]"
              style={{ background: COPPER }}>
              {completing ? "Processing..." : "Simulate Payment Success"}
            </button>
            {sessionId && orderId && (
              <button onClick={() => router.push(`/customer/payment/cancel?sessionId=${sessionId}&orderId=${orderId}${paymentId ? `&paymentId=${paymentId}` : ""}${amount ? `&amount=${amount}` : ""}`)}
                className="mt-2 w-full py-2 text-[11px] underline underline-offset-[3px]" style={{ color: "var(--ink-500)" }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  /* Success state — matches screenshot 2 */
  return (
    <main className="flex min-h-screen flex-col" style={{ background: "var(--ink-50)" }}>
      <div className="mx-auto w-full max-w-md px-5 pb-10 pt-6">
        <Brand />

        {/* Big green check with sprigs */}
        <div className="mt-5 flex items-center justify-center">
          <Sprig side="left" color={OK} />
          <div className="mx-2 flex h-[92px] w-[92px] items-center justify-center rounded-full" style={{ background: OK, boxShadow: `0 0 0 8px rgba(22,163,74,0.10)` }}>
            <svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <Sprig side="right" color={OK} />
        </div>

        <div className="mt-3 text-center">
          <h2 className="font-serif text-[28px] font-extrabold leading-tight" style={{ color: "var(--ink-900)" }}>Payment Successful</h2>
          <p className="mt-1.5 text-[12px] leading-snug" style={{ color: "var(--ink-500)" }}>Your payment was confirmed and<br />your order is now being processed.</p>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold" style={{ background: "var(--ok-soft)", color: OK_DARK, border: `1px solid #bbf7d0` }}>
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 11 12 14 16 9" /></svg>
            Mock Gateway Simulation
          </span>
        </div>

        {/* Payment Summary */}
        <div className="mt-6 rounded-[14px] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: COPPER_SOFT, color: COPPER }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>
            </span>
            <span className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>Payment Summary</span>
          </div>
          <div className="space-y-2.5">
            <SummaryRow
              icon={<svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>}
              label="Order Number"
              value={<span className="font-mono font-semibold">#{orderNumber}</span>}
            />
            <SummaryRow
              icon={<svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v12M9 9h4.5a2.5 2.5 0 0 1 0 5H9.5a2.5 2.5 0 0 0 0 5H15" /></svg>}
              label="Paid Amount"
              value={<span className="font-bold text-[14px]" style={{ color: "var(--ink-900)" }}>{fmtMoney(amount)} <span className="text-[9px] font-normal" style={{ color: "var(--ink-500)" }}>JOD</span></span>}
            />
            <SummaryRow
              icon={<svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>}
              label="Payment Method"
              value={<span className="inline-flex items-center gap-1.5"><VisaLogo /><span>ending in 4242</span></span>}
            />
            <SummaryRow
              icon={<svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>}
              label="Date & Time"
              value={dateLine}
            />
            <SummaryRow
              icon={<svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>}
              label="Transaction ID"
              value={<span className="font-mono">{txnId}</span>}
            />
          </div>
        </div>

        {/* Order Status stepper */}
        <div className="mt-4 rounded-[14px] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: COPPER_SOFT, color: COPPER }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
            </span>
            <span className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>Order Status</span>
          </div>
          <PaymentStatusStepper activeIndex={2} placedAt={placedTime} paidAt={paidTime} />
        </div>

        {/* Receipt notice */}
        <div className="mt-4 flex items-start gap-3 rounded-[12px] p-3.5" style={{ background: "var(--ok-soft)", border: "1px solid #bbf7d0" }}>
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "#bbf7d0", color: OK_DARK }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
          </span>
          <span className="text-[12px] leading-snug pt-0.5" style={{ color: OK_DARK }}>A digital receipt has been sent to your email.<br />You can also download it anytime.</span>
        </div>

        {/* Actions */}
        <div className="mt-5 space-y-2.5">
          {sessionId && orderId && order && !existingReview && (
            <OrderReviewForm
              order={order}
              sessionId={sessionId}
              onSubmitted={() => refetchReview()}
            />
          )}

          {existingReview && (
            <div className="rounded-[14px] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
              <div className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>Thanks for your review</div>
              <div className="mt-1 flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg key={star} width={16} height={16} viewBox="0 0 24 24" fill={star <= existingReview.overallRating ? "#f59e0b" : "none"} stroke={star <= existingReview.overallRating ? "#f59e0b" : "var(--ink-300)"} strokeWidth={1.5}>
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                ))}
              </div>
            </div>
          )}

          {sessionId && orderId && (
            <button onClick={() => router.push(`/customer/session/${sessionId}/orders/${orderId}`)}
              className="flex w-full items-center justify-center gap-2.5 rounded-[14px] py-4 text-[14px] font-semibold text-white transition active:scale-[0.98]"
              style={{ background: COPPER, boxShadow: `0 12px 28px -8px rgba(194,132,29,0.55)` }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
              View Order Status
            </button>
          )}
          <button onClick={() => window.print()}
            className="flex w-full items-center justify-center gap-2.5 rounded-[14px] py-4 text-[14px] font-semibold transition active:scale-[0.98]"
            style={{ background: "var(--ink-0)", color: COPPER, border: `1px solid ${COPPER_EDGE}` }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Download Receipt
          </button>
          {sessionId && (
            <button onClick={() => router.push(`/customer/session/${sessionId}/menu`)}
              className="w-full text-center text-[13px] font-semibold underline underline-offset-[3px] py-2" style={{ color: COPPER }}>
              Back to Menu
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center" style={{ background: "var(--ink-50)" }}><div className="h-6 w-6 animate-spin rounded-full" style={{ border: "2px solid var(--ink-200)", borderTopColor: COPPER }} /></div>}>
      <SuccessInner />
    </Suspense>
  );
}
