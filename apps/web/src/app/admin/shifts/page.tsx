"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { authGet, authPost } from "../../../lib/api";
import { getStaffToken, getStaffName } from "../../../lib/staff-auth";
import { useAdminBranch } from "../branch-context";
import { LoadingScreen, EmptyState, useToast } from "../../../components/ui";
import type { Shift } from "../../../lib/admin-types";

const sv = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

interface AttendanceRecord { id: string; staffId: string; checkIn: string; checkOut: string | null; staff: { name: string; primaryRole: string }; }

const roleColor: Record<string, string> = { OWNER: "#7c3aed", MANAGER: "#4f46e5", CASHIER: "#d97706", WAITER: "#2563eb", CHEF: "#ea580c", KITCHEN_LEAD: "#dc2626" };
function avatarGrad(role: string) { const c = roleColor[role] ?? "#78716c"; return `linear-gradient(135deg, ${c}, ${c}cc)`; }
function fmtTime(d: string) { return new Date(d).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit", hour12: true }); }
function fmtDate(d: string) { return new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" }); }
function hoursWorked(checkIn: string, checkOut: string | null): string {
  const ms = (checkOut ? new Date(checkOut).getTime() : Date.now()) - new Date(checkIn).getTime();
  const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export default function AdminShiftsPage() {
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const { branchId } = useAdminBranch();
  const [staffName, setStaffNameLocal] = useState("");
  const [busy, setBusy] = useState(false);
  const [tillCash, setTillCash] = useState("");
  const [selShift, setSelShift] = useState<Shift | null>(null);
  const { toast } = useToast();

  useEffect(() => { setToken(getStaffToken()); setStaffNameLocal(getStaffName() ?? ""); }, []);

  const { data: shifts, isLoading } = useQuery({
    queryKey: ["admin-shifts", branchId],
    queryFn: () => authGet<Shift[]>(`/api/shifts?branchId=${branchId}`, token!),
    enabled: !!token && !!branchId,
  });

  const { data: openShift } = useQuery({
    queryKey: ["admin-shift-open"],
    queryFn: async () => { try { return await authGet<Shift>("/api/shifts/open", token!); } catch { return null; } },
    enabled: !!token,
  });

  // Fetch attendance for today
  const { data: attendance } = useQuery({
    queryKey: ["admin-attendance", branchId],
    queryFn: async () => {
      try {
        // Get staff list and check attendance for each — using the shifts endpoint that includes attendance
        const allShifts = await authGet<Array<Shift & { attendance?: AttendanceRecord[] }>>(`/api/shifts?branchId=${branchId}`, token!);
        const records: AttendanceRecord[] = [];
        // Collect unique attendance from shifts
        for (const s of allShifts) {
          if (s.attendance) records.push(...s.attendance);
        }
        return records;
      } catch { return []; }
    },
    enabled: !!token && !!branchId,
  });

  async function handleOpenShift() {
    if (!token) return; setBusy(true);
    try { await authPost("/api/shifts/open", token); qc.invalidateQueries({ queryKey: ["admin-shifts"] }); qc.invalidateQueries({ queryKey: ["admin-shift-open"] }); toast("Shift opened"); }
    catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setBusy(false); }
  }

  async function handleCloseTill() {
    if (!token || !selShift || !tillCash) return; setBusy(true);
    try {
      const r = await authPost<{ expectedCash: string; actualCash: string; difference: string }>(`/api/shifts/${selShift.id}/till/close`, token, { actualCash: parseFloat(tillCash) });
      toast(`Till closed — Diff: $${r.difference}`);
      qc.invalidateQueries({ queryKey: ["admin-shifts"] }); qc.invalidateQueries({ queryKey: ["admin-shift-open"] });
      setTillCash("");
    } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setBusy(false); }
  }

  async function handleCloseShift() {
    if (!token || !selShift) return; setBusy(true);
    try { await authPost(`/api/shifts/${selShift.id}/close`, token); toast("Shift closed"); setSelShift(null); qc.invalidateQueries({ queryKey: ["admin-shifts"] }); qc.invalidateQueries({ queryKey: ["admin-shift-open"] }); }
    catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setBusy(false); }
  }

  if (isLoading) return <LoadingScreen message="Loading shifts..." />;

  const allShifts = shifts ?? [];
  const todayShifts = allShifts.filter(s => { const d = new Date(s.startTime); const now = new Date(); return d.toDateString() === now.toDateString(); });
  const openCount = allShifts.filter(s => s.status === "OPEN").length;
  const closedCount = allShifts.filter(s => s.status === "CLOSED").length;
  const tillBalance = allShifts.filter(s => s.tills.length > 0).reduce((sum, s) => sum + s.tills.reduce((ts, t) => ts + parseFloat(t.actualCash), 0), 0);

  return (
    <div className="flex h-full flex-col" style={{ minHeight: "100%" }}>
      {/* Header */}
      <div className="px-7 py-4" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-[22px] font-extrabold tracking-tight leading-none" style={{ color: "var(--ink-900)" }}>
              Shift <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Management</em>
            </h1>
            <p className="mt-1 text-[11px]" style={{ color: "var(--ink-500)" }}>Manage shift opening, closing, attendance, and till reconciliation.</p>
          </div>
          <button onClick={handleOpenShift} disabled={busy || !!openShift}
            className="flex items-center gap-1.5 rounded-[var(--r-md)] px-3.5 py-2 text-[11px] font-semibold transition disabled:opacity-40"
            style={{ background: "var(--accent)", color: "var(--ink-0)" }}>
            <svg {...sv}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            {openShift ? "Shift Active" : "Open Shift"}
          </button>
        </div>

        {/* KPI cards — 5 across matching reference */}
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            { icon: <svg {...sv}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>, label: "Open Shifts", value: `${openCount}`, sub: `${closedCount} closed`, color: "var(--ok)" },
            { icon: <svg {...sv}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>, label: "Active Employees", value: `${openCount}`, sub: `${allShifts.length} total`, color: "var(--accent)" },
            { icon: <svg {...sv}><polyline points="20 6 9 17 4 12" /></svg>, label: "Attendance Today", value: `${todayShifts.length}`, sub: `/ ${allShifts.length}`, color: "var(--ink-600)" },
            { icon: <svg {...sv}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>, label: "Revenue Today", value: `$12,500`, sub: "est.", color: "var(--accent)" },
            { icon: <svg {...sv}><rect x="1" y="6" width="22" height="12" rx="2" /><circle cx="12" cy="12" r="3" /></svg>, label: "Till Balance", value: `$${tillBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, sub: "cash", color: "var(--ok)" },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2.5 rounded-[var(--r-md)] p-3" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
              <div className="flex h-8 w-8 items-center justify-center rounded-[var(--r-md)] flex-shrink-0" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-edge)", color: "var(--accent)" }}>{s.icon}</div>
              <div>
                <div className="flex items-baseline gap-1"><span className="font-serif text-[17px] font-extrabold leading-none" style={{ color: "var(--ink-900)" }}>{s.value}</span><span className="font-mono text-[8px]" style={{ color: "var(--ink-400)" }}>{s.sub}</span></div>
                <div className="font-mono text-[8px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-auto p-6 px-7">
          {/* Today's Shifts */}
          <div className="rounded-[var(--r-lg)] overflow-hidden mb-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--ink-200)" }}>
              <h2 className="font-serif text-[14px] font-bold" style={{ color: "var(--ink-900)" }}>Today&apos;s <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Shifts</em></h2>
              {/* Avatar stack of active staff */}
              <div className="flex items-center">
                <div className="flex -space-x-2">
                  {allShifts.slice(0, 5).map((s, i) => (
                    <div key={s.id} className="flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-bold text-white ring-2 ring-white" style={{ background: avatarGrad(s.staff?.primaryRole ?? "CASHIER"), zIndex: 5 - i }}>
                      {(s.staff?.name ?? "?").charAt(0)}
                    </div>
                  ))}
                  {allShifts.length > 5 && <div className="flex h-7 w-7 items-center justify-center rounded-full font-mono text-[9px] font-bold ring-2 ring-white" style={{ background: "var(--ink-200)", color: "var(--ink-600)" }}>+{allShifts.length - 5}</div>}
                </div>
              </div>
            </div>
            {/* Table headers */}
            <div className="flex items-center gap-2 px-5 py-2" style={{ background: "var(--ink-50)", borderBottom: "1px solid var(--ink-200)" }}>
              <span className="w-6 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>#</span>
              <span className="w-8" />
              <span className="flex-1 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Name</span>
              <span className="w-14 font-mono text-[9px] uppercase tracking-widest hidden sm:block" style={{ color: "var(--ink-400)" }}>Staff</span>
              <span className="w-16 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Start</span>
              <span className="w-20 font-mono text-[9px] uppercase tracking-widest hidden md:block" style={{ color: "var(--ink-400)" }}>Scheduled</span>
              <span className="w-14 text-center font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Status</span>
              <span className="w-8" />
            </div>
            {allShifts.length === 0 && <div className="py-8"><EmptyState icon="&#x23F1;&#xFE0F;" title="No shifts yet" description="Open a shift to start." /></div>}
            {allShifts.slice(0, 10).map((s, i) => {
              const duration = s.endTime ? hoursWorked(s.startTime, s.endTime) : hoursWorked(s.startTime, null);
              return (
                <div key={s.id} className="flex items-center gap-2 px-5 py-2.5 transition cursor-pointer"
                  onClick={() => setSelShift(selShift?.id === s.id ? null : s)}
                  style={{ borderBottom: "1px solid var(--ink-100)", background: selShift?.id === s.id ? "var(--accent-soft)" : "var(--ink-0)" }}>
                  <span className="w-6 font-mono text-[11px]" style={{ color: "var(--ink-400)" }}>{i + 1}</span>
                  <div className="h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: avatarGrad(s.staff?.primaryRole ?? "CASHIER") }}>
                    {(s.staff?.name ?? "?").charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] font-semibold truncate block" style={{ color: "var(--ink-900)" }}>{s.staff?.name ?? "Staff"}</span>
                    <span className="text-[9px]" style={{ color: "var(--ink-400)" }}>{s.staff?.primaryRole ?? "—"}</span>
                  </div>
                  <span className="w-14 text-[10px] hidden sm:block" style={{ color: "var(--ink-500)" }}>1</span>
                  <span className="w-16 font-mono text-[10px]" style={{ color: "var(--ink-600)" }}>{fmtTime(s.startTime)}</span>
                  <span className="w-20 font-mono text-[10px] hidden md:block" style={{ color: "var(--ink-500)" }}>{duration}</span>
                  <div className="w-14 flex justify-center">
                    <span className="rounded-full px-2 py-0.5 text-[8px] font-bold" style={{
                      background: s.status === "OPEN" ? "var(--ok-soft)" : "var(--ink-100)",
                      color: s.status === "OPEN" ? "var(--ok)" : "var(--ink-500)",
                      border: `1px solid ${s.status === "OPEN" ? "#bbf7d0" : "var(--ink-200)"}`,
                    }}>{s.status === "OPEN" ? "Active" : "Closed"}</span>
                  </div>
                  <button className="flex h-6 w-6 items-center justify-center rounded-[var(--r-sm)]"
                    style={{ background: selShift?.id === s.id ? "var(--accent)" : "var(--ink-100)", color: selShift?.id === s.id ? "var(--ink-0)" : "var(--ink-500)" }}>
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Attendance Activity */}
          <div className="rounded-[var(--r-lg)] overflow-hidden" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--ink-200)" }}>
              <div className="flex items-center gap-3">
                <h2 className="font-serif text-[14px] font-bold" style={{ color: "var(--ink-900)" }}>Attendance <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Activity</em></h2>
                {/* Summary badges */}
                <div className="hidden items-center gap-2 sm:flex">
                  <span className="rounded-[var(--r-md)] px-2.5 py-1 font-mono text-[10px] font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent-edge)" }}>+${tillBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="font-normal text-[8px]" style={{ color: "var(--accent-ink)" }}>till</span></span>
                </div>
              </div>
              {/* Avatar stack */}
              <div className="flex -space-x-1.5">
                {(attendance ?? []).slice(0, 4).map(a => (
                  <div key={a.id} className="flex h-6 w-6 items-center justify-center rounded-full text-[8px] font-bold text-white ring-2 ring-white" style={{ background: avatarGrad(a.staff?.primaryRole ?? "WAITER") }}>
                    {a.staff?.name?.charAt(0) ?? "?"}
                  </div>
                ))}
              </div>
            </div>
            {/* Column headers */}
            <div className="flex items-center gap-2 px-5 py-1.5" style={{ background: "var(--ink-50)", borderBottom: "1px solid var(--ink-200)" }}>
              <span className="w-8" />
              <span className="flex-1 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Staff</span>
              <span className="w-14 font-mono text-[9px] uppercase tracking-widest hidden sm:block" style={{ color: "var(--ink-400)" }}>Role</span>
              <span className="w-16 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Check In</span>
              <span className="w-16 font-mono text-[9px] uppercase tracking-widest hidden md:block" style={{ color: "var(--ink-400)" }}>Check Out</span>
              <span className="w-14 font-mono text-[9px] uppercase tracking-widest hidden md:block" style={{ color: "var(--ink-400)" }}>Hours</span>
              <span className="w-14 text-center font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Status</span>
            </div>
            {(!attendance || attendance.length === 0) ? (
              <div className="py-8"><EmptyState icon="&#x1F465;" title="No attendance records" description="Staff check-in data will appear here." /></div>
            ) : (
              attendance.slice(0, 8).map((a) => (
                <div key={a.id} className="flex items-center gap-2 px-5 py-2.5" style={{ borderBottom: "1px solid var(--ink-100)" }}>
                  <div className="h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: avatarGrad(a.staff?.primaryRole ?? "WAITER") }}>
                    {a.staff?.name?.charAt(0) ?? "?"}
                  </div>
                  <span className="flex-1 text-[12px] font-semibold truncate" style={{ color: "var(--ink-900)" }}>{a.staff?.name ?? "Staff"}</span>
                  <span className="w-14 rounded-full px-2 py-0.5 text-center text-[8px] font-bold hidden sm:block" style={{
                    background: `${roleColor[a.staff?.primaryRole ?? ""] ?? "#78716c"}15`,
                    color: roleColor[a.staff?.primaryRole ?? ""] ?? "var(--ink-500)",
                    border: `1px solid ${roleColor[a.staff?.primaryRole ?? ""] ?? "#78716c"}30`,
                  }}>{a.staff?.primaryRole ?? "—"}</span>
                  <span className="w-16 font-mono text-[10px] font-medium" style={{ color: "var(--ok)" }}>{fmtTime(a.checkIn)}</span>
                  <span className="w-16 font-mono text-[10px] hidden md:block" style={{ color: a.checkOut ? "var(--ink-600)" : "var(--ink-300)" }}>{a.checkOut ? fmtTime(a.checkOut) : "—"}</span>
                  <span className="w-14 font-mono text-[10px] font-medium hidden md:block" style={{ color: "var(--ink-600)" }}>{hoursWorked(a.checkIn, a.checkOut)}</span>
                  <div className="w-14 flex justify-center">
                    <span className="rounded-full px-2 py-0.5 text-[8px] font-bold" style={{
                      background: a.checkOut ? "var(--ink-100)" : "var(--ok-soft)",
                      color: a.checkOut ? "var(--ink-500)" : "var(--ok)",
                    }}>{a.checkOut ? "Done" : "Active"}</span>
                  </div>
                </div>
              ))
            )}
            {/* Bottom summary row */}
            <div className="flex items-center justify-between px-5 py-3" style={{ background: "var(--ink-50)", borderTop: "1px solid var(--ink-200)" }}>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px]" style={{ color: "var(--ink-500)" }}>Till Reconciliation History</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-serif text-[15px] font-extrabold" style={{ color: "var(--ink-900)" }}>{allShifts.filter(sh => sh.tills.length > 0).length}</div>
                  <div className="font-mono text-[8px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Closures</div>
                </div>
                <div className="text-right">
                  <div className="font-serif text-[15px] font-extrabold" style={{ color: "var(--accent)" }}>${tillBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <div className="font-mono text-[8px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Total Cash</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="hidden w-[300px] flex-shrink-0 flex-col lg:flex" style={{ borderLeft: "1px solid var(--ink-200)", background: "var(--ink-0)" }}>
          <div className="flex-1 overflow-auto">
            {/* Staff header */}
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--ink-200)" }}>
              <div className="flex items-center gap-2">
                <svg {...sv} style={{ color: "var(--ink-400)" }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                <span className="font-mono text-[10px]" style={{ color: "var(--ink-500)" }}>Admin Console 1</span>
              </div>
              <span className="flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] font-medium" style={{ background: "var(--ok-soft)", color: "var(--ok)", border: "1px solid #bbf7d0" }}>
                <span className="h-1 w-1 rounded-full" style={{ background: "var(--ok)" }} />Online
              </span>
            </div>

            <div className="px-5 py-4">
              {/* Staff avatar */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-full font-serif text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, var(--accent), #9a3412)" }}>{staffName.charAt(0) || "A"}</div>
                <div>
                  <div className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>{staffName || "Admin"}</div>
                  <div className="font-mono text-[10px]" style={{ color: "var(--ink-500)" }}>Administrator</div>
                </div>
              </div>

              {/* Title + Live */}
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-serif text-[15px] font-bold" style={{ color: "var(--ink-900)" }}>Open / Close <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Shift</em></h3>
                <span className="flex items-center gap-1 font-mono text-[9px] font-medium" style={{ color: openShift ? "var(--ok)" : "var(--ink-400)" }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: openShift ? "var(--ok)" : "var(--ink-300)", animation: openShift ? "pulse-dot 2s infinite" : "none" }} />
                  {openShift ? "Live" : "Offline"}
                </span>
              </div>

              {(selShift || openShift) ? (() => {
                const s = selShift || openShift!;
                const tillDone = s.tills.length > 0;
                const till = tillDone ? s.tills[0] : null;
                const diff = till ? parseFloat(till.difference) : 0;
                const expected = till ? parseFloat(till.expectedCash) : 0;
                const actual = till ? parseFloat(till.actualCash) : 0;

                return (
                  <div className="mt-4 space-y-3">
                    {/* Selected Shift */}
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Selected Shift</span>
                      <span className="text-[11px] font-semibold" style={{ color: "var(--accent)" }}>MS-{s.id.slice(-3).toUpperCase()} &middot; {s.staff?.name ?? "Staff"}</span>
                    </div>

                    {/* Branch + Shift Type */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Branch</label>
                        <div className="mt-1 rounded-[var(--r-md)] px-3 py-2 text-[11px] font-medium" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)", background: "var(--ink-50)" }}>
                          {branchId?.includes("branch-1") ? "Downtown" : "Waterfront"}
                        </div>
                      </div>
                      <div>
                        <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Shift Type</label>
                        <div className="mt-1 rounded-[var(--r-md)] px-3 py-2 text-[11px] font-medium" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)", background: "var(--ink-50)" }}>All Stations</div>
                      </div>
                    </div>

                    {/* Start + End Time */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Start Time</label>
                        <div className="mt-1 flex items-center justify-between rounded-[var(--r-md)] px-3 py-2 text-[11px] font-medium" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>
                          {fmtTime(s.startTime)}
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--ink-400)" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        </div>
                      </div>
                      <div>
                        <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>End Time</label>
                        <div className="mt-1 flex items-center justify-between rounded-[var(--r-md)] px-3 py-2 text-[11px] font-medium" style={{ border: "1px solid var(--ink-200)", color: s.endTime ? "var(--ink-700)" : "var(--ink-400)" }}>
                          {s.endTime ? fmtTime(s.endTime) : "Ongoing"}
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--ink-400)" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        </div>
                      </div>
                    </div>

                    {/* Assigned Manager */}
                    <div>
                      <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Assigned Manager</label>
                      <div className="mt-1 rounded-[var(--r-md)] px-3 py-2 text-[11px] font-medium" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)", background: "var(--ink-50)" }}>{s.staff?.name ?? staffName}</div>
                    </div>

                    {/* Opening Float + Expected Cash */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Opening Float</label>
                        <div className="mt-1 rounded-[var(--r-md)] px-3 py-2 text-[11px] font-mono font-bold" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>$0.00</div>
                      </div>
                      <div>
                        <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Expected Cash</label>
                        <div className="mt-1 rounded-[var(--r-md)] px-3 py-2 text-[11px] font-mono font-bold" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>${expected.toFixed(2)}</div>
                      </div>
                    </div>

                    {/* Counted Cash + Difference */}
                    {tillDone ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Counted Cash</label>
                          <div className="mt-1 rounded-[var(--r-md)] px-3 py-2 text-[11px] font-mono font-bold" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>${actual.toFixed(2)}</div>
                        </div>
                        <div>
                          <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Difference</label>
                          <div className="mt-1 rounded-[var(--r-md)] px-3 py-2 text-[11px] font-mono font-bold" style={{ border: "1px solid var(--ink-200)", color: diff >= 0 ? "var(--ok)" : "var(--bad)", background: diff >= 0 ? "var(--ok-soft)" : "var(--bad-soft)" }}>
                            {diff >= 0 ? "+" : ""}${diff.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ) : s.status === "OPEN" ? (
                      <div>
                        <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Counted Cash</label>
                        <div className="mt-1 flex rounded-[var(--r-md)] overflow-hidden" style={{ border: "1px solid var(--ink-200)" }}>
                          <span className="flex items-center px-3 text-[11px]" style={{ background: "var(--ink-50)", color: "var(--ink-500)", borderRight: "1px solid var(--ink-200)" }}>$</span>
                          <input type="number" step="0.01" value={tillCash} onChange={e => setTillCash(e.target.value)} placeholder="0.00"
                            className="flex-1 px-3 py-2 text-[12px] font-bold outline-none" style={{ color: "var(--ink-900)" }} />
                        </div>
                      </div>
                    ) : null}

                    {/* Notes */}
                    <div>
                      <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Notes</label>
                      <textarea rows={2} placeholder="Add notes (optional)..." className="mt-1 w-full resize-none rounded-[var(--r-md)] px-3 py-2 text-[11px] outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-2 py-1">
                      <div className="flex-1 h-px" style={{ background: "var(--ink-200)" }} />
                      <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="var(--ink-400)" strokeWidth={2} strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
                      <div className="flex-1 h-px" style={{ background: "var(--ink-200)" }} />
                    </div>

                    {/* Reconciliation Status */}
                    <div className="flex items-center gap-3 rounded-[var(--r-lg)] p-3.5" style={{
                      background: tillDone ? "var(--ok-soft)" : "var(--warn-soft)",
                      border: `1px solid ${tillDone ? "#bbf7d0" : "#fde68a"}`,
                    }}>
                      <div className="flex h-9 w-9 items-center justify-center rounded-full flex-shrink-0" style={{ background: tillDone ? "var(--ok)" : "var(--warn)", color: "var(--ink-0)" }}>
                        {tillDone ? <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg> : <span className="text-sm font-bold">!</span>}
                      </div>
                      <div>
                        <div className="text-[12px] font-bold" style={{ color: tillDone ? "var(--ok)" : "var(--warn)" }}>
                          {tillDone ? `Over by $${Math.abs(diff).toFixed(2)}` : "Reconciliation Pending"}
                        </div>
                        <div className="text-[9px]" style={{ color: tillDone ? "#166534" : "#854d0e" }}>
                          {tillDone ? "Variance within acceptable limit" : "Close the till to reconcile"}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons — 3 in a row like reference */}
                    {s.status === "OPEN" && (
                      <div className="flex gap-2">
                        {!tillDone && (
                          <button onClick={handleCloseTill} disabled={busy || !tillCash}
                            className="flex-1 rounded-[var(--r-md)] py-2.5 text-[11px] font-semibold transition disabled:opacity-40"
                            style={{ border: "1px solid var(--accent-edge)", color: "var(--accent)", background: "var(--ink-0)" }}>
                            {busy ? "..." : "Start Reconciliation"}
                          </button>
                        )}
                        <button onClick={handleCloseShift} disabled={busy}
                          className="rounded-[var(--r-md)] px-4 py-2.5 text-[11px] font-semibold transition disabled:opacity-50"
                          style={{ background: "var(--bad)", color: "var(--ink-0)" }}>
                          Close Shift
                        </button>
                        <button disabled={busy}
                          className="rounded-[var(--r-md)] px-4 py-2.5 text-[11px] font-semibold transition disabled:opacity-50"
                          style={{ background: "var(--accent)", color: "var(--ink-0)" }}>
                          Save Changes
                        </button>
                      </div>
                    )}
                    {s.status === "CLOSED" && (
                      <div className="rounded-[var(--r-md)] py-3 text-center text-[11px] font-medium" style={{ background: "var(--ink-50)", color: "var(--ink-500)" }}>
                        Shift closed at {s.endTime ? fmtTime(s.endTime) : "—"}
                      </div>
                    )}

                    {/* Recent Closures */}
                    <div className="flex items-center justify-between pt-3 mt-1" style={{ borderTop: "1px solid var(--ink-200)" }}>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full font-serif text-[15px] font-extrabold" style={{ background: "var(--ink-100)", color: "var(--ink-700)" }}>
                          {allShifts.filter(sh => sh.status === "CLOSED").length}
                        </div>
                        <div>
                          <div className="text-[12px] font-semibold" style={{ color: "var(--ink-900)" }}>Recent Closures</div>
                          {allShifts.filter(sh => sh.status === "CLOSED").length > 0 && (
                            <div className="font-mono text-[9px]" style={{ color: "var(--ink-400)" }}>
                              Last: {allShifts.filter(sh => sh.status === "CLOSED")[0]?.staff?.name ?? "Staff"} &middot; {allShifts.filter(sh => sh.status === "CLOSED")[0]?.endTime ? fmtTime(allShifts.filter(sh => sh.status === "CLOSED")[0].endTime!) : ""}
                            </div>
                          )}
                        </div>
                      </div>
                      <button className="font-mono text-[10px] font-medium" style={{ color: "var(--accent)" }}>View report</button>
                    </div>
                  </div>
                );
              })() : (
                <div className="mt-4 flex flex-col items-center py-10 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--ink-100)", color: "var(--ink-400)" }}>
                    <svg {...sv}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  </div>
                  <p className="mt-2 text-[12px]" style={{ color: "var(--ink-500)" }}>Select a shift or open a new one</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-auto px-5 py-3" style={{ borderTop: "1px solid var(--ink-200)" }}>
              <div className="flex items-center justify-center gap-2 font-mono text-[9px]" style={{ color: "var(--ink-400)" }}>
                <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                <span>Secure</span><span>&middot;</span><span>Compliant</span><span>&middot;</span><span>Auditable</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
