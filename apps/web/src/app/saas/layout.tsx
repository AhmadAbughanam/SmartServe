"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { authGet } from "../../lib/api";
import { clearSaasOwnerSession, hasSaasOwnerSessionHint } from "../../lib/saas-auth";
import { SaasBadge, saasIconProps } from "./saas-ui";

const primaryNav = [
  { href: "/saas", label: "Overview", icon: "grid" },
  { href: "/saas/tenants", label: "Tenants", icon: "buildings" },
  { href: "/saas/operations", label: "Operations", icon: "operations" },
  { href: "/saas/controls", label: "Controls", icon: "spark" },
  { href: "/saas/billing", label: "Billing", icon: "revenue" },
  { href: "/saas/system-health", label: "System Health", icon: "shield" },
  { href: "/saas/settings", label: "Settings", icon: "settings" },
] as const;

interface SaasMe {
  userId: string;
  name: string;
  email: string;
  globalRole: "SAAS_OWNER";
}

function NavIcon({ icon }: { icon: "grid" | "buildings" | "operations" | "spark" | "revenue" | "shield" | "settings" }) {
  if (icon === "buildings") {
    return (
      <svg {...saasIconProps}>
        <path d="M3 21h18" />
        <path d="M5 21V7l7-4v18" />
        <path d="M19 21V11l-7-4" />
        <path d="M9 9h.01" />
        <path d="M9 13h.01" />
        <path d="M15 13h.01" />
      </svg>
    );
  }
  if (icon === "revenue") {
    return (
      <svg {...saasIconProps}>
        <path d="M12 3v18" />
        <path d="M17 7h-6a3 3 0 0 0 0 6h2a3 3 0 0 1 0 6H7" />
      </svg>
    );
  }
  if (icon === "operations") {
    return (
      <svg {...saasIconProps}>
        <path d="M12 2v4" />
        <path d="M12 18v4" />
        <path d="m4.93 4.93 2.83 2.83" />
        <path d="m16.24 16.24 2.83 2.83" />
        <path d="M2 12h4" />
        <path d="M18 12h4" />
        <path d="m4.93 19.07 2.83-2.83" />
        <path d="m16.24 7.76 2.83-2.83" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  if (icon === "spark") {
    return (
      <svg {...saasIconProps}>
        <path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8Z" />
        <path d="M5 19h.01" />
        <path d="M19 19h.01" />
      </svg>
    );
  }
  if (icon === "shield") {
    return (
      <svg {...saasIconProps}>
        <path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4Z" />
        <path d="m9.5 12 1.5 1.5 3.5-3.5" />
      </svg>
    );
  }
  if (icon === "settings") {
    return (
      <svg {...saasIconProps}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33" />
        <path d="M4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6" />
        <path d="M9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15" />
        <path d="M14.999 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82" />
        <path d="M15 19.4a1.65 1.65 0 0 0 1.82.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0-2.83l-.06-.06a1.65 1.65 0 0 0-.33-1.82" />
      </svg>
    );
  }
  return (
    <svg {...saasIconProps}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export default function SaasLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/saas/login";
  const [accountOpen, setAccountOpen] = useState(false);

  useEffect(() => {
    if (!isLogin && !hasSaasOwnerSessionHint()) router.replace("/saas/login");
  }, [isLogin, router]);

  const me = useQuery({
    queryKey: ["saas-me"],
    queryFn: () => authGet<SaasMe>("/api/saas/me"),
    enabled: !isLogin && hasSaasOwnerSessionHint(),
    retry: false,
  });

  useEffect(() => {
    if (me.isError && !isLogin) {
      clearSaasOwnerSession();
      router.replace("/saas/login");
    }
  }, [isLogin, me.isError, router]);

  if (isLogin) return <>{children}</>;

  return (
    <div className="min-h-screen" style={{ background: "var(--ink-50)", color: "var(--ink-900)" }}>
      <aside
        className="fixed inset-y-0 left-0 z-20 hidden lg:block"
        style={{ width: 296 }}
      >
        <div className="h-full p-3">
          <div
            className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] px-4 py-5"
            style={{
              background: "linear-gradient(180deg, #ffffff 0%, #fbfbfb 100%)",
              border: "1px solid var(--ink-200)",
              boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)",
            }}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[16px] font-serif text-[28px] font-extrabold italic" style={{ background: "var(--ink-900)", color: "var(--ink-0)", boxShadow: "0 12px 24px rgba(15, 23, 42, 0.16)" }}>
                R
              </div>
              <div>
                <div className="font-serif text-[18px] font-bold tracking-tight" style={{ color: "var(--ink-900)" }}>
                  Restaurant OS
                </div>
                <div className="text-[12px]" style={{ color: "var(--ink-500)" }}>SaaS Control Center</div>
              </div>
            </div>

            <div
              className="mt-6 rounded-[20px] p-4"
              style={{ background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)", border: "1px solid var(--ink-200)" }}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <SaasBadge label="Demo" />
                <SaasBadge label="Owner" tone="ok" />
              </div>
              <div className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>{me.data?.email ?? "saas@demo.com"}</div>
              <div className="mt-2 text-[12px]" style={{ color: "var(--ink-500)" }}>Global platform controls</div>
            </div>

            <nav className="mt-6 space-y-1.5">
              {primaryNav.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 rounded-[16px] px-3 py-2.5 text-[14px] font-medium transition"
                    style={
                      active
                        ? { background: "linear-gradient(180deg, #090909 0%, #151515 100%)", color: "var(--ink-0)", boxShadow: "0 14px 30px rgba(15, 23, 42, 0.16)" }
                        : { color: "var(--ink-900)" }
                    }
                  >
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-[12px]"
                      style={{ background: active ? "rgba(255,255,255,0.06)" : "var(--ink-50)", color: active ? "var(--ink-0)" : "var(--ink-700)", border: active ? "1px solid rgba(255,255,255,0.06)" : "1px solid var(--ink-200)" }}
                    >
                      <NavIcon icon={item.icon} />
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            </div>

            <div className="mt-5 border-t pt-5" style={{ borderColor: "var(--ink-200)" }}>
              <div
                className="overflow-hidden rounded-[18px]"
                style={{ background: "linear-gradient(180deg, #ffffff 0%, #fbfbfb 100%)", border: "1px solid var(--ink-200)" }}
              >
                <button
                  type="button"
                  onClick={() => setAccountOpen((current) => !current)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-full text-[15px] font-semibold" style={{ background: "linear-gradient(180deg, #111111 0%, #1d1d1d 100%)", color: "var(--ink-0)" }}>
                      {(me.data?.name?.[0] ?? "N").toUpperCase()}
                      <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full" style={{ background: "#22c55e", border: "2px solid var(--ink-0)" }} />
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>{me.data?.name ?? "Platform Admin"}</div>
                      <div className="mt-0.5 text-[12px]" style={{ color: "var(--ink-500)" }}>Owner</div>
                    </div>
                  </div>
                  <span aria-hidden style={{ color: "var(--ink-700)", transform: accountOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 160ms ease" }}>
                    <ChevronDownGlyph />
                  </span>
                </button>

                {accountOpen ? (
                  <div style={{ background: "var(--ink-0)" }}>
                    <Link
                      href="/saas/settings"
                      className="flex h-12 w-full items-center gap-3 border-t px-4 text-[14px] font-medium"
                      style={{ borderColor: "var(--ink-200)", color: "var(--ink-900)" }}
                    >
                      <span style={{ color: "var(--ink-700)" }}>
                        <SettingsMiniGlyph />
                      </span>
                      Open Settings
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        clearSaasOwnerSession();
                        router.push("/saas/login");
                      }}
                      className="flex h-12 w-full items-center gap-3 border-t px-4 text-[14px] font-medium"
                      style={{ borderColor: "var(--ink-200)", color: "#ef4444", background: "var(--ink-0)" }}
                    >
                      <span style={{ color: "var(--ink-700)" }}>
                        <LogoutGlyph />
                      </span>
                      Logout
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col lg:pl-[296px]">
        <header className="flex items-center gap-2 overflow-x-auto border-b px-4 py-3 lg:hidden" style={{ borderColor: "var(--ink-200)", background: "var(--ink-0)" }}>
          {primaryNav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex-shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold"
                style={
                  active
                    ? { background: "var(--ink-900)", color: "var(--ink-0)" }
                    : { background: "var(--ink-100)", color: "var(--ink-700)" }
                }
              >
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => {
              clearSaasOwnerSession();
              router.push("/saas/login");
            }}
            className="ml-auto text-[11px] font-semibold"
            style={{ color: "var(--bad)" }}
          >
            Logout
          </button>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

function ChevronDownGlyph() {
  return (
    <svg {...saasIconProps}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function LogoutGlyph() {
  return (
    <svg {...saasIconProps}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function SettingsMiniGlyph() {
  return (
    <svg {...saasIconProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82" />
      <path d="M4.6 9a1.65 1.65 0 0 0-.33-1.82" />
      <path d="M9 19.4a1.65 1.65 0 0 0-1.82.33" />
      <path d="M15 4.6a1.65 1.65 0 0 0 1.82-.33" />
    </svg>
  );
}
