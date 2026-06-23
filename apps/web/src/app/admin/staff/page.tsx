"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { authGet, authPost, authPatch } from "../../../lib/api";
import { useAdminBranch } from "../branch-context";
import { LoadingScreen, EmptyState, ErrorDisplay, useToast } from "../../../components/ui";
import type { StaffMember } from "../../../lib/admin-types";

const sv = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const ASSIGNABLE_ROLES = ["MANAGER", "CASHIER", "WAITER", "CHEF", "KITCHEN_LEAD"] as const;

const roleColor: Record<string, string> = {
  OWNER: "#7c3aed", MANAGER: "#4f46e5", CASHIER: "#d97706", WAITER: "#2563eb", CHEF: "#ea580c", KITCHEN_LEAD: "#dc2626",
};

function avatarGrad(role: string) {
  const c = roleColor[role] ?? "#78716c";
  return `linear-gradient(135deg, ${c}, ${c}cc)`;
}

export default function AdminStaffPage() {
  const qc = useQueryClient();
  const { branchId } = useAdminBranch();
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  /* Form state */
  const [mode, setMode] = useState<"idle" | "create" | "edit">("idle");
  const [editId, setEditId] = useState<string | null>(null);
  const [fName, setFName] = useState(""); const [fEmail, setFEmail] = useState(""); const [fPhone, setFPhone] = useState("");
  const [fRole, setFRole] = useState<string>("WAITER"); const [fPass, setFPass] = useState(""); const [fActive, setFActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const { data: staff, isLoading, error } = useQuery({
    queryKey: ["admin-staff", branchId],
    queryFn: () => authGet<StaffMember[]>(`/api/admin/staff?branchId=${branchId}`),
    enabled: !!branchId,
  });

  function resetForm() { setMode("idle"); setEditId(null); setFName(""); setFEmail(""); setFPhone(""); setFRole("WAITER"); setFPass(""); setFActive(true); }

  function startCreate() { resetForm(); setMode("create"); }

  function startEdit(s: StaffMember) {
    setMode("edit"); setEditId(s.id);
    setFName(s.name); setFEmail(s.email); setFPhone(s.phone); setFRole(s.primaryRole); setFActive(s.isActive);
  }

  async function handleSave() {
    if (!branchId) return;
    setSaving(true);
    try {
      if (mode === "create") {
        if (!fName || !fEmail || !fPass) { toast("Name, email, and password are required", "error"); return; }
        await authPost("/api/admin/staff", undefined, { branchId, name: fName, email: fEmail, phone: fPhone, primaryRole: fRole, password: fPass });
        toast("Staff member created");
      } else {
        await authPatch(`/api/admin/staff/${editId}`, undefined, { name: fName, email: fEmail, phone: fPhone, primaryRole: fRole, isActive: fActive });
        toast("Staff member updated");
      }
      qc.invalidateQueries({ queryKey: ["admin-staff"] });
      resetForm();
    } catch (e) { toast(e instanceof Error ? e.message : "Failed", "error"); }
    finally { setSaving(false); }
  }

  if (isLoading) return <LoadingScreen message="Loading staff..." />;
  if (error) return <ErrorDisplay message={error instanceof Error ? error.message : "Access denied"} />;

  const q = search.toLowerCase().trim();
  const filtered = (staff ?? []).filter(s => !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.primaryRole.toLowerCase().includes(q));
  const total = staff?.length ?? 0;
  const activeCount = (staff ?? []).filter(s => s.isActive).length;
  const inactiveCount = total - activeCount;
  const rolesUsed = new Set((staff ?? []).map(s => s.primaryRole)).size;
  const isEditingOwner = mode === "edit" && fRole === "OWNER";

  return (
    <div className="flex h-full flex-col" style={{ minHeight: "100%" }}>
      {/* Header */}
      <div className="px-7 py-4" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-[22px] font-extrabold tracking-tight leading-none" style={{ color: "var(--ink-900)" }}>
              Staff <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Management</em>
            </h1>
            <p className="mt-1 text-[11px]" style={{ color: "var(--ink-500)" }}>Manage staff accounts, access levels, and role assignments.</p>
          </div>
          <button onClick={startCreate}
            className="flex items-center gap-1.5 rounded-[var(--r-md)] px-4 py-2 text-[12px] font-semibold transition"
            style={{ background: "var(--accent)", color: "var(--ink-0)" }}>
            <svg {...sv}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add New Staff
          </button>
        </div>

        {/* Stat cards */}
        <div className="mt-3 flex gap-3">
          {[
            { icon: <svg {...sv}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>, label: "Total", value: total, color: "var(--ink-600)" },
            { icon: <svg {...sv}><polyline points="20 6 9 17 4 12" /></svg>, label: "Active", value: activeCount, pct: total > 0 ? ((activeCount / total) * 100).toFixed(0) + "%" : "0%", color: "var(--ok)" },
            { icon: <svg {...sv}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>, label: "Inactive", value: inactiveCount, color: "var(--bad)" },
            { icon: <svg {...sv}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>, label: "Roles", value: rolesUsed, color: "var(--accent)" },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2.5 rounded-[var(--r-md)] px-3.5 py-2" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
              <span style={{ color: s.color }}>{s.icon}</span>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-[18px] font-extrabold" style={{ color: "var(--ink-900)" }}>{s.value}</span>
                  {s.pct && <span className="font-mono text-[9px]" style={{ color: s.color }}>{s.pct}</span>}
                </div>
                <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>{s.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Table */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search + filters */}
          <div className="flex items-center gap-3 px-7 py-2" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
            <div className="flex items-center gap-2 rounded-[var(--r-md)] px-3 py-1.5" style={{ border: "1px solid var(--ink-200)" }}>
              <svg {...sv} style={{ color: "var(--ink-400)" }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff..."
                className="w-36 bg-transparent text-[12px] outline-none" style={{ color: "var(--ink-900)" }} />
            </div>
          </div>

          {/* Column headers */}
          <div className="flex items-center gap-3 px-7 py-2" style={{ background: "var(--ink-50)", borderBottom: "1px solid var(--ink-200)" }}>
            <span className="w-7 font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>#</span>
            <span className="w-9" />
            <span className="flex-1 font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Staff Name</span>
            <span className="w-24 font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Role</span>
            <span className="w-40 font-mono text-[9px] font-medium uppercase tracking-widest hidden md:block" style={{ color: "var(--ink-400)" }}>Email</span>
            <span className="w-24 font-mono text-[9px] font-medium uppercase tracking-widest hidden lg:block" style={{ color: "var(--ink-400)" }}>Phone</span>
            <span className="w-16 text-center font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Status</span>
            <span className="w-10" />
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-auto" style={{ background: "var(--ink-0)" }}>
            {filtered.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 px-7 py-2.5 transition"
                style={{ borderBottom: "1px solid var(--ink-100)", background: editId === s.id ? "var(--accent-soft)" : "var(--ink-0)", opacity: s.isActive ? 1 : 0.55 }}>
                <span className="w-7 font-mono text-[11px]" style={{ color: "var(--ink-400)" }}>{i + 1}</span>
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ background: avatarGrad(s.primaryRole) }}>
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-semibold truncate" style={{ color: "var(--ink-900)" }}>{s.name}</span>
                </div>
                <span className="w-24 rounded-full px-2 py-0.5 text-center text-[10px] font-bold"
                  style={{ background: `${roleColor[s.primaryRole] ?? "#78716c"}15`, color: roleColor[s.primaryRole] ?? "var(--ink-600)", border: `1px solid ${roleColor[s.primaryRole] ?? "#78716c"}30` }}>
                  {s.primaryRole}
                </span>
                <span className="w-40 truncate font-mono text-[11px] hidden md:block" style={{ color: "var(--ink-500)" }}>{s.email}</span>
                <span className="w-24 truncate font-mono text-[11px] hidden lg:block" style={{ color: "var(--ink-500)" }}>{s.phone || "—"}</span>
                <div className="w-16 flex justify-center">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.isActive ? "var(--ok)" : "var(--ink-300)" }} />
                    <span className="text-[10px] font-medium" style={{ color: s.isActive ? "var(--ok)" : "var(--ink-400)" }}>{s.isActive ? "Active" : "Off"}</span>
                  </span>
                </div>
                <button onClick={() => editId === s.id ? resetForm() : startEdit(s)}
                  className="flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] transition hover:opacity-80"
                  style={{ background: editId === s.id ? "var(--accent)" : "var(--ink-100)", color: editId === s.id ? "var(--ink-0)" : "var(--ink-500)" }}>
                  <svg {...sv}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </button>
              </div>
            ))}
            {filtered.length === 0 && <div className="py-12"><EmptyState icon="&#x1F465;" title="No staff found" description={search ? "Try a different search." : "Add staff members to get started."} /></div>}
          </div>

          {/* Footer */}
          <div className="px-7 py-2" style={{ background: "var(--ink-50)", borderTop: "1px solid var(--ink-200)" }}>
            <span className="font-mono text-[10px]" style={{ color: "var(--ink-400)" }}>Showing {filtered.length} of {total} staff</span>
          </div>
        </div>

        {/* Right sidebar: Create / Edit form */}
        <div className="hidden w-[280px] flex-shrink-0 flex-col lg:flex" style={{ borderLeft: "1px solid var(--ink-200)", background: "var(--ink-0)" }}>
          <div className="flex-1 overflow-auto p-5">
            <h3 className="font-serif text-[14px] font-bold mb-4" style={{ color: "var(--ink-900)" }}>
              {mode === "create" ? "Create" : mode === "edit" ? "Edit" : "Create / Edit"}{" "}
              <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Staff</em>
            </h3>

            {mode === "idle" ? (
              <div className="flex flex-col items-center py-8 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: "var(--ink-100)", color: "var(--ink-400)" }}>
                  <svg {...sv}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                </div>
                <p className="mt-2 text-[12px] font-medium" style={{ color: "var(--ink-500)" }}>Select a staff member to edit</p>
                <p className="mt-0.5 text-[10px]" style={{ color: "var(--ink-400)" }}>Or click "Add New Staff" to create one</p>
              </div>
            ) : (
              <>
                {/* Avatar preview for edit */}
                {mode === "edit" && (
                  <div className="flex items-center gap-3 rounded-[var(--r-lg)] p-3 mb-4" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white" style={{ background: avatarGrad(fRole) }}>
                      {fName.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold truncate" style={{ color: "var(--ink-900)" }}>{fName || "Staff Name"}</div>
                      <div className="text-[10px]" style={{ color: "var(--ink-500)" }}>{fEmail}</div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Full Name</label>
                    <input value={fName} onChange={e => setFName(e.target.value)}
                      className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
                      style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                  </div>
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Email</label>
                    <input value={fEmail} onChange={e => setFEmail(e.target.value)} type="email"
                      className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
                      style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                  </div>
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Phone</label>
                    <input value={fPhone} onChange={e => setFPhone(e.target.value)}
                      className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
                      style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                  </div>
                  {mode === "create" && (
                    <div>
                      <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Password</label>
                      <input value={fPass} onChange={e => setFPass(e.target.value)} type="password" placeholder="Min 6 characters"
                        className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
                        style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                    </div>
                  )}
                  <div>
                    <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Role Assignment</label>
                    <select value={fRole} onChange={e => setFRole(e.target.value)}
                      disabled={isEditingOwner}
                      className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
                      style={{ border: "1px solid var(--ink-200)", color: isEditingOwner ? "var(--ink-400)" : "var(--ink-900)", background: "var(--ink-0)" }}>
                      {isEditingOwner && <option value="OWNER">OWNER - SaaS managed</option>}
                      {ASSIGNABLE_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <p className="mt-1 text-[10px]" style={{ color: "var(--ink-400)" }}>
                      Owner accounts are created and managed by the SaaS operator.
                    </p>
                  </div>
                  {mode === "edit" && (
                    <div>
                      <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Status</label>
                      <button onClick={() => setFActive(!fActive)}
                        className="mt-1 flex w-full items-center gap-2.5 rounded-[var(--r-md)] px-3 py-2.5 transition"
                        style={{ border: "1px solid var(--ink-200)", background: "var(--ink-0)" }}>
                        <span className="relative h-5 w-9 rounded-full flex-shrink-0" style={{ background: fActive ? "var(--ok)" : "var(--ink-200)" }}>
                          <span className="absolute top-0.5 h-4 w-4 rounded-full transition-all" style={{ background: "var(--ink-0)", left: fActive ? 18 : 2, boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }} />
                        </span>
                        <span className="text-[11px] font-medium" style={{ color: fActive ? "var(--ok)" : "var(--bad)" }}>
                          {fActive ? "Active" : "Inactive"}
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex gap-2">
                  <button onClick={resetForm}
                    className="flex-1 rounded-[var(--r-md)] py-2.5 text-[12px] font-semibold transition"
                    style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 rounded-[var(--r-md)] py-2.5 text-[12px] font-semibold transition disabled:opacity-50"
                    style={{ background: "var(--accent)", color: "var(--ink-0)" }}>
                    {saving ? "Saving..." : mode === "create" ? "Create Staff" : "Save Changes"}
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
