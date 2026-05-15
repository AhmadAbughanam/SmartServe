"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { authGet, authPatch } from "../../../lib/api";
import { getStaffToken } from "../../../lib/staff-auth";
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
  featureFlagsJson: Record<string, boolean> | null;
  aiConfigJson: {
    menuChatEnabled?: boolean;
    hostedLlmEnabled?: boolean;
    fallbackOnly?: boolean;
    dailyHostedRequestLimit?: number;
    dailyRequestLimit?: number;
    sessionHourlyRequestLimit?: number;
    hostedProviderTimeoutMs?: number;
    maxResponseLength?: number;
    maxSuggestions?: number;
    assistantTone?: "concise" | "friendly" | "formal";
  } | null;
}

interface MenuChatDiagnostics {
  windowHours: number;
  latestAt: string | null;
  controls: {
    enabled: boolean;
    hostedLlmEnabled: boolean;
    fallbackOnly: boolean;
    dailyHostedRequestLimit: number;
    dailyRequestLimit: number;
    sessionHourlyRequestLimit: number;
    hostedProviderTimeoutMs: number;
    maxResponseLength: number;
    maxSuggestions: number;
    assistantTone: "concise" | "friendly" | "formal";
  };
  totals: {
    requests: number;
    hostedRequests: number;
    fallbackResponses: number;
    staffHelpResponses: number;
    providerRejections: number;
  };
  byProvider: Record<string, number>;
  rejectionReasons: Record<string, number>;
  controlModes: Record<string, number>;
}

