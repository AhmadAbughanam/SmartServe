"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearStaffToken, getStaffName } from "../../lib/staff-auth";

const items = [
  { href: "/waiter/pos", label: "POS", mark: "$" },
  { href: "/waiter/inventory", label: "Inventory", mark: "#" },
  { href: "/waiter/promotions", label: "Promotions", mark: "%" },
];

export function CashierNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [staffName, setStaffName] = useState("Cashier");

  useEffect(() => {
    setStaffName(getStaffName("waiter") ?? "Cashier");
  }, []);

  return (
    <div className="flex items-center justify-between gap-3 px-5 py-2.5" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] font-serif text-[13px] font-bold" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>R</div>
        <div className="hidden min-w-0 sm:block">
          <div className="truncate text-[12px] font-semibold" style={{ color: "var(--ink-900)" }}>{staffName}</div>
          <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Cashier workspace</div>
        </div>
      </div>
      <nav className="flex flex-1 justify-center gap-1.5 overflow-x-auto">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold"
              style={{
                background: active ? "var(--accent)" : "var(--ink-0)",
                color: active ? "var(--ink-0)" : "var(--ink-600)",
                border: `1px solid ${active ? "var(--accent)" : "var(--ink-200)"}`,
              }}>
              <span className="font-mono text-[10px]">{item.mark}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <button onClick={() => { clearStaffToken("waiter"); router.push("/waiter/login"); }}
        className="rounded-[var(--r-md)] px-3 py-1.5 text-[11px] font-semibold"
        style={{ background: "var(--ink-100)", color: "var(--ink-600)" }}>
        Logout
      </button>
    </div>
  );
}
