"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { get, ApiError } from "../../lib/api";
import type { TableAccessResult } from "../../lib/types";
import { Cloche } from "../../components/ui";

const COPPER = "#c2841d";
const COPPER_SOFT = "#fdf2e2";
const COPPER_EDGE = "#f1d9a8";
const OK = "#16a34a";

export default function CustomerCheckInPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true); setError(null);
    try {
      // Validate the code resolves before forwarding to /customer/start.
      await get<TableAccessResult>(`/api/table-access/${encodeURIComponent(trimmed)}`);
      router.push(`/customer/start?code=${encodeURIComponent(trimmed)}`);
    } catch (e) {
      const msg = e instanceof ApiError && e.status === 404 ? "We couldn't find that code. Check and try again." :
                   e instanceof Error ? e.message : "Invalid branch or table code";
      setError(msg);
    } finally { setLoading(false); }
  }

  return (
    <main className="flex min-h-screen flex-col" style={{ background: "var(--ink-50)" }}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-6 pt-7">
        {/* Brand */}
        <div className="text-center">
          <Cloche size={34} color={COPPER} />
          <h1 className="mt-1.5 font-serif text-[15px] font-semibold tracking-[0.22em]" style={{ color: "var(--ink-900)" }}>TASTE HOUSE</h1>
          <p className="mt-0.5 font-serif text-[8px] font-medium tracking-[0.3em]" style={{ color: COPPER }}>CAFÉ &middot; KITCHEN</p>
        </div>

        {/* Welcome */}
        <div className="mt-6 text-center">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: COPPER }}>Welcome to</p>
          <h2 className="mt-2 font-serif text-[28px] font-extrabold leading-tight" style={{ color: "var(--ink-900)" }}>Smart <em className="font-serif italic font-medium" style={{ color: COPPER }}>dining.</em></h2>
          <p className="mt-1.5 text-[12px]" style={{ color: "var(--ink-500)" }}>Let&apos;s get you started.</p>
        </div>

        {/* Check-in card */}
        <form onSubmit={handleContinue} className="mt-6 rounded-[16px] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", boxShadow: "0 1px 3px rgba(12,10,9,0.04)" }}>
          <h3 className="text-center font-serif text-[18px] font-bold" style={{ color: "var(--ink-900)" }}>Check in to your branch</h3>
          <p className="mt-1.5 text-center text-[11px] leading-relaxed" style={{ color: "var(--ink-500)" }}>Scan the QR code at the branch<br />or enter the branch code / table number</p>

          {/* QR illustration */}
          <div className="mt-4 flex justify-center">
            <div className="relative flex h-[124px] w-[124px] items-center justify-center rounded-[14px]" style={{ background: COPPER_SOFT }}>
              <span className="absolute left-2.5 top-2.5 h-4 w-4 rounded-tl-[4px]" style={{ borderTop: `3px solid ${COPPER}`, borderLeft: `3px solid ${COPPER}` }} />
              <span className="absolute right-2.5 top-2.5 h-4 w-4 rounded-tr-[4px]" style={{ borderTop: `3px solid ${COPPER}`, borderRight: `3px solid ${COPPER}` }} />
              <span className="absolute left-2.5 bottom-2.5 h-4 w-4 rounded-bl-[4px]" style={{ borderBottom: `3px solid ${COPPER}`, borderLeft: `3px solid ${COPPER}` }} />
              <span className="absolute right-2.5 bottom-2.5 h-4 w-4 rounded-br-[4px]" style={{ borderBottom: `3px solid ${COPPER}`, borderRight: `3px solid ${COPPER}` }} />
              <svg width={56} height={56} viewBox="0 0 24 24" fill="none" stroke={COPPER} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <path d="M14 14h2v2h-2zM18 14h3M14 18h3M18 18v3" />
              </svg>
            </div>
          </div>

          {/* Scan button */}
          <button
            type="button"
            onClick={() => setError("Camera scanning isn't enabled on this device — enter your code below.")}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-[12px] py-3 text-[13px] font-semibold text-white transition active:scale-[0.98]"
            style={{ background: COPPER }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
              <rect x="7" y="7" width="10" height="10" />
            </svg>
            Scan QR Code
          </button>

          {/* OR divider */}
          <div className="my-4 flex items-center gap-2.5">
            <div className="h-px flex-1" style={{ background: "var(--ink-200)" }} />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--ink-400)" }}>OR</span>
            <div className="h-px flex-1" style={{ background: "var(--ink-200)" }} />
          </div>

          {/* Manual input */}
          <label className="block text-[11px] font-medium" style={{ color: "var(--ink-700)" }}>Enter Branch Code / Table Number</label>
          <div className="mt-1.5 flex items-center rounded-[10px] px-3" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(null); }}
              placeholder="e.g. BLR001 / T12"
              className="flex-1 bg-transparent py-3 text-[13px] outline-none"
              style={{ color: "var(--ink-900)" }}
              autoComplete="off"
              autoCapitalize="characters"
            />
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--ink-400)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>

          {error && (
            <div className="mt-3 rounded-[10px] px-3 py-2 text-[11px]" style={{ background: "var(--bad-soft)", border: "1px solid #fecaca", color: "var(--bad)" }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="mt-4 w-full rounded-[12px] py-3 text-[13px] font-semibold transition disabled:opacity-50 active:scale-[0.98]"
            style={{ background: COPPER_SOFT, color: COPPER, border: `1px solid ${COPPER_EDGE}` }}
          >
            {loading ? "Checking..." : "Continue"}
          </button>
        </form>

        {/* Info chips */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { label: "Secure & Private", icon: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>, color: OK, soft: "var(--ok-soft)" },
            { label: "Faster Service", icon: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>, color: COPPER, soft: COPPER_SOFT },
            { label: "Paperless", icon: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2c1 1.5 1 5-1 8.5-1.7 3.06-3.81 6.39-7 7.5" /><path d="M2 21c0-3 1.85-5.36 5.08-6" /></svg>, color: OK, soft: "var(--ok-soft)" },
          ].map(c => (
            <div key={c.label} className="flex flex-col items-center gap-1.5 rounded-[12px] px-2 py-3 text-center" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: c.soft, color: c.color }}>{c.icon}</span>
              <span className="text-[10px] font-semibold leading-tight" style={{ color: "var(--ink-700)" }}>{c.label}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-auto flex flex-col items-center gap-2 pt-6">
          <button onClick={() => router.push("/customer/login")} className="text-[11px] font-semibold underline underline-offset-[3px]" style={{ color: COPPER }}>
            Already have an account? Sign in
          </button>
          <p className="text-[10px]" style={{ color: "var(--ink-400)" }}>Need help? Contact branch staff</p>
        </div>
      </div>
    </main>
  );
}
