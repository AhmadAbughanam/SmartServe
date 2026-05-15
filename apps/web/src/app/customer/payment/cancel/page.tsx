"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { post } from "../../../../lib/api";
import { Cloche, Sprig } from "../../../../components/ui";

const COPPER = "#c2841d";
const COPPER_SOFT = "#fdf2e2";
const COPPER_EDGE = "#f1d9a8";
const COPPER_INK = "#7c5511";
const RUST = "#a8482a"; // deeper rusty-red used for the X circle in the design
const OK = "#16a34a";
const OK_DARK = "#15803d";

function fmtMoney(v: string) { return parseFloat(v || "0").toFixed(2); }

function SummaryRow({ icon, label, value, valueColor }: { icon: React.ReactNode; label: string; value: React.ReactNode; valueColor?: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center" style={{ color: COPPER }}>{icon}</span>
      <span className="text-[12px]" style={{ color: "var(--ink-500)" }}>{label}</span>
      <div className="flex-1" style={{ borderTop: "1.5px dotted var(--ink-300)", marginBottom: 4 }} />
      <span className="text-[12px]" style={{ color: valueColor ?? "var(--ink-700)" }}>{value}</span>
    </div>
  );
}

function VisaLogo() {
  return (
    <span className="inline-flex items-center justify-center rounded-[3px] px-1.5 py-0.5 text-[9px] font-extrabold italic tracking-tight" style={{ background: "#1A1F71", color: "#fff" }}>VISA</span>
  );
}

function Brand() {
  return (
    <div className="text-center">
      <Cloche size={32} color={COPPER} />
      <div className="mt-1.5 font-serif text-[15px] font-semibold tracking-[0.22em]" style={{ color: "var(--ink-900)" }}>TASTE HOUSE</div>
      <div className="mt-0.5 font-serif text-[8px] font-medium tracking-[0.3em]" style={{ color: COPPER }}>CAFÉ &middot; KITCHEN</div>
    </div>
  );
}

function CancelInner() {
  const params = useSearchParams();
  const router = useRouter();
  const sessionId = params.get("sessionId");
  const orderId = params.get("orderId");
  const paymentId = params.get("paymentId");
  const amount = params.get("amount") ?? "";

  const orderNumber = orderId ? `TH-${orderId.slice(-4).toUpperCase()}` : "—";
  const dateLine = new Date().toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

  function callWaiter() {
    if (!sessionId) return;
    post(`/api/sessions/${sessionId}/service-requests`, { type: "CALL_WAITER" }).catch(() => {});
  }

  return (
    <main className="flex min-h-screen flex-col" style={{ background: "var(--ink-50)" }}>
      <div className="mx-auto w-full max-w-md px-5 pb-10 pt-6">
        <Brand />

        {/* Big rust X with sprigs */}
        <div className="mt-5 flex items-center justify-center">
          <Sprig side="left" color={OK} />
          <div className="mx-2 flex h-[92px] w-[92px] items-center justify-center rounded-full" style={{ background: RUST, boxShadow: `0 0 0 8px rgba(168,72,42,0.12)` }}>
            <svg width={42} height={42} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </div>
          <Sprig side="right" color={OK} />
        </div>

        <div className="mt-3 text-center">
          <h2 className="font-serif text-[28px] font-extrabold leading-tight" style={{ color: "var(--ink-900)" }}>Payment Cancelled</h2>
          <p className="mt-1.5 text-[12px] leading-snug" style={{ color: "var(--ink-500)" }}>Your payment was not completed. No charge<br />was made. You can try again or ask a waiter for help.</p>
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
              label="Amount Due"
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
              icon={<svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>}
              label="Status"
              value={<span className="font-semibold" style={{ color: RUST }}>Cancelled</span>}
              valueColor={RUST}
            />
          </div>
        </div>

        {/* What happened card */}
        <div className="mt-4 rounded-[14px] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: COPPER_SOFT, color: COPPER }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
            </span>
            <span className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>What happened?</span>
          </div>
          <p className="text-[12px] leading-snug" style={{ color: "var(--ink-600)" }}>
            The payment window was closed or the transaction was cancelled before completion. Your order is still saved and waiting for payment.
          </p>
          <div className="mt-3 flex items-start gap-2 rounded-[10px] p-2.5" style={{ background: COPPER_SOFT, border: `1px solid ${COPPER_EDGE}` }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={COPPER_INK} strokeWidth={1.8} strokeLinecap="round" className="mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
            <span className="text-[11px]" style={{ color: COPPER_INK }}>Need help? A waiter can assist you at your table.</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 space-y-2.5">
          {sessionId && orderId && (
            <button onClick={() => router.push(`/customer/session/${sessionId}/orders/${orderId}`)}
              className="flex w-full items-center justify-center gap-2.5 rounded-[14px] py-4 text-[14px] font-semibold text-white transition active:scale-[0.98]"
              style={{ background: COPPER, boxShadow: `0 12px 28px -8px rgba(194,132,29,0.55)` }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><polyline points="3 3 3 8 8 8" /></svg>
              Retry Payment
            </button>
          )}
          <button onClick={callWaiter}
            className="flex w-full items-center justify-center gap-2.5 rounded-[14px] py-4 text-[14px] font-semibold transition active:scale-[0.98]"
            style={{ background: "var(--ink-0)", color: COPPER, border: `1px solid ${COPPER_EDGE}` }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
            Call Waiter
          </button>
          {sessionId && (
            <button onClick={() => router.push(`/customer/session/${sessionId}/cart`)}
              className="w-full text-center text-[13px] font-semibold underline underline-offset-[3px] py-2" style={{ color: COPPER }}>
              Back to Cart
            </button>
          )}
        </div>

        {/* Reassurance footer chip */}
        <div className="mt-5 flex items-start gap-3 rounded-[12px] p-3.5" style={{ background: "var(--ok-soft)", border: "1px solid #bbf7d0" }}>
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "#bbf7d0", color: OK_DARK }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 11 12 14 16 9" /></svg>
          </span>
          <span className="text-[12px] leading-snug pt-0.5" style={{ color: OK_DARK }}>Your order remains saved and has not<br />been sent for final payment.</span>
        </div>

        {paymentId && <p className="mt-3 text-center font-mono text-[8px]" style={{ color: "var(--ink-400)" }}>ref: {paymentId.slice(-8)}</p>}
      </div>
    </main>
  );
}

export default function PaymentCancelPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center" style={{ background: "var(--ink-50)" }}><div className="h-6 w-6 animate-spin rounded-full" style={{ border: "2px solid var(--ink-200)", borderTopColor: COPPER }} /></div>}>
      <CancelInner />
    </Suspense>
  );
}
