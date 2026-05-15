"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { post } from "../lib/api";
import { setStaffToken, setStaffBranchId, setStaffName, setStaffRole, setStaffTenantId } from "../lib/staff-auth";
import type { StaffLoginResponse } from "../lib/kds-types";

interface StaffLoginFormProps {
  title: string;
  subtitle: string;
  icon: string;
  redirectTo: string;
  requiredPermissions: string[];
  permissionMode: "all" | "some";
  deniedMessage: string;
  placeholder?: string;
  accentColor: string;
  accentHover: string;
  theme: "dark" | "light" | "indigo";
  desktopLayout?: boolean;
  routeLabel?: string;
}

export function StaffLoginForm({
  title, subtitle, redirectTo, requiredPermissions, permissionMode, deniedMessage, placeholder,
  theme, desktopLayout, routeLabel,
}: StaffLoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await post<StaffLoginResponse>("/api/auth/staff/login", { email, password });
      const hasAccess = permissionMode === "all"
        ? requiredPermissions.every((p) => res.staff.permissions.includes(p))
        : requiredPermissions.some((p) => res.staff.permissions.includes(p));
      if (!hasAccess) { setError(deniedMessage); return; }
      setStaffToken(res.accessToken);
      setStaffBranchId(res.staff.branchId);
      setStaffName(res.staff.name);
      setStaffRole(res.staff.primaryRole);
      setStaffTenantId(res.staff.tenantId);
      router.push(redirectTo);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally { setLoading(false); }
  }

  /* ── Desktop split-panel (admin) ── */
  if (desktopLayout) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6" style={{ background: "var(--ink-50)" }}>
        <div className="w-full max-w-[1100px] overflow-hidden rounded-[var(--r-xl)]" style={{ border: "var(--line)", background: "var(--ink-0)" }}>
          <div className="grid min-h-[600px] md:grid-cols-2">
            <div className="relative hidden flex-col overflow-hidden p-12 md:flex" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>
              <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at 20% 80%, rgba(249,115,22,0.25), transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(249,115,22,0.12), transparent 55%)" }} />
              <div className="relative z-10 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md font-serif text-lg font-extrabold italic" style={{ background: "var(--accent)", color: "var(--ink-900)" }}>R</div>
                <span className="font-serif text-lg font-bold">Restaurant <em className="font-serif italic font-medium">OS</em></span>
              </div>
              <div className="relative z-10 mt-auto font-serif text-[32px] italic font-medium leading-snug tracking-tight" style={{ maxWidth: 420 }}>
                &ldquo;The table, the kitchen, the books &mdash; one glass of water away from each other.&rdquo;
              </div>
              <div className="relative z-10 mt-6 font-mono text-[11px] tracking-wide" style={{ color: "rgba(255,255,255,0.6)" }}>&mdash; our operating principle, 2026</div>
            </div>
            <form onSubmit={handleLogin} className="flex flex-col justify-center p-10 md:p-14">
              <div className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>{subtitle}</div>
              <h1 className="mt-3.5 font-serif text-[40px] font-extrabold tracking-tight leading-none">Back at it,<em className="block font-serif italic font-medium" style={{ color: "var(--accent)" }}>boss.</em></h1>
              <p className="mt-2.5 max-w-[380px] text-sm leading-relaxed" style={{ color: "var(--ink-500)" }}>Enter your work email and password to access {title}.</p>
              <div className="mt-8 space-y-4 max-w-[380px]">
                <div className="relative">
                  <span className="absolute -top-[7px] left-3 px-1.5 font-mono text-[10px] font-medium" style={{ background: "var(--ink-0)", color: "var(--ink-500)" }}>Work email</span>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder={placeholder ?? "staff@demo.com"}
                    className="w-full rounded-[var(--r-md)] px-3.5 py-4 text-[15px] font-medium outline-none" style={{ border: "1px solid var(--ink-300)", color: "var(--ink-900)" }} />
                </div>
                <div className="relative">
                  <span className="absolute -top-[7px] left-3 px-1.5 font-mono text-[10px] font-medium" style={{ background: "var(--ink-0)", color: "var(--ink-500)" }}>Password</span>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="password123"
                    className="w-full rounded-[var(--r-md)] px-3.5 py-4 text-[15px] font-medium outline-none" style={{ border: "1px solid var(--ink-300)", color: "var(--ink-900)" }} />
                </div>
              </div>
              {routeLabel && (
                <div className="mt-3.5 flex max-w-[380px] items-center gap-2.5 rounded-[var(--r-md)] p-3" style={{ border: "1px dashed var(--ink-300)" }}>
                  <span className="font-serif italic" style={{ color: "var(--accent)" }}>&rarr;</span>
                  <span className="text-xs leading-snug" style={{ color: "var(--ink-700)" }}>{routeLabel}</span>
                </div>
              )}
              {error && <div className="mt-3 max-w-[380px] rounded-[var(--r-md)] p-3 text-sm" style={{ background: "var(--bad-soft)", border: "1px solid #fecaca", color: "var(--bad)" }}>{error}</div>}
              <button type="submit" disabled={loading} className="mt-6 w-full max-w-[380px] rounded-[var(--r-md)] py-4 text-sm font-semibold transition disabled:opacity-50" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>
                {loading ? "Signing in..." : "Enter station"}
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  /* ── Mobile layout (kitchen / waiter) ── */
  const isDark = theme === "dark";

  return (
    <main className="flex min-h-screen flex-col px-6 pb-6" style={{ background: isDark ? "var(--ink-900)" : "var(--ink-0)", color: isDark ? "var(--ink-0)" : "var(--ink-900)" }}>
      <div className="mt-6 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md font-serif text-base font-extrabold italic"
          style={{ background: isDark ? "var(--accent)" : "var(--ink-900)", color: isDark ? "var(--ink-900)" : "var(--ink-0)" }}>R</div>
        <span className="font-serif text-base font-bold">Restaurant <em className="font-serif italic font-medium">OS</em></span>
      </div>
      <div className="mt-12">
        <div className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>{subtitle}</div>
        <h1 className="mt-3.5 font-serif text-[44px] font-extrabold leading-none tracking-tight">Good<em className="block font-serif italic font-medium" style={{ color: "var(--accent)" }}>evening.</em></h1>
        <p className="mt-2.5 max-w-[260px] text-[13px] leading-relaxed" style={{ color: isDark ? "rgba(255,255,255,0.6)" : "var(--ink-500)" }}>{title} login. Enter your email and password.</p>
      </div>
      <form onSubmit={handleLogin} className="mt-9">
        <div className="relative">
          <span className="absolute -top-[7px] left-3 px-1.5 font-mono text-[10px] font-medium" style={{ background: isDark ? "var(--ink-900)" : "var(--ink-0)", color: "var(--ink-500)" }}>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder={placeholder ?? "staff@demo.com"}
            className="w-full rounded-[var(--r-md)] px-3.5 py-4 text-[15px] font-medium outline-none"
            style={{ border: `1px solid ${isDark ? "rgba(255,255,255,0.2)" : "var(--ink-300)"}`, background: "transparent", color: isDark ? "var(--ink-0)" : "var(--ink-900)" }} />
        </div>
        <div className="relative mt-4">
          <span className="absolute -top-[7px] left-3 px-1.5 font-mono text-[10px] font-medium" style={{ background: isDark ? "var(--ink-900)" : "var(--ink-0)", color: "var(--ink-500)" }}>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="password123"
            className="w-full rounded-[var(--r-md)] px-3.5 py-4 text-[15px] font-medium outline-none"
            style={{ border: `1px solid ${isDark ? "rgba(255,255,255,0.2)" : "var(--ink-300)"}`, background: "transparent", color: isDark ? "var(--ink-0)" : "var(--ink-900)" }} />
        </div>
        {routeLabel && (
          <div className="mt-3.5 flex items-center gap-2.5 rounded-[var(--r-md)] p-3" style={{ border: `1px dashed ${isDark ? "rgba(255,255,255,0.2)" : "var(--ink-300)"}` }}>
            <span className="font-serif italic" style={{ color: "var(--accent)" }}>&rarr;</span>
            <span className="text-xs leading-snug" style={{ color: isDark ? "rgba(255,255,255,0.7)" : "var(--ink-700)" }}>{routeLabel}</span>
          </div>
        )}
        {error && <div className="mt-3 rounded-[var(--r-md)] p-3 text-sm" style={{ background: isDark ? "rgba(220,38,38,0.1)" : "var(--bad-soft)", border: `1px solid ${isDark ? "rgba(220,38,38,0.2)" : "#fecaca"}`, color: isDark ? "#fca5a5" : "var(--bad)" }}>{error}</div>}
        <div className="mt-6 flex flex-col gap-2.5">
          <button type="submit" disabled={loading} className="w-full rounded-[var(--r-md)] py-4 text-sm font-semibold transition disabled:opacity-50"
            style={{ background: isDark ? "var(--accent)" : "var(--ink-900)", color: isDark ? "var(--ink-900)" : "var(--ink-0)" }}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
          <button type="button" onClick={() => router.push("/")} className="w-full py-2 text-[13px] font-medium underline underline-offset-[3px]"
            style={{ color: isDark ? "rgba(255,255,255,0.5)" : "var(--ink-500)" }}>Continue as guest instead</button>
        </div>
      </form>
      <div className="mt-auto pt-5 text-center font-mono text-[10px]" style={{ color: "var(--ink-500)" }}>Smart Restaurant OS &middot; {new Date().getFullYear()}</div>
    </main>
  );
}
