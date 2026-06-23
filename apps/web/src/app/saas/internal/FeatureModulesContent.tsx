"use client";

import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorDisplay, useToast } from "../../../components/ui";
import { authGet, authPatch, getApiErrorMessage } from "../../../lib/api";
import {
  SaasBadge,
  SaasLiveBadge,
  SaasPage,
  SaasSearchField,
  SaasSurface,
  SaasSurfaceBody,
  SaasToolbarButton,
} from "../saas-ui";

interface BranchSettings {
  branchId: string;
  featureFlagsJson: Record<string, boolean> | null;
  aiConfigJson: Record<string, boolean | number | string> | null;
}

interface Tenant {
  id: string;
  name: string;
  isActive: boolean;
  branches: Array<{
    id: string;
    name: string;
    location: string;
    isActive: boolean;
    branchSettings: BranchSettings | null;
  }>;
}

interface BranchRow {
  tenantId: string;
  tenantName: string;
  branchId: string;
  branchName: string;
  branchLocation: string;
  isActive: boolean;
  branchSettings: BranchSettings | null;
}

type FeatureKey =
  | "customerOrdering"
  | "kds"
  | "waiterDashboard"
  | "pos"
  | "inventory"
  | "promotions"
  | "aiRecommendations";

type FeatureDraft = Record<FeatureKey, boolean>;

const featureModules: Array<{ key: FeatureKey; label: string; icon: string }> = [
  { key: "customerOrdering", label: "Customer Ordering", icon: "🛒" },
  { key: "kds", label: "Kitchen Display", icon: "🖥️" },
  { key: "waiterDashboard", label: "Waiter Dashboard", icon: "⌂" },
  { key: "pos", label: "POS", icon: "▣" },
  { key: "inventory", label: "Inventory", icon: "◈" },
  { key: "promotions", label: "Promotions", icon: "◇" },
  { key: "aiRecommendations", label: "AI Recommendations", icon: "✦" },
];

function buildRows(tenants: Tenant[]): BranchRow[] {
  return tenants.flatMap((tenant) =>
    tenant.branches.map((branch) => ({
      tenantId: tenant.id,
      tenantName: tenant.name,
      branchId: branch.id,
      branchName: branch.name,
      branchLocation: branch.location,
      isActive: branch.isActive,
      branchSettings: branch.branchSettings,
    })),
  );
}

function readFeature(branch: BranchRow, key: FeatureKey) {
  return !!branch.branchSettings?.featureFlagsJson?.[key];
}

function buildDraft(branch: BranchRow | null): FeatureDraft | null {
  if (!branch) return null;
  return featureModules.reduce((acc, module) => {
    acc[module.key] = readFeature(branch, module.key);
    return acc;
  }, {} as FeatureDraft);
}

function countEnabled(draft: FeatureDraft | null) {
  if (!draft) return 0;
  return featureModules.filter((module) => draft[module.key]).length;
}

