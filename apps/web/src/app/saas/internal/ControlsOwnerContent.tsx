"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authGet, authPatch, getApiErrorMessage } from "../../../lib/api";
import { ErrorDisplay, useToast } from "../../../components/ui";
import {
  SaasBadge,
  SaasLiveBadge,
  SaasMetricCard,
  SaasPage,
  SaasSearchField,
  SaasSectionHeader,
  SaasSurface,
  SaasSurfaceBody,
  SaasTableWrap,
  SaasToolbarButton,
} from "../saas-ui";
import FeatureModulesContent from "./FeatureModulesContent";

type ControlsTab = "modules" | "ai" | "diagnostics" | "presets";
type AiStatusCode = "healthy" | "attention" | "fallback" | "disabled";
type AiTone = "concise" | "friendly" | "formal";

interface AiOverview {
  totals: {
    totalBranches: number;
    activeBranches: number;
    menuChatEnabledBranches: number;
    hostedLlmEnabledBranches: number;
    fallbackOnlyBranches: number;
    aiRecommendationsEnabledBranches: number;
    requests24h: number;
    hostedRequests24h: number;
    fallbackResponses24h: number;
    staffHelpResponses24h: number;
    providerRejections24h: number;
  };
  issueBranches: Array<{
    branchId: string;
    branchName: string;
    tenantId: string;
    tenantName: string;
    requests24h: number;
    lastActivityAt: string | null;
    status: { code: AiStatusCode; label: string; reason: string };
  }>;
}

interface AiControls {
  menuChatEnabled: boolean;
  hostedLlmEnabled: boolean;
  fallbackOnly: boolean;
  dailyHostedRequestLimit: number;
  dailyRequestLimit: number;
  sessionHourlyRequestLimit: number;
  hostedProviderTimeoutMs: number;
  maxResponseLength: number;
  maxSuggestions: number;
  assistantTone: AiTone;
}

interface AiBranchRow {
  tenantId: string;
  tenantName: string;
  branchId: string;
  branchName: string;
  branchLocation: string;
  isActive: boolean;
  aiRecommendationsEnabled: boolean;
  controls: AiControls;
  requests24h: number;
  hostedRequests24h: number;
  fallbackResponses24h: number;
  staffHelpResponses24h: number;
  providerRejections24h: number;
  lastActivityAt: string | null;
  branchSettingsUpdatedAt: string | null;
  status: { code: AiStatusCode; label: string; reason: string };
}

interface AiBranchDetail {
  branchId: string;
  branchName: string;
  branchLocation: string;
  tenantId: string;
  tenantName: string;
  aiRecommendationsEnabled: boolean;
  branchSettingsUpdatedAt: string | null;
  status: { code: AiStatusCode; label: string; reason: string };
  controls: AiControls;
  diagnostics: {
    windowHours: number;
    totals: {
      requests: number;
      hostedRequests: number;
      fallbackResponses: number;
      staffHelpResponses: number;
      providerRejections: number;
    };
    byProvider: Record<string, number>;
    byIntent: Record<string, number>;
    rejectionReasons: Record<string, number>;
    latestAt: string | null;
  };
  recommendations: string[];
}

const presets: Array<{ key: string; label: string; description: string; controls: AiControls }> = [
  {
    key: "balanced",
    label: "Balanced Service",
    description: "Hosted AI enabled with fallback available and moderate request limits.",
    controls: {
      menuChatEnabled: true,
      hostedLlmEnabled: true,
      fallbackOnly: false,
      dailyHostedRequestLimit: 200,
      dailyRequestLimit: 1000,
      sessionHourlyRequestLimit: 40,
      hostedProviderTimeoutMs: 4500,
      maxResponseLength: 500,
      maxSuggestions: 5,
      assistantTone: "concise",
    },
  },
  {
    key: "supportive",
    label: "Supportive Tone",
    description: "Friendlier customer guidance with slightly longer responses.",
    controls: {
      menuChatEnabled: true,
      hostedLlmEnabled: true,
      fallbackOnly: false,
      dailyHostedRequestLimit: 250,
      dailyRequestLimit: 1200,
      sessionHourlyRequestLimit: 45,
      hostedProviderTimeoutMs: 5000,
      maxResponseLength: 620,
      maxSuggestions: 5,
      assistantTone: "friendly",
    },
  },
  {
    key: "fallback",
    label: "Fallback Only",
    description: "Disables hosted LLM usage and forces deterministic assistance.",
    controls: {
      menuChatEnabled: true,
      hostedLlmEnabled: false,
      fallbackOnly: true,
      dailyHostedRequestLimit: 0,
      dailyRequestLimit: 1000,
      sessionHourlyRequestLimit: 40,
      hostedProviderTimeoutMs: 4500,
      maxResponseLength: 380,
      maxSuggestions: 4,
      assistantTone: "formal",
    },
  },
];

