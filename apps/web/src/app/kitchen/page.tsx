"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getStaffToken } from "../../lib/staff-auth";

export default function KitchenPage() {
  const router = useRouter();

  useEffect(() => {
    const token = getStaffToken("kitchen");
    if (token) {
      router.replace("/kitchen/orders");
    } else {
      router.replace("/kitchen/login");
    }
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center" style={{ background: "var(--ink-900)" }}>
      <div className="h-6 w-6 animate-spin rounded-full" style={{ border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "var(--accent)" }} />
    </main>
  );
}
