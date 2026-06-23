"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authGet, authPost } from "../../../lib/api";
import { clearStaffToken, getStaffRole, hasStaffSession } from "../../../lib/staff-auth";
import { LoadingScreen, useToast } from "../../../components/ui";
import { CashierNav } from "../cashier-nav";

interface Coupon {
  id: string;
  code: string;
  isActive: boolean;
  expiresAt: string | null;
  maxRedemptions: number | null;
  perUserLimit: number | null;
  discount: { name: string; type: string; value: string; isActive: boolean };
}

interface GiftCard {
  id: string;
  code: string;
  initialAmount: string;
  balanceAmount: string;
  status: string;
  expiresAt: string | null;
}

const sv = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export default function CashierPromotionsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();
  const [role, setRole] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [giftCode, setGiftCode] = useState("");
  const [giftAmount, setGiftAmount] = useState("");
  const [selectedGiftCard, setSelectedGiftCard] = useState<GiftCard | null>(null);
  const [couponResult, setCouponResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hasStaffSession("waiter")) { router.push("/waiter/login"); return; }
    setRole(getStaffRole("waiter") ?? "");
  }, [router]);

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["cashier-coupons"],
    queryFn: () => authGet<Coupon[]>("/api/promotions/coupons?active=true"),
    enabled: role === "CASHIER",
  });

  const { data: giftCards } = useQuery({
    queryKey: ["cashier-gift-cards"],
    queryFn: () => authGet<GiftCard[]>("/api/promotions/gift-cards?status=ACTIVE"),
    enabled: role === "CASHIER",
  });

  async function validateCoupon() {
    if (!couponCode.trim()) return;
    setBusy(true);
    try {
      const result = await authPost("/api/promotions/coupons/validate", undefined, { code: couponCode.trim() });
      setCouponResult(result);
      toast("Coupon checked");
    } catch (e) {
      setCouponResult(null);
      toast(e instanceof Error ? e.message : "Coupon is not valid", "error");
    } finally {
      setBusy(false);
    }
  }

  async function redeemGiftCard() {
    if (!selectedGiftCard || !giftAmount) return;
    setBusy(true);
    try {
      await authPost(`/api/promotions/gift-cards/${selectedGiftCard.id}/redeem`, undefined, { amount: parseFloat(giftAmount) });
      toast("Gift card redeemed");
      setGiftAmount("");
      setSelectedGiftCard(null);
      qc.invalidateQueries({ queryKey: ["cashier-gift-cards"] });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Gift card redemption failed", "error");
    } finally {
      setBusy(false);
    }
  }

  const filteredGiftCards = (giftCards ?? []).filter(g => !giftCode.trim() || g.code.toLowerCase().includes(giftCode.toLowerCase().trim()));

  if (role && role !== "CASHIER") {
    return (
      <div className="flex h-full flex-col" style={{ minHeight: "100%" }}>
        <CashierNav />
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
          <div className="max-w-sm rounded-[var(--r-lg)] p-6" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <h1 className="font-serif text-[22px] font-extrabold" style={{ color: "var(--ink-900)" }}>Cashier access required</h1>
            <p className="mt-2 text-[12px]" style={{ color: "var(--ink-500)" }}>Promotion checkout tools are available only to cashier staff.</p>
            <button onClick={() => { clearStaffToken("waiter"); router.push("/waiter/login"); }} className="mt-4 rounded-[var(--r-md)] px-4 py-2 text-[12px] font-semibold" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>Open Cashier Login</button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) return <LoadingScreen message="Loading cashier promotions..." />;

  return (
    <div className="flex h-full flex-col" style={{ minHeight: "100%" }}>
      <CashierNav />
      <div className="px-7 py-4" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        <h1 className="font-serif text-[22px] font-extrabold tracking-tight leading-none" style={{ color: "var(--ink-900)" }}>Cashier <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Promotions</em></h1>
        <p className="mt-1 text-[11px]" style={{ color: "var(--ink-500)" }}>Check active coupons and redeem gift cards during checkout. Owner promotion management remains in Admin.</p>
      </div>

      <div className="grid flex-1 gap-4 overflow-auto p-6 px-7 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent-edge)" }}><svg {...sv}><path d="M20.59 13.41 13.41 20.59a2 2 0 0 1-2.82 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" /><path d="M7 7h.01" /></svg></div>
            <h2 className="font-serif text-[16px] font-bold" style={{ color: "var(--ink-900)" }}>Coupon Lookup</h2>
          </div>
          <div className="flex gap-2">
            <input value={couponCode} onChange={e => setCouponCode(e.target.value)} placeholder="Enter coupon code"
              className="flex-1 rounded-[var(--r-md)] px-3 py-2.5 text-[12px] outline-none"
              style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
            <button onClick={validateCoupon} disabled={busy || !couponCode.trim()} className="rounded-[var(--r-md)] px-4 py-2.5 text-[12px] font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>Check</button>
          </div>
          {couponResult !== null && (
            <div className="mt-3 rounded-[var(--r-md)] p-3 text-[12px]" style={{ background: "var(--ok-soft)", color: "var(--ok)", border: "1px solid #bbf7d0" }}>Coupon is valid for checkout.</div>
          )}
          <div className="mt-5 space-y-2">
            {(coupons ?? []).slice(0, 8).map(c => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-[var(--r-md)] px-3 py-2" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
                <div className="min-w-0">
                  <div className="font-mono text-[12px] font-bold" style={{ color: "var(--ink-900)" }}>{c.code}</div>
                  <div className="truncate text-[10px]" style={{ color: "var(--ink-500)" }}>{c.discount.name}</div>
                </div>
                <span className="font-serif text-[15px] font-bold" style={{ color: "var(--accent)" }}>{c.discount.type === "PERCENT" ? `${parseFloat(c.discount.value).toFixed(0)}%` : `$${parseFloat(c.discount.value).toFixed(2)}`}</span>
              </div>
            ))}
            {(coupons ?? []).length === 0 && <p className="py-4 text-center text-[11px]" style={{ color: "var(--ink-400)" }}>No active coupons.</p>}
          </div>
        </section>

        <section className="rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent-edge)" }}><svg {...sv}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg></div>
            <h2 className="font-serif text-[16px] font-bold" style={{ color: "var(--ink-900)" }}>Gift Cards</h2>
          </div>
          <input value={giftCode} onChange={e => setGiftCode(e.target.value)} placeholder="Search gift card code"
            className="w-full rounded-[var(--r-md)] px-3 py-2.5 text-[12px] outline-none"
            style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
          <div className="mt-3 max-h-72 space-y-2 overflow-auto">
            {filteredGiftCards.slice(0, 10).map(g => (
              <button key={g.id} onClick={() => { setSelectedGiftCard(g); setGiftCode(g.code); }}
                className="flex w-full items-center justify-between gap-3 rounded-[var(--r-md)] px-3 py-2 text-left"
                style={{ background: selectedGiftCard?.id === g.id ? "var(--accent-soft)" : "var(--ink-50)", border: `1px solid ${selectedGiftCard?.id === g.id ? "var(--accent-edge)" : "var(--ink-100)"}` }}>
                <span className="font-mono text-[12px] font-bold" style={{ color: "var(--ink-900)" }}>{g.code}</span>
                <span className="font-serif text-[15px] font-bold" style={{ color: "var(--accent)" }}>${parseFloat(g.balanceAmount).toFixed(2)}</span>
              </button>
            ))}
            {filteredGiftCards.length === 0 && <p className="py-4 text-center text-[11px]" style={{ color: "var(--ink-400)" }}>No active gift cards found.</p>}
          </div>

          <div className="mt-4 rounded-[var(--r-md)] p-3" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
            <div className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Redeem selected gift card</div>
            <div className="mt-2 flex gap-2">
              <input value={giftAmount} onChange={e => setGiftAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="Amount"
                className="flex-1 rounded-[var(--r-md)] px-3 py-2.5 text-[12px] outline-none"
                style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
              <button onClick={redeemGiftCard} disabled={busy || !selectedGiftCard || !giftAmount}
                className="rounded-[var(--r-md)] px-4 py-2.5 text-[12px] font-semibold disabled:opacity-50"
                style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>Redeem</button>
            </div>
            {selectedGiftCard && <p className="mt-2 text-[10px]" style={{ color: "var(--ink-500)" }}>Selected: {selectedGiftCard.code} / balance ${parseFloat(selectedGiftCard.balanceAmount).toFixed(2)}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