function statusTone(code: AiStatusCode): "ok" | "warn" | "bad" | "neutral" {
  if (code === "healthy") return "ok";
  if (code === "fallback") return "warn";
  if (code === "attention") return "bad";
  return "neutral";
}

function formatDateTime(value: string | null) {
  if (!value) return "No recent activity";
  return new Date(value).toLocaleString("en-US");
}

function topEntries(input: Record<string, number>, limit: number) {
  return Object.entries(input).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function sameControls(left: AiControls | null, right: AiControls | null) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export default function ControlsOwnerContent({ initialTab }: { initialTab: ControlsTab }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<ControlsTab>(initialTab);
  const [search, setSearch] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [hours, setHours] = useState(24);
  const [draft, setDraft] = useState<AiControls | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  const overviewQuery = useQuery({
    queryKey: ["saas-ai-overview"],
    queryFn: () => authGet<AiOverview>("/api/saas/ai/overview"),
    retry: false,
  });

  const branchesQuery = useQuery({
    queryKey: ["saas-ai-branches"],
    queryFn: () => authGet<AiBranchRow[]>("/api/saas/ai/branches"),
    retry: false,
  });

  const detailQuery = useQuery({
    queryKey: ["saas-ai-branch-detail", selectedBranchId, hours],
    queryFn: () => authGet<AiBranchDetail>(`/api/saas/ai/branches/${selectedBranchId}?hours=${hours}`),
    enabled: !!selectedBranchId,
    retry: false,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setLastUpdated(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (overviewQuery.data || branchesQuery.data || detailQuery.data) setLastUpdated(new Date());
  }, [overviewQuery.data, branchesQuery.data, detailQuery.data]);

  const branches = branchesQuery.data ?? [];
  const visibleBranches = useMemo(() => {
    const query = search.trim().toLowerCase();
    return branches.filter((branch) =>
      !query ||
      `${branch.tenantName} ${branch.branchName} ${branch.branchLocation}`.toLowerCase().includes(query),
    );
  }, [branches, search]);

  useEffect(() => {
    if (visibleBranches.length === 0) {
      setSelectedBranchId("");
      return;
    }
    if (!selectedBranchId || !visibleBranches.some((branch) => branch.branchId === selectedBranchId)) {
      setSelectedBranchId(visibleBranches[0].branchId);
    }
  }, [selectedBranchId, visibleBranches]);

  useEffect(() => {
    if (detailQuery.data?.controls) {
      setDraft(detailQuery.data.controls);
    }
  }, [detailQuery.data]);

  async function saveControls(next?: AiControls) {
    const payload = next ?? draft;
    if (!selectedBranchId || !payload) return;

    setSaving(true);
    try {
      await authPatch(`/api/saas/ai/branches/${selectedBranchId}`, null, payload);
      toast("AI controls updated");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["saas-ai-overview"] }),
        qc.invalidateQueries({ queryKey: ["saas-ai-branches"] }),
        qc.invalidateQueries({ queryKey: ["saas-ai-branch-detail", selectedBranchId] }),
      ]);
    } catch (error) {
      toast(getApiErrorMessage(error, "Failed to update AI controls."), "error");
    } finally {
      setSaving(false);
    }
  }

  if (tab === "modules") {
    return (
      <div className="space-y-4">
        <ControlsTabBar active={tab} onChange={setTab} />
        <FeatureModulesContent />
      </div>
    );
  }

  if (overviewQuery.isLoading || branchesQuery.isLoading) {
    return <div className="p-6" />;
  }

  if (overviewQuery.isError || branchesQuery.isError || !overviewQuery.data) {
    return (
      <ErrorDisplay
        message={getApiErrorMessage(overviewQuery.error ?? branchesQuery.error, "Controls data is unavailable.")}
        onRetry={() => {
          void overviewQuery.refetch();
          void branchesQuery.refetch();
        }}
      />
    );
  }

  const overview = overviewQuery.data;
  const selectedBranch =
    visibleBranches.find((branch) => branch.branchId === selectedBranchId) ??
    branches.find((branch) => branch.branchId === selectedBranchId) ??
    null;
  const detail = detailQuery.data ?? null;
  const dirty = !sameControls(draft, detail?.controls ?? null);

  return (
    <div className="space-y-4">
      <ControlsTabBar active={tab} onChange={setTab} />
      <SaasPage
        eyebrow="AI governance"
        title="Controls"
        description="Own branch module rollout, AI operating limits, diagnostics, and reusable presets from one SaaS control surface."
        actions={
          <>
            <SaasToolbarButton label="Refresh" onClick={() => { void overviewQuery.refetch(); void branchesQuery.refetch(); void detailQuery.refetch(); }} />
            <SaasLiveBadge lastUpdated={lastUpdated} />
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SaasMetricCard label="AI-enabled branches" value={overview.totals.menuChatEnabledBranches.toLocaleString()} detail={`${overview.totals.totalBranches.toLocaleString()} total branches`} tone="ok" />
          <SaasMetricCard label="Hosted LLM" value={overview.totals.hostedLlmEnabledBranches.toLocaleString()} detail={`${overview.totals.fallbackOnlyBranches.toLocaleString()} fallback-only branches`} />
          <SaasMetricCard label="Requests 24h" value={overview.totals.requests24h.toLocaleString()} detail={`${overview.totals.hostedRequests24h.toLocaleString()} hosted requests`} />
          <SaasMetricCard label="Staff escalations" value={overview.totals.staffHelpResponses24h.toLocaleString()} detail={`${overview.totals.providerRejections24h.toLocaleString()} provider rejections`} tone={overview.totals.providerRejections24h > 0 ? "warn" : "neutral"} />
          <SaasMetricCard label="AI modules" value={overview.totals.aiRecommendationsEnabledBranches.toLocaleString()} detail="Branches with AI recommendations enabled" />
        </div>

        <SaasSurface>
          <SaasSurfaceBody>
            <div className="grid gap-3 xl:grid-cols-[1.4fr_0.8fr_auto]">
              <SaasSearchField value={search} onChange={setSearch} placeholder="Search tenants or branches..." />
              <select
                value={hours}
                onChange={(event) => setHours(Number(event.target.value))}
                className="h-10 rounded-[var(--r-md)] px-3 text-[13px] outline-none md:h-11"
                style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
              >
                <option value={24}>Last 24 hours</option>
                <option value={72}>Last 72 hours</option>
                <option value={168}>Last 7 days</option>
              </select>
              <div className="flex items-center rounded-[var(--r-md)] px-3 text-[12px] font-semibold md:h-11" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>
                {visibleBranches.length.toLocaleString()} branches visible
              </div>
            </div>
          </SaasSurfaceBody>
        </SaasSurface>

        {tab === "ai" ? (
          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <SaasSurface>
              <SaasSurfaceBody>
                <SaasSectionHeader title="Branch AI watchlist" subtitle="Select a branch to edit AI controls." />
                <SaasTableWrap>
                  <table className="min-w-full text-left">
                    <thead style={{ background: "var(--ink-50)" }}>
                      <tr className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--ink-500)" }}>
                        <th className="px-4 py-3">Branch</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Requests</th>
                        <th className="px-4 py-3 text-right">Rejections</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleBranches.map((branch) => (
                        <tr
                          key={branch.branchId}
                          onClick={() => setSelectedBranchId(branch.branchId)}
                          style={{ borderTop: "1px solid var(--ink-200)", background: branch.branchId === selectedBranchId ? "var(--ink-50)" : "transparent", cursor: "pointer" }}
                        >
                          <td className="px-4 py-3">
                            <div className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>{branch.tenantName} - {branch.branchName}</div>
                            <div className="text-[12px]" style={{ color: "var(--ink-500)" }}>{branch.branchLocation}</div>
                          </td>
                          <td className="px-4 py-3">
                            <SaasBadge label={branch.status.label} tone={statusTone(branch.status.code)} />
                          </td>
                          <td className="px-4 py-3 text-right text-[13px]" style={{ color: "var(--ink-700)" }}>{branch.requests24h.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-[13px]" style={{ color: "var(--ink-700)" }}>{branch.providerRejections24h.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </SaasTableWrap>
              </SaasSurfaceBody>
            </SaasSurface>

            <SaasSurface>
              <SaasSurfaceBody>
                <SaasSectionHeader
                  title={selectedBranch ? `${selectedBranch.tenantName} - ${selectedBranch.branchName}` : "AI controls"}
                  subtitle={selectedBranch ? selectedBranch.branchLocation : "Select a branch"}
                  action={selectedBranch ? <SaasBadge label={selectedBranch.status.label} tone={statusTone(selectedBranch.status.code)} /> : undefined}
                />
                {!selectedBranch || !draft ? null : (
                  <div className="space-y-3">
                    <ToggleRow label="Menu chat enabled" checked={draft.menuChatEnabled} onChange={(checked) => setDraft({ ...draft, menuChatEnabled: checked })} />
                    <ToggleRow label="Hosted LLM enabled" checked={draft.hostedLlmEnabled} onChange={(checked) => setDraft({ ...draft, hostedLlmEnabled: checked })} />
                    <ToggleRow label="Fallback only" checked={draft.fallbackOnly} onChange={(checked) => setDraft({ ...draft, fallbackOnly: checked })} />
                    <NumberField label="Daily hosted request limit" value={draft.dailyHostedRequestLimit} onChange={(value) => setDraft({ ...draft, dailyHostedRequestLimit: value })} />
                    <NumberField label="Daily request limit" value={draft.dailyRequestLimit} onChange={(value) => setDraft({ ...draft, dailyRequestLimit: value })} />
                    <NumberField label="Session hourly request limit" value={draft.sessionHourlyRequestLimit} onChange={(value) => setDraft({ ...draft, sessionHourlyRequestLimit: value })} />
                    <NumberField label="Hosted provider timeout (ms)" value={draft.hostedProviderTimeoutMs} onChange={(value) => setDraft({ ...draft, hostedProviderTimeoutMs: value })} />
                    <NumberField label="Max response length" value={draft.maxResponseLength} onChange={(value) => setDraft({ ...draft, maxResponseLength: value })} />
                    <NumberField label="Max suggestions" value={draft.maxSuggestions} onChange={(value) => setDraft({ ...draft, maxSuggestions: value })} />
                    <label className="block">
                      <div className="mb-2 text-[12px] font-semibold" style={{ color: "var(--ink-700)" }}>Assistant tone</div>
                      <select value={draft.assistantTone} onChange={(event) => setDraft({ ...draft, assistantTone: event.target.value as AiTone })} className="h-11 w-full rounded-[var(--r-md)] px-3 text-[13px] outline-none" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}>
                        <option value="concise">Concise</option>
                        <option value="friendly">Friendly</option>
                        <option value="formal">Formal</option>
                      </select>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <SaasToolbarButton label={saving ? "Saving..." : "Save Controls"} onClick={() => { void saveControls(); }} variant="primary" />
                      <SaasToolbarButton label="Reset" onClick={() => setDraft(detail?.controls ?? null)} />
                    </div>
                    {dirty ? <div className="text-[12px]" style={{ color: "var(--warn)" }}>Unsaved control changes are pending.</div> : null}
                  </div>
                )}
              </SaasSurfaceBody>
            </SaasSurface>
          </div>
        ) : null}

        {tab === "diagnostics" ? (
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <SaasSurface>
              <SaasSurfaceBody>
                <SaasSectionHeader title="Attention queue" subtitle="Branches with AI pressure or rejection signal." />
                <div className="space-y-3">
                  {overview.issueBranches.map((branch) => (
                    <button key={branch.branchId} type="button" onClick={() => setSelectedBranchId(branch.branchId)} className="w-full rounded-[var(--r-md)] p-4 text-left" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>{branch.tenantName} - {branch.branchName}</div>
                          <div className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>{branch.status.reason}</div>
                        </div>
                        <SaasBadge label={branch.status.label} tone={statusTone(branch.status.code)} />
                      </div>
                    </button>
                  ))}
                </div>
              </SaasSurfaceBody>
            </SaasSurface>

            <SaasSurface>
              <SaasSurfaceBody>
                <SaasSectionHeader title={detail ? "Selected branch diagnostics" : "Diagnostics"} subtitle={detail ? `${detail.tenantName} - ${detail.branchName}` : "Select a branch from the watchlist"} />
                {!detail ? null : (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <MiniStat label="Requests" value={detail.diagnostics.totals.requests.toLocaleString()} />
                      <MiniStat label="Hosted" value={detail.diagnostics.totals.hostedRequests.toLocaleString()} />
                      <MiniStat label="Fallback" value={detail.diagnostics.totals.fallbackResponses.toLocaleString()} />
                      <MiniStat label="Rejections" value={detail.diagnostics.totals.providerRejections.toLocaleString()} />
                    </div>
                    <ListPanel title="Top intents" items={topEntries(detail.diagnostics.byIntent, 5)} />
                    <ListPanel title="Provider mix" items={topEntries(detail.diagnostics.byProvider, 5)} />
                    <ListPanel title="Rejection reasons" items={topEntries(detail.diagnostics.rejectionReasons, 5)} />
                    <div className="text-[12px]" style={{ color: "var(--ink-500)" }}>Latest activity: {formatDateTime(detail.diagnostics.latestAt)}</div>
                  </div>
                )}
              </SaasSurfaceBody>
            </SaasSurface>
          </div>
        ) : null}

        {tab === "presets" ? (
          <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <SaasSurface>
              <SaasSurfaceBody>
                <SaasSectionHeader title="Preset target branch" subtitle="Select the branch that should receive a rollout profile." />
                <div className="space-y-2">
                  {visibleBranches.map((branch) => (
                    <button key={branch.branchId} type="button" onClick={() => setSelectedBranchId(branch.branchId)} className="flex w-full items-center justify-between rounded-[var(--r-md)] px-3 py-3 text-left" style={{ background: branch.branchId === selectedBranchId ? "var(--ink-50)" : "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
                      <div>
                        <div className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>{branch.tenantName} - {branch.branchName}</div>
                        <div className="text-[12px]" style={{ color: "var(--ink-500)" }}>{branch.branchLocation}</div>
                      </div>
                      <SaasBadge label={branch.status.label} tone={statusTone(branch.status.code)} />
                    </button>
                  ))}
                </div>
              </SaasSurfaceBody>
            </SaasSurface>

            <SaasSurface>
              <SaasSurfaceBody>
                <SaasSectionHeader title="Preset library" subtitle={selectedBranch ? `${selectedBranch.tenantName} - ${selectedBranch.branchName}` : "Select a branch first"} />
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {presets.map((preset) => (
                    <div key={preset.key} className="rounded-[var(--r-md)] p-4" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
                      <div className="text-[15px] font-semibold" style={{ color: "var(--ink-900)" }}>{preset.label}</div>
                      <div className="mt-2 text-[12px]" style={{ color: "var(--ink-500)" }}>{preset.description}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <SaasBadge label={preset.controls.assistantTone} />
                        <SaasBadge label={preset.controls.fallbackOnly ? "fallback" : "hosted"} tone={preset.controls.fallbackOnly ? "warn" : "ok"} />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDraft(preset.controls);
                          void saveControls(preset.controls);
                        }}
                        disabled={!selectedBranch || saving}
                        className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-[var(--r-md)] px-4 text-[12px] font-semibold disabled:opacity-50"
                        style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}
                      >
                        Apply preset
                      </button>
                    </div>
                  ))}
                </div>
              </SaasSurfaceBody>
            </SaasSurface>
          </div>
        ) : null}
      </SaasPage>
    </div>
  );
}

