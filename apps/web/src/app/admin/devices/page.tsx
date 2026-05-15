"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { authGet, authPost, authPatch } from "../../../lib/api";
import { getStaffToken, getStaffName } from "../../../lib/staff-auth";
import { useAdminBranch } from "../branch-context";
import { LoadingScreen, EmptyState, useToast } from "../../../components/ui";

const sv = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

interface Device { id: string; name: string; deviceType: string; isActive: boolean; lastSeenAt: string | null; createdAt: string; branchId: string; capabilitiesJson: unknown; }

const TYPES = ["KDS", "WAITER", "POS", "ADMIN", "CDS", "OTHER"] as const;
const typeColor: Record<string, string> = { KDS: "#d97706", WAITER: "#2563eb", POS: "#7c3aed", ADMIN: "#4f46e5", CDS: "#059669", OTHER: "#78716c" };

function fmtDate(d: string) { return new Date(d).toLocaleDateString("en", { month: "short", day: "numeric", year: "2-digit" }); }
function fmtAgo(d: string | null) { if (!d) return "Never"; const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 1) return "Just now"; if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`; return `${Math.floor(h / 24)}d ago`; }

export default function AdminDevicesPage() {
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const { branchId } = useAdminBranch();
  const [staffName, setStaffNameLocal] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const { toast } = useToast();

  /* Sidebar form */
  const [sideOpen, setSideOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fName, setFName] = useState(""); const [fType, setFType] = useState<string>("KDS");
  const [fArea, setFArea] = useState(""); const [fActive, setFActive] = useState(true);
  const [fNotes, setFNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  useEffect(() => { setToken(getStaffToken()); setStaffNameLocal(getStaffName() ?? ""); }, []);

  const { data: devices, isLoading } = useQuery({
    queryKey: ["admin-devices", branchId],
    queryFn: () => authGet<Device[]>(`/api/admin/devices?branchId=${branchId}`, token!),
    enabled: !!token && !!branchId,
  });

  function openCreate() { setEditId(null); setSideOpen(true); setFName(""); setFType("KDS"); setFArea(""); setFActive(true); setFNotes(""); setNewKey(null); }
  function openEdit(d: Device) { setEditId(d.id); setSideOpen(true); setFName(d.name); setFType(d.deviceType); setFArea(""); setFActive(d.isActive); setFNotes(""); setNewKey(null); }

  async function handleSave() {
    if (!token || !branchId || !fName) return; setBusy(true);
    try {
      if (editId) {
        await authPatch(`/api/admin/devices/${editId}`, token, { name: fName, deviceType: fType, isActive: fActive });
        toast("Device updated");
      } else {
        const res = await authPost<{ id: string; apiKey: string }>("/api/admin/devices", token, { branchId, name: fName, deviceType: fType });
        setNewKey(res.apiKey); toast("Device registered");
      }
      qc.invalidateQueries({ queryKey: ["admin-devices"] });
      if (editId) { setSideOpen(false); setEditId(null); }
    } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setBusy(false); }
  }

  if (isLoading) return <LoadingScreen message="Loading devices..." />;

  const all = devices ?? [];
  const q = search.toLowerCase().trim();
  const filtered = all.filter(d => (!q || d.name.toLowerCase().includes(q) || d.deviceType.toLowerCase().includes(q)) && (filterType === "all" || d.deviceType === filterType) && (filterStatus === "all" || (filterStatus === "active" ? d.isActive : !d.isActive)));
  const totalDevices = all.length;
  const onlineDevices = all.filter(d => d.isActive).length;
  const offlineDevices = totalDevices - onlineDevices;
  const typeCounts = TYPES.map(t => ({ type: t, count: all.filter(d => d.deviceType === t).length })).filter(t => t.count > 0);
  const offlineAlerts = all.filter(d => d.isActive && !d.lastSeenAt);

  return (
    <div className="flex h-full flex-col" style={{ minHeight: "100%" }}>
      {/* Header */}
      <div className="px-7 py-4" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-[22px] font-extrabold tracking-tight leading-none" style={{ color: "var(--ink-900)" }}>Device <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Management</em></h1>
            <p className="mt-1 text-[11px]" style={{ color: "var(--ink-500)" }}>Register and manage KDS, POS, and waiter devices across branches.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-[var(--r-md)] px-3 py-2 text-[11px] font-semibold" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>
              <svg {...sv}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>Export List
            </button>
            <button onClick={openCreate} className="flex items-center gap-1.5 rounded-[var(--r-md)] px-3 py-2 text-[11px] font-semibold" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>
              <svg {...sv}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>Register Device
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { icon: <svg {...sv}><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>, label: "Total Devices", value: totalDevices, sub: "All registered devices", color: "var(--accent)" },
            { icon: <svg {...sv}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>, label: "Online Devices", value: onlineDevices, sub: totalDevices > 0 ? `${((onlineDevices / totalDevices) * 100).toFixed(1)}% of total` : "0%", color: "var(--ok)" },
            { icon: <svg {...sv}><line x1="1" y1="1" x2="23" y2="23" /><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" /><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" /></svg>, label: "Offline Devices", value: offlineDevices, sub: totalDevices > 0 ? `${((offlineDevices / totalDevices) * 100).toFixed(1)}% of total` : "0%", color: "var(--bad)" },
            { icon: <svg {...sv}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>, label: "Branches Covered", value: new Set(all.map(d => d.branchId)).size, sub: "Active branches", color: "var(--ink-600)" },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 rounded-[var(--r-md)] p-3.5" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0" style={{ background: `${s.color}15`, color: s.color }}>{s.icon}</div>
              <div>
                <div className="font-serif text-[20px] font-extrabold leading-none" style={{ color: "var(--ink-900)" }}>{s.value}</div>
                <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>{s.label}</div>
                <div className="text-[9px]" style={{ color: s.color }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Table area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Search + filters */}
          <div className="flex items-center gap-2 flex-wrap px-7 py-2" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
            <div className="flex items-center gap-2 rounded-[var(--r-md)] px-3 py-1.5" style={{ border: "1px solid var(--ink-200)" }}>
              <svg {...sv} style={{ color: "var(--ink-400)" }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search devices..." className="w-32 bg-transparent text-[12px] outline-none" style={{ color: "var(--ink-900)" }} />
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="rounded-[var(--r-md)] px-2.5 py-1.5 text-[11px] font-medium outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>
              <option value="all">All Types</option>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="rounded-[var(--r-md)] px-2.5 py-1.5 text-[11px] font-medium outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>
              <option value="all">All Status</option>
              <option value="active">Online</option>
              <option value="inactive">Offline</option>
            </select>
            <span className="ml-auto font-mono text-[10px]" style={{ color: "var(--ink-400)" }}>{filtered.length} devices</span>
          </div>

          {/* Column headers */}
          <div className="flex items-center gap-2 px-7 py-2" style={{ background: "var(--ink-50)", borderBottom: "1px solid var(--ink-200)" }}>
            <span className="w-6 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>#</span>
            <span className="flex-1 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Device</span>
            <span className="w-12 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Type</span>
            <span className="w-20 font-mono text-[9px] uppercase tracking-widest hidden sm:block" style={{ color: "var(--ink-400)" }}>Branch</span>
            <span className="w-14 text-center font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Status</span>
            <span className="w-16 font-mono text-[9px] uppercase tracking-widest hidden md:block" style={{ color: "var(--ink-400)" }}>Last Seen</span>
            <span className="w-14 text-center font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Actions</span>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-auto" style={{ background: "var(--ink-0)" }}>
            {filtered.map((d, i) => (
              <div key={d.id} className="flex items-center gap-2 px-7 py-2.5 transition cursor-pointer"
                onClick={() => openEdit(d)}
                style={{ borderBottom: "1px solid var(--ink-100)", background: editId === d.id ? "var(--accent-soft)" : "var(--ink-0)", opacity: d.isActive ? 1 : 0.55 }}>
                <span className="w-6 font-mono text-[11px]" style={{ color: "var(--ink-400)" }}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-semibold truncate block" style={{ color: "var(--ink-900)" }}>{d.name}</span>
                  <span className="font-mono text-[9px]" style={{ color: "var(--ink-400)" }}>{d.id.slice(-8).toUpperCase()}</span>
                </div>
                <span className="w-12 rounded-full px-2 py-0.5 text-center text-[8px] font-bold" style={{ background: `${typeColor[d.deviceType] ?? "#78716c"}15`, color: typeColor[d.deviceType] ?? "var(--ink-500)", border: `1px solid ${typeColor[d.deviceType] ?? "#78716c"}30` }}>{d.deviceType}</span>
                <span className="w-20 text-[10px] truncate hidden sm:block" style={{ color: "var(--ink-500)" }}>{d.branchId.includes("branch-1") ? "Downtown" : "Waterfront"}</span>
                <div className="w-14 flex justify-center">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: d.isActive ? "var(--ok)" : "var(--bad)" }} />
                    <span className="text-[9px] font-medium" style={{ color: d.isActive ? "var(--ok)" : "var(--bad)" }}>{d.isActive ? "On" : "Off"}</span>
                  </span>
                </div>
                <span className="w-16 text-[9px] hidden md:block" style={{ color: "var(--ink-500)" }}>{fmtAgo(d.lastSeenAt)}</span>
                <div className="w-14 flex justify-center gap-1">
                  <button onClick={e => { e.stopPropagation(); openEdit(d); }} className="flex h-6 w-6 items-center justify-center rounded-[var(--r-sm)]" style={{ background: editId === d.id ? "var(--accent)" : "var(--ink-100)", color: editId === d.id ? "var(--ink-0)" : "var(--ink-500)" }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="py-12"><EmptyState icon="&#x1F4F1;" title="No devices found" /></div>}
          </div>

          {/* Footer */}
          <div className="px-7 py-2" style={{ background: "var(--ink-50)", borderTop: "1px solid var(--ink-200)" }}>
            <span className="font-mono text-[10px]" style={{ color: "var(--ink-400)" }}>Showing {filtered.length} of {totalDevices} devices</span>
          </div>

          {/* Bottom cards row */}
          <div className="grid gap-4 px-7 py-4 lg:grid-cols-3" style={{ background: "var(--ink-50)", borderTop: "1px solid var(--ink-200)" }}>
            {/* Offline Alerts */}
            <div className="rounded-[var(--r-lg)] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px]" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>
                    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23" /><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" /></svg>
                  </span>
                  <span className="text-[12px] font-semibold" style={{ color: "var(--ink-900)" }}>Offline Alerts</span>
                  <span className="rounded-full px-1.5 py-0.5 font-mono text-[8px] font-bold" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>{offlineAlerts.length}</span>
                </div>
              </div>
              {offlineAlerts.length === 0 ? <p className="text-[10px] text-center py-2" style={{ color: "var(--ok)" }}>All devices online</p> : (
                offlineAlerts.slice(0, 3).map(d => (
                  <div key={d.id} className="flex items-center gap-2 py-1.5" style={{ borderTop: "1px solid var(--ink-100)" }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--bad)" }} />
                    <span className="flex-1 text-[10px] font-medium truncate" style={{ color: "var(--ink-700)" }}>{d.name}</span>
                    <span className="font-mono text-[9px]" style={{ color: "var(--ink-400)" }}>{fmtAgo(d.lastSeenAt)}</span>
                  </div>
                ))
              )}
            </div>

            {/* Devices by Type */}
            <div className="rounded-[var(--r-lg)] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px]" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                </span>
                <span className="text-[12px] font-semibold" style={{ color: "var(--ink-900)" }}>Devices by Type</span>
              </div>
              <div className="flex items-center gap-4">
                {/* Mini donut representation */}
                <div className="relative flex h-16 w-16 items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 36 36" className="h-16 w-16">
                    {typeCounts.reduce<Array<{ type: string; count: number; offset: number }>>((acc, t) => {
                      const offset = acc.length > 0 ? acc[acc.length - 1].offset + (acc[acc.length - 1].count / totalDevices) * 100 : 0;
                      acc.push({ ...t, offset }); return acc;
                    }, []).map(t => {
                      const pct = totalDevices > 0 ? (t.count / totalDevices) * 100 : 0;
                      return <circle key={t.type} cx="18" cy="18" r="14" fill="none" stroke={typeColor[t.type] ?? "#78716c"} strokeWidth="4" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={-t.offset} transform="rotate(-90 18 18)" />;
                    })}
                  </svg>
                  <span className="absolute font-serif text-[13px] font-extrabold" style={{ color: "var(--ink-900)" }}>{totalDevices}</span>
                </div>
                <div className="flex-1 space-y-1">
                  {typeCounts.map(t => (
                    <div key={t.type} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: typeColor[t.type] }} />
                      <span className="text-[10px]" style={{ color: "var(--ink-600)" }}>{t.type}</span>
                      <span className="ml-auto font-mono text-[10px] font-bold" style={{ color: "var(--ink-900)" }}>{t.count}</span>
                      <span className="font-mono text-[8px]" style={{ color: "var(--ink-400)" }}>({totalDevices > 0 ? ((t.count / totalDevices) * 100).toFixed(0) : 0}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="rounded-[var(--r-lg)] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px]" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                </span>
                <span className="text-[12px] font-semibold" style={{ color: "var(--ink-900)" }}>Recent Activity</span>
              </div>
              {all.slice(0, 3).map(d => (
                <div key={d.id} className="flex items-start gap-2 py-1.5" style={{ borderTop: "1px solid var(--ink-100)" }}>
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: "var(--accent)" }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-medium block truncate" style={{ color: "var(--ink-700)" }}>{d.name} registered</span>
                    <span className="font-mono text-[8px]" style={{ color: "var(--ink-400)" }}>{fmtDate(d.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="hidden w-[300px] flex-shrink-0 flex-col lg:flex" style={{ borderLeft: "1px solid var(--ink-200)", background: "var(--ink-0)" }}>
          <div className="flex-1 overflow-auto">
            {/* Staff header */}
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--ink-200)" }}>
              <div className="flex items-center gap-2"><svg {...sv} style={{ color: "var(--ink-400)" }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg><span className="font-mono text-[10px]" style={{ color: "var(--ink-500)" }}>Admin Console 1</span></div>
              <span className="flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] font-medium" style={{ background: "var(--ok-soft)", color: "var(--ok)", border: "1px solid #bbf7d0" }}><span className="h-1 w-1 rounded-full" style={{ background: "var(--ok)" }} />Online</span>
            </div>

            <div className="px-5 py-4">
              {/* Staff avatar */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-full font-serif text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, var(--accent), #9a3412)" }}>{staffName.charAt(0) || "A"}</div>
                <div><div className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>{staffName || "Admin"}</div><div className="font-mono text-[10px]" style={{ color: "var(--ink-500)" }}>Administrator</div></div>
              </div>

              <h3 className="font-serif text-[15px] font-bold mb-4" style={{ color: "var(--ink-900)" }}>Register / Edit <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Device</em></h3>

              {!sideOpen ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--ink-100)", color: "var(--ink-400)" }}>
                    <svg {...sv}><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
                  </div>
                  <p className="mt-2 text-[12px]" style={{ color: "var(--ink-500)" }}>Click &quot;Register Device&quot; or select one to edit</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* API Key display (after create) */}
                  {newKey && (
                    <div className="rounded-[var(--r-md)] p-3" style={{ background: "var(--warn-soft)", border: "1px solid #fde68a" }}>
                      <div className="font-mono text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--warn)" }}>API Key (copy now)</div>
                      <code className="block rounded px-2 py-1.5 text-[10px] font-mono break-all select-all" style={{ background: "var(--ink-0)", border: "1px solid #fde68a", color: "var(--ink-900)" }}>{newKey}</code>
                    </div>
                  )}

                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Device Name *</label>
                    <input value={fName} onChange={e => setFName(e.target.value)} placeholder="Enter device name" className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2.5 text-[12px] outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                  </div>
                  {editId && (
                    <div>
                      <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Device ID</label>
                      <div className="mt-1 rounded-[var(--r-md)] px-3 py-2.5 font-mono text-[11px]" style={{ border: "1px solid var(--ink-100)", background: "var(--ink-50)", color: "var(--ink-500)" }}>{editId.slice(-12).toUpperCase()}</div>
                    </div>
                  )}
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Device Type *</label>
                    <select value={fType} onChange={e => setFType(e.target.value)} className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2.5 text-[12px] outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)", background: "var(--ink-0)" }}>
                      {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Branch *</label>
                    <div className="mt-1 rounded-[var(--r-md)] px-3 py-2.5 text-[11px]" style={{ border: "1px solid var(--ink-100)", background: "var(--ink-50)", color: "var(--ink-600)" }}>{branchId?.includes("branch-1") ? "Downtown" : "Waterfront"}</div>
                  </div>
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Assigned Area / Station</label>
                    <input value={fArea} onChange={e => setFArea(e.target.value)} placeholder="Enter area or station name" className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2.5 text-[12px] outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                  </div>
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Access Mode *</label>
                    <div className="mt-1 flex gap-2">
                      <div className="flex flex-1 items-center gap-2 rounded-[var(--r-md)] px-3 py-2" style={{ border: "1px solid var(--accent-edge)", background: "var(--accent-soft)" }}>
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                        <span className="text-[9px] font-medium" style={{ color: "var(--accent-ink)" }}>Staff Login</span>
                      </div>
                      <div className="flex flex-1 items-center gap-2 rounded-[var(--r-md)] px-3 py-2" style={{ border: "1px solid var(--ink-200)" }}>
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--ink-400)" strokeWidth={2} strokeLinecap="round"><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
                        <span className="text-[9px] font-medium" style={{ color: "var(--ink-500)" }}>Dedicated</span>
                      </div>
                    </div>
                  </div>
                  {editId && (
                    <div>
                      <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Status</label>
                      <button onClick={() => setFActive(!fActive)} className="mt-1 flex w-full items-center gap-2.5 rounded-[var(--r-md)] px-3 py-2.5" style={{ border: "1px solid var(--ink-200)" }}>
                        <span className="relative h-5 w-9 rounded-full flex-shrink-0" style={{ background: fActive ? "var(--ok)" : "var(--ink-200)" }}>
                          <span className="absolute top-0.5 h-4 w-4 rounded-full transition-all" style={{ background: "var(--ink-0)", left: fActive ? 18 : 2, boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }} />
                        </span>
                        <span className="text-[11px] font-medium" style={{ color: fActive ? "var(--ok)" : "var(--ink-500)" }}>{fActive ? "Active" : "Inactive"}</span>
                      </button>
                    </div>
                  )}
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Notes</label>
                    <textarea value={fNotes} onChange={e => setFNotes(e.target.value)} rows={2} placeholder="Add any notes about this device..." className="mt-1 w-full resize-none rounded-[var(--r-md)] px-3 py-2 text-[11px] outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button onClick={() => { setSideOpen(false); setEditId(null); setNewKey(null); }} className="flex-1 rounded-[var(--r-md)] py-2.5 text-[12px] font-semibold" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>Cancel</button>
                    <button onClick={handleSave} disabled={busy || !fName} className="flex-1 rounded-[var(--r-md)] py-2.5 text-[12px] font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>{busy ? "..." : editId ? "Save Device" : "Save Device"}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
