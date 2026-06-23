"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { authGet, authPost, getApiErrorMessage } from "../../../lib/api";
import { clearStaffToken, getStaffBranchId, getStaffPermissions, getStaffRole, hasStaffSession } from "../../../lib/staff-auth";
import { useAdminBranch } from "../branch-context";
import { LoadingScreen, EmptyState, ErrorDisplay, InlineAlert, PermissionDeniedState, useToast } from "../../../components/ui";
import { usePathname, useRouter } from "next/navigation";

const sv = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

interface InvItem { id: string; name: string; category?: string; unit: string; currentStock: string; reorderLevel: string; isActive: boolean; branchId: string; menuItemLinks: Array<{ qtyPerItem: string; menuItem: { id: string; name: string } }>; }
interface LowStockItem { id: string; name: string; unit: string; currentStock: string; reorderLevel: string; deficit: string; isZero: boolean; linkedMenuItems: Array<{ name: string }> }

const INVENTORY_CATEGORIES = [
  { value: "VEGETABLES", label: "Vegetables", color: "#15803d", bg: "#dcfce7" },
  { value: "FRUITS", label: "Fruits", color: "#be123c", bg: "#ffe4e6" },
  { value: "MEAT", label: "Meat", color: "#b91c1c", bg: "#fee2e2" },
  { value: "SEAFOOD", label: "Seafood", color: "#0369a1", bg: "#e0f2fe" },
  { value: "DAIRY", label: "Dairy", color: "#0f766e", bg: "#ccfbf1" },
  { value: "GRAINS", label: "Grains", color: "#a16207", bg: "#fef3c7" },
  { value: "SPICES", label: "Spices", color: "#c2410c", bg: "#ffedd5" },
  { value: "BEVERAGES", label: "Beverages", color: "#2563eb", bg: "#dbeafe" },
  { value: "PACKAGING", label: "Packaging", color: "#475569", bg: "#e2e8f0" },
  { value: "OTHER", label: "Other", color: "#64748b", bg: "#f1f5f9" },
] as const;

function categoryMeta(category?: string) {
  return INVENTORY_CATEGORIES.find(c => c.value === (category ?? "OTHER")) ?? INVENTORY_CATEGORIES[INVENTORY_CATEGORIES.length - 1];
}

function inferCategoryFromName(name: string) {
  const n = name.toLowerCase();
  if (/(beef|chicken|lamb|meat|patty|steak|burger)/.test(n)) return "MEAT";
  if (/(fish|shrimp|prawn|salmon|tuna|seafood)/.test(n)) return "SEAFOOD";
  if (/(milk|cheese|cream|butter|yogurt|dairy)/.test(n)) return "DAIRY";
  if (/(tomato|lettuce|onion|potato|carrot|pepper|veg|vegetable)/.test(n)) return "VEGETABLES";
  if (/(apple|banana|orange|lemon|lime|fruit|berry)/.test(n)) return "FRUITS";
  if (/(rice|pasta|flour|bun|bread|grain|noodle)/.test(n)) return "GRAINS";
  if (/(salt|spice|pepper|sauce|herb|seasoning)/.test(n)) return "SPICES";
  if (/(cola|juice|water|coffee|tea|drink|beverage|soda)/.test(n)) return "BEVERAGES";
  if (/(box|bag|cup|lid|straw|napkin|packaging)/.test(n)) return "PACKAGING";
  return "OTHER";
}

function itemCategory(item: Pick<InvItem, "category" | "name">) {
  return item.category && item.category !== "OTHER" ? item.category : inferCategoryFromName(item.name);
}

