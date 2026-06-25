"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CustomerOtpLogin } from "../../components/customer-otp-login";
import { post } from "../../lib/api";
import { setSaasOwnerSession } from "../../lib/saas-auth";
import type { StaffAuthScope } from "../../lib/staff-auth";
import {
  setStaffBranchId,
  setStaffName,
  setStaffPermissions,
  setStaffRole,
  setStaffTenantId,
  setStaffToken,
} from "../../lib/staff-auth";
import type { StaffLoginResponse } from "../../lib/kds-types";

type LoginAudience = "choice" | "staff" | "customer";

interface StaffDestination {
  href: string;
  label: string;
  scope: StaffAuthScope;
}

interface SaasLoginResponse {
  user: { id: string; name: string; email: string; globalRole: "SAAS_OWNER" };
}

function resolveStaffDestination(staff: StaffLoginResponse["staff"]): StaffDestination | null {
  const permissions = new Set(staff.permissions);
  const role = staff.primaryRole;

  if (role === "OWNER" || role === "MANAGER" || permissions.has("admin:read") || permissions.has("analytics:read")) {
    return { href: "/admin/dashboard", label: "Admin dashboard", scope: "default" };
  }

  if (role === "CASHIER" || (permissions.has("pos:read") && permissions.has("pos:write"))) {
    return { href: "/waiter/pos", label: "Cashier POS", scope: "waiter" };
  }

  if (role === "CHEF" || role === "KITCHEN_LEAD" || (permissions.has("kds:read") && permissions.has("kds:write"))) {
    return { href: "/kitchen/orders", label: "Kitchen display", scope: "kitchen" };
  }

  if (role === "WAITER" || permissions.has("service-requests:read")) {
    return { href: "/waiter/dashboard", label: "Waiter dashboard", scope: "waiter" };
  }

  return null;
}