function ControlsTabBar({
  active,
  onChange,
}: {
  active: ControlsTab;
  onChange: (tab: ControlsTab) => void;
}) {
  return (
    <div className="px-5 pt-5 md:px-6 md:pt-6">
      <div className="mx-auto flex max-w-[1520px] flex-wrap gap-2 rounded-[var(--r-lg)] bg-[var(--ink-0)] p-2" style={{ border: "1px solid var(--ink-200)" }}>
        {[
          { key: "modules", label: "Modules" },
          { key: "ai", label: "AI Controls" },
          { key: "diagnostics", label: "Diagnostics" },
          { key: "presets", label: "Presets" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key as ControlsTab)}
            className="inline-flex h-10 items-center justify-center rounded-[var(--r-md)] px-4 text-[12px] font-semibold md:text-[13px]"
            style={active === item.key ? { background: "var(--ink-900)", color: "var(--ink-0)" } : { background: "var(--ink-50)", color: "var(--ink-700)" }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-[var(--r-md)] px-3 py-3" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
      <span className="text-[13px]" style={{ color: "var(--ink-700)" }}>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[var(--ink-900)]" />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-[12px] font-semibold" style={{ color: "var(--ink-700)" }}>{label}</div>
      <input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-11 w-full rounded-[var(--r-md)] px-3 text-[13px] outline-none" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-900)" }} />
    </label>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--r-md)] p-3" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
      <div className="text-[18px] font-semibold" style={{ color: "var(--ink-900)" }}>{value}</div>
      <div className="mt-1 text-[11px]" style={{ color: "var(--ink-500)" }}>{label}</div>
    </div>
  );
}

function ListPanel({ title, items }: { title: string; items: Array<[string, number]> }) {
  return (
    <div className="rounded-[var(--r-md)] p-4" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
      <div className="mb-3 text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>{title}</div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-[var(--r-sm)] px-3 py-2 text-[12px]" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-500)" }}>
            No data available.
          </div>
        ) : (
          items.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between rounded-[var(--r-sm)] px-3 py-2 text-[12px]" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
              <span style={{ color: "var(--ink-700)" }}>{label.replaceAll("_", " ")}</span>
              <span style={{ color: "var(--ink-900)" }}>{value.toLocaleString()}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