function sameDraft(left: FeatureDraft | null, right: FeatureDraft | null) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export default function FeatureModulesContent() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [search, setSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [savingBranch, setSavingBranch] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [draft, setDraft] = useState<FeatureDraft | null>(null);
  const deferredSearch = useDeferredValue(search);

  const tenantsQuery = useQuery({
    queryKey: ["saas-tenants"],
    queryFn: () => authGet<Tenant[]>("/api/saas/tenants"),
    retry: false,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setLastUpdated(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (tenantsQuery.data) setLastUpdated(new Date());
  }, [tenantsQuery.data]);

  const tenants = tenantsQuery.data ?? [];
  const allBranches = useMemo(() => buildRows(tenants), [tenants]);
  const visibleBranches = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return allBranches.filter((branch) => {
      if (tenantFilter !== "all" && branch.tenantId !== tenantFilter) return false;
      if (query && !`${branch.tenantName} ${branch.branchName} ${branch.branchLocation}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [allBranches, deferredSearch, tenantFilter]);

  useEffect(() => {
    if (visibleBranches.length === 0) {
      setSelectedBranchId("");
      return;
    }
    if (!selectedBranchId || !visibleBranches.some((branch) => branch.branchId === selectedBranchId)) {
      setSelectedBranchId(visibleBranches[0].branchId);
    }
  }, [selectedBranchId, visibleBranches]);

  const selectedBranch =
    visibleBranches.find((branch) => branch.branchId === selectedBranchId) ??
    allBranches.find((branch) => branch.branchId === selectedBranchId) ??
    null;

  useEffect(() => {
    setDraft(buildDraft(selectedBranch));
  }, [selectedBranch?.branchId, tenantsQuery.dataUpdatedAt]);

  async function saveModules() {
    if (!selectedBranch || !draft) return;

    setSavingBranch(selectedBranch.branchId);
    try {
      await authPatch(`/api/saas/branches/${selectedBranch.branchId}/features`, null, {
        featureFlagsJson: draft,
      });
      toast("Branch modules updated");
      await qc.invalidateQueries({ queryKey: ["saas-tenants"] });
    } catch (error) {
      toast(getApiErrorMessage(error, "Failed to update branch modules."), "error");
    } finally {
      setSavingBranch(null);
    }
  }

  if (tenantsQuery.isLoading) {
    return <div className="p-6" />;
  }

  if (tenantsQuery.isError) {
    return <ErrorDisplay message={getApiErrorMessage(tenantsQuery.error, "Feature modules are unavailable.")} onRetry={() => tenantsQuery.refetch()} />;
  }

  const selectedCount = countEnabled(draft);
  const branchCount = allBranches.length;
  const aiCount = allBranches.filter((branch) => readFeature(branch, "aiRecommendations")).length;
  const posCount = allBranches.filter((branch) => readFeature(branch, "pos")).length;
  const inventoryCount = allBranches.filter((branch) => readFeature(branch, "inventory")).length;
  const dirty = !sameDraft(draft, buildDraft(selectedBranch));

  return (
    <SaasPage
      eyebrow="Branch modules"
      title="Feature Control"
      description="Manage branch-level operational modules from the consolidated Controls surface."
      actions={
        <>
          <SaasToolbarButton label="Refresh" onClick={() => void tenantsQuery.refetch()} />
          <SaasLiveBadge lastUpdated={lastUpdated} />
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ModuleTopCard label="Branches" value={branchCount.toLocaleString()} detail={`Across ${tenants.length} tenants`} icon={<GlyphBuilding />} />
        <ModuleTopCard label="AI-ready" value={aiCount.toLocaleString()} detail="Branches with AI recommendations enabled" icon={<GlyphSpark />} />
        <ModuleTopCard label="POS enabled" value={posCount.toLocaleString()} detail="Branches with POS module enabled" icon={<GlyphDisplay />} />
        <ModuleTopCard label="Inventory enabled" value={inventoryCount.toLocaleString()} detail="Branches with inventory controls enabled" icon={<GlyphCube />} />
      </div>

      <SaasSurface style={{ background: "linear-gradient(180deg, #111111 0%, #181818 100%)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 40px rgba(15, 23, 42, 0.1)" }}>
        <SaasSurfaceBody>
          <div className="grid gap-3 xl:grid-cols-[1.4fr_0.8fr]">
            <DarkSearchField value={search} onChange={setSearch} placeholder="Search branches or tenants..." />
            <select
              value={tenantFilter}
              onChange={(event) => setTenantFilter(event.target.value)}
              className="h-10 rounded-[var(--r-md)] px-3 text-[13px] outline-none md:h-11"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--ink-0)" }}
            >
              <option value="all" style={{ color: "#111111" }}>All tenants</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id} style={{ color: "#111111" }}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>
        </SaasSurfaceBody>
      </SaasSurface>

      <div className="grid items-stretch gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section
          className="rounded-[var(--r-lg)] p-4 md:p-5"
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
            border: "1px solid var(--ink-200)",
            boxShadow: "0 18px 38px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="text-[30px] font-semibold leading-none" style={{ color: "var(--ink-900)", fontFamily: "var(--font-serif)" }}>
                Branch matrix
              </div>
              <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "var(--warn-soft)", color: "var(--ink-600)", border: "1px solid var(--ink-200)" }}>
                {visibleBranches.length} visible branches
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-[var(--r-md)]" style={{ border: "1px solid var(--ink-200)" }}>
            <div className="grid grid-cols-[1.2fr_1.05fr_0.72fr_0.78fr_32px] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ background: "var(--ink-50)", color: "var(--ink-500)" }}>
              <div>Tenant</div>
              <div>Branch</div>
              <div>State</div>
              <div>Modules</div>
              <div />
            </div>

            <div className="max-h-[860px] overflow-y-auto">
              {visibleBranches.map((branch) => {
                const enabledCount = featureModules.filter((module) => readFeature(branch, module.key)).length;
                const active = branch.branchId === selectedBranchId;
                return (
                  <button
                    key={branch.branchId}
                    type="button"
                    onClick={() => setSelectedBranchId(branch.branchId)}
                    className="grid w-full grid-cols-[1.2fr_1.05fr_0.72fr_0.78fr_32px] items-center gap-3 px-4 py-4 text-left transition"
                    style={{
                      borderTop: "1px solid var(--ink-200)",
                      background: active ? "linear-gradient(180deg, #fbfbfb 0%, #f7f7f7 100%)" : "var(--ink-0)",
                    }}
                  >
                    <div className="min-w-0 text-[13px]" style={{ color: "var(--ink-900)" }}>{branch.tenantName}</div>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>{branch.branchName}</div>
                      <div className="mt-1 truncate text-[12px]" style={{ color: "var(--ink-500)" }}>{branch.branchLocation}</div>
                    </div>
                    <div>
                      <SaasBadge label={branch.isActive ? "active" : "inactive"} tone={branch.isActive ? "ok" : "warn"} />
                    </div>
                    <div className="text-[12px]" style={{ color: "var(--ink-700)" }}>
                      {enabledCount}/{featureModules.length} enabled
                    </div>
                    <div className="text-[16px]" style={{ color: "var(--ink-500)" }}>
                      ›
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section
          className="flex h-full flex-col rounded-[var(--r-lg)] p-4 md:p-5"
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
            border: "1px solid var(--ink-200)",
            boxShadow: "0 18px 38px rgba(15, 23, 42, 0.04)",
            minHeight: 0,
          }}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="text-[30px] font-semibold leading-none" style={{ color: "var(--ink-900)", fontFamily: "var(--font-serif)" }}>
                {selectedBranch ? `${selectedBranch.tenantName} - ${selectedBranch.branchName}` : "Branch detail"}
              </div>
              <div className="mt-2 text-[13px]" style={{ color: "var(--ink-500)" }}>
                {selectedBranch ? selectedBranch.branchLocation : "Select a branch to edit modules."}
              </div>
            </div>
            {selectedBranch ? (
              <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "var(--warn-soft)", color: "var(--ink-600)", border: "1px solid var(--ink-200)" }}>
                {selectedCount} modules
              </span>
            ) : null}
          </div>

          {!selectedBranch || !draft ? (
            <div className="flex flex-1 items-center justify-center rounded-[var(--r-md)]" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)", color: "var(--ink-500)" }}>
              Select a branch from the matrix.
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-3">
                {featureModules.map((module) => (
                  <label
                    key={module.key}
                    className="flex items-center justify-between rounded-[var(--r-md)] px-4 py-4"
                    style={{ background: "linear-gradient(180deg, #101010 0%, #1c1c1c 100%)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 14px 28px rgba(15, 23, 42, 0.08)" }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[14px]" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.92)" }}>
                        {module.icon}
                      </span>
                      <span className="text-[14px] font-semibold" style={{ color: "var(--ink-0)" }}>{module.label}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={draft[module.key]}
                      disabled={savingBranch === selectedBranch.branchId}
                      onChange={(event) => setDraft((current) => (current ? { ...current, [module.key]: event.target.checked } : current))}
                      className="h-4 w-4 accent-[var(--ink-0)]"
                    />
                  </label>
                ))}
              </div>

              <div className="mt-4 rounded-[var(--r-md)] px-4 py-3" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[12px]" style={{ color: dirty ? "var(--warn)" : "var(--ink-600)" }}>
                    {dirty ? "Unsaved changes are pending for the selected branch modules." : "Changes take effect immediately after saving the selected branch modules."}
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveModules()}
                    disabled={!dirty || savingBranch === selectedBranch.branchId}
                    className="inline-flex h-11 items-center justify-center rounded-[var(--r-md)] px-5 text-[13px] font-semibold disabled:opacity-50"
                    style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}
                  >
                    {savingBranch === selectedBranch.branchId ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </SaasPage>
  );
}

function ModuleTopCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div
      className="rounded-[var(--r-lg)] p-5"
      style={{
        background: "linear-gradient(180deg, #101010 0%, #181818 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 20px 42px rgba(15, 23, 42, 0.12)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.62)" }}>{label}</div>
          <div className="mt-5 text-[18px] font-semibold md:text-[19px]" style={{ color: "var(--ink-0)" }}>{value}</div>
          <div className="mt-2 text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}>{detail}</div>
        </div>
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ border: "1px solid rgba(245, 158, 11, 0.35)", color: "#d6b77f", background: "rgba(255,255,255,0.02)" }}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}

function DarkSearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label
      className="flex h-10 items-center gap-3 rounded-[var(--r-md)] px-3 md:h-11"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <span style={{ color: "rgba(255,255,255,0.56)" }}>
        <GlyphSearch />
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-[13px] outline-none"
        style={{ color: "var(--ink-0)" }}
      />
    </label>
  );
}

function GlyphSearch() {
  return (
    <svg viewBox="0 0 24 24" style={glyphStyle()}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function GlyphBuilding() {
  return (
    <svg viewBox="0 0 24 24" style={glyphStyle()}>
      <path d="M4 21h16" />
      <path d="M7 21V7l5-3 5 3v14" />
      <path d="M10 10h.01" />
      <path d="M10 14h.01" />
      <path d="M14 10h.01" />
      <path d="M14 14h.01" />
    </svg>
  );
}

function GlyphSpark() {
  return (
    <svg viewBox="0 0 24 24" style={glyphStyle()}>
      <path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" />
    </svg>
  );
}

function GlyphDisplay() {
  return (
    <svg viewBox="0 0 24 24" style={glyphStyle()}>
      <rect x="4" y="4" width="16" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </svg>
  );
}

function GlyphCube() {
  return (
    <svg viewBox="0 0 24 24" style={glyphStyle()}>
      <path d="m12 3 8 4.5v9L12 21 4 16.5v-9L12 3Z" />
      <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" />
      <path d="M12 12v9" />
    </svg>
  );
}

function glyphStyle(): CSSProperties {
  return {
    width: 18,
    height: 18,
    stroke: "currentColor",
    strokeWidth: 1.8,
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
}
