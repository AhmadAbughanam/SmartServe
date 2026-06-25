"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { authDelete, authGet, authPatch, authPost } from "../../../lib/api";
import { useAdminBranch } from "../branch-context";
import { LoadingScreen, EmptyState, useToast } from "../../../components/ui";

const sv = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

interface Table {
  id: string;
  branchId: string;
  tableCode: string;
  capacity: number;
  zone: string | null;
  createdAt: string;
}

export default function AdminTablesPage() {
  const qc = useQueryClient();
  const { branchId } = useAdminBranch();
  const { toast } = useToast();
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  /* Sidebar form state */
  const [sideOpen, setSideOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [fTableCode, setFTableCode] = useState("");
  const [fCapacity, setFCapacity] = useState("4");
  const [fZone, setFZone] = useState("");

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ["admin-tables", branchId],
    queryFn: () => authGet<Table[]>(`/api/admin/tables?branchId=${branchId}`),
    enabled: !!branchId,
  });

  const { mutate: createTable, isPending: isCreating } = useMutation({
    mutationFn: (newTable: { branchId: string, tableCode: string, capacity: number, zone?: string }) => {
      return authPost<{ id: string }>("/api/admin/tables", undefined, newTable);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tables", branchId] });
      toast("Table created successfully");
      setSideOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast(err.message, "error");
    },
  });

  const { mutate: updateTable, isPending: isUpdating } = useMutation({
    mutationFn: (updatedTable: { id: string, tableCode?: string, capacity?: number, zone?: string }) => {
      return authPatch(`/api/admin/tables/${updatedTable.id}`, undefined, updatedTable);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tables", branchId] });
      toast("Table updated successfully");
      setSideOpen(false);
      resetForm();
    },
    onError: (err) => {
      toast(err.message, "error");
    },
  });

  const { mutate: deleteTable, isPending: isDeleting } = useMutation({
    mutationFn: (tableId: string) => {
      return authDelete(`/api/admin/tables/${tableId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tables", branchId] });
      toast("Table deleted successfully");
    },
    onError: (err) => {
      toast(err.message, "error");
    },
  });

  function resetForm() {
    setSelectedTable(null);
    setFTableCode("");
    setFCapacity("4");
    setFZone("");
  }

  function openCreate() {
    resetForm();
    setSideOpen(true);
  }

  function openEdit(table: Table) {
    setSelectedTable(table);
    setFTableCode(table.tableCode);
    setFCapacity(table.capacity.toString());
    setFZone(table.zone || "");
    setSideOpen(true);
  }

  function handleSave() {
    if (!branchId || !fTableCode || !fCapacity) return;

    if (selectedTable) {
      updateTable({
        id: selectedTable.id,
        tableCode: fTableCode,
        capacity: parseInt(fCapacity, 10),
        zone: fZone || undefined,
      });
    } else {
      createTable({
        branchId,
        tableCode: fTableCode,
        capacity: parseInt(fCapacity, 10),
        zone: fZone || undefined,
      });
    }
  }
  
  function copyUrl(table: Table) {
    const url = `${origin}/customer/start?branchId=${table.branchId}&tableCode=${table.tableCode}`;
    navigator.clipboard.writeText(url);
    toast(`Copied URL for table ${table.tableCode}`);
  }

  if (isLoading) return <LoadingScreen message="Loading tables..." />;

  const totalTables = tables.length;
  const isSaving = isCreating || isUpdating;

  return (
    <div className="flex h-full flex-col" style={{ minHeight: "100%" }}>
      {/* Header */}
      <div className="px-7 py-4" style={{ background: "var(--ink-0)", borderBottom: "1px solid var(--ink-200)" }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-serif text-[22px] font-extrabold tracking-tight leading-none" style={{ color: "var(--ink-900)" }}>Table <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Management</em></h1>
            <p className="mt-1 text-[11px]" style={{ color: "var(--ink-500)" }}>Manage tables and generate QR code URLs for customer ordering.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openCreate} className="flex items-center gap-1.5 rounded-[var(--r-md)] px-3 py-2 text-[11px] font-semibold" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>
              <svg {...sv}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>Add Table
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Table area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Column headers */}
          <div className="flex items-center gap-4 px-7 py-2" style={{ background: "var(--ink-50)", borderBottom: "1px solid var(--ink-200)" }}>
            <span className="flex-1 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Table Code</span>
            <span className="w-24 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Capacity</span>
            <span className="w-32 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Zone</span>
            <span className="w-48 text-center font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-400)" }}>Actions</span>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-auto" style={{ background: "var(--ink-0)" }}>
            {tables.map((table) => (
              <div key={table.id} className="flex items-center gap-4 px-7 py-3" style={{ borderBottom: "1px solid var(--ink-100)" }}>
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>{table.tableCode}</span>
                </div>
                <span className="w-24 text-[12px]" style={{ color: "var(--ink-600)" }}>{table.capacity} people</span>
                <span className="w-32 text-[12px]" style={{ color: "var(--ink-600)" }}>{table.zone || "N/A"}</span>
                <div className="w-48 flex justify-center gap-2">
                  <button onClick={() => copyUrl(table)} className="flex items-center gap-1.5 rounded-[var(--r-sm)] px-2.5 py-1.5 text-[11px] font-medium" style={{ background: "var(--ink-100)", color: "var(--ink-700)" }}>
                    <svg {...sv} width={12} height={12}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /></svg>
                    Copy URL
                  </button>
                  <button onClick={() => openEdit(table)} className="flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] text-white" style={{ background: "var(--sky)" }}>
                    <svg {...sv} width={12} height={12}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                  </button>
                  <button onClick={() => deleteTable(table.id)} disabled={isDeleting} className="flex h-7 w-7 items-center justify-center rounded-[var(--r-sm)] text-white" style={{ background: "var(--bad)" }}>
                     <svg {...sv} width={12} height={12}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                  </button>
                </div>
              </div>
            ))}
            {tables.length === 0 && <div className="py-12"><EmptyState icon="&#x1F4CB;" title="No tables found" description="Add your first table to get started." /></div>}
          </div>

          <div className="px-7 py-2" style={{ background: "var(--ink-50)", borderTop: "1px solid var(--ink-200)" }}>
            <span className="font-mono text-[10px]" style={{ color: "var(--ink-400)" }}>Showing {totalTables} tables</span>
          </div>
        </div>

        {/* Right sidebar for adding/editing a table */}
        {sideOpen && (
          <div className="w-[320px] flex-shrink-0 flex-col flex" style={{ borderLeft: "1px solid var(--ink-200)", background: "var(--ink-0)" }}>
            <div className="px-5 py-4">
              <h3 className="font-serif text-[15px] font-bold mb-4" style={{ color: "var(--ink-900)" }}>{selectedTable ? "Edit" : "Add New"} <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Table</em></h3>
              <div className="space-y-4">
                <div>
                  <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Table Code *</label>
                  <input value={fTableCode} onChange={e => setFTableCode(e.target.value.toUpperCase())} placeholder="e.g., T6 or P1" className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2.5 text-[12px] outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                </div>
                <div>
                  <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Capacity *</label>
                  <input type="number" value={fCapacity} onChange={e => setFCapacity(e.target.value)} className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2.5 text-[12px] outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                </div>
                <div>
                  <label className="font-mono text-[9px] font-medium uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>Zone</label>
                  <input value={fZone} onChange={e => setFZone(e.target.value)} placeholder="e.g., Patio or Main Dining" className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2.5 text-[12px] outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
                </div>
              </div>
            </div>
            <div className="mt-auto p-4 flex gap-2" style={{borderTop: "1px solid var(--ink-200)"}}>
              <button onClick={() => setSideOpen(false)} className="flex-1 rounded-[var(--r-md)] py-2.5 text-[12px] font-semibold" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>Cancel</button>
              <button onClick={handleSave} disabled={isSaving || !fTableCode || !fCapacity} className="flex-1 rounded-[var(--r-md)] py-2.5 text-[12px] font-semibold disabled:opacity-50" style={{ background: "var(--accent)", color: "var(--ink-0)" }}>
                {isSaving ? "Saving..." : selectedTable ? "Update Table" : "Add Table"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