export default function UnifiedLoginPage() {
  const router = useRouter();
  const [audience, setAudience] = useState<LoginAudience>("choice");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [routeHint, setRouteHint] = useState<string>("Admin, cashier, kitchen, and waiter accounts route automatically.");
  const [clockText, setClockText] = useState<{ time: string; date: string } | null>(null);

  useEffect(() => {
    const now = new Date();
    setClockText({
      time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      date: now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    });
  }, []);

  async function handleStaffLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await post<StaffLoginResponse>("/api/auth/staff/login", { email, password });
      const destination = resolveStaffDestination(res.staff);

      if (!destination) {
        setError("This staff account does not have access to a supported staff workspace.");
        return;
      }

      setStaffToken(undefined, destination.scope);
      setStaffBranchId(res.staff.branchId, destination.scope);
      setStaffName(res.staff.name, destination.scope);
      setStaffRole(res.staff.primaryRole, destination.scope);
      setStaffTenantId(res.staff.tenantId, destination.scope);
      setStaffPermissions(res.staff.permissions, destination.scope);
      setRouteHint(`Signed in as ${res.staff.primaryRole}. Opening ${destination.label}.`);
      router.push(destination.href);
    } catch (err) {
      try {
        await post<SaasLoginResponse>("/api/auth/saas/login", { email, password });
        setSaasOwnerSession();
        setRouteHint("Signed in as SaaS Owner. Opening SaaS dashboard.");
        router.push("/saas");
      } catch {
        setError(err instanceof Error ? err.message : "Login failed");
      }
    } finally {
      setLoading(false);
    }
  }

  if (audience === "customer") return <CustomerOtpLogin onBack={() => setAudience("choice")} />;

  return (
    <main className="min-h-screen" style={{ background: "var(--ink-50)" }}>
      <nav className="flex items-center justify-between px-5 py-3 md:px-10" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        <span className="font-mono text-[11px]" style={{ color: "var(--ink-400)" }}>
          {clockText ? `${clockText.time} · ${clockText.date}` : "\u2014"}
        </span>
        <button
          type="button"
          onClick={() => {
            if (audience === "choice") router.push("/customer");
            else setAudience("choice");
          }}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-[10px] font-semibold"
          style={{ background: "var(--ink-100)", color: "var(--ink-600)", border: "1px solid var(--ink-200)" }}
        >
          <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
      </nav>

      <div className="mx-auto flex min-h-[calc(100vh-49px)] w-full max-w-5xl flex-col px-5 py-8 md:px-10 md:py-12">
        <header className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--r-lg)] font-serif text-2xl font-extrabold italic" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>R</div>
          <h1 className="mt-5 font-serif text-3xl font-extrabold tracking-tight md:text-[38px]" style={{ color: "var(--ink-900)" }}>
            Sign <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>In</em>
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed" style={{ color: "var(--ink-500)" }}>
            Choose customer ordering or staff access. Staff credentials are checked once and routed to the right workspace.
          </p>
        </header>

        {audience === "choice" ? (
          <section className="mx-auto mt-9 grid w-full max-w-3xl gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setAudience("customer")}
              className="group rounded-[var(--r-lg)] p-6 text-left transition hover:opacity-95"
              style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-[var(--r-md)]" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-edge)", color: "var(--accent)" }}>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" /><path d="M10 18h4" /></svg>
              </span>
              <h2 className="mt-4 font-serif text-[22px] font-bold" style={{ color: "var(--ink-900)" }}>Customer</h2>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--ink-500)" }}>Use the existing mobile OTP flow for customer ordering.</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--accent)" }}>Continue <span aria-hidden="true">&rarr;</span></span>
            </button>

            <button
              type="button"
              onClick={() => setAudience("staff")}
              className="group rounded-[var(--r-lg)] p-6 text-left transition hover:opacity-95"
              style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-[var(--r-md)]" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              </span>
              <h2 className="mt-4 font-serif text-[22px] font-bold" style={{ color: "var(--ink-900)" }}>Staff</h2>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--ink-500)" }}>SaaS owner, admin, cashier, and kitchen staff sign in from one page.</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--accent)" }}>Continue <span aria-hidden="true">&rarr;</span></span>
            </button>
          </section>
        ) : (
          <section className="mx-auto mt-9 w-full max-w-sm">
            <button onClick={() => { setAudience("choice"); setError(null); }} aria-label="Back" className="mb-5 flex h-10 w-10 items-center justify-center rounded-[12px]" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--ink-700)" strokeWidth={2} strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>

            <form onSubmit={handleStaffLogin} className="rounded-[var(--r-lg)] p-6" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
              <div className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>Staff access</div>
              <h2 className="mt-2 font-serif text-[28px] font-extrabold leading-tight" style={{ color: "var(--ink-900)" }}>
                Work <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>login</em>
              </h2>
              <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "var(--ink-500)" }}>Enter your staff or SaaS credential. The system opens the correct workspace.</p>

              <div className="mt-6 space-y-3.5">
                <div>
                  <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Work email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="name@company.com"
                    className="mt-1.5 w-full rounded-[var(--r-md)] px-3.5 py-3 text-[13px] font-medium outline-none transition"
                    style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
                  />
                </div>
                <div>
                  <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    className="mt-1.5 w-full rounded-[var(--r-md)] px-3.5 py-3 text-[13px] font-medium outline-none transition"
                    style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2.5 rounded-[var(--r-md)] p-3" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-edge)" }}>
                <span className="font-serif italic" style={{ color: "var(--accent)" }}>&rarr;</span>
                <span className="text-[11px] leading-snug" style={{ color: "var(--accent-ink)" }}>{routeHint}</span>
              </div>

              {error && (
                <div className="mt-3 rounded-[var(--r-md)] p-3 text-[12px]" style={{ background: "var(--bad-soft)", border: "1px solid #fecaca", color: "var(--bad)" }}>{error}</div>
              )}

              <button type="submit" disabled={loading} className="mt-5 w-full rounded-[var(--r-md)] py-3.5 text-sm font-semibold transition disabled:opacity-50" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
