"use client";

import { useDeferredValue, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ErrorDisplay } from "../../../components/ui";
import { authGet, getApiErrorMessage } from "../../../lib/api";
import {
  SaasBadge,
  SaasLiveBadge,
  SaasPage,
  SaasSearchField,
  SaasToolbarButton,
} from "../saas-ui";

type HealthCode = "healthy" | "degraded" | "unavailable";
type ServiceCategory = "core" | "integration" | "config";
type IncidentSeverity = "WARN" | "ERROR";

interface HealthOverview {
  generatedAt: string;
  windowHours: number;
  totals: {
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    unavailableServices: number;
    incidentCount: number;
    errorIncidents: number;
    warningIncidents: number;
    affectedBranches: number;
    affectedTenants: number;
  };
  services: Array<{
    id: string;
    name: string;
    status: { code: HealthCode; label: string; reason: string };
    mode: string;
    incidentCount: number;
  }>;
  issueBranches: Array<{
    tenantId: string;
    tenantName: string;
    branchId: string;
    branchName: string;
    count: number;
  }>;
}

interface HealthServiceRow {
  id: string;
  name: string;
  category: ServiceCategory;
  status: { code: HealthCode; label: string; reason: string };
  mode: string;
  endpoint: string | null;
  lastCheckedAt: string;
  metrics: {
    incidentCount: number;
    warningCount: number;
    affectedBranches: number;
  };
  highlights: string[];
  actionRoute: string;
}

interface IncidentRow {
  id: string;
  source: string;
  serviceId: string;
  serviceName: string;
  tenantId: string | null;
  tenantName: string | null;
  branchId: string | null;
  branchName: string | null;
  severity: IncidentSeverity;
  title: string;
  message: string;
  occurredAt: string;
}

function tone(code: HealthCode): "ok" | "warn" | "bad" {
  if (code === "healthy") return "ok";
  if (code === "degraded") return "warn";
  return "bad";
}

function severityTone(severity: IncidentSeverity): "warn" | "bad" {
  return severity === "ERROR" ? "bad" : "warn";
}

function timeLabel(value: string) {
  return new Date(value).toLocaleString("en-US");
}

