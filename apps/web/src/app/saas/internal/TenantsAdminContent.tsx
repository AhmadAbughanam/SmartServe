"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authGet, authPatch, authPost, getApiErrorMessage } from "../../../lib/api";
import { ErrorDisplay, useToast } from "../../../components/ui";
import {
  SaasBadge,
  SaasLiveBadge,
  SaasMetricCard,
  SaasPage,
  SaasSearchField,
  SaasSurface,
  SaasSurfaceBody,
  SaasToolbarButton,
} from "../saas-ui";

type TenantsTab = "directory" | "branches" | "owners" | "provisioning";
type StatusFilter = "all" | "active" | "inactive";

interface Tenant {
  id: string;
  name: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone?: string | null;
  isActive: boolean;
  branches: Array<{
    id: string;
    name: string;
    location: string;
    timezone?: string;
    isActive: boolean;
    branchSettings: {
      featureFlagsJson: Record<string, boolean> | null;
      aiConfigJson: Record<string, boolean | number | string> | null;
    } | null;
    _count: { staff: number; orders: number; sessions: number };
  }>;
  staff: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
    branchId: string;
    isActive: boolean;
    createdAt: string;
  }>;
  _count: { branches: number; staff: number; orders: number };
}

interface SaasAnalytics {
  tenants: Array<{
    id: string;
    name: string;
    isActive: boolean;
    branchCount: number;
    activeBranchCount: number;
    orderCount: number;
    paidOrderCount: number;
    revenue: string;
  }>;
}

interface AuditFeedRow {
  id: string;
  occurredAt: string;
  tenantId: string;
  tenantName: string;
  branchId: string;
  branchName: string;
  actor: { id: string | null; name: string; role: string | null } | null;
  code: string;
  title: string;
  summary: string;
}

type OwnerRow = {
  tenantId: string;
  tenantName: string;
  branchName: string;
  owner: Tenant["staff"][number];
};

type BranchRow = {
  tenantId: string;
  tenantName: string;
  tenantActive: boolean;
  branch: Tenant["branches"][number];
};

function money(value: string | number) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function activityQueryParams(days: number) {
  const end = new Date();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return new URLSearchParams({
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  }).toString();
}

function relativeTime(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < hour) return `${Math.max(1, Math.round(diff / minute))}m ago`;
  if (diff < day) return `${Math.max(1, Math.round(diff / hour))}h ago`;
  return `${Math.max(1, Math.round(diff / day))}d ago`;
}

