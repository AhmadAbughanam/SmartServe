"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { authGet } from "../../lib/api";
import { hasStaffSession, getStaffName, getStaffRole, getStaffBranchId, getSelectedBranchId, setSelectedBranchId, clearStaffToken, getStaffPermissions } from "../../lib/staff-auth";
import { AdminBranchContext } from "./branch-context";

interface BranchOption { id: string; name: string; location: string; isActive: boolean }

/* SVG icon helper */
const si = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: <svg {...si}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg> },
  { href: "/admin/analytics", label: "Analytics", icon: <svg {...si}><path d="M18 20V10M12 20V4M6 20v-6" /></svg> },
  { href: "/admin/menu",      label: "Menu",      icon: <svg {...si}><path d="M3 3h18v18H3zM3 9h18M9 21V9" /></svg> },
  { href: "/admin/promotions", label: "Promotions", icon: <svg {...si}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg> },
  { href: "/admin/staff",     label: "Staff",     icon: <svg {...si}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
  { href: "/admin/shifts",    label: "Shifts",    icon: <svg {...si}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> },
  { href: "/admin/logs",      label: "Logs",      icon: <svg {...si}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="14" y2="17" /></svg> },
  { href: "/admin/devices",   label: "Devices",   icon: <svg {...si}><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg> },
  { href: "/admin/settings",  label: "Settings",  icon: <svg {...si}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg> },
];

const navGroups = [
  { label: "Run", items: [
    { href: "/admin/dashboard", label: "Today", g: "\u25CF" },
  ]},
  { label: "Grow", items: [
    { href: "/admin/analytics", label: "Analytics", g: "#" },
    { href: "/admin/promotions", label: "Promotions", g: "\u2605" },
    { href: "/admin/menu", label: "Menu", g: "\u270E" },
  ]},
  { label: "People", items: [
    { href: "/admin/staff", label: "Staff", g: "@" },
    { href: "/admin/shifts", label: "Shifts", g: "\u25F4" },
  ]},
  { label: "Infra", items: [
    { href: "/admin/logs", label: "Logs", g: "!" },
    { href: "/admin/devices", label: "Devices", g: "\u25A2" },
    { href: "/admin/settings", label: "Settings", g: "\u2699" },
  ]},
];

const allItems = navGroups.flatMap((g) => g.items);

const navRequirements: Record<string, string[]> = {
  "/admin/dashboard": ["admin:read", "analytics:read"],
  "/admin/analytics": ["analytics:read"],
  "/admin/promotions": ["promotions:read"],
  "/admin/menu": ["menu:write", "admin:read"],
  "/admin/staff": ["staff:read"],
  "/admin/shifts": ["shifts:read", "attendance:write"],
  "/admin/logs": ["audit:read"],
  "/admin/devices": ["admin:read"],
  "/admin/settings": ["admin:read", "settings:write"],
};

