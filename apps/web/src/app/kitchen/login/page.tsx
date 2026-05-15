"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { post } from "../../../lib/api";
import { setStaffToken, setStaffBranchId, setStaffName, setStaffRole, setStaffTenantId, setStaffPermissions } from "../../../lib/staff-auth";
import type { StaffLoginResponse } from "../../../lib/kds-types";
import Link from "next/link";

const sv = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export default function KitchenLoginPage() {
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
      const hasAccess = ["kds:read", "kds:write"].every((permission) =>
        res.staff.permissions.includes(permission),
      );
      if (!hasAccess) { setError("You do not have kitchen display permissions."); return; }
      setStaffToken(res.accessToken, "kitchen");
      setStaffBranchId(res.staff.branchId, "kitchen");
      setStaffName(res.staff.name, "kitchen");
      setStaffRole(res.staff.primaryRole, "kitchen");
      setStaffTenantId(res.staff.tenantId, "kitchen");
      setStaffPermissions(res.staff.permissions, "kitchen");
      router.push("/kitchen/orders");
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
          <span className="font-mono text-[11px]" style={{ color: "var(--ink-500)" }}>Kitchen Display 1</span>
          <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold" style={{ background: "var(--ok-soft)", color: "var(--ok)", border: "1px solid #bbf7d0" }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ok)" }} />Online
          </span>
        </div>
      </nav>

      <div className="mx-auto max-w-md px-5 py-10 md:py-14">
        {/* Brand */}
        <header className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--r-lg)] font-serif text-2xl font-extrabold italic" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>R</div>
          <h1 className="mt-5 font-serif text-[28px] font-extrabold tracking-tight md:text-[32px]" style={{ color: "var(--ink-900)" }}>
            Kitchen <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Login</em>
          </h1>
          <p className="mx-auto mt-1.5 max-w-sm text-[12px] leading-relaxed" style={{ color: "var(--ink-500)" }}>
            Chef and kitchen staff sign on to access live orders.
          </p>
        </header>

        {/* Login form */}
        <form onSubmit={handleLogin} className="mt-8 rounded-[var(--r-lg)] p-6" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <div className="space-y-3.5">
            <div>
              <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Staff ID or Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="chef@demo.com"
                className="mt-1.5 w-full rounded-[var(--r-md)] px-3.5 py-3 text-[13px] font-medium outline-none transition"
                style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
            </div>
            <div>
              <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Password / PIN</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="password123"
                className="mt-1.5 w-full rounded-[var(--r-md)] px-3.5 py-3 text-[13px] font-medium outline-none transition"
                style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
            </div>
          </div>

          {/* Role tabs */}
          <div className="mt-4 flex gap-2">
            <div className="flex flex-1 items-center justify-center gap-2 rounded-[var(--r-md)] py-2.5" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-600)" }}>
              <svg {...sv}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>
              <span className="text-[11px] font-semibold">Chef</span>
            </div>
            <div className="flex flex-1 items-center justify-center gap-2 rounded-[var(--r-md)] py-2.5" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>
              <svg {...sv}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              <span className="text-[11px] font-semibold">Kitchen Staff</span>
            </div>
            <div className="flex flex-1 items-center justify-center gap-2 rounded-[var(--r-md)] py-2.5" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-600)" }}>
              <svg {...sv}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              <span className="text-[11px] font-semibold">Expediter</span>
            </div>
          </div>

          {/* Remember device */}
          <label className="mt-3.5 flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="h-3.5 w-3.5 rounded accent-[var(--accent)]" />
            <span className="text-[11px]" style={{ color: "var(--ink-600)" }}>Remember this device</span>
          </label>

          {error && (
            <div className="mt-3 rounded-[var(--r-md)] p-3 text-[12px]" style={{ background: "var(--bad-soft)", border: "1px solid #fecaca", color: "var(--bad)" }}>{error}</div>
          )}

          <button type="submit" disabled={loading}
            className="mt-4 w-full rounded-[var(--r-md)] py-3.5 text-[13px] font-semibold transition disabled:opacity-50"
            style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>
            {loading ? "Signing in..." : "Sign In"}
          </button>

          {/* Links */}
          <div className="mt-4 flex items-center justify-between">
            <Link href="/kitchen" className="flex items-center gap-1 text-[11px] font-medium" style={{ color: "var(--ink-600)" }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
              Back to Access Check
            </Link>
            <span className="text-[11px]" style={{ color: "var(--ink-400)" }}>Need help? Contact manager</span>
          </div>

          {/* Quick fill */}
          <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--ink-100)" }}>
            <div className="font-mono text-[9px] uppercase tracking-widest mb-2" style={{ color: "var(--ink-400)" }}>Demo accounts</div>
            <div className="flex gap-2">
              {[
                { label: "Chef", email: "chef@demo.com" },
                { label: "Owner", email: "owner@demo.com" },
              ].map(c => (
                <button key={c.email} type="button" onClick={() => { setEmail(c.email); setPassword("password123"); }}
                  className="flex-1 rounded-[var(--r-md)] py-2 text-center text-[10px] font-semibold transition"
                  style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* Info cards */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { icon: <svg {...sv}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>, title: "Secure Staff Access", desc: "Protected by authorized kitchen staff only." },
            { icon: <svg {...sv}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>, title: "Role-Based Permissions", desc: "Access orders and KDS tools based on your role." },
            { icon: <svg {...sv}><polyline points="13 2 3 14h9l-1 8 10-12h-9l1-8" /></svg>, title: "Fast Order Routing", desc: "View live orders and kitchen queue without delay." },
          ].map(c => (
            <div key={c.title} className="flex flex-col items-center rounded-[var(--r-lg)] p-3.5 text-center" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-edge)", color: "var(--accent)" }}>{c.icon}</div>
              <h4 className="mt-2 text-[11px] font-bold" style={{ color: "var(--ink-900)" }}>{c.title}</h4>
              <p className="mt-0.5 text-[9px] leading-relaxed" style={{ color: "var(--ink-500)" }}>{c.desc}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center font-mono text-[10px]" style={{ color: "var(--ink-400)" }}>
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="inline-block mr-1" style={{ verticalAlign: "-1px" }}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          Only authorized kitchen staff can access live orders.
        </p>
      </div>
    </main>
  );
}
