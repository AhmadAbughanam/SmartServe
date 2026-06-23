"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { authDelete, authGet, authPost, authPatch } from "../../../lib/api";
import { LoadingScreen, EmptyState, useToast } from "../../../components/ui";

const sv = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

interface Discount {
  id: string; name: string; description: string | null; type: string; value: string;
  scope: string; isActive: boolean; startAt: string | null; endAt: string | null;
  branchId: string | null; createdAt: string; updatedAt: string;
  _count?: { coupons: number };
  coupons?: Array<{ _count: { redemptions: number } }>;
}
interface Coupon { id: string; code: string; discountId: string; isActive: boolean; expiresAt: string | null; maxRedemptions: number | null; perUserLimit: number | null; discount: { name: string; type: string; value: string; isActive: boolean }; }
interface GiftCard { id: string; code: string; initialAmount: string; balanceAmount: string; status: string; expiresAt: string | null; }
interface LoyaltyReward { id: string; name: string; pointsCost: number; rewardValue: string; isActive: boolean; _count?: { redemptions: number }; }
interface LoyaltyProgram { id: string; name: string; pointsPerCurrency: string; pointsPerReward: number; rewardValue: string; pointExpiryMonths: number; isActive: boolean; rewards: LoyaltyReward[]; }
interface LoyaltyMember { id: string; pointsBalance: number; lifetimePoints: number; tier: string; updatedAt: string; user: { id: string; name: string; phone: string; email: string | null; lastVisitAt: string | null }; _count: { ledgerEntries: number; redemptions: number }; }
interface LoyaltyMembersResponse { totalMembers: number; pointsLiability: number; lifetimePoints: number; members: LoyaltyMember[]; }

const grads = ["linear-gradient(135deg,#c2410c,#7c2d12)","linear-gradient(135deg,#15803d,#14532d)","linear-gradient(135deg,#b45309,#78350f)","linear-gradient(135deg,#0e7490,#164e63)","linear-gradient(135deg,#9333ea,#581c87)","linear-gradient(135deg,#dc2626,#7f1d1d)"];
function grad(id: string) { let h = 0; for (const c of id) h = ((h << 5) - h + c.charCodeAt(0)) | 0; return grads[Math.abs(h) % grads.length]; }

const ROWS_PER_PAGE = 10;

