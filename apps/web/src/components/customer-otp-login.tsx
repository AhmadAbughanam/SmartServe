"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { post } from "../lib/api";
import {
  clearCustomerAuth,
  getCustomerPhone,
  isCustomerLoggedIn,
  setCustomerPhone,
  setCustomerRefresh,
  setCustomerToken,
} from "../lib/customer-auth";

const COPPER = "#0c0a09";
const COPPER_EDGE = "#e7e5e4";
const COPPER_INK = "#1c1917";
const OK = "#16a34a";
const OK_DARK = "#15803d";

interface OtpResponse {
  message: string;
  expiresInSeconds: number;
  _dev_otp?: string;
}

interface VerifyResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; phone: string; name: string };
}

const COUNTRIES = [
  { code: "+962", flag: "🇯🇴" },
  { code: "+966", flag: "🇸🇦" },
  { code: "+971", flag: "🇦🇪" },
  { code: "+20", flag: "🇪🇬" },
  { code: "+1", flag: "🇺🇸" },
  { code: "+44", flag: "🇬🇧" },
];

interface CustomerOtpLoginProps {
  onBack?: () => void;
}

export function CustomerOtpLogin({ onBack }: CustomerOtpLoginProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<"phone" | "otp">("phone");
  const [country, setCountry] = useState("+962");
  const [phone, setPhone] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const loggedIn = typeof window !== "undefined" && isCustomerLoggedIn();

  const otp = otpDigits.join("");
  const fullPhone = country + phone.replace(/\D/g, "");

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (phase === "otp" && inputs.current[0]) inputs.current[0].focus();
  }, [phase]);

  async function handleSendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    if (!phone) return;
    setLoading(true);
    setError(null);
    try {
      const res = await post<OtpResponse>("/api/auth/customer/otp/request", { phone: fullPhone });
      if (res._dev_otp) setDevOtp(res._dev_otp);
      setPhase("otp");
      setResendIn(30);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e?: React.FormEvent) {
    e?.preventDefault();
    if (otp.length < 6) return;
    setLoading(true);
    setError(null);
    try {
      const res = await post<VerifyResponse>("/api/auth/customer/otp/verify", { phone: fullPhone, code: otp });
      setCustomerToken(res.accessToken);
      setCustomerRefresh(res.refreshToken);
      setCustomerPhone(res.user.phone);
      router.push("/customer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid OTP");
      setOtpDigits(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(index: number, val: string) {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < 5) inputs.current[index + 1]?.focus();
  }

  function handleOtpKey(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === "ArrowLeft" && index > 0) inputs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) inputs.current[index + 1]?.focus();
  }

  function handleOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = pasted.split("").concat(["", "", "", "", "", ""]).slice(0, 6);
    setOtpDigits(next);
    inputs.current[Math.min(pasted.length, 5)]?.focus();
  }

  function handleBack() {
    if (onBack) {
      onBack();
      return;
    }
    router.push("/login");
  }

  if (loggedIn) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-5" style={{ background: "var(--ink-50)" }}>
        <div className="w-full max-w-sm rounded-[16px] p-7 text-center" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <button
            onClick={handleBack}
            aria-label="Back"
            className="mb-5 flex h-10 w-10 items-center justify-center rounded-[12px]"
            style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--ink-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ background: OK, color: "#fff" }}>
            <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h1 className="mt-4 font-serif text-[22px] font-extrabold" style={{ color: "var(--ink-900)" }}>You&apos;re signed in</h1>
          <p className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>{getCustomerPhone()}</p>
          <div className="mt-5 flex gap-2">
            <button onClick={() => router.push("/customer")} className="flex-1 rounded-[12px] py-3 text-[12px] font-semibold text-white" style={{ background: COPPER }}>Continue</button>
            <button onClick={() => { clearCustomerAuth(); router.refresh(); }} className="rounded-[12px] px-4 py-3 text-[12px] font-semibold" style={{ background: "var(--ink-0)", color: "var(--ink-700)", border: "1px solid var(--ink-200)" }}>Sign out</button>
          </div>
        </div>
      </main>
    );
  }

  return (
      <main className="flex min-h-screen flex-col" style={{ background: "var(--ink-50)" }}>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col px-5 pb-8 pt-5">
        <button onClick={handleBack} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-[12px]" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--ink-700)" strokeWidth={2} strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>

        <div className="mt-6">
          <h1 className="font-serif text-[30px] font-extrabold leading-tight" style={{ color: COPPER_INK }}>Welcome back!</h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--ink-500)" }}>Login with your mobile number</p>
        </div>

        <form onSubmit={handleSendOtp} className="mt-6">
          <label className="text-[11px] font-medium" style={{ color: "var(--ink-700)" }}>Mobile Number</label>
          <div className="mt-1.5 flex items-stretch gap-2">
            <div className="relative flex items-center rounded-[10px] px-2.5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
              <span className="text-[14px]">{COUNTRIES.find((c) => c.code === country)?.flag}</span>
              <span className="ml-1 text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>{country}</span>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--ink-400)" strokeWidth={2} strokeLinecap="round" className="ml-1"><polyline points="6 9 12 15 18 9" /></svg>
              <select value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country code" className="absolute inset-0 cursor-pointer opacity-0">
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
              </select>
            </div>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98765 43210"
              autoFocus
              className="flex-1 rounded-[10px] px-3 py-3 text-[14px] outline-none"
              style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
            />
          </div>

          <button type="submit" disabled={loading || !phone}
            className="mt-4 w-full rounded-[12px] py-3.5 text-[13px] font-semibold text-white transition disabled:opacity-50 active:scale-[0.98]"
            style={{ background: COPPER }}>
            {loading && phase === "phone" ? "Sending..." : "Send OTP"}
          </button>

          <div className="mt-3 flex items-start gap-2.5 rounded-[12px] p-3" style={{ background: "var(--ok-soft)", border: "1px solid #bbf7d0" }}>
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "#bbf7d0", color: OK_DARK }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 11 12 14 16 9" /></svg>
            </span>
            <span className="pt-0.5 text-[11px] leading-snug" style={{ color: OK_DARK }}>We will send a 6-digit OTP to your registered mobile number</span>
          </div>
        </form>

        {phase === "otp" && (
          <form onSubmit={handleVerify} className="mt-5 pt-5" style={{ borderTop: "1px solid var(--ink-200)" }}>
            <label className="text-[11px] font-medium" style={{ color: "var(--ink-700)" }}>Enter OTP</label>
            <div className="mt-2.5 flex justify-between gap-2">
              {otpDigits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => { inputs.current[i] = el; }}
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKey(i, e)}
                  onPaste={i === 0 ? handleOtpPaste : undefined}
                  className="h-12 w-11 rounded-[10px] text-center text-[18px] font-semibold outline-none transition"
                  style={{ background: "var(--ink-0)", border: `1px solid ${d ? COPPER : "var(--ink-200)"}`, color: "var(--ink-900)" }}
                />
              ))}
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[10px]" style={{ color: "var(--ink-500)" }}>
              <span>OTP sent to <strong style={{ color: "var(--ink-900)" }}>{fullPhone}</strong></span>
              {resendIn > 0 ? (
                <span>Resend OTP in 00:{resendIn.toString().padStart(2, "0")}</span>
              ) : (
                <button type="button" onClick={handleSendOtp} className="font-semibold underline" style={{ color: COPPER }}>Resend OTP</button>
              )}
            </div>

            {devOtp && (
              <div className="mt-3 rounded-[10px] px-3 py-2 text-center" style={{ background: "var(--warn-soft)", border: "1px dashed #fde68a" }}>
                <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "var(--warn)" }}>Dev OTP &middot; </span>
                <span className="font-mono text-[12px] font-bold tracking-[0.25em]" style={{ color: "#78350f" }}>{devOtp}</span>
              </div>
            )}

            <button type="submit" disabled={loading || otp.length < 6}
              className="mt-4 w-full rounded-[12px] py-3.5 text-[13px] font-semibold text-white transition disabled:opacity-50 active:scale-[0.98]"
              style={{ background: COPPER }}>
              {loading ? "Verifying..." : "Login"}
            </button>
          </form>
        )}

        {error && (
          <div className="mt-3 rounded-[10px] px-3 py-2 text-[11px]" style={{ background: "var(--bad-soft)", border: "1px solid #fecaca", color: "var(--bad)" }}>{error}</div>
        )}

        <div className="mt-auto flex items-center justify-center gap-2 pt-6 text-[11px]" style={{ color: "var(--ink-500)" }}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: "#bbf7d0", color: OK_DARK }}>
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
          </span>
          Your data is secure with us
        </div>
      </div>
    </main>
  );
}