function percentage(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

export default function TenantsAdminContent({ initialTab }: { initialTab: TenantsTab }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [tab, setTab] = useState<TenantsTab>(initialTab);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  const [newTenant, setNewTenant] = useState({
    name: "",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
  });
  const [tenantDraft, setTenantDraft] = useState({
    name: "",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: "",
  });
  const [branchCreateDraft, setBranchCreateDraft] = useState({
    name: "",
    location: "",
    timezone: "UTC",
  });
  const [branchDraft, setBranchDraft] = useState({
    name: "",
    location: "",
    timezone: "UTC",
  });
  const [ownerDraft, setOwnerDraft] = useState({
    name: "",
    email: "",
    phone: "",
    password: "password123",
    confirmPassword: "password123",
  });
  const [busy, setBusy] = useState<string | null>(null);

  const auditParams = useMemo(() => activityQueryParams(30), []);

  const tenantsQuery = useQuery({
    queryKey: ["saas-tenants"],
    queryFn: () => authGet<Tenant[]>("/api/saas/tenants"),
    retry: false,
  });

  const analyticsQuery = useQuery({
    queryKey: ["saas-analytics"],
    queryFn: () => authGet<SaasAnalytics>("/api/saas/analytics"),
    retry: false,
  });

  const activityQuery = useQuery({
    queryKey: ["saas-tenants-activity", auditParams],
    queryFn: () => authGet<AuditFeedRow[]>(`/api/saas/audit-logs/feed?${auditParams}`),
    retry: false,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setLastUpdated(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (tenantsQuery.data || analyticsQuery.data || activityQuery.data) setLastUpdated(new Date());
  }, [activityQuery.data, analyticsQuery.data, tenantsQuery.data]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const tenants = tenantsQuery.data ?? [];
  const analyticsByTenant = useMemo(() => {
    const map = new Map<string, SaasAnalytics["tenants"][number]>();
    for (const tenant of analyticsQuery.data?.tenants ?? []) map.set(tenant.id, tenant);
    return map;
  }, [analyticsQuery.data]);

  const visibleTenants = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tenants.filter((tenant) => {
      if (statusFilter === "active" && !tenant.isActive) return false;
      if (statusFilter === "inactive" && tenant.isActive) return false;
      if (
        query &&
        !`${tenant.name} ${tenant.ownerEmail ?? ""} ${tenant.ownerName ?? ""} ${tenant.branches
          .map((branch) => `${branch.name} ${branch.location}`)
          .join(" ")} ${tenant.staff.map((owner) => `${owner.name} ${owner.email}`).join(" ")}`
          .toLowerCase()
          .includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [search, statusFilter, tenants]);

  const branchRows = useMemo<BranchRow[]>(
    () =>
      visibleTenants.flatMap((tenant) =>
        tenant.branches.map((branch) => ({
          tenantId: tenant.id,
          tenantName: tenant.name,
          tenantActive: tenant.isActive,
          branch,
        })),
      ),
    [visibleTenants],
  );

  const ownerRows = useMemo<OwnerRow[]>(
    () =>
      visibleTenants.flatMap((tenant) =>
        tenant.staff.map((owner) => ({
          tenantId: tenant.id,
          tenantName: tenant.name,
          branchName: tenant.branches.find((branch) => branch.id === owner.branchId)?.name ?? "Unknown branch",
          owner,
        })),
      ),
    [visibleTenants],
  );

  useEffect(() => {
    if (visibleTenants.length === 0) {
      setSelectedTenantId("");
      setSelectedBranchId("");
      return;
    }
    const selectedTenant = visibleTenants.find((tenant) => tenant.id === selectedTenantId) ?? visibleTenants[0];
    setSelectedTenantId(selectedTenant.id);
    const branch = selectedTenant.branches.find((item) => item.id === selectedBranchId) ?? selectedTenant.branches[0];
    setSelectedBranchId(branch?.id ?? "");
  }, [selectedBranchId, selectedTenantId, visibleTenants]);

  const selectedTenant =
    visibleTenants.find((tenant) => tenant.id === selectedTenantId) ??
    tenants.find((tenant) => tenant.id === selectedTenantId) ??
    null;
  const selectedBranch =
    selectedTenant?.branches.find((branch) => branch.id === selectedBranchId) ??
    branchRows.find((row) => row.branch.id === selectedBranchId)?.branch ??
    null;
  const selectedAnalytics = selectedTenant ? analyticsByTenant.get(selectedTenant.id) : null;

  useEffect(() => {
    if (!selectedTenant) return;
    setTenantDraft({
      name: selectedTenant.name,
      ownerName: selectedTenant.ownerName ?? "",
      ownerEmail: selectedTenant.ownerEmail ?? "",
      ownerPhone: selectedTenant.ownerPhone ?? "",
    });
  }, [selectedTenant?.id]);

  useEffect(() => {
    if (!selectedBranch) return;
    setBranchDraft({
      name: selectedBranch.name,
      location: selectedBranch.location,
      timezone: selectedBranch.timezone ?? "UTC",
    });
  }, [selectedBranch?.id]);

  async function refreshAll() {
    await Promise.all([tenantsQuery.refetch(), analyticsQuery.refetch(), activityQuery.refetch()]);
  }

  async function runAction(key: string, action: () => Promise<void>) {
    setBusy(key);
    try {
      await action();
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["saas-tenants"] }),
        qc.invalidateQueries({ queryKey: ["saas-analytics"] }),
        qc.invalidateQueries({ queryKey: ["saas-tenants-activity"] }),
      ]);
    } catch (error) {
      toast(getApiErrorMessage(error, "Request failed."), "error");
    } finally {
      setBusy(null);
    }
  }

  const topBranches = useMemo(() => {
    if (!selectedTenant) return [];
    return [...selectedTenant.branches].sort((a, b) => b._count.orders - a._count.orders).slice(0, 4);
  }, [selectedTenant]);

  if (tenantsQuery.isLoading || analyticsQuery.isLoading) {
    return <div className="p-6" />;
  }

  if (tenantsQuery.isError || analyticsQuery.isError) {
    return (
      <ErrorDisplay
        message={getApiErrorMessage(tenantsQuery.error ?? analyticsQuery.error, "Tenant administration is unavailable.")}
        onRetry={() => {
          void refreshAll();
        }}
      />
    );
  }

  const totals = {
    tenants: tenants.length,
    activeTenants: tenants.filter((tenant) => tenant.isActive).length,
    branches: tenants.reduce((sum, tenant) => sum + tenant._count.branches, 0),
    activeBranches: tenants.reduce((sum, tenant) => sum + tenant.branches.filter((branch) => branch.isActive).length, 0),
    owners: ownerRows.length,
    revenue: analyticsQuery.data?.tenants.reduce((sum, tenant) => sum + Number(tenant.revenue), 0) ?? 0,
  };

  const provisioningActivity = (activityQuery.data ?? [])
    .filter((item) => /owner|branch|tenant|provision|feature|approval|review|deactiv|activ/i.test(`${item.code} ${item.title} ${item.summary}`))
    .filter((item) => (selectedTenant ? item.tenantId === selectedTenant.id : true))
    .slice(0, 4);

  const platformActivity = (activityQuery.data ?? []).slice(0, 4);

  const ownerPasswordsMatch = ownerDraft.password.length > 0 && ownerDraft.password === ownerDraft.confirmPassword;
  const selectedTenantRevenue = Number(selectedAnalytics?.revenue ?? 0);
  const selectedTenantPaidOrders = selectedAnalytics?.paidOrderCount ?? 0;
  const selectedTenantOrderCount = selectedAnalytics?.orderCount ?? 0;
  const activeBranchCount = selectedTenant?.branches.filter((branch) => branch.isActive).length ?? 0;
  const inactiveBranchCount = Math.max(0, (selectedTenant?.branches.length ?? 0) - activeBranchCount);
  const featureReadyCount =
    selectedTenant?.branches.filter((branch) => Object.values(branch.branchSettings?.featureFlagsJson ?? {}).some(Boolean)).length ?? 0;
  const aiConfiguredCount =
    selectedTenant?.branches.filter((branch) => Object.keys(branch.branchSettings?.aiConfigJson ?? {}).length > 0).length ?? 0;
  const selectedBranchOwnerCount = selectedTenant?.staff.filter((owner) => owner.branchId === selectedBranch?.id).length ?? 0;

  const riskFlags = [
    selectedTenant && !selectedTenant.ownerEmail ? "Primary owner email not set" : null,
    selectedTenant && selectedTenant.staff.length === 0 ? "No provisioned owner accounts" : null,
    inactiveBranchCount > 0 ? `${inactiveBranchCount} inactive branches require review` : null,
    selectedTenant && featureReadyCount < activeBranchCount ? "Some active branches are missing licensed modules" : null,
    selectedTenant && aiConfiguredCount < activeBranchCount ? "Some active branches are missing AI configuration" : null,
  ].filter(Boolean) as string[];

  const heroPills = selectedTenant
    ? [
        `${activeBranchCount}/${selectedTenant.branches.length} Branches Online`,
        `${selectedTenant.staff.length} Owners`,
        `${featureReadyCount}/${selectedTenant.branches.length || 1} Premium Items`,
      ]
    : [];

  return (
    <SaasPage
      title="Tenants"
      description="Operate the full tenant lifecycle from one unified surface: portfolio overview, branch, revenue coverage, and provisioning control."
      actions={
        <>
          <SaasToolbarButton label="Refresh" onClick={() => { void refreshAll(); }} />
          <div className="flex items-center gap-2 rounded-[var(--r-md)] px-4 py-2 text-[13px]" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <span className="h-2 w-2 rounded-full" style={{ background: "#22c55e" }} />
            <span className="font-semibold" style={{ color: "#16a34a" }}>Live</span>
            <span style={{ color: "var(--ink-600)" }}>{lastUpdated.toLocaleTimeString("en-US")}</span>
          </div>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SaasMetricCard label="Tenants" value={totals.tenants.toLocaleString()} detail={`${totals.activeTenants.toLocaleString()} active in portfolio`} />
        <SaasMetricCard label="Branches" value={totals.branches.toLocaleString()} detail={`${totals.activeBranches.toLocaleString()} active branches`} />
        <SaasMetricCard label="Owned brands" value={Math.max(1, Math.min(totals.tenants, selectedTenant ? 1 : totals.tenants)).toLocaleString()} detail="Provisioned accounts across 1 brand" />
        <SaasMetricCard label="Sales snapshot" value={money(totals.revenue)} detail="Current month sales (payment volume)" tone="ok" />
        <SaasMetricCard label="Attention" value={riskFlags.length.toLocaleString()} detail={selectedTenant ? `${selectedTenant.name} risk check` : "No tenant selected"} tone={riskFlags.length > 0 ? "warn" : "ok"} />
      </div>

      <SaasSurface style={{ boxShadow: "0 14px 36px rgba(15, 23, 42, 0.04)" }}>
        <SaasSurfaceBody>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_180px_auto]">
            <SaasSearchField value={search} onChange={setSearch} placeholder="Search tenants, branches, owners..." />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="h-10 rounded-[var(--r-md)] px-3 text-[13px] outline-none md:h-11"
              style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <TenantTabs active={tab} onChange={setTab} />
          </div>
        </SaasSurfaceBody>
      </SaasSurface>

      <SaasSurface style={{ overflow: "hidden", boxShadow: "0 22px 56px rgba(15, 23, 42, 0.08)" }}>
        <SaasSurfaceBody className="space-y-5">
          <div
            className="rounded-[var(--r-lg)] p-5 md:p-6"
            style={{
              background: "linear-gradient(135deg, #020617 0%, #0f172a 34%, #111827 68%, #1e293b 100%)",
              boxShadow: "0 30px 60px rgba(15, 23, 42, 0.18)",
            }}
          >
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "rgba(248, 250, 252, 0.72)" }}>
                  Active workspace
                </div>
                <div className="mt-2 text-[30px] font-semibold leading-tight md:text-[36px]" style={{ color: "var(--ink-0)" }}>
                  {selectedTenant?.name ?? "Select a tenant"}
                </div>
                <div className="mt-3 max-w-2xl text-[14px] leading-relaxed" style={{ color: "rgba(248, 250, 252, 0.78)" }}>
                  {selectedTenant
                    ? "Drive lifecycle change, mitigate risk, and run core coverage workflows keeping the tenant current."
                    : "Choose a tenant from the portfolio to start profile edits, branch rollout, owner coverage, and provisioning."}
                </div>
                {heroPills.length > 0 ? (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {heroPills.map((pill) => (
                      <HeroPill key={pill} label={pill} />
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedTenant ? (
                  <>
                    <Link href={`/saas/tenants?tab=${tab}`} className="inline-flex h-11 items-center justify-center rounded-[var(--r-md)] px-4 text-[13px] font-semibold" style={{ background: "var(--ink-0)", color: "var(--ink-900)" }}>
                      View Tenant
                    </Link>
                    <SaasToolbarButton
                      label={busy === "toggle-tenant" ? "Updating..." : selectedTenant.isActive ? "Suspend Tenant" : "Reactivate Tenant"}
                      onClick={() => {
                        void runAction("toggle-tenant", async () => {
                          await authPatch(`/api/saas/tenants/${selectedTenant.id}/status`, null, { isActive: !selectedTenant.isActive });
                          toast(selectedTenant.isActive ? "Tenant suspended" : "Tenant reactivated");
                        });
                      }}
                      variant="primary"
                    />
                  </>
                ) : null}
              </div>
            </div>

            {selectedTenant ? (
              <div className="mt-6 grid gap-4 border-t pt-5 md:grid-cols-2 xl:grid-cols-4" style={{ borderColor: "rgba(248, 250, 252, 0.16)" }}>
                <HeroStat label="Branches" value={selectedTenant._count.branches.toLocaleString()} />
                <HeroStat label="Owners" value={selectedTenant.staff.length.toLocaleString()} />
                <HeroStat label="Paid orders" value={selectedTenantPaidOrders.toLocaleString()} />
                <HeroStat label="Sales snapshot" value={money(selectedTenantRevenue)} />
              </div>
            ) : null}
          </div>
        </SaasSurfaceBody>
      </SaasSurface>

      <PanelCard title="Tenant Portfolio" subtitle="View and manage all tenants in scope" action={<GhostLink href={`/saas/tenants?tab=${tab}`} label="View all" />}>
        {visibleTenants.length === 0 ? (
          <EmptyMessage message="No tenants match the current filters." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {visibleTenants.map((tenant) => {
              const analytics = analyticsByTenant.get(tenant.id);
              const active = tenant.id === selectedTenantId;
              const activeBranchesForTenant = tenant.branches.filter((branch) => branch.isActive).length;
              return (
                <button
                  key={tenant.id}
                  type="button"
                  onClick={() => {
                    setSelectedTenantId(tenant.id);
                    setSelectedBranchId(tenant.branches[0]?.id ?? "");
                  }}
                  className="rounded-[var(--r-md)] p-4 text-left transition"
                  style={{
                    background: active ? "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)" : "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                    color: active ? "var(--ink-0)" : "var(--ink-900)",
                    border: active ? "1px solid #243446" : "1px solid var(--ink-200)",
                    boxShadow: active ? "0 20px 40px rgba(15, 23, 42, 0.14)" : "0 10px 24px rgba(15, 23, 42, 0.04)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-[10px]" style={{ background: active ? "rgba(248,250,252,0.1)" : "var(--ink-900)", color: "var(--ink-0)" }}>
                      <GlyphBuilding />
                    </div>
                    <SaasBadge label={tenant.isActive ? "active" : "inactive"} tone={tenant.isActive ? "ok" : "warn"} />
                  </div>
                  <div className="mt-4 text-[16px] font-semibold" style={{ color: active ? "var(--ink-0)" : "var(--ink-900)" }}>{tenant.name}</div>
                  <div className="mt-1 text-[12px]" style={{ color: active ? "rgba(248,250,252,0.72)" : "var(--ink-500)" }}>
                    {tenant.ownerEmail ?? tenant.ownerName ?? "Owner unassigned"}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[12px]" style={{ color: active ? "rgba(248,250,252,0.78)" : "var(--ink-700)" }}>
                    <span>Branches {tenant._count.branches}</span>
                    <span>Lvl {activeBranchesForTenant}</span>
                    <span>Sales {money(analytics?.revenue ?? 0)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </PanelCard>

      <PanelCard title="Add New Tenant" subtitle="Register a tenant and define onboarding basics.">
        <div className="grid gap-3 xl:grid-cols-[1.1fr_1fr_1fr_1fr_auto] xl:items-end">
          <Field label="Tenant Name">
            <input value={newTenant.name} onChange={(event) => setNewTenant((current) => ({ ...current, name: event.target.value }))} className={inputClass} style={inputStyle} placeholder="Enter tenant name" />
          </Field>
          <Field label="Owner Name">
            <input value={newTenant.ownerName} onChange={(event) => setNewTenant((current) => ({ ...current, ownerName: event.target.value }))} className={inputClass} style={inputStyle} placeholder="Enter owner name" />
          </Field>
          <Field label="Owner Email">
            <input value={newTenant.ownerEmail} onChange={(event) => setNewTenant((current) => ({ ...current, ownerEmail: event.target.value }))} className={inputClass} style={inputStyle} placeholder="owner@email.com" />
          </Field>
          <Field label="Owner Phone">
            <input value={newTenant.ownerPhone} onChange={(event) => setNewTenant((current) => ({ ...current, ownerPhone: event.target.value }))} className={inputClass} style={inputStyle} placeholder="(000) 000-0000" />
          </Field>
          <div className="xl:min-w-[170px]">
            <SaasToolbarButton
              label={busy === "create-tenant" ? "Creating..." : "Create Tenant"}
              onClick={() => {
                void runAction("create-tenant", async () => {
                  await authPost("/api/saas/tenants", null, newTenant);
                  setNewTenant({ name: "", ownerName: "", ownerEmail: "", ownerPhone: "" });
                  toast("Tenant created");
                });
              }}
              variant="primary"
            />
          </div>
        </div>
      </PanelCard>

      {tab === "directory" ? (
        <>
          <div className="grid gap-4 xl:grid-cols-3">
            <PanelCard title="Tenant Intelligence" subtitle="Core health, usage, and value at a glance.">
              {!selectedTenant ? (
                <EmptyMessage message="Select a tenant to load intelligence." compact />
              ) : (
                <div className="space-y-4">
                  <div className="rounded-[var(--r-md)] p-4" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>{selectedTenant.name}</div>
                        <div className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>
                          {selectedTenant.ownerEmail ? "Primary tenant fully configured" : "Primary tenant not set or configured"}
                        </div>
                      </div>
                      <SaasBadge label={selectedTenant.isActive ? "active" : "inactive"} tone={selectedTenant.isActive ? "ok" : "warn"} />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <KeyMetric label="Branches" value={`${activeBranchCount}/${selectedTenant.branches.length}`} caption="Active" />
                    <KeyMetric label="Revenue" value={money(selectedTenantRevenue)} caption="Assessment" />
                    <KeyMetric label="Risk Check" value={`${riskFlags.length}%`.replace("%", "") === "0" ? "0%" : `${riskFlags.length * 25}%`} caption="Risk status" />
                  </div>
                </div>
              )}
            </PanelCard>

            <PanelCard title="Risk Watch" subtitle="Prioritize mitigation for risk-led tenant conditions.">
              <div className="space-y-2">
                {riskFlags.length === 0 ? (
                  <EmptyMessage message="No current tenant risks detected." compact />
                ) : (
                  riskFlags.map((flag) => (
                    <div key={flag} className="rounded-[var(--r-sm)] px-3 py-2 text-[12px]" style={{ background: "var(--warn-soft)", border: "1px solid #fde68a", color: "var(--warn)" }}>
                      {flag}
                    </div>
                  ))
                )}
              </div>
            </PanelCard>

            <PanelCard title="Activity Lens" subtitle="Live audit of tenant and branch actions.">
              <div className="space-y-3">
                {(platformActivity.length === 0 ? provisioningActivity : platformActivity).map((item) => (
                  <div key={item.id} className="grid gap-1 border-b pb-3 text-[12px]" style={{ borderColor: "var(--ink-200)" }}>
                    <div className="font-semibold" style={{ color: "var(--ink-900)" }}>{item.title.toUpperCase()}</div>
                    <div style={{ color: "var(--ink-500)" }}>{item.summary}</div>
                    <div className="flex items-center justify-between gap-3">
                      <span style={{ color: "var(--ink-500)" }}>{item.tenantName}</span>
                      <span style={{ color: "var(--ink-500)" }}>{relativeTime(item.occurredAt)}</span>
                    </div>
                  </div>
                ))}
                {platformActivity.length === 0 && provisioningActivity.length === 0 ? <EmptyMessage message="No recent activity found." compact /> : null}
                <GhostLink href="/saas/audit-logs" label="View all activity" />
              </div>
            </PanelCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <PanelCard title="Tenant Profile" subtitle="View tenant owner and location information.">
              {!selectedTenant ? (
                <EmptyMessage message="Select a tenant to edit its profile." />
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Tenant Name">
                      <input value={tenantDraft.name} onChange={(event) => setTenantDraft((current) => ({ ...current, name: event.target.value }))} className={inputClass} style={inputStyle} />
                    </Field>
                    <Field label="Owner Name">
                      <input value={tenantDraft.ownerName} onChange={(event) => setTenantDraft((current) => ({ ...current, ownerName: event.target.value }))} className={inputClass} style={inputStyle} />
                    </Field>
                    <Field label="Owner Email">
                      <input value={tenantDraft.ownerEmail} onChange={(event) => setTenantDraft((current) => ({ ...current, ownerEmail: event.target.value }))} className={inputClass} style={inputStyle} />
                    </Field>
                    <Field label="Owner Phone">
                      <input value={tenantDraft.ownerPhone} onChange={(event) => setTenantDraft((current) => ({ ...current, ownerPhone: event.target.value }))} className={inputClass} style={inputStyle} />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <KeyMetric label="Active Branches" value={`${activeBranchCount}/${selectedTenant.branches.length}`} caption="100%" />
                    <KeyMetric label="Feature Rollout" value={`${featureReadyCount}/${selectedTenant.branches.length || 1}`} caption="Modules enabled" />
                    <KeyMetric label="Add-On Spend" value={`${aiConfiguredCount}/${selectedTenant.branches.length || 1}`} caption="Branches with monthly AI" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SaasToolbarButton
                      label={busy === "save-tenant" ? "Saving..." : "Save Tenant"}
                      onClick={() => {
                        if (!selectedTenant) return;
                        void runAction("save-tenant", async () => {
                          await authPatch(`/api/saas/tenants/${selectedTenant.id}`, null, tenantDraft);
                          toast("Tenant profile updated");
                        });
                      }}
                    />
                  </div>
                </div>
              )}
            </PanelCard>

            <PanelCard title="Branch Momentum" subtitle="Track branch activity and health at a glance.">
              {!selectedTenant ? (
                <EmptyMessage message="Select a tenant to inspect branch momentum." />
              ) : topBranches.length === 0 ? (
                <EmptyMessage message="No branches have been added yet." />
              ) : (
                <div className="space-y-3">
                  {topBranches.map((branch) => (
                    <button
                      key={branch.id}
                      type="button"
                      onClick={() => {
                        setTab("branches");
                        setSelectedBranchId(branch.id);
                      }}
                      className="rounded-[var(--r-md)] p-4 text-left transition"
                      style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>{branch.name}</div>
                          <div className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>{branch.location}</div>
                        </div>
                        <SaasBadge label={branch.isActive ? "active" : "inactive"} tone={branch.isActive ? "ok" : "warn"} />
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <KeyMetric label="Branches" value={selectedTenant.branches.length.toLocaleString()} caption="Total" />
                        <KeyMetric label="Orders" value={branch._count.orders.toLocaleString()} caption="Orders" />
                        <KeyMetric label="Revenue" value={money(analyticsByTenant.get(selectedTenant.id)?.revenue ?? 0)} caption="Revenue" />
                      </div>
                    </button>
                  ))}
                  <GhostLink href="/saas/tenants?tab=branches" label="View all branches" />
                </div>
              )}
            </PanelCard>
          </div>
        </>
      ) : null}

      {tab === "branches" ? (
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <PanelCard title="Branch Directory" subtitle="Manage rollout readiness, branch profile, and state.">
            {branchRows.length === 0 ? (
              <EmptyMessage message="No branches match the current filters." />
            ) : (
              <div className="space-y-3">
                {branchRows.map((row) => {
                  const active = row.branch.id === selectedBranchId;
                  return (
                    <button
                      key={row.branch.id}
                      type="button"
                      onClick={() => {
                        setSelectedTenantId(row.tenantId);
                        setSelectedBranchId(row.branch.id);
                      }}
                      className="rounded-[var(--r-md)] p-4 text-left transition"
                      style={{
                        background: active ? "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)" : "var(--ink-50)",
                        color: active ? "var(--ink-0)" : "var(--ink-900)",
                        border: active ? "1px solid #243446" : "1px solid var(--ink-200)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[14px] font-semibold">{row.branch.name}</div>
                          <div className="mt-1 text-[12px]" style={{ color: active ? "rgba(248,250,252,0.72)" : "var(--ink-500)" }}>
                            {row.tenantName} · {row.branch.location}
                          </div>
                        </div>
                        <SaasBadge label={row.branch.isActive ? "active" : "inactive"} tone={row.branch.isActive ? "ok" : "warn"} />
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-4">
                        <KeyMetric label="Staff" value={row.branch._count.staff.toLocaleString()} caption="Coverage" inverted={active} />
                        <KeyMetric label="Orders" value={row.branch._count.orders.toLocaleString()} caption="Live" inverted={active} />
                        <KeyMetric label="Sessions" value={row.branch._count.sessions.toLocaleString()} caption="Tracked" inverted={active} />
                        <KeyMetric label="Timezone" value={row.branch.timezone ?? "UTC"} caption="Clock" inverted={active} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </PanelCard>

          <div className="space-y-4">
            <PanelCard title="Branch Profile" subtitle={selectedBranch ? `${selectedBranch.name} · ${selectedBranch.location}` : "Select a branch"} action={selectedBranch ? <SaasBadge label={selectedBranch.isActive ? "active" : "inactive"} tone={selectedBranch.isActive ? "ok" : "warn"} /> : undefined}>
              {!selectedBranch ? (
                <EmptyMessage message="Select a branch from the directory." />
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3">
                    <Field label="Branch Name">
                      <input value={branchDraft.name} onChange={(event) => setBranchDraft((current) => ({ ...current, name: event.target.value }))} className={inputClass} style={inputStyle} />
                    </Field>
                    <Field label="Location">
                      <input value={branchDraft.location} onChange={(event) => setBranchDraft((current) => ({ ...current, location: event.target.value }))} className={inputClass} style={inputStyle} />
                    </Field>
                    <Field label="Timezone">
                      <input value={branchDraft.timezone} onChange={(event) => setBranchDraft((current) => ({ ...current, timezone: event.target.value }))} className={inputClass} style={inputStyle} />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <KeyMetric label="Staff" value={selectedBranch._count.staff.toLocaleString()} caption="Assigned" />
                    <KeyMetric label="Orders" value={selectedBranch._count.orders.toLocaleString()} caption="Captured" />
                    <KeyMetric label="Sessions" value={selectedBranch._count.sessions.toLocaleString()} caption="Tracked" />
                    <KeyMetric label="Owner Seats" value={selectedBranchOwnerCount.toLocaleString()} caption="Attached" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SaasToolbarButton
                      label={busy === "save-branch" ? "Saving..." : "Save Branch"}
                      onClick={() => {
                        if (!selectedBranch) return;
                        void runAction("save-branch", async () => {
                          await authPatch(`/api/saas/branches/${selectedBranch.id}`, null, branchDraft);
                          toast("Branch updated");
                        });
                      }}
                    />
                    <SaasToolbarButton
                      label={busy === "toggle-branch" ? "Updating..." : selectedBranch.isActive ? "Deactivate Branch" : "Activate Branch"}
                      onClick={() => {
                        if (!selectedBranch) return;
                        void runAction("toggle-branch", async () => {
                          await authPatch(`/api/saas/branches/${selectedBranch.id}/status`, null, { isActive: !selectedBranch.isActive });
                          toast(selectedBranch.isActive ? "Branch deactivated" : "Branch activated");
                        });
                      }}
                      variant="primary"
                    />
                  </div>
                </div>
              )}
            </PanelCard>

            <PanelCard title="Create Branch" subtitle={selectedTenant ? `Add a branch to ${selectedTenant.name}` : "Select a tenant first"}>
              <div className="space-y-3">
                <Field label="Branch Name">
                  <input value={branchCreateDraft.name} onChange={(event) => setBranchCreateDraft((current) => ({ ...current, name: event.target.value }))} className={inputClass} style={inputStyle} />
                </Field>
                <Field label="Location">
                  <input value={branchCreateDraft.location} onChange={(event) => setBranchCreateDraft((current) => ({ ...current, location: event.target.value }))} className={inputClass} style={inputStyle} />
                </Field>
                <Field label="Timezone">
                  <input value={branchCreateDraft.timezone} onChange={(event) => setBranchCreateDraft((current) => ({ ...current, timezone: event.target.value }))} className={inputClass} style={inputStyle} />
                </Field>
                <SaasToolbarButton
                  label={busy === "create-branch" ? "Creating..." : "Create Branch"}
                  onClick={() => {
                    if (!selectedTenant) return;
                    void runAction("create-branch", async () => {
                      await authPost(`/api/saas/tenants/${selectedTenant.id}/branches`, null, branchCreateDraft);
                      setBranchCreateDraft({ name: "", location: "", timezone: "UTC" });
                      toast("Branch created");
                    });
                  }}
                  variant="primary"
                />
              </div>
            </PanelCard>
          </div>
        </div>
      ) : null}

      {tab === "owners" ? (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <PanelCard title="Owners" subtitle={`${ownerRows.length.toLocaleString()} owner accounts in scope`}>
            {ownerRows.length === 0 ? (
              <EmptyMessage message="No owner accounts match the current filters." />
            ) : (
              <div className="grid gap-3 xl:grid-cols-2">
                {ownerRows.map((row) => (
                  <div key={row.owner.id} className="rounded-[var(--r-md)] p-4" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>{row.owner.name}</div>
                        <div className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>{row.owner.email}</div>
                      </div>
                      <SaasBadge label={row.owner.isActive ? "active" : "inactive"} tone={row.owner.isActive ? "ok" : "warn"} />
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <InfoBlock label="Tenant" value={row.tenantName} />
                      <InfoBlock label="Branch" value={row.branchName} />
                      <InfoBlock label="Phone" value={row.owner.phone || "Not set"} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PanelCard>

          <PanelCard title="Coverage Summary" subtitle="Quick read on owner allocation.">
            {!selectedTenant ? (
              <EmptyMessage message="Select a tenant to inspect owner coverage." />
            ) : (
              <div className="space-y-3">
                <KeyMetric label="Primary Owner" value={selectedTenant.ownerEmail ?? selectedTenant.ownerName ?? "Missing"} caption="Tenant level contact" />
                <KeyMetric label="Provisioned Owners" value={selectedTenant.staff.length.toLocaleString()} caption={`${selectedTenant.branches.length.toLocaleString()} branches under coverage`} />
                <KeyMetric label="Orders in Scope" value={selectedTenantOrderCount.toLocaleString()} caption="Useful for staffing review" />
                <GhostLink href="/saas/tenants?tab=provisioning" label="Open provisioning workspace" />
              </div>
            )}
          </PanelCard>
        </div>
      ) : null}

      {tab === "provisioning" ? (
        <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
          <PanelCard title="Provision Owner" subtitle="Create tenant owners with branch assignment in one pass.">
            {!selectedTenant ? (
              <EmptyMessage message="Select a tenant to provision an owner." />
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Tenant">
                    <select value={selectedTenantId} onChange={(event) => setSelectedTenantId(event.target.value)} className={inputClass} style={inputStyle}>
                      {visibleTenants.map((tenant) => (
                        <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Branch">
                    <select value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)} className={inputClass} style={inputStyle}>
                      {selectedTenant.branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Owner Name">
                  <input value={ownerDraft.name} onChange={(event) => setOwnerDraft((current) => ({ ...current, name: event.target.value }))} className={inputClass} style={inputStyle} />
                </Field>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Email">
                    <input value={ownerDraft.email} onChange={(event) => setOwnerDraft((current) => ({ ...current, email: event.target.value }))} className={inputClass} style={inputStyle} />
                  </Field>
                  <Field label="Phone">
                    <input value={ownerDraft.phone} onChange={(event) => setOwnerDraft((current) => ({ ...current, phone: event.target.value }))} className={inputClass} style={inputStyle} />
                  </Field>
                  <Field label="Password">
                    <input type="password" value={ownerDraft.password} onChange={(event) => setOwnerDraft((current) => ({ ...current, password: event.target.value }))} className={inputClass} style={inputStyle} />
                  </Field>
                  <Field label="Confirm Password">
                    <input type="password" value={ownerDraft.confirmPassword} onChange={(event) => setOwnerDraft((current) => ({ ...current, confirmPassword: event.target.value }))} className={inputClass} style={inputStyle} />
                  </Field>
                </div>
                <div className="rounded-[var(--r-md)] p-4" style={{ background: ownerPasswordsMatch ? "var(--ok-soft)" : "var(--bad-soft)", border: `1px solid ${ownerPasswordsMatch ? "#bbf7d0" : "#fecaca"}` }}>
                  <div className="text-[13px] font-semibold" style={{ color: ownerPasswordsMatch ? "var(--ok)" : "var(--bad)" }}>
                    {ownerPasswordsMatch ? "Passwords are aligned and ready for provisioning." : "Passwords must match before the owner can be provisioned."}
                  </div>
                </div>
                <SaasToolbarButton
                  label={busy === "create-owner" ? "Creating..." : "Create Owner"}
                  onClick={() => {
                    if (!selectedTenant || !selectedBranch || !ownerPasswordsMatch) return;
                    void runAction("create-owner", async () => {
                      await authPost("/api/saas/tenants/owners", null, {
                        tenantId: selectedTenant.id,
                        branchId: selectedBranch.id,
                        name: ownerDraft.name,
                        email: ownerDraft.email,
                        phone: ownerDraft.phone,
                        password: ownerDraft.password,
                      });
                      setOwnerDraft({
                        name: "",
                        email: "",
                        phone: "",
                        password: "password123",
                        confirmPassword: "password123",
                      });
                      toast("Owner created");
                    });
                  }}
                  variant="primary"
                />
              </div>
            )}
          </PanelCard>

          <PanelCard title="Provisioning Activity" subtitle="Recent tenant, branch, and owner mutations in this workspace.">
            <div className="space-y-3">
              {provisioningActivity.length === 0 ? (
                <EmptyMessage message="No provisioning activity appears in the current window." />
              ) : (
                provisioningActivity.map((item) => (
                  <div key={item.id} className="rounded-[var(--r-md)] p-4" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>{item.title}</div>
                        <div className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>{item.summary}</div>
                      </div>
                      <div className="text-[11px]" style={{ color: "var(--ink-500)" }}>{relativeTime(item.occurredAt)}</div>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <InfoBlock label="Tenant" value={item.tenantName} />
                      <InfoBlock label="Branch" value={item.branchName} />
                      <InfoBlock label="Actor" value={item.actor?.name ?? "System"} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </PanelCard>
        </div>
      ) : null}
    </SaasPage>
  );
}

function TenantTabs({
  active,
  onChange,
}: {
  active: TenantsTab;
  onChange: (tab: TenantsTab) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {[
        { key: "directory", label: "Directory" },
        { key: "branches", label: "Branches" },
        { key: "owners", label: "Owners" },
        { key: "provisioning", label: "Provisioning" },
      ].map((item) => {
        const isActive = active === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key as TenantsTab)}
            className="inline-flex h-10 items-center justify-center rounded-[var(--r-md)] px-4 text-[12px] font-semibold md:h-11 md:text-[13px]"
            style={
              isActive
                ? { background: "var(--ink-900)", color: "var(--ink-0)" }
                : { background: "var(--ink-0)", color: "var(--ink-700)", border: "1px solid var(--ink-200)" }
            }
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function PanelCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      className="rounded-[var(--r-lg)] p-4 md:p-5"
      style={{
        background: "linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)",
        border: "1px solid var(--ink-200)",
        boxShadow: "0 14px 32px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="font-serif text-[27px] font-semibold leading-none" style={{ color: "var(--ink-900)" }}>{title}</div>
          {subtitle ? (
            <div className="mt-2 text-[12px]" style={{ color: "var(--ink-500)" }}>{subtitle}</div>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function HeroPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-semibold" style={{ background: "rgba(248,250,252,0.08)", color: "rgba(248,250,252,0.9)", border: "1px solid rgba(248,250,252,0.12)" }}>
      {label}
    </span>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-r pr-4 last:border-r-0 last:pr-0" style={{ borderColor: "rgba(248, 250, 252, 0.16)" }}>
      <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(248,250,252,0.58)" }}>{label}</div>
      <div className="mt-2 text-[18px] font-semibold" style={{ color: "var(--ink-0)" }}>{value}</div>
    </div>
  );
}

function KeyMetric({
  label,
  value,
  caption,
  inverted = false,
}: {
  label: string;
  value: string;
  caption: string;
  inverted?: boolean;
}) {
  return (
    <div className="rounded-[var(--r-md)] p-3" style={{ background: inverted ? "rgba(248,250,252,0.08)" : "var(--ink-50)", border: `1px solid ${inverted ? "rgba(248,250,252,0.12)" : "var(--ink-200)"}` }}>
      <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: inverted ? "rgba(248,250,252,0.62)" : "var(--ink-500)" }}>{label}</div>
      <div className="mt-2 text-[18px] font-semibold" style={{ color: inverted ? "var(--ink-0)" : "var(--ink-900)" }}>{value}</div>
      <div className="mt-1 text-[11px]" style={{ color: inverted ? "rgba(248,250,252,0.72)" : "var(--ink-600)" }}>{caption}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-[12px] font-semibold" style={{ color: "var(--ink-700)" }}>{label}</div>
      {children}
    </label>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--r-sm)] px-3 py-2.5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
      <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--ink-500)" }}>{label}</div>
      <div className="mt-1 text-[12px] font-medium" style={{ color: "var(--ink-900)" }}>{value}</div>
    </div>
  );
}

function EmptyMessage({
  message,
  compact = false,
}: {
  message: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-[var(--r-md)] text-center text-[13px] ${compact ? "px-3 py-4" : "px-4 py-10"}`}
      style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)", color: "var(--ink-500)" }}
    >
      {message}
    </div>
  );
}

function GhostLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-[12px] font-semibold" style={{ color: "var(--ink-700)" }}>
      {label}
      <span aria-hidden>→</span>
    </Link>
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

function glyphStyle(): CSSProperties {
  return {
    width: 16,
    height: 16,
    stroke: "currentColor",
    strokeWidth: 1.8,
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
}

const inputClass = "h-11 w-full rounded-[var(--r-md)] px-3 text-[13px] outline-none";
const inputStyle = {
  background: "var(--ink-0)",
  border: "1px solid var(--ink-200)",
  color: "var(--ink-900)",
} as const;