export default function SaasSystemHealthPage() {
  const [hours, setHours] = useState(24);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | HealthCode>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | ServiceCategory>("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | IncidentSeverity>("all");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedIncidentId, setSelectedIncidentId] = useState("");
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const deferredSearch = useDeferredValue(search);

  const overviewQuery = useQuery({
    queryKey: ["saas-system-health-overview", hours],
    queryFn: () => authGet<HealthOverview>(`/api/saas/system-health/overview?hours=${hours}`),
    retry: false,
  });

  const servicesQuery = useQuery({
    queryKey: ["saas-system-health-services", hours],
    queryFn: () => authGet<HealthServiceRow[]>(`/api/saas/system-health/services?hours=${hours}`),
    retry: false,
  });

  const incidentsQuery = useQuery({
    queryKey: ["saas-system-health-incidents", hours],
    queryFn: () => authGet<IncidentRow[]>(`/api/saas/system-health/incidents?hours=${hours}`),
    retry: false,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setLastUpdated(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (overviewQuery.data || servicesQuery.data || incidentsQuery.data) {
      setLastUpdated(new Date());
    }
  }, [incidentsQuery.data, overviewQuery.data, servicesQuery.data]);

  const overview = overviewQuery.data;
  const services = servicesQuery.data ?? [];
  const incidents = incidentsQuery.data ?? [];
  const query = deferredSearch.trim().toLowerCase();

  const visibleServices = useMemo(
    () =>
      services.filter((service) => {
        if (statusFilter !== "all" && service.status.code !== statusFilter) return false;
        if (categoryFilter !== "all" && service.category !== categoryFilter) return false;
        if (
          query &&
          !`${service.name} ${service.mode} ${service.endpoint ?? ""} ${service.highlights.join(" ")}`
            .toLowerCase()
            .includes(query)
        ) {
          return false;
        }
        return true;
      }),
    [categoryFilter, query, services, statusFilter],
  );

  const visibleIncidents = useMemo(
    () =>
      incidents.filter((incident) => {
        if (severityFilter !== "all" && incident.severity !== severityFilter) return false;
        if (
          query &&
          !`${incident.title} ${incident.message} ${incident.serviceName} ${incident.tenantName ?? ""} ${incident.branchName ?? ""}`
            .toLowerCase()
            .includes(query)
        ) {
          return false;
        }
        return true;
      }),
    [incidents, query, severityFilter],
  );

  useEffect(() => {
    if (visibleServices.length === 0) {
      setSelectedServiceId("");
      return;
    }
    if (!selectedServiceId || !visibleServices.some((service) => service.id === selectedServiceId)) {
      setSelectedServiceId(visibleServices[0].id);
    }
  }, [selectedServiceId, visibleServices]);

  useEffect(() => {
    if (visibleIncidents.length === 0) {
      setSelectedIncidentId("");
      return;
    }
    if (!selectedIncidentId || !visibleIncidents.some((incident) => incident.id === selectedIncidentId)) {
      setSelectedIncidentId(visibleIncidents[0].id);
    }
  }, [selectedIncidentId, visibleIncidents]);

  if (overviewQuery.isLoading || servicesQuery.isLoading || incidentsQuery.isLoading) {
    return (
      <div className="p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-[132px] animate-pulse rounded-[var(--r-lg)]" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }} />
          ))}
        </div>
      </div>
    );
  }

  if (overviewQuery.isError || servicesQuery.isError || incidentsQuery.isError || !overview) {
    return (
      <ErrorDisplay
        message={getApiErrorMessage(
          overviewQuery.error ?? servicesQuery.error ?? incidentsQuery.error,
          "System health data is unavailable.",
        )}
        onRetry={() => {
          void overviewQuery.refetch();
          void servicesQuery.refetch();
          void incidentsQuery.refetch();
        }}
      />
    );
  }

  const selectedService =
    visibleServices.find((service) => service.id === selectedServiceId) ??
    services.find((service) => service.id === selectedServiceId) ??
    null;
  const selectedIncident =
    visibleIncidents.find((incident) => incident.id === selectedIncidentId) ??
    incidents.find((incident) => incident.id === selectedIncidentId) ??
    null;

  return (
    <SaasPage
      eyebrow="Platform reliability command"
      title="System Health"
      description="Monitor dependency status, provider mode, platform incidents, and branch-level fault pressure from one SaaS-wide control surface."
      actions={
        <>
          <Link
            href="/saas/audit-logs"
            className="inline-flex h-10 items-center justify-center rounded-[var(--r-md)] px-4 text-[12px] font-semibold md:h-11 md:text-[13px]"
            style={{ background: "var(--ink-0)", color: "var(--ink-900)", border: "1px solid var(--ink-200)" }}
          >
            Open Audit Logs
          </Link>
          <SaasToolbarButton
            label="Refresh"
            onClick={() => {
              void overviewQuery.refetch();
              void servicesQuery.refetch();
              void incidentsQuery.refetch();
            }}
          />
          <SaasLiveBadge lastUpdated={lastUpdated} />
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <HealthMetricCard
          label="Healthy services"
          value={overview.totals.healthyServices.toLocaleString()}
          status="OK"
          tone="ok"
          detail={`${overview.totals.totalServices.toLocaleString()} total services checked`}
          icon={<HealthHeartGlyph />}
        />
        <HealthMetricCard
          label="Degraded services"
          value={overview.totals.degradedServices.toLocaleString()}
          status="WARN"
          tone={overview.totals.degradedServices > 0 ? "warn" : "ok"}
          detail="Services that need monitoring or are in non-live mode"
          icon={<PulseGlyph />}
        />
        <HealthMetricCard
          label="Unavailable services"
          value={overview.totals.unavailableServices.toLocaleString()}
          status="BAD"
          tone={overview.totals.unavailableServices > 0 ? "bad" : "ok"}
          detail="Hard failures detected from live checks"
          icon={<BrokenLinkGlyph />}
        />
        <HealthMetricCard
          label="Open incidents"
          value={overview.totals.incidentCount.toLocaleString()}
          status="OK"
          tone={overview.totals.errorIncidents > 0 ? "bad" : overview.totals.warningIncidents > 0 ? "warn" : "ok"}
          detail={`${overview.totals.errorIncidents.toLocaleString()} errors and ${overview.totals.warningIncidents.toLocaleString()} warnings`}
          icon={<ClipboardGlyph />}
        />
        <HealthMetricCard
          label="Affected branches"
          value={overview.totals.affectedBranches.toLocaleString()}
          status="OK"
          tone={overview.totals.affectedBranches > 0 ? "warn" : "ok"}
          detail={`${overview.totals.affectedTenants.toLocaleString()} tenants have incident footprint`}
          icon={<BranchGlyph />}
        />
      </div>

      <section
        className="rounded-[var(--r-lg)] p-4 md:p-5"
        style={{
          background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
          border: "1px solid var(--ink-200)",
          boxShadow: "0 18px 38px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div className="grid gap-3 xl:grid-cols-[1.35fr_0.85fr_0.85fr_0.95fr_auto]">
          <SaasSearchField value={search} onChange={setSearch} placeholder="Search services, incidents, tenants, branches..." />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "all" | HealthCode)}
            className="h-10 rounded-[var(--r-md)] px-3 text-[13px] outline-none md:h-11"
            style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
          >
            <option value="all">All service states</option>
            <option value="healthy">Healthy</option>
            <option value="degraded">Degraded</option>
            <option value="unavailable">Unavailable</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as "all" | ServiceCategory)}
            className="h-10 rounded-[var(--r-md)] px-3 text-[13px] outline-none md:h-11"
            style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
          >
            <option value="all">All categories</option>
            <option value="core">Core runtime</option>
            <option value="integration">Integrations</option>
            <option value="config">Config mode</option>
          </select>
          <select
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value as "all" | IncidentSeverity)}
            className="h-10 rounded-[var(--r-md)] px-3 text-[13px] outline-none md:h-11"
            style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
          >
            <option value="all">All incident severities</option>
            <option value="ERROR">Errors</option>
            <option value="WARN">Warnings</option>
          </select>
          <select
            value={hours}
            onChange={(event) => setHours(Number(event.target.value))}
            className="h-10 rounded-[var(--r-md)] px-3 text-[13px] outline-none md:h-11"
            style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
          >
            <option value={6}>Last 6 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={72}>Last 72 hours</option>
            <option value={168}>Last 7 days</option>
            <option value={720}>Last 30 days</option>
          </select>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <section
          className="rounded-[var(--r-lg)] p-5"
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
            border: "1px solid var(--ink-200)",
            boxShadow: "0 18px 38px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="text-[34px] font-semibold leading-none" style={{ color: "var(--ink-900)", fontFamily: "var(--font-serif)" }}>
              Service registry
            </div>
            <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "var(--ink-50)", color: "var(--ink-600)", border: "1px solid var(--ink-200)" }}>
              {visibleServices.length} services visible in the current view
            </span>
          </div>

          <div className="overflow-hidden rounded-[var(--r-md)]" style={{ border: "1px solid var(--ink-200)" }}>
            <div className="grid grid-cols-[1.55fr_0.8fr_0.8fr_0.55fr_0.9fr_24px] gap-3 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ background: "var(--ink-50)", color: "var(--ink-500)" }}>
              <div>Service</div>
              <div>Category</div>
              <div>Status</div>
              <div>Incidents</div>
              <div>Checked</div>
              <div />
            </div>

            <div>
              {visibleServices.map((service, index) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => setSelectedServiceId(service.id)}
                  className="grid w-full grid-cols-[1.55fr_0.8fr_0.8fr_0.55fr_0.9fr_24px] items-center gap-3 px-4 py-4 text-left"
                  style={{
                    borderTop: index === 0 ? "none" : "1px solid var(--ink-200)",
                    background: service.id === selectedServiceId ? "linear-gradient(180deg, #fbfbfb 0%, #f7f7f7 100%)" : "var(--ink-0)",
                  }}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>{service.name}</div>
                    <div className="mt-1 truncate text-[12px]" style={{ color: "var(--ink-500)" }}>{service.mode}{service.endpoint ? ` | ${service.endpoint}` : ""}</div>
                  </div>
                  <div className="text-[12px]" style={{ color: "var(--ink-700)" }}>{service.category}</div>
                  <div><SaasBadge label={service.status.label.toLowerCase()} tone={tone(service.status.code)} /></div>
                  <div className="text-[13px]" style={{ color: "var(--ink-900)" }}>{service.metrics.incidentCount.toLocaleString()}</div>
                  <div className="text-[12px]" style={{ color: "var(--ink-500)" }}>{timeLabel(service.lastCheckedAt)}</div>
                  <div className="text-[16px]" style={{ color: "var(--ink-500)" }}>⋮</div>
                </button>
              ))}
              {visibleServices.length === 0 ? (
                <div className="border-t px-4 py-10 text-center text-[13px]" style={{ borderColor: "var(--ink-200)", color: "var(--ink-500)" }}>
                  No services match the current filters.
                </div>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-[var(--r-md)] text-[13px] font-semibold"
            style={{ background: "var(--ink-0)", color: "var(--ink-900)", border: "1px solid var(--ink-200)" }}
          >
            View all services
          </button>
        </section>

        <section
          className="rounded-[var(--r-lg)] overflow-hidden"
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
            border: "1px solid var(--ink-200)",
            boxShadow: "0 18px 38px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ background: "linear-gradient(180deg, #0c0c0c 0%, #171717 100%)" }}>
            <div className="flex items-center gap-3">
              <span style={{ color: "rgba(255,255,255,0.82)" }}><CubeGlyph /></span>
              <div className="text-[28px] font-semibold leading-none" style={{ color: "var(--ink-0)", fontFamily: "var(--font-serif)" }}>
                {selectedService ? selectedService.name : "Service detail"}
              </div>
            </div>
            {selectedService ? <SaasBadge label={selectedService.status.label.toLowerCase()} tone={tone(selectedService.status.code)} /> : null}
          </div>

          {!selectedService ? (
            <div className="px-5 py-12 text-center text-[13px]" style={{ color: "var(--ink-500)" }}>
              No service selected.
            </div>
          ) : (
            <div className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailMiniCard label="Incident count" value={selectedService.metrics.incidentCount.toLocaleString()} icon={<PulseGlyph />} />
                <DetailMiniCard label="Affected branches" value={selectedService.metrics.affectedBranches.toLocaleString()} icon={<ShieldOutlineGlyph />} />
                <DetailMiniCard label="Warnings" value={selectedService.metrics.warningCount.toLocaleString()} icon={<WarningGlyph />} />
                <DetailMiniCard label="Category" value={selectedService.category} icon={<StackGlyph />} />
              </div>

              <div className="rounded-[var(--r-md)] p-4" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
                <div className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>Current assessment</div>
                <div className="mt-2 text-[12px]" style={{ color: "var(--ink-700)" }}>{selectedService.status.reason}</div>
              </div>

              <div className="space-y-2">
                {selectedService.highlights.map((item) => (
                  <div key={item} className="rounded-[var(--r-sm)] px-3 py-2 text-[12px]" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>
                    {item}
                  </div>
                ))}
              </div>

              <Link
                href={selectedService.actionRoute}
                className="inline-flex h-11 w-full items-center justify-between rounded-[var(--r-md)] px-4 text-[13px] font-semibold"
                style={{ background: "linear-gradient(180deg, #0c0c0c 0%, #171717 100%)", color: "var(--ink-0)" }}
              >
                <span>Open related section</span>
                <span aria-hidden>→</span>
              </Link>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.06fr_0.94fr]">
        <section
          className="rounded-[var(--r-lg)] p-5"
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
            border: "1px solid var(--ink-200)",
            boxShadow: "0 18px 38px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="text-[34px] font-semibold leading-none" style={{ color: "var(--ink-900)", fontFamily: "var(--font-serif)" }}>
              Incident feed
            </div>
            <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "var(--ink-50)", color: "var(--ink-600)", border: "1px solid var(--ink-200)" }}>
              {visibleIncidents.length} incidents in the selected window
            </span>
          </div>

          <div className="overflow-hidden rounded-[var(--r-md)]" style={{ border: "1px solid var(--ink-200)" }}>
            <div className="grid grid-cols-[1.35fr_0.85fr_0.7fr_0.95fr_0.8fr] gap-3 px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ background: "var(--ink-50)", color: "var(--ink-500)" }}>
              <div>Incident</div>
              <div>Service</div>
              <div>Severity</div>
              <div>Branch</div>
              <div>Time</div>
            </div>
            <div>
              {visibleIncidents.length === 0 ? (
                <div className="px-4 py-12 text-center text-[13px]" style={{ color: "var(--ink-500)" }}>
                  No incidents match the current filters.
                </div>
              ) : (
                visibleIncidents.map((incident, index) => (
                  <button
                    key={incident.id}
                    type="button"
                    onClick={() => setSelectedIncidentId(incident.id)}
                    className="grid w-full grid-cols-[1.35fr_0.85fr_0.7fr_0.95fr_0.8fr] items-center gap-3 px-4 py-4 text-left"
                    style={{
                      borderTop: index === 0 ? "none" : "1px solid var(--ink-200)",
                      background: incident.id === selectedIncidentId ? "linear-gradient(180deg, #fbfbfb 0%, #f7f7f7 100%)" : "var(--ink-0)",
                    }}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>{incident.title}</div>
                      <div className="mt-1 truncate text-[12px]" style={{ color: "var(--ink-500)" }}>{incident.message}</div>
                    </div>
                    <div className="text-[12px]" style={{ color: "var(--ink-700)" }}>{incident.serviceName}</div>
                    <div><SaasBadge label={incident.severity.toLowerCase()} tone={severityTone(incident.severity)} /></div>
                    <div className="text-[12px]" style={{ color: "var(--ink-700)" }}>{incident.branchName ?? "Platform-wide"}</div>
                    <div className="text-[12px]" style={{ color: "var(--ink-500)" }}>{timeLabel(incident.occurredAt)}</div>
                  </button>
                ))
              )}
            </div>
          </div>

          <button
            type="button"
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-[var(--r-md)] text-[13px] font-semibold"
            style={{ background: "var(--ink-0)", color: "var(--ink-900)", border: "1px solid var(--ink-200)" }}
          >
            View all incidents
          </button>
        </section>

        <section
          className="rounded-[var(--r-lg)] p-5"
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
            border: "1px solid var(--ink-200)",
            boxShadow: "0 18px 38px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div className="mb-4">
            <div className="text-[34px] font-semibold leading-none" style={{ color: "var(--ink-900)", fontFamily: "var(--font-serif)" }}>
              Selected incident and noisy branches
            </div>
            <div className="mt-3 text-[13px]" style={{ color: "var(--ink-500)" }}>
              {selectedIncident ? selectedIncident.serviceName : "Select an incident to inspect its scope."}
            </div>
          </div>

          {!selectedIncident ? (
            <div className="rounded-[var(--r-md)] border border-dashed px-4 py-10 text-center text-[13px]" style={{ borderColor: "var(--ink-200)", color: "var(--ink-500)" }}>
              No incident selected.
            </div>
          ) : (
            <div className="rounded-[var(--r-md)] p-4" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>{selectedIncident.title}</div>
                  <div className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>{selectedIncident.message}</div>
                </div>
                <SaasBadge label={selectedIncident.severity.toLowerCase()} tone={severityTone(selectedIncident.severity)} />
              </div>
            </div>
          )}

          <div className="mt-5 rounded-[var(--r-md)] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
            <div className="mb-3 flex items-center gap-2">
              <span style={{ color: "var(--ink-700)" }}><BranchGlyph /></span>
              <div className="text-[16px] font-semibold" style={{ color: "var(--ink-900)" }}>Noisy branches</div>
            </div>
            <div className="space-y-2">
              {overview.issueBranches.length === 0 ? (
                <div className="rounded-[var(--r-sm)] px-3 py-2 text-[12px]" style={{ background: "var(--ink-50)", color: "var(--ink-500)", border: "1px solid var(--ink-200)" }}>
                  No branches currently have repeated incident pressure.
                </div>
              ) : (
                overview.issueBranches.map((branch) => (
                  <Link
                    key={branch.branchId}
                    href="/saas/operations"
                    className="flex items-center justify-between rounded-[var(--r-sm)] px-3 py-3 text-[12px]"
                    style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)", color: "var(--ink-900)" }}
                  >
                    <div>
                      <div>{branch.tenantName} - {branch.branchName}</div>
                      <div style={{ color: "var(--ink-500)" }}>{branch.count} incidents in window</div>
                    </div>
                    <span aria-hidden>›</span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </SaasPage>
  );
}

function HealthMetricCard({
  label,
  value,
  status,
  tone,
  detail,
  icon,
}: {
  label: string;
  value: string;
  status: string;
  tone: "ok" | "warn" | "bad";
  detail: string;
  icon: ReactNode;
}) {
  const palette =
    tone === "ok"
      ? { background: "rgba(34,197,94,0.1)", color: "#16a34a" }
      : tone === "warn"
        ? { background: "rgba(245,158,11,0.1)", color: "#d97706" }
        : { background: "rgba(239,68,68,0.1)", color: "#ef4444" };

  return (
    <div
      className="rounded-[var(--r-lg)] p-5"
      style={{
        background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
        border: "1px solid var(--ink-200)",
        boxShadow: "0 18px 34px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-full" style={palette}>
          {icon}
        </span>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--ink-500)" }}>{label}</div>
      </div>
      <div className="mt-4 text-[20px] font-semibold" style={{ color: "var(--ink-900)" }}>{value}</div>
      <div className="mt-2 text-[12px] font-semibold" style={{ color: palette.color }}>{status}</div>
      <div className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--ink-500)" }}>{detail}</div>
    </div>
  );
}

function DetailMiniCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[var(--r-md)] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
      <div className="flex items-start justify-between gap-3">
        <span style={{ color: "var(--ink-600)" }}>{icon}</span>
        <div className="text-right">
          <div className="text-[20px] font-semibold" style={{ color: "var(--ink-900)" }}>{value}</div>
          <div className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>{label}</div>
        </div>
      </div>
    </div>
  );
}

function HealthHeartGlyph() {
  return (
    <svg viewBox="0 0 24 24" style={glyphStyle()}>
      <path d="M12 21s-6.7-4.35-9-8.28C1 9.3 3.14 5 7.24 5c2.01 0 3.3 1.06 4.03 2.17C12 6.06 13.29 5 15.3 5 19.4 5 21.54 9.3 21 12.72 18.7 16.65 12 21 12 21Z" />
      <path d="M8 12h2l1-2 2 4 1-2h2" />
    </svg>
  );
}

function PulseGlyph() {
  return (
    <svg viewBox="0 0 24 24" style={glyphStyle()}>
      <path d="M3 12h4l2.5-6 5 12 2.5-6H21" />
    </svg>
  );
}

function BrokenLinkGlyph() {
  return (
    <svg viewBox="0 0 24 24" style={glyphStyle()}>
      <path d="m10 13-2 2a3 3 0 1 1-4-4l3-3a3 3 0 0 1 4 0" />
      <path d="m14 11 2-2a3 3 0 1 1 4 4l-3 3a3 3 0 0 1-4 0" />
      <path d="m8 8 8 8" />
    </svg>
  );
}

function ClipboardGlyph() {
  return (
    <svg viewBox="0 0 24 24" style={glyphStyle()}>
      <path d="M9 3h6l1 2h3v16H5V5h3l1-2Z" />
      <path d="M9 7h6" />
      <path d="M9 11h6" />
      <path d="M9 15h4" />
    </svg>
  );
}

function BranchGlyph() {
  return (
    <svg viewBox="0 0 24 24" style={glyphStyle()}>
      <path d="M12 4v16" />
      <path d="M6 8v8" />
      <path d="M18 8v8" />
      <path d="M6 8h12" />
      <path d="M6 16h12" />
      <circle cx="6" cy="8" r="2" />
      <circle cx="18" cy="8" r="2" />
      <circle cx="6" cy="16" r="2" />
      <circle cx="18" cy="16" r="2" />
    </svg>
  );
}

function CubeGlyph() {
  return (
    <svg viewBox="0 0 24 24" style={glyphStyle()}>
      <path d="m12 3 8 4.5v9L12 21 4 16.5v-9L12 3Z" />
      <path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z" />
      <path d="M12 12v9" />
    </svg>
  );
}

function ShieldOutlineGlyph() {
  return (
    <svg viewBox="0 0 24 24" style={glyphStyle()}>
      <path d="m12 3 7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
    </svg>
  );
}

function WarningGlyph() {
  return (
    <svg viewBox="0 0 24 24" style={glyphStyle()}>
      <path d="M12 3 3 20h18L12 3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function StackGlyph() {
  return (
    <svg viewBox="0 0 24 24" style={glyphStyle()}>
      <path d="m12 4 8 4-8 4-8-4 8-4Z" />
      <path d="m4 12 8 4 8-4" />
      <path d="m4 16 8 4 8-4" />
    </svg>
  );
}

function glyphStyle(): CSSProperties {
  return {
    width: 20,
    height: 20,
    stroke: "currentColor",
    strokeWidth: 1.8,
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };
}

function MetricMini({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  const color =
    tone === "ok"
      ? "var(--ok)"
      : tone === "warn"
        ? "var(--warn)"
        : tone === "bad"
          ? "var(--bad)"
          : "var(--ink-900)";

  return (
    <div className="rounded-[var(--r-md)] p-3" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
      <div className="text-[18px] font-semibold" style={{ color }}>{value}</div>
      <div className="mt-1 text-[11px]" style={{ color: "var(--ink-500)" }}>{label}</div>
    </div>
  );
}