export default function AdminPromotionsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"discounts" | "coupons" | "gift-cards" | "loyalty">("discounts");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name-asc");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(0);
  const { toast } = useToast();

  /* Sidebar */
  const [sideOpen, setSideOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  /* Discount form */
  const [dType, setDType] = useState("PERCENT"); const [dName, setDName] = useState(""); const [dDesc, setDDesc] = useState("");
  const [dValue, setDValue] = useState(""); const [dScope, setDScope] = useState("ORDER");
  const [dStartAt, setDStartAt] = useState(""); const [dEndAt, setDEndAt] = useState(""); const [dActive, setDActive] = useState(true);
  /* Coupon form */
  const [cCode, setCCode] = useState(""); const [cDiscountId, setCDiscountId] = useState("");
  const [cMaxR, setCMaxR] = useState(""); const [cExpiresAt, setCExpiresAt] = useState("");
  const [cPerUser, setCPerUser] = useState(""); const [cActive, setCActive] = useState(true);
  /* Gift Card form */
  const [gCode, setGCode] = useState(""); const [gAmount, setGAmount] = useState("");
  const [gStatus, setGStatus] = useState("ACTIVE"); const [gExpiresAt, setGExpiresAt] = useState("");
  /* Loyalty settings */
  const [lName, setLName] = useState(""); const [lEarnRate, setLEarnRate] = useState("1");
  const [lRewardPoints, setLRewardPoints] = useState("100"); const [lRewardValue, setLRewardValue] = useState("5");
  const [lExpiryMonths, setLExpiryMonths] = useState("12"); const [lActive, setLActive] = useState(false);
  const [lrName, setLrName] = useState(""); const [lrCost, setLrCost] = useState(""); const [lrValue, setLrValue] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: discounts, isLoading: dl } = useQuery({ queryKey: ["promo-discounts"], queryFn: () => authGet<Discount[]>("/api/promotions/discounts") });
  const { data: coupons } = useQuery({ queryKey: ["promo-coupons"], queryFn: () => authGet<Coupon[]>("/api/promotions/coupons") });
  const { data: giftCards } = useQuery({ queryKey: ["promo-gift-cards"], queryFn: () => authGet<GiftCard[]>("/api/promotions/gift-cards") });
  const { data: loyaltyProgram, isLoading: loyaltyLoading, error: loyaltyError } = useQuery({ queryKey: ["loyalty-program"], queryFn: () => authGet<LoyaltyProgram>("/api/admin/loyalty/program") });
  const { data: loyaltyRewards } = useQuery({ queryKey: ["loyalty-rewards"], queryFn: () => authGet<LoyaltyReward[]>("/api/admin/loyalty/rewards") });
  const { data: loyaltyMembers } = useQuery({ queryKey: ["loyalty-members"], queryFn: () => authGet<LoyaltyMembersResponse>("/api/admin/loyalty/members") });

  useEffect(() => {
    if (!loyaltyProgram) return;
    setLName(loyaltyProgram.name);
    setLEarnRate(String(parseFloat(loyaltyProgram.pointsPerCurrency)));
    setLRewardPoints(String(loyaltyProgram.pointsPerReward));
    setLRewardValue(String(parseFloat(loyaltyProgram.rewardValue)));
    setLExpiryMonths(String(loyaltyProgram.pointExpiryMonths));
    setLActive(loyaltyProgram.isActive);
  }, [loyaltyProgram]);

  function resetForm() { setDName(""); setDDesc(""); setDType("PERCENT"); setDValue(""); setDScope("ORDER"); setDStartAt(""); setDEndAt(""); setDActive(true); setCCode(""); setCDiscountId(""); setCMaxR(""); setCExpiresAt(""); setCPerUser(""); setCActive(true); setGCode(""); setGAmount(""); setGStatus("ACTIVE"); setGExpiresAt(""); setEditingId(null); }
  function openNew() { resetForm(); if (tab === "loyalty") setTab("discounts"); setSideOpen(true); }
  function openEdit(d: Discount) {
    setEditingId(d.id); setSideOpen(true); setTab("discounts");
    setDName(d.name); setDDesc(d.description ?? ""); setDType(d.type); setDValue(d.value); setDScope(d.scope ?? "ORDER");
    setDStartAt(d.startAt ? d.startAt.slice(0, 10) : ""); setDEndAt(d.endAt ? d.endAt.slice(0, 10) : ""); setDActive(d.isActive);
  }
  function openEditCoupon(c: Coupon) {
    resetForm(); setEditingId(c.id); setSideOpen(true); setTab("coupons");
    setCCode(c.code); setCDiscountId(c.discountId); setCMaxR(c.maxRedemptions ? String(c.maxRedemptions) : "");
    setCPerUser(c.perUserLimit ? String(c.perUserLimit) : ""); setCExpiresAt(c.expiresAt ? c.expiresAt.slice(0, 10) : ""); setCActive(c.isActive);
  }
  function openEditGiftCard(g: GiftCard) {
    resetForm(); setEditingId(g.id); setSideOpen(true); setTab("gift-cards");
    setGCode(g.code); setGAmount(g.initialAmount); setGStatus(g.status); setGExpiresAt(g.expiresAt ? g.expiresAt.slice(0, 10) : "");
  }

  async function saveDiscount() {
    if (!dName || !dValue) return; setBusy(true);
    try {
      if (editingId) {
        await authPatch(`/api/promotions/discounts/${editingId}`, undefined, { name: dName, description: dDesc || undefined, value: parseFloat(dValue), scope: dScope, startAt: dStartAt || undefined, endAt: dEndAt || undefined, isActive: dActive });
        toast("Discount updated");
      } else {
        await authPost("/api/promotions/discounts", undefined, { name: dName, description: dDesc || undefined, type: dType, value: parseFloat(dValue), scope: dScope, startAt: dStartAt || undefined, endAt: dEndAt || undefined });
        toast("Discount created");
      }
      qc.invalidateQueries({ queryKey: ["promo-discounts"] }); setSideOpen(false); resetForm();
    } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); } finally { setBusy(false); }
  }
  async function saveCoupon() {
    if (!cCode || !cDiscountId) return; setBusy(true);
    try {
      const payload = { code: cCode, discountId: cDiscountId, maxRedemptions: cMaxR ? parseInt(cMaxR) : undefined, perUserLimit: cPerUser ? parseInt(cPerUser) : undefined, expiresAt: cExpiresAt || undefined, isActive: cActive };
      if (editingId) {
        await authPatch(`/api/promotions/coupons/${editingId}`, undefined, payload);
        toast("Coupon updated");
      } else {
        await authPost("/api/promotions/coupons", undefined, payload);
        toast("Coupon created");
      }
      qc.invalidateQueries({ queryKey: ["promo-coupons"] }); setSideOpen(false); resetForm();
    }
    catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); } finally { setBusy(false); }
  }
  async function saveGiftCard() {
    if (!gCode || !gAmount) return; setBusy(true);
    try {
      if (editingId) {
        await authPatch(`/api/promotions/gift-cards/${editingId}`, undefined, { status: gStatus, expiresAt: gExpiresAt || undefined });
        toast("Gift card updated");
      } else {
        await authPost("/api/promotions/gift-cards", undefined, { code: gCode, initialAmount: parseFloat(gAmount), expiresAt: gExpiresAt || undefined });
        toast("Gift card created");
      }
      qc.invalidateQueries({ queryKey: ["promo-gift-cards"] }); setSideOpen(false); resetForm();
    }
    catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); } finally { setBusy(false); }
  }
  async function deletePromotion(kind: "discounts" | "coupons" | "gift-cards", id: string) {
    const label = kind === "discounts" ? "discount" : kind === "coupons" ? "coupon" : "gift card";
    if (!window.confirm(`Delete this ${label}? Used records will be disabled to preserve history.`)) return;
    setBusy(true);
    try {
      await authDelete(`/api/promotions/${kind}/${id}`);
      qc.invalidateQueries({ queryKey: ["promo-discounts"] });
      qc.invalidateQueries({ queryKey: ["promo-coupons"] });
      qc.invalidateQueries({ queryKey: ["promo-gift-cards"] });
      toast(`${label[0].toUpperCase()}${label.slice(1)} deleted`);
      if (editingId === id) { setSideOpen(false); resetForm(); }
    } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); } finally { setBusy(false); }
  }
  async function saveLoyaltyProgram() {
    setBusy(true);
    try {
      await authPatch("/api/admin/loyalty/program", undefined, {
        name: lName || "Default Loyalty Program",
        pointsPerCurrency: parseFloat(lEarnRate),
        pointsPerReward: parseInt(lRewardPoints),
        rewardValue: parseFloat(lRewardValue),
        pointExpiryMonths: parseInt(lExpiryMonths),
        isActive: lActive,
      });
      qc.invalidateQueries({ queryKey: ["loyalty-program"] });
      toast("Loyalty program saved");
    } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); } finally { setBusy(false); }
  }
  async function createLoyaltyReward() {
    if (!lrName || !lrCost || !lrValue) return; setBusy(true);
    try {
      await authPost("/api/admin/loyalty/rewards", undefined, { name: lrName, pointsCost: parseInt(lrCost), rewardValue: parseFloat(lrValue), isActive: true });
      setLrName(""); setLrCost(""); setLrValue("");
      qc.invalidateQueries({ queryKey: ["loyalty-rewards"] });
      qc.invalidateQueries({ queryKey: ["loyalty-program"] });
      toast("Loyalty reward created");
    } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); } finally { setBusy(false); }
  }
  async function toggleLoyaltyReward(reward: LoyaltyReward) {
    setBusy(true);
    try {
      await authPatch(`/api/admin/loyalty/rewards/${reward.id}`, undefined, { isActive: !reward.isActive });
      qc.invalidateQueries({ queryKey: ["loyalty-rewards"] });
      toast(reward.isActive ? "Reward paused" : "Reward activated");
    } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); } finally { setBusy(false); }
  }
  async function deleteLoyaltyReward(id: string) {
    if (!window.confirm("Delete this loyalty reward? Used rewards will be disabled to preserve history.")) return;
    setBusy(true);
    try {
      await authDelete(`/api/admin/loyalty/rewards/${id}`);
      qc.invalidateQueries({ queryKey: ["loyalty-rewards"] });
      qc.invalidateQueries({ queryKey: ["loyalty-program"] });
      toast("Loyalty reward deleted");
    } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); } finally { setBusy(false); }
  }

  if (dl) return <LoadingScreen message="Loading promotions..." />;

  /* Computed stats */
  const activePromos = (discounts ?? []).filter(d => d.isActive).length;
  const totalCoupons = coupons?.length ?? 0;
  const totalSavings = (discounts ?? []).reduce((s, d) => s + parseFloat(d.value), 0);
  const expiringSoon = (coupons ?? []).filter(c => c.expiresAt && new Date(c.expiresAt).getTime() - Date.now() < 7 * 86400000 && new Date(c.expiresAt).getTime() > Date.now()).length;
  const loyaltyActiveRewards = (loyaltyRewards ?? []).filter(r => r.isActive).length;
  const loyaltyTopMember = loyaltyMembers?.members?.[0];

  /* Filtered + sorted discounts */
  const q = search.toLowerCase().trim();
  let filtered = (discounts ?? []).filter(d => (!q || d.name.toLowerCase().includes(q)) && (filterStatus === "all" || (filterStatus === "active" ? d.isActive : !d.isActive)));
  if (sort === "name-asc") filtered.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === "name-desc") filtered.sort((a, b) => b.name.localeCompare(a.name));
  else if (sort === "value-desc") filtered.sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
  else if (sort === "newest") filtered.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
  const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);
  const paged = filtered.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);

  function getRedemptions(d: Discount): number { return (d.coupons ?? []).reduce((s, c) => s + (c._count?.redemptions ?? 0), 0); }
  function getStatus(d: Discount): string {
    if (!d.isActive) return "Paused";
    if (d.endAt && new Date(d.endAt) < new Date()) return "Expired";
    if (d.startAt && new Date(d.startAt) > new Date()) return "Scheduled";
    return "Active";
  }
  function statusStyle(s: string) {
    if (s === "Active") return { bg: "var(--ok-soft)", color: "var(--ok)", border: "#bbf7d0" };
    if (s === "Scheduled") return { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" };
    if (s === "Paused") return { bg: "var(--warn-soft)", color: "var(--warn)", border: "#fde68a" };
    return { bg: "var(--bad-soft)", color: "var(--bad)", border: "#fecaca" };
  }
  function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString("en", { month: "short", day: "numeric", year: "2-digit" }) : "—"; }
  function scheduleLabel(d: Discount) {
    if (d.startAt && d.endAt) return `${fmtDate(d.startAt)} - ${fmtDate(d.endAt)}`;
    if (d.startAt) return `From ${fmtDate(d.startAt)}`;
    if (d.endAt) return `Until ${fmtDate(d.endAt)}`;
    return "Always";
  }

  const inputCls = "mt-1 w-full rounded-[var(--r-md)] px-3 py-2.5 text-[12px] outline-none";
  const inputSt: React.CSSProperties = { border: "1px solid var(--ink-200)", color: "var(--ink-900)", background: "var(--ink-0)" };

  return (
    <div className="flex h-full flex-col" style={{ minHeight: "100%" }}>
      {/* ── Header ── */}
      <div className="px-7 py-4" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-[22px] font-extrabold tracking-tight leading-none" style={{ color: "var(--ink-900)" }}>Promotions <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Management</em></h1>
            <p className="mt-1 text-[11px]" style={{ color: "var(--ink-500)" }}>Manage discounts, coupons, and gift cards across all branches.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-[var(--r-md)] px-3 py-2 text-[11px] font-semibold" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>
              <svg {...sv}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>Export
            </button>
            <button onClick={openNew} className="flex items-center gap-1.5 rounded-[var(--r-md)] px-3 py-2 text-[11px] font-semibold" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>
              <svg {...sv}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>New Promotion
            </button>
          </div>
        </div>
        <div className="mt-3 flex gap-1.5">
          {(["discounts","coupons","gift-cards","loyalty"] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setPage(0); }}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition"
              style={{ background: tab === t ? "var(--accent)" : "var(--ink-0)", color: tab === t ? "var(--ink-0)" : "var(--ink-600)", border: `1px solid ${tab === t ? "var(--accent)" : "var(--ink-200)"}` }}>
              {t === "discounts" ? "Discounts" : t === "coupons" ? "Coupons" : t === "gift-cards" ? "Gift Cards" : "Loyalty"}
            </button>
          ))}
        </div>
        {/* KPIs */}
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { icon: <svg {...sv}><polyline points="20 6 9 17 4 12" /></svg>, label: "Active Promos", value: activePromos, color: "var(--ok)" },
            { icon: <svg {...sv}><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>, label: "Total Coupons", value: totalCoupons, color: "var(--accent)" },
            { icon: <svg {...sv}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>, label: "Savings Total", value: `${totalSavings.toFixed(0)}`, color: "var(--ink-600)" },
            { icon: <svg {...sv}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>, label: "Expiring Soon", value: expiringSoon, color: "var(--warn)" },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2.5 rounded-[var(--r-md)] p-3" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
              <span style={{ color: s.color }}>{s.icon}</span>
              <div><div className="font-serif text-[18px] font-extrabold leading-none" style={{ color: "var(--ink-900)" }}>{s.value}</div><div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>{s.label}</div></div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">

          {/* Discounts tab — full table with reference design */}
          {tab === "discounts" && (<>
            {/* Search + Filter + Sort bar */}
            <div className="flex items-center gap-2 px-7 py-2 flex-wrap" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
              <div className="flex items-center gap-2 rounded-[var(--r-md)] px-3 py-1.5" style={{ border: "1px solid var(--ink-200)" }}>
                <svg {...sv} style={{ color: "var(--ink-400)" }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search promotions..." className="w-36 bg-transparent text-[12px] outline-none" style={{ color: "var(--ink-900)" }} />
              </div>
              <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value as typeof filterStatus); setPage(0); }}
                className="rounded-[var(--r-md)] px-3 py-1.5 text-[11px] font-medium outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)", background: "var(--ink-0)" }}>
                <option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option>
              </select>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="font-mono text-[9px]" style={{ color: "var(--ink-400)" }}>Sort:</span>
                <select value={sort} onChange={e => setSort(e.target.value)}
                  className="rounded-[var(--r-md)] px-2 py-1.5 text-[11px] font-medium outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)", background: "var(--ink-0)" }}>
                  <option value="name-asc">A-Z</option><option value="name-desc">Z-A</option><option value="value-desc">Value (high)</option><option value="newest">Newest</option>
                </select>
              </div>
            </div>

            {/* Table headers */}
            <div className="flex items-center gap-2 px-7 py-2" style={{ background: "var(--ink-50)", borderBottom: "1px solid var(--ink-200)" }}>
              <span className="w-14 font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Name</span>
              <span className="w-7" />
              <span className="flex-1 font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-400)" }}></span>
              <span className="w-16 font-mono text-[9px] font-medium uppercase tracking-widest hidden sm:block" style={{ color: "var(--ink-400)" }}>Type</span>
              <span className="w-12 font-mono text-[9px] font-medium uppercase tracking-widest hidden sm:block" style={{ color: "var(--ink-400)" }}>Scope</span>
              <span className="w-14 font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Value</span>
              <span className="w-20 font-mono text-[9px] font-medium uppercase tracking-widest hidden md:block" style={{ color: "var(--ink-400)" }}>Schedule</span>
              <span className="w-16 text-center font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Status</span>
              <span className="w-12 text-center font-mono text-[9px] font-medium uppercase tracking-widest hidden lg:block" style={{ color: "var(--ink-400)" }}>Redeem</span>
              <span className="w-16 font-mono text-[9px] font-medium uppercase tracking-widest hidden lg:block" style={{ color: "var(--ink-400)" }}>Updated</span>
              <span className="w-14 text-center font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Actions</span>
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-auto" style={{ background: "var(--ink-0)" }}>
              {paged.map((d) => {
                const st = getStatus(d);
                const sty = statusStyle(st);
                const redemptions = getRedemptions(d);
                return (
                  <div key={d.id} className="flex items-center gap-2 px-7 py-2.5 transition" style={{ borderBottom: "1px solid var(--ink-100)", background: editingId === d.id ? "var(--accent-soft)" : "var(--ink-0)" }}>
                    <div className="h-7 w-7 flex-shrink-0 rounded-[var(--r-sm)]" style={{ background: grad(d.id) }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-[12px] font-semibold truncate" style={{ color: "var(--ink-900)" }}>{d.name}</span>
                      {d.description && <div className="text-[9px] truncate" style={{ color: "var(--ink-400)" }}>{d.description}</div>}
                    </div>
                    <span className="w-16 text-[10px] hidden sm:block" style={{ color: "var(--ink-500)" }}>{d.type === "PERCENT" ? "Percentage" : "Fixed Amount"}</span>
                    <span className="w-12 text-[10px] hidden sm:block" style={{ color: "var(--ink-500)" }}>{d.scope === "ORDER" ? "Order" : "Items"}</span>
                    <span className="w-14 font-mono text-[12px] font-bold" style={{ color: "var(--accent)" }}>{d.type === "PERCENT" ? `${d.value}%` : `$${parseFloat(d.value).toFixed(0)}`}</span>
                    <span className="w-20 text-[9px] truncate hidden md:block" style={{ color: "var(--ink-500)" }}>{scheduleLabel(d)}</span>
                    <div className="w-16 flex justify-center">
                      <span className="rounded-full px-2 py-0.5 text-[8px] font-bold" style={{ background: sty.bg, color: sty.color, border: `1px solid ${sty.border}` }}>{st}</span>
                    </div>
                    <span className="w-12 text-center font-mono text-[10px] hidden lg:block" style={{ color: "var(--ink-600)" }}>{redemptions}</span>
                    <span className="w-16 text-[9px] hidden lg:block" style={{ color: "var(--ink-400)" }}>{fmtDate(d.updatedAt)}</span>
                    <div className="w-14 flex justify-center gap-1">
                      <button onClick={() => openEdit(d)} className="flex h-6 w-6 items-center justify-center rounded-[var(--r-sm)]" style={{ background: "var(--ink-100)", color: "var(--ink-500)" }}>
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      </button>
                      <button onClick={() => deletePromotion("discounts", d.id)} className="flex h-6 w-6 items-center justify-center rounded-[var(--r-sm)]" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
              {paged.length === 0 && <div className="py-12"><EmptyState icon="&#x1F3F7;&#xFE0F;" title="No promotions found" /></div>}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-7 py-2" style={{ background: "var(--ink-50)", borderTop: "1px solid var(--ink-200)" }}>
              <span className="font-mono text-[10px]" style={{ color: "var(--ink-400)" }}>Showing {page * ROWS_PER_PAGE + 1}-{Math.min((page + 1) * ROWS_PER_PAGE, filtered.length)} of {filtered.length} promotions</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="rounded-[var(--r-sm)] px-2 py-1 text-[11px] font-medium disabled:opacity-30" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-600)" }}>&lt;</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
                  <button key={i} onClick={() => setPage(i)} className="rounded-[var(--r-sm)] px-2.5 py-1 text-[11px] font-medium transition"
                    style={{ background: page === i ? "var(--accent)" : "var(--ink-0)", color: page === i ? "var(--ink-0)" : "var(--ink-600)", border: `1px solid ${page === i ? "var(--accent)" : "var(--ink-200)"}` }}>{i + 1}</button>
                ))}
                <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="rounded-[var(--r-sm)] px-2 py-1 text-[11px] font-medium disabled:opacity-30" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-600)" }}>&gt;</button>
                <span className="ml-2 font-mono text-[10px]" style={{ color: "var(--ink-400)" }}>{ROWS_PER_PAGE} / page</span>
              </div>
            </div>

            {/* Bottom: Coupons + Gift Cards mini tables */}
            <div className="grid gap-4 px-7 py-4 lg:grid-cols-2" style={{ background: "var(--ink-50)", borderTop: "1px solid var(--ink-200)" }}>
              <div className="rounded-[var(--r-lg)] overflow-hidden" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
                <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: "1px solid var(--ink-200)" }}>
                  <span className="font-serif text-[12px] font-bold" style={{ color: "var(--ink-900)" }}>Coupons <span className="font-mono text-[10px] font-normal" style={{ color: "var(--ink-400)" }}>({totalCoupons})</span></span>
                  <button onClick={() => setTab("coupons")} className="font-mono text-[10px]" style={{ color: "var(--accent)" }}>View all &rarr;</button>
                </div>
                {(coupons ?? []).slice(0, 3).map(c => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-1.5" style={{ borderBottom: "1px solid var(--ink-100)" }}>
                    <span className="font-mono text-[10px] font-bold" style={{ color: "var(--ink-900)" }}>{c.code}</span>
                    <span className="text-[9px]" style={{ color: "var(--ink-500)" }}>{c.discount.name}</span>
                    <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold" style={{ background: c.isActive ? "var(--ok-soft)" : "var(--ink-100)", color: c.isActive ? "var(--ok)" : "var(--ink-500)" }}>{c.isActive ? "Active" : "Off"}</span>
                  </div>
                ))}
                {(!coupons || coupons.length === 0) && <p className="px-4 py-3 text-center text-[10px]" style={{ color: "var(--ink-400)" }}>No coupons</p>}
              </div>
              <div className="rounded-[var(--r-lg)] overflow-hidden" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
                <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: "1px solid var(--ink-200)" }}>
                  <span className="font-serif text-[12px] font-bold" style={{ color: "var(--ink-900)" }}>Gift Cards <span className="font-mono text-[10px] font-normal" style={{ color: "var(--ink-400)" }}>({giftCards?.length ?? 0})</span></span>
                  <button onClick={() => setTab("gift-cards")} className="font-mono text-[10px]" style={{ color: "var(--accent)" }}>View all &rarr;</button>
                </div>
                {(giftCards ?? []).slice(0, 3).map(g => (
                  <div key={g.id} className="flex items-center justify-between px-4 py-1.5" style={{ borderBottom: "1px solid var(--ink-100)" }}>
                    <span className="font-mono text-[10px] font-bold" style={{ color: "var(--ink-900)" }}>{g.code}</span>
                    <span className="font-mono text-[10px]" style={{ color: "var(--accent)" }}>${parseFloat(g.balanceAmount).toFixed(2)}</span>
                    <span className="rounded-full px-1.5 py-0.5 text-[8px] font-bold" style={{ background: g.status === "ACTIVE" ? "var(--ok-soft)" : "var(--ink-100)", color: g.status === "ACTIVE" ? "var(--ok)" : "var(--ink-500)" }}>{g.status}</span>
                  </div>
                ))}
                {(!giftCards || giftCards.length === 0) && <p className="px-4 py-3 text-center text-[10px]" style={{ color: "var(--ink-400)" }}>No gift cards</p>}
              </div>
            </div>
          </>)}

          {/* Coupons tab */}
          {tab === "coupons" && (<div className="flex-1 overflow-auto" style={{ background: "var(--ink-0)" }}>
            <div className="flex items-center gap-2 px-7 py-2" style={{ background: "var(--ink-50)", borderBottom: "1px solid var(--ink-200)" }}>
              <span className="w-6 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>#</span>
              <span className="flex-1 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Code</span>
              <span className="flex-1 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Discount</span>
              <span className="w-14 font-mono text-[9px] uppercase tracking-widest hidden md:block" style={{ color: "var(--ink-400)" }}>Max</span>
              <span className="w-16 font-mono text-[9px] uppercase tracking-widest hidden md:block" style={{ color: "var(--ink-400)" }}>Expires</span>
              <span className="w-14 text-center font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Status</span>
              <span className="w-14 text-center font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Actions</span>
            </div>
            {(coupons ?? []).filter(c => !q || c.code.toLowerCase().includes(q)).map((c, i) => (
              <div key={c.id} className="flex items-center gap-2 px-7 py-2.5" style={{ borderBottom: "1px solid var(--ink-100)" }}>
                <span className="w-6 font-mono text-[11px]" style={{ color: "var(--ink-400)" }}>{i+1}</span>
                <span className="flex-1 font-mono text-[12px] font-bold" style={{ color: "var(--ink-900)" }}>{c.code}</span>
                <div className="flex-1"><span className="text-[11px]" style={{ color: "var(--ink-700)" }}>{c.discount.name}</span> <span className="font-mono text-[10px]" style={{ color: "var(--accent)" }}>{c.discount.type === "PERCENT" ? `${c.discount.value}%` : `$${c.discount.value}`}</span></div>
                <span className="w-14 font-mono text-[10px] hidden md:block" style={{ color: "var(--ink-500)" }}>{c.maxRedemptions ?? "∞"}</span>
                <span className="w-16 text-[10px] hidden md:block" style={{ color: "var(--ink-500)" }}>{c.expiresAt ? fmtDate(c.expiresAt) : "Never"}</span>
                <div className="w-14 flex justify-center"><span className="rounded-full px-2 py-0.5 text-[8px] font-bold" style={{ background: c.isActive ? "var(--ok-soft)" : "var(--ink-100)", color: c.isActive ? "var(--ok)" : "var(--ink-500)" }}>{c.isActive ? "Active" : "Off"}</span></div>
                <div className="w-14 flex justify-center gap-1">
                  <button onClick={() => openEditCoupon(c)} className="flex h-6 w-6 items-center justify-center rounded-[var(--r-sm)]" style={{ background: "var(--ink-100)", color: "var(--ink-500)" }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </button>
                  <button onClick={() => deletePromotion("coupons", c.id)} className="flex h-6 w-6 items-center justify-center rounded-[var(--r-sm)]" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>)}

          {/* Gift Cards tab */}
          {tab === "gift-cards" && (<div className="flex-1 overflow-auto" style={{ background: "var(--ink-0)" }}>
            <div className="flex items-center gap-2 px-7 py-2" style={{ background: "var(--ink-50)", borderBottom: "1px solid var(--ink-200)" }}>
              <span className="w-6 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>#</span>
              <span className="flex-1 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Code</span>
              <span className="w-16 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Initial</span>
              <span className="w-16 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Balance</span>
              <span className="w-14 text-center font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Status</span>
              <span className="w-14 text-center font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Actions</span>
            </div>
            {(giftCards ?? []).filter(g => !q || g.code.toLowerCase().includes(q)).map((g, i) => (
              <div key={g.id} className="flex items-center gap-2 px-7 py-2.5" style={{ borderBottom: "1px solid var(--ink-100)" }}>
                <span className="w-6 font-mono text-[11px]" style={{ color: "var(--ink-400)" }}>{i+1}</span>
                <span className="flex-1 font-mono text-[12px] font-bold" style={{ color: "var(--ink-900)" }}>{g.code}</span>
                <span className="w-16 font-mono text-[11px]" style={{ color: "var(--ink-500)" }}>${parseFloat(g.initialAmount).toFixed(2)}</span>
                <span className="w-16 font-mono text-[12px] font-bold" style={{ color: "var(--accent)" }}>${parseFloat(g.balanceAmount).toFixed(2)}</span>
                <div className="w-14 flex justify-center"><span className="rounded-full px-2 py-0.5 text-[8px] font-bold" style={{ background: g.status === "ACTIVE" ? "var(--ok-soft)" : "var(--ink-100)", color: g.status === "ACTIVE" ? "var(--ok)" : "var(--ink-500)" }}>{g.status}</span></div>
                <div className="w-14 flex justify-center gap-1">
                  <button onClick={() => openEditGiftCard(g)} className="flex h-6 w-6 items-center justify-center rounded-[var(--r-sm)]" style={{ background: "var(--ink-100)", color: "var(--ink-500)" }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </button>
                  <button onClick={() => deletePromotion("gift-cards", g.id)} className="flex h-6 w-6 items-center justify-center rounded-[var(--r-sm)]" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>)}

          {/* Loyalty tab */}
          {tab === "loyalty" && (
            <div className="flex-1 overflow-auto px-7 py-5" style={{ background: "var(--ink-50)" }}>
              <div className="mb-4 rounded-[var(--r-lg)] p-4" style={{ background: "var(--ink-900)", color: "var(--ink-0)", border: "1px solid var(--ink-800)" }}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.48)" }}>Live loyalty program</div>
                    <h2 className="mt-1 font-serif text-[22px] font-extrabold leading-tight">Points, rewards, and repeat guests</h2>
                    <p className="mt-1 max-w-3xl text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.62)" }}>Points are posted after completed payments, reversed on refunds, and managed through an auditable ledger.</p>
                  </div>
                  <span className="w-fit rounded-full px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wider" style={{ background: lActive ? "var(--ok-soft)" : "var(--warn-soft)", color: lActive ? "var(--ok)" : "var(--warn)", border: `1px solid ${lActive ? "#bbf7d0" : "#fde68a"}` }}>{lActive ? "Program active" : "Program paused"}</span>
                </div>
              </div>

              {loyaltyError && (
                <div className="mb-4 rounded-[var(--r-md)] p-3 text-[12px]" style={{ background: "var(--bad-soft)", color: "var(--bad)", border: "1px solid #fecaca" }}>
                  Loyalty API is not available yet. Run Prisma migration/generate and restart the API.
                </div>
              )}

              <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <section className="rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-serif text-[16px] font-bold" style={{ color: "var(--ink-900)" }}>Program Settings</h3>
                      <p className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>Keep earning simple and rewards controlled by the business.</p>
                    </div>
                    <button disabled={busy || loyaltyLoading} onClick={saveLoyaltyProgram} className="rounded-[var(--r-md)] px-3 py-2 text-[11px] font-semibold" style={{ background: "var(--accent)", color: "var(--ink-0)", opacity: busy ? 0.65 : 1 }}>Save Settings</button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div>
                      <label className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Program Name</label>
                      <input value={lName} onChange={e => setLName(e.target.value)} className={inputCls} style={inputSt} />
                    </div>
                    <div>
                      <label className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Points per 1.00</label>
                      <input type="number" min="0" step="0.1" value={lEarnRate} onChange={e => setLEarnRate(e.target.value)} className={inputCls} style={inputSt} />
                    </div>
                    <div>
                      <label className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Point Expiry Months</label>
                      <input type="number" min="1" value={lExpiryMonths} onChange={e => setLExpiryMonths(e.target.value)} className={inputCls} style={inputSt} />
                    </div>
                    <div>
                      <label className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Default Reward Points</label>
                      <input type="number" min="1" value={lRewardPoints} onChange={e => setLRewardPoints(e.target.value)} className={inputCls} style={inputSt} />
                    </div>
                    <div>
                      <label className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Default Reward Value</label>
                      <input type="number" min="0" step="0.01" value={lRewardValue} onChange={e => setLRewardValue(e.target.value)} className={inputCls} style={inputSt} />
                    </div>
                    <label className="mt-5 flex items-center gap-2 rounded-[var(--r-md)] px-3 py-2.5 text-[12px]" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)", color: "var(--ink-700)" }}>
                      <input type="checkbox" checked={lActive} onChange={e => setLActive(e.target.checked)} />
                      Post points after completed payments
                    </label>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {[
                      { label: "Members", value: String(loyaltyMembers?.totalMembers ?? 0), sub: `${loyaltyMembers?.pointsLiability ?? 0} outstanding points` },
                      { label: "Rewards", value: String(loyaltyActiveRewards), sub: "Active customer reward options" },
                      { label: "Top Member", value: loyaltyTopMember ? loyaltyTopMember.user.name : "None", sub: loyaltyTopMember ? `${loyaltyTopMember.pointsBalance} point balance` : "No points earned yet" },
                    ].map(card => (
                      <div key={card.label} className="rounded-[var(--r-md)] p-4" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
                        <div className="truncate font-serif text-[19px] font-extrabold leading-tight" style={{ color: "var(--ink-900)" }}>{card.value}</div>
                        <div className="mt-1 font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--accent)" }}>{card.label}</div>
                        <div className="mt-1 text-[11px]" style={{ color: "var(--ink-500)" }}>{card.sub}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-[var(--r-md)] p-4" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-edge)" }}>
                    <div className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--accent)" }}>Live process</div>
                    <div className="mt-3 grid gap-2 md:grid-cols-5">
                      {[
                        ["01", "Paid order"],
                        ["02", "Points posted"],
                        ["03", "Progress shown"],
                        ["04", "Reward unlocked"],
                        ["05", "Coupon redeemed"],
                      ].map(([number, label]) => (
                        <div key={number} className="rounded-[var(--r-md)] px-3 py-3" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-100)" }}>
                          <div className="font-mono text-[10px] font-bold" style={{ color: "var(--accent)" }}>{number}</div>
                          <div className="mt-1 text-[12px] font-semibold" style={{ color: "var(--ink-900)" }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
                  <h3 className="font-serif text-[16px] font-bold" style={{ color: "var(--ink-900)" }}>Rewards</h3>
                  <p className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>Rewards are redeemed into one-use coupon codes.</p>
                  <div className="mt-4 grid gap-2">
                    <input value={lrName} onChange={e => setLrName(e.target.value)} placeholder="Reward name" className={inputCls} style={inputSt} />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" min="1" value={lrCost} onChange={e => setLrCost(e.target.value)} placeholder="Point cost" className={inputCls} style={inputSt} />
                      <input type="number" min="0" step="0.01" value={lrValue} onChange={e => setLrValue(e.target.value)} placeholder="Reward value" className={inputCls} style={inputSt} />
                    </div>
                    <button disabled={busy || !lrName || !lrCost || !lrValue} onClick={createLoyaltyReward} className="rounded-[var(--r-md)] px-3 py-2 text-[11px] font-semibold" style={{ background: "var(--ink-900)", color: "var(--ink-0)", opacity: busy ? 0.65 : 1 }}>Add Reward</button>
                  </div>
                  <div className="mt-4 space-y-2.5">
                    {(loyaltyRewards ?? loyaltyProgram?.rewards ?? []).map(item => (
                      <div key={item.id} className="rounded-[var(--r-md)] px-3 py-3" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-bold" style={{ color: item.isActive ? "var(--ink-900)" : "var(--ink-400)" }}>{item.name}</span>
                          <span className="font-mono text-[9px]" style={{ color: "var(--ink-500)" }}>{item.pointsCost} pts</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-[11px]" style={{ color: "var(--ink-500)" }}>
                          <span>${parseFloat(item.rewardValue).toFixed(2)} coupon value</span>
                          <div className="flex gap-1">
                            <button onClick={() => toggleLoyaltyReward(item)} className="rounded-[var(--r-sm)] px-2 py-1 font-mono text-[9px]" style={{ background: item.isActive ? "var(--warn-soft)" : "var(--ok-soft)", color: item.isActive ? "var(--warn)" : "var(--ok)" }}>{item.isActive ? "Pause" : "Activate"}</button>
                            <button onClick={() => deleteLoyaltyReward(item.id)} className="rounded-[var(--r-sm)] px-2 py-1 font-mono text-[9px]" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(loyaltyRewards ?? loyaltyProgram?.rewards ?? []).length === 0 && (
                      <div className="rounded-[var(--r-md)] p-4 text-[12px]" style={{ background: "var(--ink-50)", color: "var(--ink-500)" }}>No rewards configured yet.</div>
                    )}
                  </div>
                </section>
              </div>

              <section className="mt-4 rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-[16px] font-bold" style={{ color: "var(--ink-900)" }}>Loyalty Members</h3>
                  <span className="font-mono text-[10px]" style={{ color: "var(--ink-500)" }}>{loyaltyMembers?.lifetimePoints ?? 0} lifetime points issued</span>
                </div>
                <div className="mt-3 overflow-hidden rounded-[var(--r-md)]" style={{ border: "1px solid var(--ink-100)" }}>
                  <div className="grid grid-cols-[1.3fr_0.7fr_0.7fr_0.7fr] gap-2 px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-widest" style={{ background: "var(--ink-50)", color: "var(--ink-500)" }}>
                    <span>Customer</span><span>Balance</span><span>Lifetime</span><span>Tier</span>
                  </div>
                  {(loyaltyMembers?.members ?? []).map(member => (
                    <div key={member.id} className="grid grid-cols-[1.3fr_0.7fr_0.7fr_0.7fr] gap-2 px-3 py-2 text-[12px]" style={{ borderTop: "1px solid var(--ink-100)", color: "var(--ink-700)" }}>
                      <span className="truncate font-semibold" style={{ color: "var(--ink-900)" }}>{member.user.name}</span>
                      <span className="font-mono">{member.pointsBalance}</span>
                      <span className="font-mono">{member.lifetimePoints}</span>
                      <span className="font-mono">{member.tier}</span>
                    </div>
                  ))}
                  {(loyaltyMembers?.members ?? []).length === 0 && (
                    <div className="px-3 py-6 text-center text-[12px]" style={{ color: "var(--ink-500)" }}>No loyalty members yet. Completed payments from signed-in customers will create accounts automatically.</div>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* Footer for coupon/gift tabs */}
          {tab !== "discounts" && tab !== "loyalty" && (
            <div className="px-7 py-2" style={{ background: "var(--ink-50)", borderTop: "1px solid var(--ink-200)" }}>
              <span className="font-mono text-[10px]" style={{ color: "var(--ink-400)" }}>Tip: Promotions are applied at checkout. All changes are logged for audit and reporting.</span>
            </div>
          )}
        </div>

        {/* ── Right sidebar ── */}
        <div className="hidden w-[300px] flex-shrink-0 flex-col lg:flex" style={{ borderLeft: "1px solid var(--ink-200)", background: "var(--ink-0)" }}>
          <div className="flex-1 overflow-auto p-5">
            <h3 className="font-serif text-[15px] font-bold mb-5" style={{ color: "var(--ink-900)" }}>Create / Edit <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Promotion</em></h3>

            {!sideOpen ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--ink-100)", color: "var(--ink-400)" }}>
                  <svg {...sv}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
                </div>
                <p className="mt-2 text-[12px]" style={{ color: "var(--ink-500)" }}>Click &quot;New Promotion&quot; or edit an existing one</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Promotion Type */}
                <div>
                  <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Promotion Type *</label>
                  <select value={tab} onChange={e => { setTab(e.target.value as typeof tab); setEditingId(null); }} className={inputCls} style={inputSt} disabled={!!editingId}>
                    <option value="discounts">Percentage Discount</option><option value="coupons">Coupon Code</option><option value="gift-cards">Gift Card</option>
                  </select>
                </div>

                {tab === "discounts" && (<>
                  <div><label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Promotion Name *</label><input value={dName} onChange={e => setDName(e.target.value)} placeholder="Lunch Combo 15% Off" className={inputCls} style={inputSt} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Discount Value *</label>
                      <div className="mt-1 flex rounded-[var(--r-md)] overflow-hidden" style={{ border: "1px solid var(--ink-200)" }}>
                        <input type="number" value={dValue} onChange={e => setDValue(e.target.value)} placeholder="15" className="flex-1 px-3 py-2.5 text-[12px] outline-none" style={{ color: "var(--ink-900)" }} />
                        <span className="flex items-center px-2 text-[11px] font-bold" style={{ background: "var(--ink-50)", color: "var(--ink-500)", borderLeft: "1px solid var(--ink-200)" }}>{dType === "PERCENT" ? "%" : "$"}</span>
                      </div>
                    </div>
                    <div><label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Applies To *</label><select value={dScope} onChange={e => setDScope(e.target.value)} className={inputCls} style={inputSt}><option value="ORDER">Order (Entire Bill)</option><option value="ITEMS">Items</option></select></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Start Date</label><input type="date" value={dStartAt} onChange={e => setDStartAt(e.target.value)} className={inputCls} style={inputSt} /></div>
                    <div><label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>End Date</label><input type="date" value={dEndAt} onChange={e => setDEndAt(e.target.value)} className={inputCls} style={inputSt} /></div>
                  </div>
                  <div><label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Status</label>
                    <button onClick={() => setDActive(!dActive)} className="mt-1 flex w-full items-center gap-2.5 rounded-[var(--r-md)] px-3 py-2.5" style={{ border: "1px solid var(--ink-200)" }}>
                      <span className="relative h-5 w-9 rounded-full flex-shrink-0" style={{ background: dActive ? "var(--ok)" : "var(--ink-200)" }}><span className="absolute top-0.5 h-4 w-4 rounded-full transition-all" style={{ background: "var(--ink-0)", left: dActive ? 18 : 2, boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }} /></span>
                      <span className="text-[11px] font-medium" style={{ color: dActive ? "var(--ok)" : "var(--ink-500)" }}>{dActive ? "Active" : "Inactive"}</span>
                    </button>
                  </div>
                  <div><label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Description</label><textarea value={dDesc} onChange={e => setDDesc(e.target.value)} rows={2} placeholder="Get 15% off your entire order during lunch hours." className={`${inputCls} resize-none`} style={inputSt} /></div>
                  <div className="pt-2 flex gap-2">
                    <button onClick={() => { setSideOpen(false); resetForm(); }} className="flex-1 rounded-[var(--r-md)] py-2.5 text-[12px] font-semibold" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>Cancel</button>
                    <button onClick={saveDiscount} disabled={busy || !dName || !dValue} className="flex-1 rounded-[var(--r-md)] py-2.5 text-[12px] font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>{busy ? "..." : editingId ? "Save Changes" : "Save Promotion"}</button>
                  </div>
                </>)}

                {tab === "coupons" && (<>
                  <div><label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Coupon Code *</label><input value={cCode} onChange={e => setCCode(e.target.value.toUpperCase())} placeholder="SAVE15" className={`${inputCls} font-mono uppercase`} style={inputSt} /></div>
                  <div><label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Linked Discount *</label>
                    <select value={cDiscountId} onChange={e => setCDiscountId(e.target.value)} className={inputCls} style={inputSt}><option value="">Select discount...</option>{(discounts ?? []).map(d => <option key={d.id} value={d.id}>{d.name} ({d.type === "PERCENT" ? `${d.value}%` : `$${d.value}`}){d.isActive ? "" : " - inactive"}</option>)}</select></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Max Uses</label><input type="number" value={cMaxR} onChange={e => setCMaxR(e.target.value)} placeholder="∞" className={inputCls} style={inputSt} /></div>
                    <div><label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Per User</label><input type="number" value={cPerUser} onChange={e => setCPerUser(e.target.value)} placeholder="∞" className={inputCls} style={inputSt} /></div>
                  </div>
                  <div><label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Expires</label><input type="date" value={cExpiresAt} onChange={e => setCExpiresAt(e.target.value)} className={inputCls} style={inputSt} /></div>
                  <div><label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Status</label>
                    <button onClick={() => setCActive(!cActive)} className="mt-1 flex w-full items-center gap-2.5 rounded-[var(--r-md)] px-3 py-2.5" style={{ border: "1px solid var(--ink-200)" }}>
                      <span className="relative h-5 w-9 rounded-full flex-shrink-0" style={{ background: cActive ? "var(--ok)" : "var(--ink-200)" }}><span className="absolute top-0.5 h-4 w-4 rounded-full transition-all" style={{ background: "var(--ink-0)", left: cActive ? 18 : 2, boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }} /></span>
                      <span className="text-[11px] font-medium" style={{ color: cActive ? "var(--ok)" : "var(--ink-500)" }}>{cActive ? "Active" : "Inactive"}</span>
                    </button>
                  </div>
                  <div className="pt-2 flex gap-2">
                    <button onClick={() => { setSideOpen(false); resetForm(); }} className="flex-1 rounded-[var(--r-md)] py-2.5 text-[12px] font-semibold" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>Cancel</button>
                    <button onClick={saveCoupon} disabled={busy || !cCode || !cDiscountId} className="flex-1 rounded-[var(--r-md)] py-2.5 text-[12px] font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>{busy ? "..." : editingId ? "Save Changes" : "Save Promotion"}</button>
                  </div>
                </>)}

                {tab === "gift-cards" && (<>
                  <div><label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Card Code *</label><input value={gCode} onChange={e => setGCode(e.target.value.toUpperCase())} placeholder="GIFT50" disabled={!!editingId} className={`${inputCls} font-mono uppercase disabled:opacity-60`} style={inputSt} /></div>
                  <div><label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Initial Amount *</label><input type="number" value={gAmount} onChange={e => setGAmount(e.target.value)} placeholder="50.00" disabled={!!editingId} className={`${inputCls} disabled:opacity-60`} style={inputSt} /></div>
                  <div><label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Status</label>
                    <select value={gStatus} onChange={e => setGStatus(e.target.value)} className={inputCls} style={inputSt}>
                      <option value="ACTIVE">ACTIVE</option><option value="DISABLED">DISABLED</option><option value="EXPIRED">EXPIRED</option><option value="REDEEMED">REDEEMED</option>
                    </select>
                  </div>
                  <div><label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Expires</label><input type="date" value={gExpiresAt} onChange={e => setGExpiresAt(e.target.value)} className={inputCls} style={inputSt} /></div>
                  <div className="pt-2 flex gap-2">
                    <button onClick={() => { setSideOpen(false); resetForm(); }} className="flex-1 rounded-[var(--r-md)] py-2.5 text-[12px] font-semibold" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>Cancel</button>
                    <button onClick={saveGiftCard} disabled={busy || !gCode || !gAmount} className="flex-1 rounded-[var(--r-md)] py-2.5 text-[12px] font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>{busy ? "..." : editingId ? "Save Changes" : "Save Promotion"}</button>
                  </div>
                </>)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
