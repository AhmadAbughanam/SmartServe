"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { get, authPatch, authPost, authUpload } from "../../../lib/api";
import { getStaffToken } from "../../../lib/staff-auth";
import { useAdminBranch } from "../branch-context";
import { LoadingScreen, EmptyState, useToast } from "../../../components/ui";
import type { MenuCategory, MenuItem } from "../../../lib/types";

/* gradient placeholders */
const grads = [
  "linear-gradient(135deg, #c2410c, #7c2d12)", "linear-gradient(135deg, #15803d, #14532d)",
  "linear-gradient(135deg, #b45309, #78350f)", "linear-gradient(135deg, #0e7490, #164e63)",
  "linear-gradient(135deg, #9333ea, #581c87)", "linear-gradient(135deg, #dc2626, #7f1d1d)",
  "linear-gradient(135deg, #ca8a04, #713f12)", "linear-gradient(135deg, #0284c7, #0c4a6e)",
];
function grad(id: string) { let h = 0; for (const c of id) h = ((h << 5) - h + c.charCodeAt(0)) | 0; return grads[Math.abs(h) % grads.length]; }

/* SVG icons */
const sv = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
type AdditionForm = { name: string; priceImpact: string; isRequired: boolean; maxSelectable: string };

export default function AdminMenuPage() {
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const { branchId } = useAdminBranch();
  const [busy, setBusy] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  /* Quick Edit form state */
  const [editName, setEditName] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editIngredients, setEditIngredients] = useState("");
  const [editDietaryInfo, setEditDietaryInfo] = useState("");
  const [editPrep, setEditPrep] = useState("");
  const [editVegetarian, setEditVegetarian] = useState(false);
  const [editSpicy, setEditSpicy] = useState(false);
  const [editTaxClass, setEditTaxClass] = useState("FOOD");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newIngredients, setNewIngredients] = useState("");
  const [newDietaryInfo, setNewDietaryInfo] = useState("");
  const [newPrep, setNewPrep] = useState("");
  const [newVegetarian, setNewVegetarian] = useState(false);
  const [newSpicy, setNewSpicy] = useState(false);
  const [newTaxClass, setNewTaxClass] = useState("FOOD");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState("");
  const [newAdditions, setNewAdditions] = useState<AdditionForm[]>([]);
  const [editAdditions, setEditAdditions] = useState<AdditionForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { setToken(getStaffToken()); }, []);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["admin-menu", branchId],
    queryFn: () => get<MenuCategory[]>(`/api/menu?branchId=${branchId}`),
    enabled: !!branchId,
  });

  function openEdit(item: MenuItem) {
    const row = allItems.find(i => i.id === item.id);
    setCreateOpen(false);
    setEditItem(item);
    setEditCategoryId(row?.categoryId ?? categories?.[0]?.id ?? "");
    setEditName(item.name);
    setEditPrice(item.price);
    setEditDesc(item.description ?? "");
    setEditIngredients(item.ingredients ?? "");
    setEditDietaryInfo(item.dietaryInfo ?? "");
    setEditPrep(String(item.prepTimeMinutes ?? ""));
    setEditVegetarian(item.isVegetarian);
    setEditSpicy(item.isSpicy);
    setEditTaxClass(item.taxClass ?? "FOOD");
    setEditAdditions((item.additions ?? []).map(a => ({
      name: a.name,
      priceImpact: String(parseFloat(a.priceImpact)),
      isRequired: a.isRequired,
      maxSelectable: a.maxSelectable ? String(a.maxSelectable) : "",
    })));
  }

  function openCreate() {
    setEditItem(null);
    setCreateOpen(true);
    setNewCategoryId(activeCat ?? categories?.[0]?.id ?? "");
    setNewName("");
    setNewPrice("");
    setNewDesc("");
    setNewIngredients("");
    setNewDietaryInfo("");
    setNewPrep("");
    setNewVegetarian(false);
    setNewSpicy(false);
    setNewTaxClass("FOOD");
    setNewImageFile(null);
    setNewImagePreview("");
    setNewAdditions([]);
  }

  async function saveEdit() {
    if (!token || !editItem) return;
    setSaving(true);
    try {
      await authPatch(`/api/menu/items/${editItem.id}`, token, {
        categoryId: editCategoryId,
        name: editName, price: parseFloat(editPrice), description: editDesc || undefined,
        ingredients: editIngredients || undefined,
        dietaryInfo: editDietaryInfo || undefined,
        isVegetarian: editVegetarian,
        isSpicy: editSpicy,
        prepTimeMinutes: editPrep ? parseInt(editPrep) : undefined,
        taxClass: editTaxClass,
        additions: editAdditions
          .filter(a => a.name.trim() && a.priceImpact !== "")
          .map(a => ({
            name: a.name.trim(),
            priceImpact: parseFloat(a.priceImpact),
            isRequired: a.isRequired,
            maxSelectable: a.maxSelectable ? parseInt(a.maxSelectable) : undefined,
          })),
      });
      qc.invalidateQueries({ queryKey: ["admin-menu"] });
      toast("Item saved");
      setEditItem(null);
    } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setSaving(false); }
  }

  async function createItem() {
    if (!token || !branchId || !newCategoryId || !newName || !newPrice) return;
    setSaving(true);
    try {
      const created = await authPost<MenuItem>("/api/menu/items", token, {
        branchId,
        categoryId: newCategoryId,
        name: newName,
        price: parseFloat(newPrice),
        description: newDesc || undefined,
        ingredients: newIngredients || undefined,
        prepTimeMinutes: newPrep ? parseInt(newPrep) : undefined,
        isVegetarian: newVegetarian,
        isSpicy: newSpicy,
        dietaryInfo: [
          newDietaryInfo.trim(),
          newVegetarian ? "Vegetarian" : "",
          newSpicy ? "Spicy" : "",
        ].filter(Boolean).join(", ") || undefined,
        taxClass: newTaxClass,
        additions: newAdditions
          .filter(a => a.name.trim() && a.priceImpact !== "")
          .map(a => ({
            name: a.name.trim(),
            priceImpact: parseFloat(a.priceImpact),
            isRequired: a.isRequired,
            maxSelectable: a.maxSelectable ? parseInt(a.maxSelectable) : undefined,
          })),
      });
      let createdItem = created;
      if (newImageFile) {
        const fd = new FormData();
        fd.append("image", newImageFile);
        createdItem = await authUpload<MenuItem>(`/api/menu/items/${created.id}/image`, token, fd);
      }
      qc.invalidateQueries({ queryKey: ["admin-menu"] });
      toast(newImageFile ? "Menu item created with image" : "Menu item created");
      setCreateOpen(false);
      setActiveCat(newCategoryId);
      setEditItem(createdItem);
      setEditName(createdItem.name);
      setEditPrice(createdItem.price);
      setEditDesc(createdItem.description ?? "");
      setEditIngredients(createdItem.ingredients ?? "");
      setEditDietaryInfo(createdItem.dietaryInfo ?? "");
      setEditPrep(String(createdItem.prepTimeMinutes ?? ""));
      setEditTaxClass(createdItem.taxClass ?? "FOOD");
    } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setSaving(false); }
  }

  async function toggle(itemId: string, isUnavailable: boolean) {
    if (!token) return; setBusy(itemId);
    try {
      await authPatch(`/api/menu/items/${itemId}/availability`, token, { isUnavailable: !isUnavailable });
      qc.invalidateQueries({ queryKey: ["admin-menu"] });
      toast(isUnavailable ? "Item restored" : "Item marked unavailable");
    } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setBusy(null); }
  }

  if (isLoading) return <LoadingScreen message="Loading menu..." />;

  const allItems = categories?.flatMap(c => c.menuItems.map(i => ({ ...i, categoryName: c.name, categoryId: c.id }))) ?? [];
  const q = search.toLowerCase().trim();
  const filteredItems = allItems
    .filter(i => !activeCat || i.categoryId === activeCat)
    .filter(i => !q || i.name.toLowerCase().includes(q) || i.categoryName.toLowerCase().includes(q));

  const totalItems = allItems.length;
  const availableItems = allItems.filter(i => !i.isUnavailable).length;
  const unavailableItems = totalItems - availableItems;

  return (
    <div className="flex h-full flex-col" style={{ minHeight: "100%" }}>
      {/* Header */}
      <div className="px-7 py-4" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-[22px] font-extrabold tracking-tight leading-none" style={{ color: "var(--ink-900)" }}>
              Menu <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Management</em>
            </h1>
            <p className="mt-1 text-[11px]" style={{ color: "var(--ink-500)" }}>Manage categories, items, pricing, and availability.</p>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-1.5 rounded-[var(--r-md)] px-3.5 py-2 text-[11px] font-semibold transition"
            style={{ background: "var(--accent)", color: "var(--ink-0)" }}>
            <svg {...sv}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add Item
          </button>
        </div>

        {/* Search + category tabs */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Categories</span>
            <div className="flex gap-1">
              <button onClick={() => setActiveCat(null)}
                className="rounded-full px-2.5 py-1 text-[10px] font-semibold transition"
                style={{ background: !activeCat ? "var(--accent)" : "var(--ink-0)", color: !activeCat ? "var(--ink-0)" : "var(--ink-600)", border: `1px solid ${!activeCat ? "var(--accent)" : "var(--ink-200)"}` }}>
                All
              </button>
              {categories?.map(c => (
                <button key={c.id} onClick={() => setActiveCat(activeCat === c.id ? null : c.id)}
                  className="rounded-full px-2.5 py-1 text-[10px] font-semibold transition"
                  style={{ background: activeCat === c.id ? "var(--accent)" : "var(--ink-0)", color: activeCat === c.id ? "var(--ink-0)" : "var(--ink-600)", border: `1px solid ${activeCat === c.id ? "var(--accent)" : "var(--ink-200)"}` }}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-[var(--r-md)] px-3 py-1.5" style={{ border: "1px solid var(--ink-200)", background: "var(--ink-0)" }}>
            <svg {...sv} style={{ color: "var(--ink-400)" }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..."
              className="w-32 bg-transparent text-[12px] outline-none" style={{ color: "var(--ink-900)" }} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main table */}
        <div className="flex-1 overflow-auto">
          {/* Table header */}
          <div className="flex items-center gap-3 px-7 py-2" style={{ background: "var(--ink-50)", borderBottom: "1px solid var(--ink-200)" }}>
            <span className="w-8 font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>#</span>
            <span className="w-10" />
            <span className="flex-1 font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Item</span>
            <span className="w-20 font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Category</span>
            <span className="w-16 text-right font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Price</span>
            <span className="w-20 text-center font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Available</span>
            <span className="w-16 text-center font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Actions</span>
          </div>

          {/* Rows */}
          <div style={{ background: "var(--ink-0)" }}>
            {filteredItems.map((item, i) => (
              <div key={item.id}
                className="flex items-center gap-3 px-7 py-2.5 transition"
                style={{
                  borderBottom: "1px solid var(--ink-100)",
                  background: editItem?.id === item.id ? "var(--accent-soft)" : "var(--ink-0)",
                  opacity: item.isUnavailable ? 0.5 : 1,
                }}>
                {/* # */}
                <span className="w-8 font-mono text-[11px]" style={{ color: "var(--ink-400)" }}>{i + 1}</span>
                {/* Thumbnail */}
                <div className="h-9 w-9 flex-shrink-0 rounded-[var(--r-md)] overflow-hidden"
                  style={{ background: item.imageUrl
                    ? `url(${item.imageUrl.startsWith("/") ? "http://localhost:4000" + item.imageUrl : item.imageUrl}) center/cover`
                    : grad(item.id) }} />
                {/* Name + badges */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold truncate" style={{ color: "var(--ink-900)", textDecoration: item.isUnavailable ? "line-through" : "none" }}>{item.name}</span>
                    {item.isVegetarian && <span className="rounded px-1 py-0.5 text-[8px] font-bold uppercase" style={{ background: "var(--ok-soft)", color: "var(--ok)", border: "1px solid #bbf7d0" }}>V</span>}
                    {item.isSpicy && <span className="rounded px-1 py-0.5 text-[8px] font-bold uppercase" style={{ background: "var(--bad-soft)", color: "var(--bad)", border: "1px solid #fecaca" }}>S</span>}
                  </div>
                  {item.prepTimeMinutes && <span className="font-mono text-[9px]" style={{ color: "var(--ink-400)" }}>{item.prepTimeMinutes} min</span>}
                </div>
                {/* Category */}
                <span className="w-20 text-[11px] truncate" style={{ color: "var(--ink-500)" }}>{item.categoryName}</span>
                {/* Price */}
                <span className="w-16 text-right font-mono text-[13px] font-bold" style={{ color: "var(--accent)" }}>${parseFloat(item.price).toFixed(2)}</span>
                {/* Toggle */}
                <div className="w-20 flex justify-center">
                  <button onClick={() => toggle(item.id, item.isUnavailable)} disabled={busy === item.id}
                    className="relative h-5 w-9 rounded-full transition disabled:opacity-40"
                    style={{ background: item.isUnavailable ? "var(--ink-200)" : "var(--ok)" }}>
                    <span className="absolute top-0.5 h-4 w-4 rounded-full transition-all" style={{
                      background: "var(--ink-0)",
                      left: item.isUnavailable ? 2 : 18,
                      boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                    }} />
                  </button>
                </div>
                {/* Edit button */}
                <div className="w-16 flex justify-center">
                  <button onClick={() => editItem?.id === item.id ? setEditItem(null) : openEdit(item)}
                    className="rounded-[var(--r-sm)] p-1.5 transition hover:opacity-80"
                    style={{ background: editItem?.id === item.id ? "var(--accent)" : "var(--ink-100)", color: editItem?.id === item.id ? "var(--ink-0)" : "var(--ink-500)" }}>
                    <svg {...sv}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </button>
                </div>
              </div>
            ))}
            {filteredItems.length === 0 && (
              <div className="py-12">
                <EmptyState icon="&#x1F37D;&#xFE0F;" title="No items found" description={search ? "Try a different search term." : "No menu items in this category."} />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-7 py-2.5" style={{ background: "var(--ink-50)", borderTop: "1px solid var(--ink-200)" }}>
            <span className="font-mono text-[10px]" style={{ color: "var(--ink-400)" }}>
              Showing {filteredItems.length} of {totalItems} items
            </span>
            <span className="font-mono text-[9px]" style={{ color: "var(--ink-400)" }}>
              Tip: Use the toggle to quickly update item availability. Changes are saved instantly.
            </span>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="hidden w-[280px] flex-shrink-0 flex-col lg:flex" style={{ borderLeft: "1px solid var(--ink-200)", background: "var(--ink-0)" }}>
          {/* Menu Overview — with dot indicators and percentages */}
          <div className="p-5" style={{ borderBottom: "1px solid var(--ink-200)" }}>
            <h3 className="font-serif text-[14px] font-bold" style={{ color: "var(--ink-900)" }}>Menu <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Overview</em></h3>
            <div className="mt-4 space-y-3.5">
              {[
                { dot: "var(--ink-400)", label: "Total Categories", value: categories?.length ?? 0 },
                { dot: "var(--accent)", label: "Total Items", value: totalItems },
                { dot: "var(--ok)", label: "Available Items", value: availableItems, pct: totalItems > 0 ? ((availableItems / totalItems) * 100).toFixed(1) : "0" },
                { dot: "var(--bad)", label: "Unavailable Items", value: unavailableItems, pct: totalItems > 0 ? ((unavailableItems / totalItems) * 100).toFixed(1) : "0" },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: s.dot }} />
                  <span className="flex-1 text-[12px]" style={{ color: "var(--ink-600)" }}>{s.label}</span>
                  <div className="text-right">
                    <span className="font-serif text-[16px] font-extrabold" style={{ color: "var(--ink-900)" }}>{s.value}</span>
                    {s.pct !== undefined && <div className="font-mono text-[9px]" style={{ color: s.dot }}>{s.pct}%</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Edit */}
          <div className="flex-1 overflow-auto p-5">
            {createOpen ? (
              <>
                <h3 className="font-serif text-[14px] font-bold mb-4" style={{ color: "var(--ink-900)" }}>Add <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Menu Item</em></h3>
                <div className="rounded-[var(--r-lg)] p-3 mb-4" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-edge)" }}>
                  <div className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--accent)" }}>New item</div>
                  <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--ink-600)" }}>Add the customer-facing details, photo, and optional add-ons in one flow.</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Photo</label>
                    <label className="mt-1 block cursor-pointer overflow-hidden rounded-[var(--r-lg)]" style={{ border: "1px solid var(--ink-200)", background: newImagePreview ? `url(${newImagePreview}) center/cover` : "var(--ink-50)" }}>
                      <div className="flex h-28 flex-col items-center justify-center gap-2 text-center" style={{ background: newImagePreview ? "rgba(0,0,0,0.35)" : "transparent", color: newImagePreview ? "white" : "var(--ink-500)" }}>
                        <svg {...sv}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                        <span className="text-[11px] font-semibold">{newImageFile ? newImageFile.name : "Choose item photo"}</span>
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={e => {
                        const file = e.target.files?.[0] ?? null;
                        setNewImageFile(file);
                        setNewImagePreview(file ? URL.createObjectURL(file) : "");
                      }} />
                    </label>
                  </div>
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Category *</label>
                    <select value={newCategoryId} onChange={e => setNewCategoryId(e.target.value)}
                      className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
                      style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)", background: "var(--ink-0)" }}>
                      <option value="">Select category</option>
                      {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Item Name *</label>
                    <input value={newName} onChange={e => setNewName(e.target.value)}
                      className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
                      style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Price *</label>
                      <input value={newPrice} onChange={e => setNewPrice(e.target.value)} type="number" min="0" step="0.01"
                        className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
                        style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                    </div>
                    <div>
                      <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Prep Min</label>
                      <input value={newPrep} onChange={e => setNewPrep(e.target.value)} type="number" min="1"
                        className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
                        style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                    </div>
                  </div>
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Tax Class</label>
                    <select value={newTaxClass} onChange={e => setNewTaxClass(e.target.value)}
                      className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
                      style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)", background: "var(--ink-0)" }}>
                      <option value="FOOD">Food</option>
                      <option value="BEVERAGE">Beverage</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 rounded-[var(--r-md)] px-3 py-2 text-[11px]" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>
                      <input type="checkbox" checked={newVegetarian} onChange={e => setNewVegetarian(e.target.checked)} />
                      Vegetarian
                    </label>
                    <label className="flex items-center gap-2 rounded-[var(--r-md)] px-3 py-2 text-[11px]" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>
                      <input type="checkbox" checked={newSpicy} onChange={e => setNewSpicy(e.target.checked)} />
                      Spicy
                    </label>
                  </div>
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Description</label>
                    <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2}
                      className="mt-1 w-full resize-none rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
                      style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                  </div>
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Ingredients</label>
                    <textarea value={newIngredients} onChange={e => setNewIngredients(e.target.value)} rows={2}
                      className="mt-1 w-full resize-none rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
                      style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                  </div>
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Dietary Notes</label>
                    <input value={newDietaryInfo} onChange={e => setNewDietaryInfo(e.target.value)} placeholder="e.g. Contains nuts, gluten-free"
                      className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
                      style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                  </div>
                  <div className="rounded-[var(--r-md)] p-3" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Add-ons</label>
                      <button type="button" onClick={() => setNewAdditions([...newAdditions, { name: "", priceImpact: "0", isRequired: false, maxSelectable: "" }])}
                        className="rounded-[var(--r-sm)] px-2 py-1 text-[10px] font-semibold"
                        style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>Add</button>
                    </div>
                    {newAdditions.length === 0 ? (
                      <p className="text-[11px]" style={{ color: "var(--ink-400)" }}>Optional extras like extra cheese, sauces, or required choices.</p>
                    ) : (
                      <div className="space-y-2">
                        {newAdditions.map((addition, index) => (
                          <div key={index} className="rounded-[var(--r-md)] p-2" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-100)" }}>
                            <div className="grid grid-cols-[1fr_70px_24px] gap-1.5">
                              <input value={addition.name} onChange={e => setNewAdditions(newAdditions.map((a, i) => i === index ? { ...a, name: e.target.value } : a))} placeholder="Name"
                                className="rounded-[var(--r-sm)] px-2 py-1.5 text-[11px] outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                              <input value={addition.priceImpact} onChange={e => setNewAdditions(newAdditions.map((a, i) => i === index ? { ...a, priceImpact: e.target.value } : a))} type="number" step="0.01" placeholder="Price"
                                className="rounded-[var(--r-sm)] px-2 py-1.5 text-[11px] outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                              <button type="button" onClick={() => setNewAdditions(newAdditions.filter((_, i) => i !== index))}
                                className="rounded-[var(--r-sm)] text-[12px] font-bold" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>x</button>
                            </div>
                            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                              <label className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--ink-600)" }}>
                                <input type="checkbox" checked={addition.isRequired} onChange={e => setNewAdditions(newAdditions.map((a, i) => i === index ? { ...a, isRequired: e.target.checked } : a))} />
                                Required
                              </label>
                              <input value={addition.maxSelectable} onChange={e => setNewAdditions(newAdditions.map((a, i) => i === index ? { ...a, maxSelectable: e.target.value } : a))} type="number" min="1" placeholder="Max"
                                className="rounded-[var(--r-sm)] px-2 py-1.5 text-[10px] outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  <button onClick={() => setCreateOpen(false)}
                    className="flex-1 rounded-[var(--r-md)] py-2.5 text-[12px] font-semibold transition"
                    style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>
                    Cancel
                  </button>
                  <button onClick={createItem} disabled={saving || !newCategoryId || !newName || !newPrice}
                    className="flex-1 rounded-[var(--r-md)] py-2.5 text-[12px] font-semibold transition disabled:opacity-50"
                    style={{ background: "var(--accent)", color: "var(--ink-0)" }}>
                    {saving ? "Creating..." : "Create Item"}
                  </button>
                </div>
              </>
            ) : !editItem ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--ink-100)", color: "var(--ink-400)" }}>
                  <svg {...sv}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </div>
                <p className="mt-2 text-[12px] font-medium" style={{ color: "var(--ink-500)" }}>Quick Edit</p>
                <p className="mt-0.5 text-[10px]" style={{ color: "var(--ink-400)" }}>Select an item to edit its details or add a new one</p>
                <button onClick={openCreate}
                  className="mt-4 rounded-[var(--r-md)] px-3 py-2 text-[11px] font-semibold"
                  style={{ background: "var(--accent)", color: "var(--ink-0)" }}>
                  Add Item
                </button>
              </div>
            ) : (
              <>
                <h3 className="font-serif text-[14px] font-bold mb-4" style={{ color: "var(--ink-900)" }}>Quick <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Edit</em></h3>

                {/* Item image + upload */}
                <div className="relative mb-4 overflow-hidden rounded-[var(--r-lg)]" style={{ border: "1px solid var(--ink-100)" }}>
                  <div className="h-32 w-full" style={{
                    background: editItem.imageUrl
                      ? `url(${editItem.imageUrl.startsWith("/") ? "http://localhost:4000" + editItem.imageUrl : editItem.imageUrl}) center/cover`
                      : grad(editItem.id),
                  }}>
                    <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5), transparent 60%)" }} />
                  </div>
                  {/* Name overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-[13px] font-semibold text-white">{editItem.name}</div>
                        <div className="text-[10px] text-white/70">{allItems.find(i => i.id === editItem.id)?.categoryName ?? "—"}</div>
                      </div>
                      <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{
                        background: editItem.isUnavailable ? "var(--bad)" : "var(--ok)",
                        color: "var(--ink-0)",
                      }}>{editItem.isUnavailable ? "Unavailable" : "Available"}</span>
                    </div>
                  </div>
                  {/* Upload button */}
                  <label className="absolute top-2 right-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition hover:scale-110"
                    style={{ background: "rgba(255,255,255,0.9)", color: "var(--ink-700)" }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !token) return;
                      setUploading(true);
                      try {
                        const fd = new FormData();
                        fd.append("image", file);
                        const updated = await authUpload<MenuItem>(`/api/menu/items/${editItem.id}/image`, token, fd);
                        setEditItem({ ...editItem, imageUrl: updated.imageUrl });
                        qc.invalidateQueries({ queryKey: ["admin-menu"] });
                        toast("Image uploaded");
                      } catch (err) { toast(err instanceof Error ? err.message : "Upload failed", "error"); }
                      finally { setUploading(false); e.target.value = ""; }
                    }} />
                  </label>
                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
                      <div className="h-5 w-5 animate-spin rounded-full" style={{ border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
                    </div>
                  )}
                </div>

                {/* Form fields */}
                <div className="space-y-3">
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Item Name</label>
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
                      style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Category</label>
                      <select value={editCategoryId} onChange={e => setEditCategoryId(e.target.value)}
                        className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
                        style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)", background: "var(--ink-0)" }}>
                        {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Price</label>
                      <input value={editPrice} onChange={e => setEditPrice(e.target.value)} type="number" step="0.01"
                        className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
                        style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 rounded-[var(--r-md)] px-3 py-2 text-[11px]" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>
                      <input type="checkbox" checked={editVegetarian} onChange={e => setEditVegetarian(e.target.checked)} />
                      Vegetarian
                    </label>
                    <label className="flex items-center gap-2 rounded-[var(--r-md)] px-3 py-2 text-[11px]" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>
                      <input type="checkbox" checked={editSpicy} onChange={e => setEditSpicy(e.target.checked)} />
                      Spicy
                    </label>
                  </div>

                  {/* Availability toggle — uses real PATCH endpoint */}
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Availability</label>
                    <button onClick={() => { toggle(editItem.id, editItem.isUnavailable); setEditItem({ ...editItem, isUnavailable: !editItem.isUnavailable }); }}
                      disabled={busy === editItem.id}
                      className="mt-1 flex w-full items-center gap-2.5 rounded-[var(--r-md)] px-3 py-2.5 transition disabled:opacity-50"
                      style={{ border: "1px solid var(--ink-200)", background: "var(--ink-0)" }}>
                      <span className="relative h-5 w-9 rounded-full flex-shrink-0" style={{ background: editItem.isUnavailable ? "var(--ink-200)" : "var(--ok)" }}>
                        <span className="absolute top-0.5 h-4 w-4 rounded-full transition-all" style={{ background: "var(--ink-0)", left: editItem.isUnavailable ? 2 : 18, boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }} />
                      </span>
                      <span className="text-[11px] font-medium" style={{ color: editItem.isUnavailable ? "var(--bad)" : "var(--ok)" }}>
                        {editItem.isUnavailable ? "Unavailable" : "Available"}
                      </span>
                    </button>
                  </div>

                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Description</label>
                    <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={2}
                      className="mt-1 w-full resize-none rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
                      style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                  </div>
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Ingredients</label>
                    <textarea value={editIngredients} onChange={e => setEditIngredients(e.target.value)} rows={2}
                      className="mt-1 w-full resize-none rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
                      style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Dietary Notes</label>
                      <input value={editDietaryInfo} onChange={e => setEditDietaryInfo(e.target.value)}
                        className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
                        style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                    </div>
                    <div>
                      <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Tax Class</label>
                      <select value={editTaxClass} onChange={e => setEditTaxClass(e.target.value)}
                        className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
                        style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)", background: "var(--ink-0)" }}>
                        <option value="FOOD">Food</option>
                        <option value="BEVERAGE">Beverage</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  </div>
                  <div className="rounded-[var(--r-md)] p-3" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Add-ons</label>
                      <button type="button" onClick={() => setEditAdditions([...editAdditions, { name: "", priceImpact: "0", isRequired: false, maxSelectable: "" }])}
                        className="rounded-[var(--r-sm)] px-2 py-1 text-[10px] font-semibold"
                        style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>Add</button>
                    </div>
                    {editAdditions.length === 0 ? (
                      <p className="text-[11px]" style={{ color: "var(--ink-400)" }}>No add-ons configured for this item.</p>
                    ) : (
                      <div className="space-y-2">
                        {editAdditions.map((addition, index) => (
                          <div key={index} className="rounded-[var(--r-md)] p-2" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-100)" }}>
                            <div className="grid grid-cols-[1fr_70px_24px] gap-1.5">
                              <input value={addition.name} onChange={e => setEditAdditions(editAdditions.map((a, i) => i === index ? { ...a, name: e.target.value } : a))} placeholder="Name"
                                className="rounded-[var(--r-sm)] px-2 py-1.5 text-[11px] outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                              <input value={addition.priceImpact} onChange={e => setEditAdditions(editAdditions.map((a, i) => i === index ? { ...a, priceImpact: e.target.value } : a))} type="number" step="0.01" placeholder="Price"
                                className="rounded-[var(--r-sm)] px-2 py-1.5 text-[11px] outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                              <button type="button" onClick={() => setEditAdditions(editAdditions.filter((_, i) => i !== index))}
                                className="rounded-[var(--r-sm)] text-[12px] font-bold" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>x</button>
                            </div>
                            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                              <label className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--ink-600)" }}>
                                <input type="checkbox" checked={addition.isRequired} onChange={e => setEditAdditions(editAdditions.map((a, i) => i === index ? { ...a, isRequired: e.target.checked } : a))} />
                                Required
                              </label>
                              <input value={addition.maxSelectable} onChange={e => setEditAdditions(editAdditions.map((a, i) => i === index ? { ...a, maxSelectable: e.target.value } : a))} type="number" min="1" placeholder="Max"
                                className="rounded-[var(--r-sm)] px-2 py-1.5 text-[10px] outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-5 flex gap-2">
                  <button onClick={() => setEditItem(null)}
                    className="flex-1 rounded-[var(--r-md)] py-2.5 text-[12px] font-semibold transition"
                    style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>
                    Cancel
                  </button>
                  <button onClick={saveEdit} disabled={saving}
                    className="flex-1 rounded-[var(--r-md)] py-2.5 text-[12px] font-semibold transition disabled:opacity-50"
                    style={{ background: "var(--accent)", color: "var(--ink-0)" }}>
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