export default function AdminSettingsPage() {
  const qc = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const { branchId } = useAdminBranch();
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  useEffect(() => { setToken(getStaffToken()); }, []);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-settings", branchId],
    queryFn: () => authGet<BranchSettingsData>(`/api/admin/branch-settings?branchId=${branchId}`, token!),
    enabled: !!token && !!branchId,
  });

  const { data: diagnostics } = useQuery({
    queryKey: ["menu-chat-diagnostics", branchId],
    queryFn: () => authGet<MenuChatDiagnostics>(`/api/admin/ai/menu-chat/diagnostics?branchId=${branchId}&hours=24`, token!),
    enabled: !!token && !!branchId,
  });

  const [form, setForm] = useState<Partial<BranchSettingsData>>({});

  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  async function save() {
    if (!token || !branchId) return;
    setBusy(true);
    try {
      await authPatch(`/api/admin/branch-settings?branchId=${branchId}`, token, form);
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      toast("Settings saved");
    } catch (e) { toast(e instanceof Error ? e.message : "Failed to save", "error"); }
    finally { setBusy(false); }
  }

  if (isLoading) return <LoadingScreen message="Loading settings..." />;

  const flags = (form.featureFlagsJson ?? {}) as Record<string, boolean>;
  const flagKeys = ["customerOrdering", "kds", "waiterDashboard", "pos", "inventory", "promotions", "aiRecommendations"];
  const aiConfig = form.aiConfigJson ?? {};

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <h1 className="font-serif text-2xl font-bold" style={{ color: "var(--ink-900)" }}>Branch <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>settings</em></h1>
      <p className="mt-1 font-mono text-[11px]" style={{ color: "var(--ink-500)" }}>Service charge, tips, and feature flags</p>

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

      {/* AI Assistant */}
      <section className="mt-4 rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
        <h2 className="font-serif text-sm font-bold" style={{ color: "var(--ink-900)" }}>Menu Assistant AI</h2>
        <p className="mt-0.5 font-mono text-[10px]" style={{ color: "var(--ink-500)" }}>Branch-level safety and cost controls</p>
        <div className="mt-3 space-y-2">
          {[
            ["menuChatEnabled", "Enable menu assistant"],
            ["hostedLlmEnabled", "Allow hosted LLM rewriting"],
            ["fallbackOnly", "Fallback-only mode"],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={key === "menuChatEnabled" ? aiConfig.menuChatEnabled !== false : !!aiConfig[key as keyof typeof aiConfig]}
                onChange={(e) => setForm({
                  ...form,
                  aiConfigJson: { ...aiConfig, [key]: e.target.checked },
                })}
                className="h-4 w-4 rounded accent-[var(--accent)]"
              />
              <span className="text-sm" style={{ color: "var(--ink-700)" }}>{label}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>Daily requests</span>
            <input
              type="number"
              min={0}
              max={5000}
              value={aiConfig.dailyRequestLimit ?? 1000}
              onChange={(e) => setForm({ ...form, aiConfigJson: { ...aiConfig, dailyRequestLimit: Number(e.target.value) } })}
              className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-sm outline-none"
              style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
            />
          </label>
          <label>
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>Session hourly requests</span>
            <input
              type="number"
              min={0}
              max={200}
              value={aiConfig.sessionHourlyRequestLimit ?? 40}
              onChange={(e) => setForm({ ...form, aiConfigJson: { ...aiConfig, sessionHourlyRequestLimit: Number(e.target.value) } })}
              className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-sm outline-none"
              style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
            />
          </label>
          <label>
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>Daily hosted requests</span>
            <input
              type="number"
              min={0}
              max={1000}
              value={aiConfig.dailyHostedRequestLimit ?? 200}
              onChange={(e) => setForm({ ...form, aiConfigJson: { ...aiConfig, dailyHostedRequestLimit: Number(e.target.value) } })}
              className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-sm outline-none"
              style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
            />
          </label>
          <label>
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>Provider timeout ms</span>
            <input
              type="number"
              min={750}
              max={10000}
              value={aiConfig.hostedProviderTimeoutMs ?? 4500}
              onChange={(e) => setForm({ ...form, aiConfigJson: { ...aiConfig, hostedProviderTimeoutMs: Number(e.target.value) } })}
              className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-sm outline-none"
              style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
            />
          </label>
          <label>
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>Max reply length</span>
            <input
              type="number"
              min={120}
              max={700}
              value={aiConfig.maxResponseLength ?? 500}
              onChange={(e) => setForm({ ...form, aiConfigJson: { ...aiConfig, maxResponseLength: Number(e.target.value) } })}
              className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-sm outline-none"
              style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
            />
          </label>
          <label>
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>Max suggestions</span>
            <input
              type="number"
              min={1}
              max={5}
              value={aiConfig.maxSuggestions ?? 5}
              onChange={(e) => setForm({ ...form, aiConfigJson: { ...aiConfig, maxSuggestions: Number(e.target.value) } })}
              className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-sm outline-none"
              style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
            />
          </label>
          <label>
            <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>Assistant tone</span>
            <select
              value={aiConfig.assistantTone ?? "concise"}
              onChange={(e) => setForm({ ...form, aiConfigJson: { ...aiConfig, assistantTone: e.target.value as "concise" | "friendly" | "formal" } })}
              className="mt-1 w-full rounded-[var(--r-md)] px-3 py-2 text-sm outline-none"
              style={{ border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
            >
              <option value="concise">Concise</option>
              <option value="friendly">Friendly</option>
              <option value="formal">Formal</option>
            </select>
          </label>
        </div>
      </section>

      {diagnostics && (
        <section className="mt-4 rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-serif text-sm font-bold" style={{ color: "var(--ink-900)" }}>Menu Assistant Diagnostics</h2>
              <p className="mt-0.5 font-mono text-[10px]" style={{ color: "var(--ink-500)" }}>Last {diagnostics.windowHours} hours</p>
            </div>
            <span className="rounded-full px-2.5 py-1 font-mono text-[9px] font-bold uppercase" style={{ background: diagnostics.controls.enabled ? "var(--ok-soft)" : "var(--bad-soft)", color: diagnostics.controls.enabled ? "var(--ok)" : "var(--bad)" }}>
              {diagnostics.controls.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ["Requests", diagnostics.totals.requests],
              ["Hosted", diagnostics.totals.hostedRequests],
              ["Fallbacks", diagnostics.totals.fallbackResponses],
              ["Ask staff", diagnostics.totals.staffHelpResponses],
              ["Rejected", diagnostics.totals.providerRejections],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[var(--r-md)] p-3" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
                <p className="font-mono text-[9px] uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>{label}</p>
                <p className="mt-1 text-lg font-bold" style={{ color: "var(--ink-900)" }}>{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <DiagnosticsList title="Providers" values={diagnostics.byProvider} />
            <DiagnosticsList title="Control modes" values={diagnostics.controlModes} />
            <DiagnosticsList title="Provider rejections" values={diagnostics.rejectionReasons} empty="No rejected provider output" />
          </div>
        </section>
      )}

      {/* Feature Flags */}
      <section className="mt-4 rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
        <h2 className="font-serif text-sm font-bold" style={{ color: "var(--ink-900)" }}>Feature Modules</h2>
        <p className="mt-0.5 font-mono text-[10px]" style={{ color: "var(--ink-500)" }}>Enable or disable feature modules for this branch</p>
        <div className="mt-3 space-y-2">
          {flagKeys.map((key) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={!!flags[key]}
                onChange={(e) => setForm({ ...form, featureFlagsJson: { ...flags, [key]: e.target.checked } as Record<string, boolean> })}
                className="h-4 w-4 rounded accent-[var(--accent)]" />
              <span className="text-sm" style={{ color: "var(--ink-700)" }}>{key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}</span>
            </label>
          ))}
        </div>
      </section>

      <button onClick={save} disabled={busy}
        className="mt-5 w-full rounded-[var(--r-md)] py-3.5 text-sm font-semibold transition disabled:opacity-50"
        style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>
        {busy ? "Saving..." : "Save Settings"}
      </button>
    </div>
  );
}

function DiagnosticsList({
  title,
  values,
  empty = "No data",
}: {
  title: string;
  values: Record<string, number>;
  empty?: string;
}) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="rounded-[var(--r-md)] p-3" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
      <p className="font-mono text-[9px] font-bold uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>{title}</p>
      <div className="mt-2 space-y-1.5">
        {entries.length === 0 && <p className="text-[11px]" style={{ color: "var(--ink-500)" }}>{empty}</p>}
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center justify-between gap-3 text-[11px]">
            <span className="truncate" style={{ color: "var(--ink-700)" }}>{key.replaceAll("_", " ")}</span>
            <span className="font-bold" style={{ color: "var(--ink-900)" }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