function InventoryCategoryIcon({ category, size = 18 }: { category?: string; size?: number }) {
  const c = category ?? "OTHER";
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (c === "VEGETABLES") return <svg {...props}><path d="M12 21c4-3 6-7 6-11a6 6 0 0 0-12 0c0 4 2 8 6 11Z" /><path d="M12 21V10" /><path d="M8 8c2 .5 3 1.5 4 3" /><path d="M16 8c-2 .5-3 1.5-4 3" /></svg>;
  if (c === "FRUITS") return <svg {...props}><circle cx="12" cy="13" r="7" /><path d="M12 6c0-2 1.5-3 4-3" /><path d="M12 6c-2-1-4-1-6 1" /></svg>;
  if (c === "MEAT") return <svg {...props}><path d="M7.5 14.5a5 5 0 1 1 7-7l4 4a3.5 3.5 0 0 1-5 5l-1-1" /><path d="M5 19l5-5" /><path d="M4 20l-1-1" /></svg>;
  if (c === "SEAFOOD") return <svg {...props}><path d="M3 12s4-5 9-5 9 5 9 5-4 5-9 5-9-5-9-5Z" /><path d="M18 12l3-3v6l-3-3Z" /><circle cx="9" cy="11" r="1" /></svg>;
  if (c === "DAIRY") return <svg {...props}><path d="M8 2h8l-1 5H9L8 2Z" /><path d="M9 7h6l2 4v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9l2-4Z" /><path d="M8 13h8" /></svg>;
  if (c === "GRAINS") return <svg {...props}><path d="M12 22V2" /><path d="M12 7c-3 0-5-2-5-5 3 0 5 2 5 5Z" /><path d="M12 12c-3 0-5-2-5-5 3 0 5 2 5 5Z" /><path d="M12 17c3 0 5-2 5-5-3 0-5 2-5 5Z" /></svg>;
  if (c === "SPICES") return <svg {...props}><path d="M8 3h8l-1 4H9L8 3Z" /><path d="M9 7h6l2 12a2 2 0 0 1-2 3H9a2 2 0 0 1-2-3L9 7Z" /><path d="M10 12h4" /><path d="M10 16h4" /></svg>;
  if (c === "BEVERAGES") return <svg {...props}><path d="M8 2h8l-1 7H9L8 2Z" /><path d="M9 9h6l1 11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2L9 9Z" /><path d="M9 14h6" /></svg>;
  if (c === "PACKAGING") return <svg {...props}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="M3.3 7 12 12l8.7-5" /><path d="M12 22V12" /></svg>;
  return <svg {...props}><path d="M20.59 13.41 13.41 20.59a2 2 0 0 1-2.82 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" /><path d="M7 7h.01" /></svg>;
}

function SH({ icon, title, accent }: { icon: React.ReactNode; title: string; accent: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-edge)", color: "var(--accent)" }}>{icon}</div>
      <h3 className="font-serif text-[13px] font-bold" style={{ color: "var(--ink-900)" }}>{title} <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>{accent}</em></h3>
    </div>
  );
}

