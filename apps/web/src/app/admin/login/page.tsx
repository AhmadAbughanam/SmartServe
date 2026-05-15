"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { post } from "../../../lib/api";
import { setStaffToken, setStaffBranchId, setStaffName, setStaffRole, setStaffTenantId } from "../../../lib/staff-auth";
import type { StaffLoginResponse } from "../../../lib/kds-types";
import Link from "next/link";

const REQUIRED_PERMISSIONS = ["admin:read", "analytics:read"];

export default function AdminLoginPage() {
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
      const hasAccess = REQUIRED_PERMISSIONS.some((p) => res.staff.permissions.includes(p));
      if (!hasAccess) { setError("You do not have admin console permissions."); return; }
      setStaffToken(res.accessToken);
      setStaffBranchId(res.staff.branchId);
      setStaffName(res.staff.name);
      setStaffRole(res.staff.primaryRole);
      setStaffTenantId(res.staff.tenantId);
      router.push("/admin/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally { setLoading(false); }
  }

  const now = new Date();
  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const date = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <main className="min-h-screen" style={{ background: "var(--ink-50)" }}>
      {/* Top bar */}
      <nav className="flex items-center justify-between px-6 py-3 md:px-10" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        <span className="font-mono text-[11px]" style={{ color: "var(--ink-400)" }}>{time} &middot; {date}</span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px]" style={{ color: "var(--ink-500)" }}>Admin Console</span>
          <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold"
            style={{ background: "var(--ink-100)", color: "var(--ink-500)", border: "1px solid var(--ink-200)" }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ink-400)" }} />
            Offline
          </span>
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-5 py-10 md:py-16">
        {/* Brand */}
        <header className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--r-lg)] font-serif text-2xl font-extrabold italic" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>R</div>
          <h1 className="mt-5 font-serif text-3xl font-extrabold tracking-tight md:text-[36px]" style={{ color: "var(--ink-900)" }}>
            Staff <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Sign In</em>
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed" style={{ color: "var(--ink-500)" }}>
            Enter your work email and password to access the admin console.
          </p>
        </header>

        {/* Login form card */}
        <form onSubmit={handleLogin} className="mx-auto mt-8 max-w-sm rounded-[var(--r-lg)] p-6" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <div className="space-y-4">
            <div>
              <label className="font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>Work email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                placeholder="owner@demo.com"
                className="mt-1.5 w-full rounded-[var(--r-md)] px-3.5 py-3 text-[14px] font-medium outline-none transition"
                style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
            </div>
            <div>
              <label className="font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                placeholder="password123"
                className="mt-1.5 w-full rounded-[var(--r-md)] px-3.5 py-3 text-[14px] font-medium outline-none transition"
                style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
            </div>
          </div>

          {/* Route hint */}
          <div className="mt-4 flex items-center gap-2.5 rounded-[var(--r-md)] p-3" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-edge)" }}>
            <span className="font-serif italic" style={{ color: "var(--accent)" }}>&rarr;</span>
            <span className="text-[11px] leading-snug" style={{ color: "var(--accent-ink)" }}>Routing to Admin Dashboard &middot; full management access.</span>
          </div>

          {error && (
            <div className="mt-3 rounded-[var(--r-md)] p-3 text-[13px]" style={{ background: "var(--bad-soft)", border: "1px solid #fecaca", color: "var(--bad)" }}>{error}</div>
          )}

          <button type="submit" disabled={loading}
            className="mt-5 w-full rounded-[var(--r-md)] py-3.5 text-sm font-semibold transition disabled:opacity-50"
            style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <Link href="/" className="mt-3 block text-center text-[12px] underline underline-offset-2" style={{ color: "var(--ink-500)" }}>
            Back to Demo Hub
          </Link>
        </form>

        {/* Credentials hint */}
        <div className="mx-auto mt-6 max-w-sm rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <h3 className="font-serif text-[13px] font-bold" style={{ color: "var(--ink-900)" }}>Demo <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>accounts</em></h3>
          <p className="mt-1 font-mono text-[10px]" style={{ color: "var(--ink-400)" }}>All use password: password123</p>
          <div className="mt-3 space-y-1.5">
            {[
              { role: "Owner", email: "owner@demo.com", desc: "Full access" },
            ].map((c) => (
              <button key={c.email} type="button" onClick={() => { setEmail(c.email); setPassword("password123"); }}
                className="flex w-full items-center gap-3 rounded-[var(--r-md)] px-3 py-2 text-left transition"
                style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
                <span className="rounded-[var(--r-sm)] px-2 py-0.5 font-mono text-[10px] font-bold" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>{c.role}</span>
                <code className="flex-1 font-mono text-[11px]" style={{ color: "var(--ink-600)" }}>{c.email}</code>
                <span className="font-mono text-[10px]" style={{ color: "var(--ink-400)" }}>{c.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-center font-mono text-[10px]" style={{ color: "var(--ink-400)" }}>
          &#x1F512; Only authorized admin staff can access admin console and system controls.
        </p>
      </div>
    </main>
  );
}
