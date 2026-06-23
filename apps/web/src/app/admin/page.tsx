"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { hasStaffSession, getStaffName, getStaffRole } from "../../lib/staff-auth";
import Link from "next/link";

type AuthState = "checking" | "authenticated" | "unauthenticated";

export default function AdminPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (hasStaffSession()) {
        setStaffName(getStaffName() ?? "");
        setStaffRole(getStaffRole() ?? "");
        setAuthState("authenticated");
        // Auto-redirect after a moment so the user sees the state
        setTimeout(() => router.replace("/admin/dashboard"), 1200);
      } else {
        setAuthState("unauthenticated");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [router]);

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
            style={{ background: authState === "authenticated" ? "var(--ok-soft)" : "var(--ink-100)", color: authState === "authenticated" ? "var(--ok)" : "var(--ink-500)", border: `1px solid ${authState === "authenticated" ? "#bbf7d0" : "var(--ink-200)"}` }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: authState === "authenticated" ? "var(--ok)" : "var(--ink-400)" }} />
            {authState === "authenticated" ? "Online" : "Offline"}
          </span>
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-5 py-10 md:py-16">
        {/* Brand */}
        <header className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--r-lg)] font-serif text-2xl font-extrabold italic" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>R</div>
          <h1 className="mt-5 font-serif text-3xl font-extrabold tracking-tight md:text-[36px]" style={{ color: "var(--ink-900)" }}>
            Admin <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Access</em>
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed" style={{ color: "var(--ink-500)" }}>
            Auth check in progress &mdash; route authorized staff to the correct destination.
          </p>
        </header>

        {/* Status spinner */}
        <div className="mt-8 flex items-center justify-center gap-2.5">
          {authState === "checking" && <div className="h-4 w-4 animate-spin rounded-full" style={{ border: "2px solid var(--ink-200)", borderTopColor: "var(--accent)" }} />}
          {authState === "authenticated" && <span style={{ color: "var(--ok)" }}>&check;</span>}
          {authState === "unauthenticated" && <span style={{ color: "var(--ink-400)" }}>&mdash;</span>}
          <span className="font-mono text-[12px]" style={{ color: authState === "checking" ? "var(--accent)" : authState === "authenticated" ? "var(--ok)" : "var(--ink-500)" }}>
            {authState === "checking" ? "Checking admin session" : authState === "authenticated" ? "Session verified" : "No active session"}
          </span>
        </div>

        {/* Two state cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {/* Not signed in */}
          <div className="rounded-[var(--r-lg)] p-6 text-center" style={{
            background: "var(--ink-0)",
            border: `1px solid ${authState === "unauthenticated" ? "var(--accent-edge)" : "var(--ink-200)"}`,
            opacity: authState === "authenticated" ? 0.4 : 1,
          }}>
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--ink-100)" }}>
              <span style={{ color: "var(--ink-500)" }}>&#x1F6AB;</span>
            </div>
            <h3 className="mt-3 font-serif text-[15px] font-bold" style={{ color: "var(--ink-900)" }}>Not signed in</h3>
            <p className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>No active admin session found.</p>
            <Link href="/admin/login"
              className="mt-4 inline-flex items-center justify-center rounded-[var(--r-md)] px-5 py-2.5 text-[12px] font-semibold transition hover:opacity-90"
              style={{ background: "var(--ink-0)", color: "var(--accent)", border: "1px solid var(--accent-edge)" }}>
              Go to Login
            </Link>
          </div>

          {/* Authenticated */}
          <div className="rounded-[var(--r-lg)] p-6 text-center" style={{
            background: "var(--ink-0)",
            border: `1px solid ${authState === "authenticated" ? "var(--accent-edge)" : "var(--ink-200)"}`,
            opacity: authState === "unauthenticated" ? 0.4 : 1,
          }}>
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full" style={{ background: authState === "authenticated" ? "var(--ok-soft)" : "var(--ink-100)" }}>
              <span style={{ color: authState === "authenticated" ? "var(--ok)" : "var(--ink-400)" }}>&check;</span>
            </div>
            <h3 className="mt-3 font-serif text-[15px] font-bold" style={{ color: "var(--ink-900)" }}>Authenticated</h3>
            <p className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>
              {authState === "authenticated" ? `${staffName || "Admin"} \u00B7 ${staffRole || "Staff"}` : "Admin session verified."}
              {authState === "authenticated" && <><br />Redirecting to admin dashboard.</>}
            </p>
            <button onClick={() => router.push("/admin/dashboard")} disabled={authState !== "authenticated"}
              className="mt-4 inline-flex items-center justify-center rounded-[var(--r-md)] px-5 py-2.5 text-[12px] font-semibold transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "var(--accent)", color: "var(--ink-0)" }}>
              Open Dashboard
            </button>
          </div>
        </div>

        {/* Flow steps */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { icon: "\u{1F50D}", title: "Check Session", desc: "Verify active admin session.", done: authState !== "checking" },
            { icon: "\u{1F6E1}\uFE0F", title: "Validate Role", desc: "Ensure user has admin role access.", done: authState === "authenticated" },
            { icon: "\u27A1\uFE0F", title: "Redirect", desc: "Route admin to the appropriate screen.", done: false },
          ].map((step, i) => (
            <div key={i} className="flex flex-col items-center rounded-[var(--r-lg)] p-4 text-center" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full text-sm" style={{ background: step.done ? "var(--ok-soft)" : "var(--accent-soft)", border: `1px solid ${step.done ? "#bbf7d0" : "var(--accent-edge)"}` }}>
                {step.done ? <span style={{ color: "var(--ok)" }}>&check;</span> : <span>{step.icon}</span>}
              </div>
              <h4 className="mt-2.5 font-serif text-[13px] font-bold" style={{ color: "var(--ink-900)" }}>{step.title}</h4>
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--ink-500)" }}>{step.desc}</p>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="mt-8 text-center font-mono text-[10px]" style={{ color: "var(--ink-400)" }}>
          &#x1F512; Only authorized admin staff can access admin console and system controls.
        </p>
      </div>
    </main>
  );
}