export default function AdminInventoryPage() {
  const qc = useQueryClient();
  const { branchId: adminBranchId } = useAdminBranch();
  const [staffBranchId, setStaffBranchId] = useState("");
  const [role, setRole] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const branchId = adminBranchId || staffBranchId;
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterUnit, setFilterUnit] = useState<string | null>(null);
  const { toast } = useToast();

  /* Right sidebar state */
  const [sideMode, setSideMode] = useState<"idle" | "adjust" | "create">("idle");
  const [selItem, setSelItem] = useState<InvItem | null>(null);
  const [adjDelta, setAdjDelta] = useState(""); const [adjReason, setAdjReason] = useState("");
  const [cName, setCName] = useState(""); const [cCategory, setCCategory] = useState("VEGETABLES"); const [cUnit, setCUnit] = useState("pcs"); const [cStock, setCStock] = useState("0"); const [cReorder, setCReorder] = useState("10");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const scope = pathname.startsWith("/waiter") ? "waiter" : "default";
    const r = getStaffRole(scope) ?? "";
    if (!hasStaffSession(scope)) { router.push(pathname.startsWith("/waiter") ? "/waiter/login" : "/admin/login"); return; }
    setRole(r);
    setPermissions(getStaffPermissions(scope));
    setStaffBranchId(getStaffBranchId(scope) ?? "");
  }, [pathname, router]);

  const { data: items, isLoading, error } = useQuery({
    queryKey: ["admin-inventory", branchId],
    queryFn: () => authGet<InvItem[]>(`/api/inventory/items?branchId=${branchId}`),
    enabled: !!branchId,
  });

  const { data: lowStock, isError: lowStockError, refetch: refetchLowStock } = useQuery({
    queryKey: ["admin-low-stock", branchId],
    queryFn: () => authGet<LowStockItem[]>(`/api/inventory/low-stock?branchId=${branchId}`),
    enabled: !!branchId,
  });

  const privilegedInventoryRole = ["OWNER", "MANAGER", "ADMIN", "CASHIER"].includes(role);
  const canReadInventory = privilegedInventoryRole || permissions.includes("inventory:read");
  const canWriteInventory = privilegedInventoryRole || permissions.includes("inventory:write") || permissions.includes("inventory:adjust");

  function openAdjust(item: InvItem) {
    if (!canWriteInventory) return;
    setSelItem(item); setSideMode("adjust"); setAdjDelta(""); setAdjReason(""); setFormError(null);
  }
  function openCreate() {
    if (!canWriteInventory) return;
    setSideMode("create"); setSelItem(null); setCName(""); setCCategory("VEGETABLES"); setCUnit("pcs"); setCStock("0"); setCReorder("10"); setFormError(null);
  }
  function closeSide() { setSideMode("idle"); setSelItem(null); setFormError(null); }

  async function handleAdjust() {
    if (!selItem || !adjDelta) return; setBusy(true); setFormError(null);
    try {
      await authPost(`/api/inventory/items/${selItem.id}/adjust`, undefined, { delta: parseFloat(adjDelta), reason: adjReason || undefined });
      qc.invalidateQueries({ queryKey: ["admin-inventory"] }); qc.invalidateQueries({ queryKey: ["admin-low-stock"] });
      toast("Stock adjusted"); closeSide();
    } catch (e) { const message = getApiErrorMessage(e, "Stock adjustment failed."); setFormError(message); toast(message, "error"); }
    finally { setBusy(false); }
  }

  async function handleCreate() {
    if (!branchId || !cName) return; setBusy(true); setFormError(null);
    try {
      await authPost("/api/inventory/items", undefined, { branchId, name: cName, category: cCategory, unit: cUnit, currentStock: parseFloat(cStock), reorderLevel: parseFloat(cReorder) });
      qc.invalidateQueries({ queryKey: ["admin-inventory"] }); toast("Item created"); closeSide();
    } catch (e) { const message = getApiErrorMessage(e, "Item creation failed."); setFormError(message); toast(message, "error"); }
    finally { setBusy(false); }
  }

  if (isLoading) return <LoadingScreen message="Loading inventory..." />;
  if (branchId && !canReadInventory) {
    return (
      <PermissionDeniedState
        title="Inventory access required"
        description="Your role cannot view inventory for this branch."
        action={<button onClick={() => { clearStaffToken(pathname.startsWith("/waiter") ? "waiter" : "default"); router.push(pathname.startsWith("/waiter") ? "/waiter/login" : "/admin/login"); }} className="rounded-[var(--r-md)] px-4 py-2 text-[12px] font-semibold" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>Switch account</button>}
      />
    );
  }
  if (error) return <ErrorDisplay message={getApiErrorMessage(error, "Inventory is unavailable.")} onRetry={() => qc.invalidateQueries({ queryKey: ["admin-inventory", branchId] })} />;

  const all = items ?? [];
  const units = Array.from(new Set(all.map(i => i.unit)));
  const q = search.toLowerCase().trim();
  const filtered = all.filter(i => (!q || i.name.toLowerCase().includes(q)) && (!filterUnit || i.unit === filterUnit));
  const totalItems = all.length;
  const inStock = all.filter(i => parseFloat(i.currentStock) > parseFloat(i.reorderLevel)).length;
  const outOfStock = all.filter(i => parseFloat(i.currentStock) === 0).length;
  const totalUnits = all.reduce((s, i) => s + parseFloat(i.currentStock), 0);
  const allLinks = all.flatMap(i => i.menuItemLinks.map(l => ({ invName: i.name, menuName: l.menuItem.name, qty: l.qtyPerItem })));

  return (
    <div className="flex h-full flex-col" style={{ minHeight: "100%" }}>
      {/* Header */}
      <div className="px-7 py-4" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-[22px] font-extrabold tracking-tight leading-none" style={{ color: "var(--ink-900)" }}>
              Inventory <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Management</em>
            </h1>
            <p className="mt-1 text-[11px]" style={{ color: "var(--ink-500)" }}>Track stock levels, adjust quantities, and monitor supply chain status.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openCreate} disabled={!canWriteInventory} className="flex items-center gap-1.5 rounded-[var(--r-md)] px-3.5 py-2 text-[11px] font-semibold transition disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>
              <svg {...sv}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Add Item
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { icon: <svg {...sv}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>, label: "Total Items", value: `${totalItems}`, color: "var(--ink-600)" },
            { icon: <svg {...sv}><polyline points="20 6 9 17 4 12" /></svg>, label: "In Stock", value: `${inStock}`, color: "var(--ok)" },
            { icon: <svg {...sv}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>, label: "Out of Stock", value: `${outOfStock}`, color: "var(--bad)" },
            { icon: <svg {...sv}><path d="M18 20V10M12 20V4M6 20v-6" /></svg>, label: "Inventory Qty", value: totalUnits.toLocaleString(undefined, { maximumFractionDigits: 0 }), color: "var(--accent)" },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2.5 rounded-[var(--r-md)] p-3" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
              <span style={{ color: s.color }}>{s.icon}</span>
              <div>
                <div className="font-serif text-[18px] font-extrabold leading-none" style={{ color: "var(--ink-900)" }}>{s.value}</div>
                <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Body: Table + Right Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Table area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Search + unit filter */}
          <div className="flex items-center gap-2 px-7 py-2" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
            <div className="flex items-center gap-2 rounded-[var(--r-md)] px-3 py-1.5" style={{ border: "1px solid var(--ink-200)" }}>
              <svg {...sv} style={{ color: "var(--ink-400)" }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-28 bg-transparent text-[12px] outline-none" style={{ color: "var(--ink-900)" }} />
            </div>
            <button onClick={() => setFilterUnit(null)} className="rounded-full px-2.5 py-1 text-[10px] font-semibold transition"
              style={{ background: !filterUnit ? "var(--accent)" : "var(--ink-0)", color: !filterUnit ? "var(--ink-0)" : "var(--ink-600)", border: `1px solid ${!filterUnit ? "var(--accent)" : "var(--ink-200)"}` }}>All</button>
            {units.map(u => (
              <button key={u} onClick={() => setFilterUnit(filterUnit === u ? null : u)} className="rounded-full px-2.5 py-1 text-[10px] font-semibold transition"
                style={{ background: filterUnit === u ? "var(--accent)" : "var(--ink-0)", color: filterUnit === u ? "var(--ink-0)" : "var(--ink-600)", border: `1px solid ${filterUnit === u ? "var(--accent)" : "var(--ink-200)"}` }}>{u}</button>
            ))}
            <span className="ml-auto font-mono text-[10px]" style={{ color: "var(--ink-400)" }}>{filtered.length} items</span>
          </div>

          {/* Column headers */}
          <div className="flex items-center gap-3 px-7 py-2" style={{ background: "var(--ink-50)", borderBottom: "1px solid var(--ink-200)" }}>
            <span className="w-6 font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>#</span>
            <span className="w-8" />
            <span className="flex-1 font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Item</span>
            <span className="w-24 font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Stock</span>
            <span className="w-14 font-mono text-[9px] font-medium uppercase tracking-widest hidden md:block" style={{ color: "var(--ink-400)" }}>Reorder</span>
            <span className="w-16 text-center font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Status</span>
            <span className="w-8" />
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-auto" style={{ background: "var(--ink-0)" }}>
            {filtered.map((item, i) => {
              const stock = parseFloat(item.currentStock);
              const reorder = parseFloat(item.reorderLevel);
              const isLow = stock <= reorder && stock > 0;
              const isOut = stock === 0;
              const pct = Math.min(100, (stock / Math.max(reorder * 2, 1)) * 100);
              const selected = selItem?.id === item.id;
              const resolvedCategory = itemCategory(item);
              const meta = categoryMeta(resolvedCategory);

              return (
                <div key={item.id} className="flex items-center gap-3 px-7 py-2.5 transition cursor-pointer"
                  onClick={() => openAdjust(item)}
                  style={{ borderBottom: "1px solid var(--ink-100)", background: selected ? "var(--accent-soft)" : "var(--ink-0)", opacity: isOut ? 0.55 : 1 }}>
                  <span className="w-6 font-mono text-[11px]" style={{ color: "var(--ink-400)" }}>{i + 1}</span>
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--r-sm)]" style={{ background: meta.bg, color: meta.color, border: "1px solid rgba(15,23,42,0.08)" }}>
                    <InventoryCategoryIcon category={resolvedCategory} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold truncate" style={{ color: "var(--ink-900)" }}>{item.name}</div>
                    <div className="font-mono text-[9px]" style={{ color: "var(--ink-400)" }}>
                      {meta.label} / {item.unit}{item.menuItemLinks.length > 0 ? ` \u00B7 ${item.menuItemLinks.length} linked` : ""}
                    </div>
                  </div>
                  <div className="w-24">
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono text-[12px] font-bold" style={{ color: isOut ? "var(--bad)" : isLow ? "var(--warn)" : "var(--ink-900)" }}>{stock}</span>
                      <span className="font-mono text-[8px]" style={{ color: "var(--ink-400)" }}>{item.unit}</span>
                    </div>
                    <div className="mt-0.5 h-1 rounded-full overflow-hidden" style={{ background: "var(--ink-100)", width: 56 }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.max(2, pct)}%`, background: isOut ? "var(--bad)" : isLow ? "var(--warn)" : "var(--ok)" }} />
                    </div>
                  </div>
                  <span className="w-14 font-mono text-[11px] hidden md:block" style={{ color: "var(--ink-500)" }}>{reorder}</span>
                  <div className="w-16 flex justify-center">
                    <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{
                      background: isOut ? "var(--bad-soft)" : isLow ? "var(--warn-soft)" : "var(--ok-soft)",
                      color: isOut ? "var(--bad)" : isLow ? "var(--warn)" : "var(--ok)",
                      border: `1px solid ${isOut ? "#fecaca" : isLow ? "#fde68a" : "#bbf7d0"}`,
                    }}>{isOut ? "Out" : isLow ? "Low" : "OK"}</span>
                  </div>
                  <button disabled={!canWriteInventory} className="flex h-6 w-6 items-center justify-center rounded-[var(--r-sm)] transition disabled:opacity-40" onClick={e => { e.stopPropagation(); openAdjust(item); }}
                    style={{ background: selected ? "var(--accent)" : "var(--ink-100)", color: selected ? "var(--ink-0)" : "var(--ink-500)" }}>
                    <svg {...sv}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </button>
                </div>
              );
            })}
            {filtered.length === 0 && <div className="py-12"><EmptyState icon="&#x1F4E6;" title="No items found" description={search ? "Try a different search." : "Add inventory items."} /></div>}
          </div>

          {/* Table footer */}
          <div className="px-7 py-2" style={{ background: "var(--ink-50)", borderTop: "1px solid var(--ink-200)" }}>
            <span className="font-mono text-[10px]" style={{ color: "var(--ink-400)" }}>Showing {filtered.length} of {totalItems} items &middot; Auto-decrement active on SERVED</span>
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="hidden w-[280px] flex-shrink-0 flex-col lg:flex" style={{ borderLeft: "1px solid var(--ink-200)", background: "var(--ink-0)" }}>
          <div className="flex-1 overflow-auto p-5">

            {sideMode === "idle" && (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--ink-100)", color: "var(--ink-400)" }}>
                  <svg {...sv}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>
                </div>
                <p className="mt-2 text-[12px] font-medium" style={{ color: "var(--ink-500)" }}>{canWriteInventory ? "Adjust Stock" : "Read-only inventory"}</p>
                <p className="mt-0.5 text-[10px]" style={{ color: "var(--ink-400)" }}>{canWriteInventory ? "Select an item to adjust its stock" : "Your role can view stock but cannot make adjustments."}</p>
              </div>
            )}

            {/* Adjust Stock form */}
            {sideMode === "adjust" && selItem && (
              <>
                <h3 className="font-serif text-[14px] font-bold mb-4" style={{ color: "var(--ink-900)" }}>Adjust <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Stock</em></h3>

                {/* Item preview */}
                <div className="flex items-center gap-3 rounded-[var(--r-lg)] p-3 mb-4" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[var(--r-md)]" style={{ background: categoryMeta(itemCategory(selItem)).bg, color: categoryMeta(itemCategory(selItem)).color, border: "1px solid rgba(15,23,42,0.08)" }}>
                    <InventoryCategoryIcon category={itemCategory(selItem)} size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold truncate" style={{ color: "var(--ink-900)" }}>{selItem.name}</div>
                    <div className="text-[10px]" style={{ color: "var(--ink-500)" }}>{categoryMeta(itemCategory(selItem)).label} / {selItem.unit}</div>
                  </div>
                  {(() => {
                    const st = parseFloat(selItem.currentStock); const re = parseFloat(selItem.reorderLevel);
                    const isL = st <= re && st > 0; const isO = st === 0;
                    return <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{
                      background: isO ? "var(--bad)" : isL ? "var(--warn)" : "var(--ok)",
                      color: "var(--ink-0)",
                    }}>{isO ? "Out" : isL ? "Low" : "OK"}</span>;
                  })()}
                </div>

                {/* Current stock display */}
                <div className="rounded-[var(--r-md)] p-3 mb-4 text-center" style={{ background: "var(--ink-50)" }}>
                  <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Current Stock</div>
                  <div className="font-serif text-[28px] font-extrabold" style={{ color: "var(--ink-900)" }}>{parseFloat(selItem.currentStock)}<span className="text-[14px] font-medium" style={{ color: "var(--ink-400)" }}> {selItem.unit}</span></div>
                  <div className="font-mono text-[9px]" style={{ color: "var(--ink-400)" }}>Reorder at {parseFloat(selItem.reorderLevel)}</div>
                </div>

                {/* Linked items */}
                {selItem.menuItemLinks.length > 0 && (
                  <div className="mb-4 rounded-[var(--r-md)] p-3" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-edge)" }}>
                    <div className="font-mono text-[9px] font-medium uppercase tracking-widest mb-1" style={{ color: "var(--accent-ink)" }}>Linked menu items</div>
                    {selItem.menuItemLinks.map((l, i) => (
                      <div key={i} className="text-[10px]" style={{ color: "var(--accent-ink)" }}>{l.menuItem.name} ({l.qtyPerItem} per order)</div>
                    ))}
                  </div>
                )}

                {/* Adjust form */}
                <div className="space-y-3">
                  {formError && (
                    <InlineAlert tone="error" title="Adjustment failed">
                      {formError}
                    </InlineAlert>
                  )}
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Quantity (+/-)</label>
                    <input type="number" value={adjDelta} onChange={e => setAdjDelta(e.target.value)} placeholder="e.g. +50 or -10"
                      className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2.5 text-[13px] font-bold outline-none text-center"
                      style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                  </div>
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Reason</label>
                    <select value={adjReason} onChange={e => setAdjReason(e.target.value)}
                      className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
                      style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)", background: "var(--ink-0)" }}>
                      <option value="">Select reason...</option>
                      <option value="Restocked">Restocked</option>
                      <option value="Spoilage">Spoilage</option>
                      <option value="Correction">Correction</option>
                      <option value="Inventory count">Inventory count</option>
                      <option value="Damaged">Damaged</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  <button onClick={closeSide} className="flex-1 rounded-[var(--r-md)] py-2.5 text-[12px] font-semibold transition" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>Cancel</button>
                  <button onClick={handleAdjust} disabled={busy || !adjDelta}
                    className="flex-1 rounded-[var(--r-md)] py-2.5 text-[12px] font-semibold transition disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>
                    {busy ? "Applying..." : "Apply Adjustment"}
                  </button>
                </div>
              </>
            )}

            {/* Create Item form */}
            {sideMode === "create" && (
              <>
                <h3 className="font-serif text-[14px] font-bold mb-4" style={{ color: "var(--ink-900)" }}>New <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Item</em></h3>
                <div className="space-y-3">
                  {formError && (
                    <InlineAlert tone="error" title="Create failed">
                      {formError}
                    </InlineAlert>
                  )}
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Item Name</label>
                    <input value={cName} onChange={e => setCName(e.target.value)} className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                  </div>
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Category</label>
                    <select value={cCategory} onChange={e => setCCategory(e.target.value)} className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)", background: "var(--ink-0)" }}>
                      {INVENTORY_CATEGORIES.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}
                    </select>
                    <div className="mt-2 flex items-center gap-2 rounded-[var(--r-md)] px-3 py-2" style={{ background: categoryMeta(cCategory).bg, color: categoryMeta(cCategory).color, border: "1px solid rgba(15,23,42,0.08)" }}>
                      <InventoryCategoryIcon category={cCategory} />
                      <span className="text-[11px] font-semibold">{categoryMeta(cCategory).label} icon will be used for this item</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Unit</label>
                      <select value={cUnit} onChange={e => setCUnit(e.target.value)} className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)", background: "var(--ink-0)" }}>
                        <option value="pcs">pcs</option><option value="kg">kg</option><option value="l">l</option><option value="g">g</option><option value="ml">ml</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Initial Stock</label>
                      <input type="number" value={cStock} onChange={e => setCStock(e.target.value)} className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                    </div>
                  </div>
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Reorder Level</label>
                    <input type="number" value={cReorder} onChange={e => setCReorder(e.target.value)} className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                  </div>
                </div>
                <div className="mt-5 flex gap-2">
                  <button onClick={closeSide} className="flex-1 rounded-[var(--r-md)] py-2.5 text-[12px] font-semibold transition" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>Cancel</button>
                  <button onClick={handleCreate} disabled={busy || !cName}
                    className="flex-1 rounded-[var(--r-md)] py-2.5 text-[12px] font-semibold transition disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>
                    {busy ? "Creating..." : "Create Item"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom 3 cards */}
      <div className="grid gap-4 px-7 py-4 lg:grid-cols-3" style={{ background: "var(--ink-50)", borderTop: "1px solid var(--ink-200)" }}>
        {/* Low Stock */}
        <div className="rounded-[var(--r-lg)] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <SH icon={<svg {...sv}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>} title="Low Stock" accent="Items" />
          {lowStockError ? (
            <InlineAlert
              tone="warning"
              title="Low stock unavailable"
              action={<button onClick={() => refetchLowStock()} className="rounded-[var(--r-sm)] px-2 py-1 text-[10px] font-semibold" style={{ background: "var(--ink-0)", color: "var(--warn)" }}>Retry</button>}
            >
              Low-stock alerts could not be refreshed.
            </InlineAlert>
          ) : lowStock && lowStock.length > 0 ? (
            <div className="space-y-0">
              {lowStock.slice(0, 4).map((ls, i) => (
                <div key={ls.id} className="flex items-center justify-between py-2" style={{ borderTop: i > 0 ? "1px solid var(--ink-100)" : "none" }}>
                  <span className="text-[11px] font-medium" style={{ color: "var(--ink-700)" }}>{ls.name}</span>
                  <div className="text-right">
                    <span className="font-mono text-[11px] font-bold" style={{ color: ls.isZero ? "var(--bad)" : "var(--warn)" }}>{parseFloat(ls.currentStock).toFixed(0)} {ls.unit}</span>
                    <div className="font-mono text-[8px]" style={{ color: "var(--ink-400)" }}>need {ls.deficit}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-[11px] py-3 text-center" style={{ color: "var(--ok)" }}>All items stocked</p>}
        </div>

        {/* Linked Menu Items */}
        <div className="rounded-[var(--r-lg)] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <SH icon={<svg {...sv}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>} title="Linked Menu" accent="Items" />
          {allLinks.length > 0 ? (
            <div className="space-y-0">
              {allLinks.slice(0, 5).map((l, i) => (
                <div key={i} className="flex items-center justify-between py-1.5" style={{ borderTop: i > 0 ? "1px solid var(--ink-100)" : "none" }}>
                  <span className="text-[11px]" style={{ color: "var(--ink-700)" }}>{l.menuName}</span>
                  <span className="font-mono text-[10px]" style={{ color: "var(--ink-500)" }}>{l.qty}&times; {l.invName}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-[11px] py-3 text-center" style={{ color: "var(--ink-400)" }}>No links</p>}
        </div>

        {/* Recent Adjustments info */}
        <div className="rounded-[var(--r-lg)] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <SH icon={<svg {...sv}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>} title="Stock" accent="Adjustments" />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: "var(--ink-600)" }}>Auto-decrement</span>
              <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: "var(--ok-soft)", color: "var(--ok)", border: "1px solid #bbf7d0" }}>Active</span>
            </div>
            <p className="text-[10px] leading-relaxed" style={{ color: "var(--ink-500)" }}>
              Stock reduces automatically when orders are served. Manual adjustments logged in audit trail.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
