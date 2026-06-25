"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { post } from "../../../lib/api";
import { setSaasOwnerSession } from "../../../lib/saas-auth";

interface SaasLoginResponse {
  user: { id: string; name: string; email: string; globalRole: "SAAS_OWNER" };
}

export default function SaasLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await post<SaasLoginResponse>("/api/auth/saas/login", { email, password });
      setSaasOwnerSession();
      router.push("/saas");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5" style={{ background: "var(--ink-50)" }}>
      <form onSubmit={login} className="w-full max-w-sm rounded-[var(--r-lg)] p-6" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
        <div className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--accent)" }}>SaaS owner</div>
        <h1 className="mt-2 font-serif text-[32px] font-extrabold leading-tight" style={{ color: "var(--ink-900)" }}>
          Platform <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>access</em>
        </h1>
        <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: "var(--ink-500)" }}>Global controls for tenants, store owners, analytics, and branch modules.</p>

        <div className="mt-6 space-y-3.5">
          <label className="block">
            <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="mt-1.5 w-full rounded-[var(--r-md)] px-3.5 py-3 text-[13px] outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
          </label>
          <label className="block">
            <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Password</span>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required className="mt-1.5 w-full rounded-[var(--r-md)] px-3.5 py-3 text-[13px] outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
          </label>
        </div>

        {error && <div className="mt-3 rounded-[var(--r-md)] p-3 text-[12px]" style={{ background: "var(--bad-soft)", border: "1px solid #fecaca", color: "var(--bad)" }}>{error}</div>}

        <button type="submit" disabled={loading} className="mt-5 w-full rounded-[var(--r-md)] py-3.5 text-sm font-semibold transition disabled:opacity-50" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>
          {loading ? "Signing in..." : "Enter SaaS dashboard"}
        </button>
      </form>
    </main>
  );
}