function canOpenAdminPath(path: string, role: string, permissions: string[]) {
  if (role === "OWNER" || role === "MANAGER") return true;
  const required = navRequirements[path];
  if (!required) return true;
  return required.some((permission) => permissions.includes(permission));
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [branchId, setBranchIdState] = useState("");

  useEffect(() => {
    if (pathname === "/admin/login" || pathname === "/admin") { setReady(true); return; }
    if (!hasStaffSession()) { router.replace("/admin/login"); return; }
    setName(getStaffName() ?? "");
    setRole(getStaffRole() ?? "");
    setPermissions(getStaffPermissions());
    setBranchIdState(getSelectedBranchId() ?? getStaffBranchId() ?? "");
    setReady(true);
  }, [pathname, router]);

  function setBranch(id: string) { setSelectedBranchId(id); setBranchIdState(id); }

  // Fetch branches for owner selector
  const isOwner = role === "OWNER" || role === "MANAGER";
  const { data: branches } = useQuery({
    queryKey: ["admin-branches"],
    queryFn: () => authGet<BranchOption[]>("/api/admin/branches"),
    enabled: ready && isOwner,
  });

  if (pathname === "/admin/login" || pathname === "/admin") return <>{children}</>;
  if (!ready) return <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--ink-50)" }}><div className="h-6 w-6 animate-spin rounded-full border-2" style={{ borderColor: "var(--ink-200)", borderTopColor: "var(--accent)" }} /></div>;

  const currentBranchName = branches?.find((b) => b.id === branchId)?.name;
  const visibleNavItems = navItems.filter((item) => canOpenAdminPath(item.href, role, permissions));
  const visibleMobileItems = allItems.filter((item) => canOpenAdminPath(item.href, role, permissions));

  return (
    <AdminBranchContext.Provider value={{ branchId, setBranch }}>
      <div className="flex min-h-screen" style={{ background: "var(--ink-50)" }}>
        {/* Sidebar */}
        <aside className="hidden w-[220px] flex-shrink-0 flex-col md:flex" style={{ background: "var(--ink-0)", borderRight: "1px solid var(--ink-200)" }}>
          {/* Brand — centered logo */}
          <div className="flex flex-col items-center pt-6 pb-5 px-4" style={{ borderBottom: "1px solid var(--ink-200)" }}>
            <div className="flex h-11 w-11 items-center justify-center rounded-[var(--r-lg)] font-serif text-lg font-extrabold italic" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>R</div>
            <div className="mt-2.5 text-center">
              <div className="font-serif text-[13px] font-bold" style={{ color: "var(--ink-900)" }}>Restaurant <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>OS</em></div>
              <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>{role || "Console"}</div>
            </div>
          </div>

          {/* Branch selector (owners/managers) */}
          {isOwner && branches && branches.length > 1 && (
            <div className="px-4 py-2.5" style={{ borderBottom: "1px solid var(--ink-200)" }}>
              <select
                value={branchId}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full rounded-[var(--r-md)] px-2.5 py-2 text-[11px] font-semibold outline-none"
                style={{ border: "1px solid var(--ink-200)", background: "var(--ink-50)", color: "var(--ink-900)" }}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}{!b.isActive ? " (inactive)" : ""}</option>
                ))}
              </select>
            </div>
          )}

          {/* Nav items — flat list with SVG icons */}
          <nav className="flex-1 overflow-auto px-3 py-3 space-y-0.5">
            {visibleNavItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-3 rounded-[var(--r-md)] px-3 py-2.5 text-[13px] font-medium transition"
                  style={{ background: active ? "var(--accent-soft)" : "transparent", color: active ? "var(--accent-ink)" : "var(--ink-600)" }}>
                  <span className="flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] flex-shrink-0"
                    style={{
                      background: active ? "var(--accent)" : "var(--ink-100)",
                      color: active ? "var(--ink-0)" : "var(--ink-500)",
                    }}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="px-4 py-4" style={{ borderTop: "1px solid var(--ink-200)" }}>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full font-serif text-[11px] font-bold" style={{ background: "linear-gradient(135deg, var(--accent), #9a3412)", color: "var(--ink-0)" }}>{name.charAt(0) || "A"}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold truncate" style={{ color: "var(--ink-900)" }}>{name || "Admin"}</div>
                <div className="font-mono text-[9px] truncate" style={{ color: "var(--ink-400)" }}>{currentBranchName || "Branch"}</div>
              </div>
              <button onClick={() => { clearStaffToken(); router.push("/admin/login"); }} title="Logout"
                className="flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] transition hover:opacity-80"
                style={{ background: "var(--ink-100)", color: "var(--ink-500)" }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile header + nav */}
        <div className="flex flex-1 flex-col min-w-0">
          <header className="flex items-center justify-between px-4 py-2.5 md:hidden" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded font-serif text-xs font-extrabold italic" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>R</div>
              <span className="font-serif text-sm font-bold">Admin</span>
            </div>
            {isOwner && branches && branches.length > 1 && (
              <select value={branchId} onChange={(e) => setBranch(e.target.value)}
                className="rounded px-2 py-1 text-[11px] font-semibold" style={{ border: "1px solid var(--ink-200)" }}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            )}
            <button onClick={() => { clearStaffToken(); router.push("/admin/login"); }} className="font-mono text-[10px] underline" style={{ color: "var(--bad)" }}>logout</button>
          </header>
          <nav className="flex gap-1 overflow-x-auto px-2 py-1.5 md:hidden" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
            {visibleMobileItems.map((item) => (
              <Link key={item.href} href={item.href}
                className="flex-shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold transition"
                style={{ background: pathname === item.href ? "var(--ink-900)" : "transparent", color: pathname === item.href ? "var(--ink-0)" : "var(--ink-600)", border: `1px solid ${pathname === item.href ? "var(--ink-900)" : "var(--ink-200)"}` }}>
                {item.label}
              </Link>
            ))}
          </nav>
          <main className="flex flex-1 flex-col overflow-hidden" style={{ background: "var(--ink-50)" }}>{children}</main>
        </div>
      </div>
    </AdminBranchContext.Provider>
  );
}
