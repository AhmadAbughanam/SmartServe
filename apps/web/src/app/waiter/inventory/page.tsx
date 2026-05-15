"use client";

import AdminInventoryPage from "../../admin/inventory/page";
import { CashierNav } from "../cashier-nav";

export default function CashierInventoryPage() {
  return (
    <div className="flex h-full flex-col" style={{ minHeight: "100%" }}>
      <CashierNav />
      <div className="min-h-0 flex-1 overflow-hidden">
        <AdminInventoryPage />
      </div>
    </div>
  );
}
