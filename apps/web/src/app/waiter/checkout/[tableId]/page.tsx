"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { authGet, authPost, authPatch, getApiErrorMessage } from "../../../../lib/api";
import { hasStaffSession, getStaffName } from "../../../../lib/staff-auth";
import type { TableDetail } from "../../../../lib/waiter-types";
import { useToast, LoadingScreen, ErrorDisplay, InlineAlert } from "../../../../components/ui";
import Link from "next/link";

const sv = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export default function CheckoutPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [staffName, setStaffName] = useState("");
  const [payMethod, setPayMethod] = useState<"CASH" | "CARD" | "WALLET">("CASH");
  const [splitMode, setSplitMode] = useState<"none" | "equal" | "custom">("none");
  const [splitCount, setSplitCount] = useState(2);
  const [tipAmount, setTipAmount] = useState("");
  const [surchargeAmount, setSurchargeAmount] = useState("");
  const [surchargeApplied, setSurchargeApplied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paid, setPaid] = useState(false);
  const [receiptMethod, setReceiptMethod] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => { if (!hasStaffSession("waiter")) { router.push("/waiter/login"); return; } setStaffName(getStaffName("waiter") ?? ""); }, [router]);

  const { data: detail, isLoading, error, refetch } = useQuery({
    queryKey: ["waiter-table-detail", tableId],
    queryFn: () => authGet<TableDetail>(`/api/waiter/tables/${tableId}`),
    enabled: true,
  });

  if (isLoading) return <LoadingScreen message="Loading checkout..." />;
  if (error || !detail) return <ErrorDisplay message={getApiErrorMessage(error, "Checkout is unavailable for this table.")} onRetry={() => refetch()} />;

  const session = detail.lastSession?.status === "ACTIVE" ? detail.lastSession : null;
  const orders = session?.orders ?? [];
  const payableOrders = orders.filter(o => o.orderStatus === "SERVED" || o.orderStatus === "COMPLETED");
  const pendingServiceOrders = orders.filter(o => o.orderStatus !== "SERVED" && o.orderStatus !== "COMPLETED" && o.orderStatus !== "CANCELLED");
  const allItems = payableOrders.flatMap(o => o.orderItems).filter(oi => oi.kitchenStatus !== "CANCELLED");
  const subtotal = payableOrders.reduce((s, o) => s + parseFloat(o.subtotalAmount), 0);
  const tax = payableOrders.reduce((s, o) => s + parseFloat(o.taxAmount), 0);
  const serviceCharge = parseFloat(surchargeAmount || "0");
  const tip = parseFloat(tipAmount || "0");
  const total = payableOrders.reduce((s, o) => s + parseFloat(o.totalAmount), 0) + (surchargeApplied ? 0 : serviceCharge) + tip;
  const guests = session?.guestCount ?? 1;
  const perPerson = splitMode === "equal" && splitCount > 0 ? total / splitCount : total;

  async function handleApplySurcharge() {
    if (!surchargeAmount || serviceCharge <= 0 || payableOrders.length === 0) return;
    setBusy(true);
    setPaymentError(null);
    try {
      for (const o of payableOrders) {
        await authPatch(`/api/waiter/orders/${o.id}/surcharge`, undefined, { amount: serviceCharge / payableOrders.length });
      }
      setSurchargeApplied(true);
      toast("Surcharge applied");
      qc.invalidateQueries({ queryKey: ["waiter-table-detail"] });
    } catch (e) { const message = getApiErrorMessage(e, "Surcharge failed."); setPaymentError(message); toast(message, "error"); }
    finally { setBusy(false); }
  }

  async function handlePayment() {
    if (payableOrders.length === 0) return;
    setBusy(true);
    setPaymentError(null);
    try {
      if (splitMode === "none" || splitMode === "custom") {
        // Full payment or single custom payment
        const ep = payMethod === "CASH" ? "cash-confirm" : "terminal-confirm";
        for (const o of payableOrders) {
          if (o.paymentStatus !== "PAID") {
            await authPost(`/api/waiter/orders/${o.id}/payments/${ep}`, undefined, {
              tipAmount: tip > 0 ? tip / payableOrders.length : undefined,
            });
          }
        }
      } else if (splitMode === "equal") {
        // Use split payment endpoint for each order
        for (const o of payableOrders) {
          if (o.paymentStatus !== "PAID") {
            await authPost(`/api/orders/${o.id}/payments/splits`, undefined, {
              splitType: "BY_PEOPLE",
              count: splitCount,
            });
          }
        }
      }

      // Clear the table
      await authPost(`/api/waiter/tables/${tableId}/clear`);
      setPaid(true);
      toast("Payment processed & table cleared");
      qc.invalidateQueries({ queryKey: ["waiter-floor"] });
    } catch (e) { const message = getApiErrorMessage(e, "Payment failed. Confirm the amount due and retry."); setPaymentError(message); toast(message, "error"); }
    finally { setBusy(false); }
  }

  // Success screen
  if (paid) {
    return (
      <main className="flex min-h-screen items-center justify-center" style={{ background: "var(--ink-50)" }}>
        <div className="w-full max-w-sm rounded-[var(--r-xl)] p-8 text-center" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "var(--ok)", color: "var(--ink-0)" }}>
            <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h2 className="mt-4 font-serif text-[24px] font-bold" style={{ color: "var(--ink-900)" }}>Payment Complete</h2>
          <p className="mt-1 font-serif text-[32px] font-extrabold" style={{ color: "var(--ok)" }}>${total.toFixed(2)}</p>
          <p className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>Table {detail.tableCode} &middot; {payMethod}{splitMode === "equal" ? ` (split ${splitCount} ways)` : ""} &middot; {staffName}</p>
          {tip > 0 && <p className="text-[10px]" style={{ color: "var(--ok)" }}>Tip: ${tip.toFixed(2)}</p>}
          {receiptMethod && <p className="text-[10px]" style={{ color: "var(--ink-400)" }}>Receipt: {receiptMethod}</p>}
          <button onClick={() => router.push("/waiter/dashboard")} className="mt-6 w-full rounded-[var(--r-md)] py-3 text-[12px] font-semibold" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>Back to Dashboard</button>
        </div>
      </main>
    );
  }

  const payMethods: Array<{ key: "CASH" | "CARD" | "WALLET"; label: string; desc: string; icon: React.ReactNode }> = [
    { key: "CASH", label: "Cash", desc: "Count & confirm", icon: <svg {...sv}><rect x="1" y="6" width="22" height="12" rx="2" /><circle cx="12" cy="12" r="3" /></svg> },
    { key: "CARD", label: "Card Terminal", desc: "Swipe or tap", icon: <svg {...sv}><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg> },
    { key: "WALLET", label: "Digital Wallet", desc: "NFC / QR pay", icon: <svg {...sv}><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg> },
  ];

  const tipPresets = [10, 15, 20];
  const inputSt: React.CSSProperties = { border: "1px solid var(--ink-200)", color: "var(--ink-900)", background: "var(--ink-0)" };

  return (
    <main className="flex min-h-screen flex-col" style={{ background: "var(--ink-50)" }}>
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] font-serif text-[11px] font-extrabold italic" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>R</div>
          <div>
            <Link href={`/waiter/table/${tableId}`} className="flex items-center gap-1 text-[9px]" style={{ color: "var(--ink-500)" }}>
              <svg width={8} height={8} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>Back to Table
            </Link>
            <div className="text-[13px] font-bold" style={{ color: "var(--ink-900)" }}>Checkout & Close Table {detail.tableCode}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: "var(--ink-600)" }}>{staffName}</span>
          <div className="flex h-7 w-7 items-center justify-center rounded-full font-serif text-[10px] font-bold" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>{staffName.charAt(0) || "W"}</div>
        </div>
      </header>

      {/* Body: 3-column */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Order items */}
        <div className="hidden w-[240px] flex-shrink-0 flex-col lg:flex" style={{ background: "var(--ink-0)", borderRight: "1px solid var(--ink-200)" }}>
          <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--ink-200)" }}>
            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] font-serif text-[14px] font-extrabold" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>{detail.tableCode}</div>
            <div>
              <div className="text-[11px] font-medium" style={{ color: "var(--ink-700)" }}>{guests} guests &middot; {payableOrders.length} served orders</div>
              <div className="text-[9px]" style={{ color: "var(--ink-500)" }}>{staffName}</div>
            </div>
          </div>
          <div className="flex-1 overflow-auto px-4 py-3">
            <span className="font-mono text-[8px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Order Items</span>
            {pendingServiceOrders.length > 0 && (
              <div className="mt-2 rounded-[8px] px-2.5 py-2 text-[9px]" style={{ background: "var(--warn-soft)", color: "var(--warn)", border: "1px solid #fde68a" }}>
                {pendingServiceOrders.length} order{pendingServiceOrders.length === 1 ? "" : "s"} not served yet and excluded from payment.
              </div>
            )}
            <div className="mt-2">
              {allItems.map(oi => (
                <div key={oi.id} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--ink-100)" }}>
                  <div className="flex items-center gap-2">
                    <span className="flex h-4 w-4 items-center justify-center rounded font-mono text-[8px] font-bold" style={{ background: "var(--ink-100)", color: "var(--ink-600)" }}>{oi.quantity}</span>
                    <span className="text-[10px] font-medium" style={{ color: "var(--ink-900)" }}>{oi.menuItem?.name}</span>
                  </div>
                  <span className="font-mono text-[10px] font-bold" style={{ color: "var(--ink-700)" }}>${parseFloat(oi.lineTotal).toFixed(2)}</span>
                </div>
              ))}
            </div>
            {/* Add Items — goes back to table workspace */}
            <Link href={`/waiter/table/${tableId}`} className="mt-3 flex w-full items-center justify-center rounded-[var(--r-md)] py-2 text-[9px] font-semibold" style={{ border: "1px dashed var(--ink-300)", color: "var(--ink-500)" }}>+ Add Items</Link>
          </div>
        </div>

        {/* Center: Payment controls */}
        <div className="flex-1 overflow-auto p-5">
          <div className="mx-auto max-w-xl">
            {/* Payment Method */}
            <span className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Choose Payment Method</span>
            {paymentError && (
              <InlineAlert tone="error" title="Payment not completed" className="mt-3">
                {paymentError}
              </InlineAlert>
            )}
            {payableOrders.length === 0 && (
              <InlineAlert tone="info" title="No amount due" className="mt-3">
                Only served or completed orders can be paid from checkout.
              </InlineAlert>
            )}
            <div className="mt-3 grid grid-cols-3 gap-3">
              {payMethods.map(m => (
                <button key={m.key} onClick={() => setPayMethod(m.key)}
                  className="flex flex-col items-center gap-2 rounded-[var(--r-lg)] p-4 transition"
                  style={{ background: payMethod === m.key ? "var(--ink-900)" : "var(--ink-0)", color: payMethod === m.key ? "var(--ink-0)" : "var(--ink-700)", border: `2px solid ${payMethod === m.key ? "var(--ink-900)" : "var(--ink-200)"}` }}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: payMethod === m.key ? "rgba(255,255,255,0.12)" : "var(--ink-100)", color: payMethod === m.key ? "var(--ink-0)" : "var(--ink-500)" }}>{m.icon}</div>
                  <span className="text-[10px] font-semibold">{m.label}</span>
                  <span className="text-[7px]" style={{ opacity: 0.6 }}>{m.desc}</span>
                </button>
              ))}
            </div>

            {/* Split Bill Options */}
            <div className="mt-5">
              <span className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Split Bill Options</span>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {([
                  { key: "none" as const, label: "No Split", desc: "Full bill" },
                  { key: "equal" as const, label: "Equal Split", desc: `${guests} guests` },
                  { key: "custom" as const, label: "Custom", desc: "Enter amount" },
                ]).map(opt => (
                  <button key={opt.key} onClick={() => { setSplitMode(opt.key); if (opt.key === "equal") setSplitCount(guests); }}
                    className="flex items-center gap-2 rounded-[var(--r-md)] p-3 text-left transition"
                    style={{ background: splitMode === opt.key ? "var(--ok-soft)" : "var(--ink-0)", border: `2px solid ${splitMode === opt.key ? "var(--ok)" : "var(--ink-200)"}` }}>
                    <div className="flex h-4 w-4 items-center justify-center rounded-full flex-shrink-0"
                      style={{ border: `2px solid ${splitMode === opt.key ? "var(--ok)" : "var(--ink-300)"}`, background: splitMode === opt.key ? "var(--ok)" : "transparent" }}>
                      {splitMode === opt.key && <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ink-0)" }} />}
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold" style={{ color: "var(--ink-900)" }}>{opt.label}</div>
                      <div className="text-[8px]" style={{ color: "var(--ink-500)" }}>{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
              {/* Equal split count */}
              {splitMode === "equal" && (
                <div className="mt-2 flex items-center gap-3 rounded-[var(--r-md)] p-3" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
                  <span className="text-[10px]" style={{ color: "var(--ink-600)" }}>Split between</span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setSplitCount(Math.max(2, splitCount - 1))} className="flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold" style={{ border: "1px solid var(--ink-200)" }}>&minus;</button>
                    <span className="w-6 text-center font-mono text-[13px] font-bold">{splitCount}</span>
                    <button onClick={() => setSplitCount(splitCount + 1)} className="flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold" style={{ border: "1px solid var(--ink-200)" }}>+</button>
                  </div>
                  <span className="text-[10px]" style={{ color: "var(--ink-500)" }}>guests</span>
                  <span className="ml-auto font-mono text-[12px] font-bold" style={{ color: "var(--ok)" }}>${perPerson.toFixed(2)} each</span>
                </div>
              )}
            </div>

            {/* Tip */}
            <div className="mt-5">
              <span className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Add Tip</span>
              <div className="mt-2 flex items-center gap-2">
                {tipPresets.map(pct => {
                  const amt = (subtotal * pct / 100);
                  const isSelected = tipAmount === amt.toFixed(2);
                  return (
                    <button key={pct} onClick={() => setTipAmount(isSelected ? "" : amt.toFixed(2))}
                      className="flex-1 rounded-[var(--r-md)] py-2 text-center text-[10px] font-semibold transition"
                      style={{ background: isSelected ? "var(--accent)" : "var(--ink-0)", color: isSelected ? "var(--ink-0)" : "var(--ink-700)", border: `1px solid ${isSelected ? "var(--accent)" : "var(--ink-200)"}` }}>
                      {pct}% (${amt.toFixed(2)})
                    </button>
                  );
                })}
                <div className="flex items-center rounded-[var(--r-md)] overflow-hidden" style={{ border: "1px solid var(--ink-200)" }}>
                  <span className="px-2 text-[10px]" style={{ background: "var(--ink-50)", color: "var(--ink-500)", borderRight: "1px solid var(--ink-200)" }}>$</span>
                  <input type="number" step="0.01" value={tipAmount} onChange={e => setTipAmount(e.target.value)} placeholder="0.00"
                    className="w-16 px-2 py-2 text-[11px] font-bold outline-none" style={{ color: "var(--ink-900)" }} />
                </div>
              </div>
            </div>

            {/* Surcharge */}
            <div className="mt-5">
              <span className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Add Surcharge</span>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex flex-1 items-center rounded-[var(--r-md)] overflow-hidden" style={{ border: "1px solid var(--ink-200)" }}>
                  <span className="px-2 py-2 text-[10px]" style={{ background: "var(--ink-50)", color: "var(--ink-500)", borderRight: "1px solid var(--ink-200)" }}>$</span>
                  <input type="number" step="0.01" value={surchargeAmount} onChange={e => { setSurchargeAmount(e.target.value); setSurchargeApplied(false); }} placeholder="0.00"
                    className="flex-1 px-2 py-2 text-[11px] font-bold outline-none" style={{ color: "var(--ink-900)" }} disabled={surchargeApplied} />
                </div>
                <button onClick={handleApplySurcharge} disabled={busy || surchargeApplied || !surchargeAmount || serviceCharge <= 0 || payableOrders.length === 0}
                  className="rounded-[var(--r-md)] px-4 py-2 text-[10px] font-semibold transition disabled:opacity-40"
                  style={{ background: surchargeApplied ? "var(--ok)" : "var(--ink-900)", color: "var(--ink-0)" }}>
                  {surchargeApplied ? "Applied ✓" : "Apply"}
                </button>
              </div>
            </div>

            {/* Process Payment */}
            <button onClick={handlePayment} disabled={busy || allItems.length === 0}
              className="mt-5 w-full rounded-[var(--r-md)] py-4 text-[13px] font-semibold transition disabled:opacity-50"
              style={{ background: "var(--ok)", color: "var(--ink-0)" }}>
              {busy ? "Processing..." : allItems.length === 0 ? "No served orders to pay" : `Process ${payMethod} Payment${splitMode === "equal" ? ` (${splitCount}-way split)` : ""} — $${total.toFixed(2)}`}
            </button>
            <Link href={`/waiter/table/${tableId}`} className="mt-2 flex w-full items-center justify-center py-2 text-[11px]" style={{ color: "var(--ink-500)" }}>Cancel</Link>
          </div>
        </div>

        {/* Right: Summary + Receipt */}
        <div className="hidden w-[240px] flex-shrink-0 flex-col lg:flex" style={{ borderLeft: "1px solid var(--ink-200)", background: "var(--ink-0)" }}>
          <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--ink-200)" }}>
            <span className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Payment Summary</span>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="rounded-[var(--r-lg)] p-4 text-center mb-4" style={{ background: "var(--ink-50)" }}>
              <span className="font-mono text-[8px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Grand Total</span>
              <div className="font-serif text-[28px] font-extrabold" style={{ color: "var(--ink-900)" }}>${total.toFixed(2)}</div>
              {splitMode === "equal" && <div className="font-mono text-[9px]" style={{ color: "var(--ok)" }}>${perPerson.toFixed(2)} per person</div>}
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px]"><span style={{ color: "var(--ink-500)" }}>Subtotal</span><span className="font-mono font-medium" style={{ color: "var(--ink-700)" }}>${subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-[10px]"><span style={{ color: "var(--ink-500)" }}>Tax</span><span className="font-mono font-medium" style={{ color: "var(--ink-700)" }}>${tax.toFixed(2)}</span></div>
              {serviceCharge > 0 && <div className="flex justify-between text-[10px]"><span style={{ color: "var(--ink-500)" }}>Surcharge</span><span className="font-mono font-medium" style={{ color: "var(--warn)" }}>${serviceCharge.toFixed(2)}{surchargeApplied ? " ✓" : ""}</span></div>}
              {tip > 0 && <div className="flex justify-between text-[10px]"><span style={{ color: "var(--ink-500)" }}>Tip</span><span className="font-mono font-medium" style={{ color: "var(--ok)" }}>${tip.toFixed(2)}</span></div>}
              <div className="flex justify-between text-[10px]"><span style={{ color: "var(--ink-500)" }}>Method</span><span className="font-mono font-medium" style={{ color: "var(--accent)" }}>{payMethod}{splitMode === "equal" ? ` ÷${splitCount}` : ""}</span></div>
              <div className="flex justify-between text-[11px] font-bold pt-2 mt-1" style={{ borderTop: "1px solid var(--ink-200)" }}>
                <span style={{ color: "var(--ink-900)" }}>Due</span>
                <span className="font-serif text-[15px]" style={{ color: "var(--accent)" }}>${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Receipt Options — functional tracking */}
            <div className="mt-5">
              <span className="font-mono text-[8px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Receipt Options</span>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {[
                  { key: "email", label: "Email", icon: <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg> },
                  { key: "print", label: "Print", icon: <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg> },
                  { key: "sms", label: "SMS", icon: <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg> },
                  { key: "none", label: "No Receipt", icon: <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg> },
                ].map(r => (
                  <button key={r.key} onClick={() => setReceiptMethod(receiptMethod === r.key ? null : r.key)}
                    className="flex flex-col items-center gap-1 rounded-[var(--r-md)] py-2 text-center text-[9px] font-semibold transition"
                    style={{ background: receiptMethod === r.key ? "var(--ok-soft)" : "var(--ink-50)", color: receiptMethod === r.key ? "var(--ok)" : "var(--ink-600)", border: `1px solid ${receiptMethod === r.key ? "#bbf7d0" : "var(--ink-200)"}` }}>
                    {r.icon}
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mark as Paid — shortcut for cash, no split */}
            <button onClick={() => { setPayMethod("CASH"); setSplitMode("none"); handlePayment(); }}
              disabled={busy || allItems.length === 0}
              className="mt-4 w-full rounded-[var(--r-md)] py-2.5 text-[10px] font-semibold disabled:opacity-50"
              style={{ background: "var(--accent-soft)", color: "var(--accent-ink)", border: "1px solid var(--accent-edge)" }}>
              Quick: Mark as Paid (Cash)
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
