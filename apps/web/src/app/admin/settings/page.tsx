"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { authGet, authPatch } from "../../../lib/api";
import { useAdminBranch } from "../branch-context";
import { LoadingScreen, useToast } from "../../../components/ui";

interface BranchSettingsData {
  branchId: string;
  serviceChargeEnabled: boolean;
  serviceChargeType: string;
  serviceChargeValue: string;
  tipsEnabled: boolean;
  tipPresetsJson: number[] | null;
  paymentConfigJson: Record<string, unknown> | null;
}

export default function AdminSettingsPage() {
  const qc = useQueryClient();
  const { branchId } = useAdminBranch();
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-settings", branchId],
    queryFn: () => authGet<BranchSettingsData>(`/api/admin/branch-settings?branchId=${branchId}`),
    enabled: !!branchId,
  });

  const [form, setForm] = useState<Partial<BranchSettingsData>>({});

  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  async function save() {
    if (!branchId) return;
    setBusy(true);
    try {
      const payload = {
        serviceChargeEnabled: form.serviceChargeEnabled,
        serviceChargeType: form.serviceChargeType,
        serviceChargeValue: form.serviceChargeValue,
        tipsEnabled: form.tipsEnabled,
        tipPresetsJson: form.tipPresetsJson,
        paymentConfigJson: form.paymentConfigJson,
      };
      await authPatch(`/api/admin/branch-settings?branchId=${branchId}`, undefined, payload);
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      toast("Settings saved");
    } catch (e) { toast(e instanceof Error ? e.message : "Failed to save", "error"); }
    finally { setBusy(false); }
  }

  if (isLoading) return <LoadingScreen message="Loading settings..." />;

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <h1 className="font-serif text-2xl font-bold" style={{ color: "var(--ink-900)" }}>Branch <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>settings</em></h1>
      <p className="mt-1 font-mono text-[11px]" style={{ color: "var(--ink-500)" }}>Service charge, tips, and payment settings</p>

      {/* Service Charge */}
      <section className="mt-6 rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
        <h2 className="font-serif text-sm font-bold" style={{ color: "var(--ink-900)" }}>Service Charge</h2>
        <label className="flex items-center gap-3 mt-3 mb-3 cursor-pointer">
          <input type="checkbox" checked={!!form.serviceChargeEnabled} onChange={(e) => setForm({ ...form, serviceChargeEnabled: e.target.checked })}
            className="h-4 w-4 rounded accent-[var(--accent)]" />
          <span className="text-sm" style={{ color: "var(--ink-700)" }}>Enable service charge</span>
        </label>
        {form.serviceChargeEnabled && (
          <div className="flex gap-3">
            <select value={form.serviceChargeType ?? "PERCENT"} onChange={(e) => setForm({ ...form, serviceChargeType: e.target.value })}
              className="rounded-[var(--r-md)] px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}>
              <option value="PERCENT">Percent (%)</option>
              <option value="FIXED">Fixed ($)</option>
            </select>
            <input type="number" step="0.01" value={form.serviceChargeValue ?? ""} onChange={(e) => setForm({ ...form, serviceChargeValue: e.target.value })}
              placeholder="Value" className="flex-1 rounded-[var(--r-md)] px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
          </div>
        )}
      </section>

      {/* Tips */}
      <section className="mt-4 rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
        <h2 className="font-serif text-sm font-bold" style={{ color: "var(--ink-900)" }}>Tips</h2>
        <label className="flex items-center gap-3 mt-3 mb-3 cursor-pointer">
          <input type="checkbox" checked={!!form.tipsEnabled} onChange={(e) => setForm({ ...form, tipsEnabled: e.target.checked })}
            className="h-4 w-4 rounded accent-[var(--accent)]" />
          <span className="text-sm" style={{ color: "var(--ink-700)" }}>Enable tip suggestions</span>
        </label>
        {form.tipsEnabled && (
          <div>
            <label className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>Tip presets (comma-separated %)</label>
            <input value={Array.isArray(form.tipPresetsJson) ? form.tipPresetsJson.join(", ") : ""}
              onChange={(e) => setForm({ ...form, tipPresetsJson: e.target.value.split(",").map((v) => parseInt(v.trim())).filter((n) => !isNaN(n)) as number[] })}
              placeholder="10, 15, 20" className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-sm outline-none" style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
          </div>
        )}
      </section>

      <button onClick={save} disabled={busy}
        className="mt-5 w-full rounded-[var(--r-md)] py-3.5 text-sm font-semibold transition disabled:opacity-50"
        style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>
        {busy ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}
