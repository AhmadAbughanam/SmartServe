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
import NetworkSalesContent from "./NetworkSalesContent";

type BillingTab = "subscriptions" | "invoices" | "risk" | "network-sales";
type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELED";
type InvoiceStatus = "DRAFT" | "OPEN" | "PAID" | "VOID" | "OVERDUE";

interface BillingOverview {
  totals: {
    tenantCount: number;
    subscriptionCount: number;
    activeSubscriptions: number;
    trialingSubscriptions: number;
    overdueSubscriptions: number;
    invoiceCount: number;
    openInvoices: number;
    overdueInvoices: number;
    mrr: string;
    openInvoiceAmount: string;
  };
}

interface BillingTenantRow {
  tenantId: string;
  tenantName: string;
  tenantActive: boolean;
  branchCount: number;
  subscription: {
    id: string;
    planCode: string;
    status: SubscriptionStatus;
    trialEndsAt: string | null;
    billingPeriodStart: string | null;
    billingPeriodEnd: string | null;
    nextInvoiceAt: string | null;
    amount: string;
    currency: string;
    updatedAt: string;
  } | null;
}

interface BillingInvoiceRow {
  id: string;
  tenantId: string;
  tenantName: string;
  subscriptionId: string | null;
  planCode: string | null;
  subscriptionStatus: SubscriptionStatus | null;
  invoiceNumber: string;
  status: InvoiceStatus;
  amount: string;
  currency: string;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

function money(value: string | number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number(value || 0));
}

function dateValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function statusTone(status: SubscriptionStatus | InvoiceStatus): "ok" | "warn" | "bad" | "neutral" {
  if (status === "ACTIVE" || status === "PAID") return "ok";
  if (status === "TRIALING" || status === "OPEN" || status === "DRAFT") return "neutral";
  if (status === "PAST_DUE" || status === "OVERDUE" || status === "SUSPENDED") return "warn";
  return "bad";
}

export default function BillingOwnerContent({ initialTab }: { initialTab: BillingTab }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<BillingTab>(initialTab);
  const [search, setSearch] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [saving, setSaving] = useState(false);

  const overviewQuery = useQuery({
    queryKey: ["saas-billing-overview"],
    queryFn: () => authGet<BillingOverview>("/api/saas/billing/overview"),
    retry: false,
  });

  const tenantsQuery = useQuery({
    queryKey: ["saas-billing-tenants"],
    queryFn: () => authGet<BillingTenantRow[]>("/api/saas/billing/tenants"),
    retry: false,
  });

  const invoicesQuery = useQuery({
    queryKey: ["saas-billing-invoices"],
    queryFn: () => authGet<BillingInvoiceRow[]>("/api/saas/billing/invoices"),
    retry: false,
  });

  const [draft, setDraft] = useState({
    planCode: "",
    status: "TRIALING" as SubscriptionStatus,
    trialEndsAt: "",
    billingPeriodStart: "",
    billingPeriodEnd: "",
    nextInvoiceAt: "",
    amount: "0",
    currency: "USD",
  });

  useEffect(() => {
    const timer = window.setInterval(() => setLastUpdated(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (overviewQuery.data || tenantsQuery.data || invoicesQuery.data) setLastUpdated(new Date());
  }, [overviewQuery.data, tenantsQuery.data, invoicesQuery.data]);

  const tenants = tenantsQuery.data ?? [];
  const invoices = invoicesQuery.data ?? [];
  const query = search.trim().toLowerCase();

  const visibleTenants = useMemo(
    () =>
      tenants.filter((tenant) =>
        !query || `${tenant.tenantName} ${tenant.subscription?.planCode ?? ""} ${tenant.subscription?.status ?? ""}`.toLowerCase().includes(query),
      ),
    [query, tenants],
  );

  useEffect(() => {
    if (visibleTenants.length === 0) {
      setSelectedTenantId("");
      return;
    }
    if (!selectedTenantId || !visibleTenants.some((tenant) => tenant.tenantId === selectedTenantId)) {
      setSelectedTenantId(visibleTenants[0].tenantId);
    }
  }, [selectedTenantId, visibleTenants]);

  const selectedTenant =
    visibleTenants.find((tenant) => tenant.tenantId === selectedTenantId) ??
    tenants.find((tenant) => tenant.tenantId === selectedTenantId) ??
    null;

  useEffect(() => {
    if (!selectedTenant?.subscription) {
      setDraft({
        planCode: "starter",
        status: "TRIALING",
        trialEndsAt: "",
        billingPeriodStart: "",
        billingPeriodEnd: "",
        nextInvoiceAt: "",
        amount: "0",
        currency: "USD",
      });
      return;
    }
    setDraft({
      planCode: selectedTenant.subscription.planCode,
      status: selectedTenant.subscription.status,
      trialEndsAt: dateValue(selectedTenant.subscription.trialEndsAt),
      billingPeriodStart: dateValue(selectedTenant.subscription.billingPeriodStart),
      billingPeriodEnd: dateValue(selectedTenant.subscription.billingPeriodEnd),
      nextInvoiceAt: dateValue(selectedTenant.subscription.nextInvoiceAt),
      amount: selectedTenant.subscription.amount,
      currency: selectedTenant.subscription.currency,
    });
  }, [selectedTenant?.tenantId, selectedTenant?.subscription?.updatedAt]);

  async function refreshAll() {
    await Promise.all([
      overviewQuery.refetch(),
      tenantsQuery.refetch(),
      invoicesQuery.refetch(),
    ]);
  }

  async function saveSubscription() {
    if (!selectedTenant) return;
    setSaving(true);
    try {
      await authPatch(`/api/saas/billing/tenants/${selectedTenant.tenantId}/subscription`, null, {
        ...draft,
        amount: Number(draft.amount),
      });
      toast("Subscription updated");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["saas-billing-overview"] }),
        qc.invalidateQueries({ queryKey: ["saas-billing-tenants"] }),
        qc.invalidateQueries({ queryKey: ["saas-billing-invoices"] }),
      ]);
    } catch (error) {
      toast(getApiErrorMessage(error, "Failed to update subscription."), "error");
    } finally {
      setSaving(false);
    }
  }

  if (tab === "network-sales") {
    return (
      <div className="space-y-4">
        <BillingTabBar active={tab} onChange={setTab} />
        <NetworkSalesContent />
      </div>
    );
  }

  if (overviewQuery.isLoading || tenantsQuery.isLoading || invoicesQuery.isLoading) {
    return <div className="p-6" />;
  }

  if (overviewQuery.isError || tenantsQuery.isError || invoicesQuery.isError || !overviewQuery.data) {
    return (
      <ErrorDisplay
        message={getApiErrorMessage(overviewQuery.error ?? tenantsQuery.error ?? invoicesQuery.error, "Billing data is unavailable.")}
        onRetry={() => { void refreshAll(); }}
      />
    );
  }

  const overview = overviewQuery.data;
  const overdueTenants = tenants.filter((tenant) => tenant.subscription?.status === "PAST_DUE" || tenant.subscription?.status === "SUSPENDED");
  const overdueInvoices = invoices.filter((invoice) => invoice.status === "OVERDUE");

  return (
    <div className="space-y-4">
      <BillingTabBar active={tab} onChange={setTab} />
      <SaasPage
        eyebrow="Platform commercials"
        title="Billing"
        description="Manage SaaS subscriptions, invoice exposure, billing risk, and keep tenant sales reporting separate from platform revenue."
        actions={
          <>
            <SaasToolbarButton label="Refresh" onClick={() => { void refreshAll(); }} />
            <SaasLiveBadge lastUpdated={lastUpdated} />
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SaasMetricCard label="MRR" value={money(overview.totals.mrr)} detail={`${overview.totals.activeSubscriptions.toLocaleString()} active subscriptions`} tone="ok" />
          <SaasMetricCard label="Trialing" value={overview.totals.trialingSubscriptions.toLocaleString()} detail={`${overview.totals.tenantCount.toLocaleString()} tenants in billing scope`} />
          <SaasMetricCard label="Past due" value={overview.totals.overdueSubscriptions.toLocaleString()} detail={`${overview.totals.overdueInvoices.toLocaleString()} overdue invoices`} tone={overview.totals.overdueSubscriptions > 0 ? "warn" : "ok"} />
          <SaasMetricCard label="Open invoices" value={overview.totals.openInvoices.toLocaleString()} detail={money(overview.totals.openInvoiceAmount)} tone={overview.totals.openInvoices > 0 ? "warn" : "ok"} />
          <SaasMetricCard label="Invoice count" value={overview.totals.invoiceCount.toLocaleString()} detail={`${overview.totals.subscriptionCount.toLocaleString()} subscriptions total`} />
        </div>

        <SaasSurface>
          <SaasSurfaceBody>
            <div className="grid gap-3 xl:grid-cols-[1.4fr_auto]">
              <SaasSearchField value={search} onChange={setSearch} placeholder="Search tenants or plans..." />
              <div className="flex items-center rounded-[var(--r-md)] px-3 text-[12px] font-semibold md:h-11" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>
                {visibleTenants.length.toLocaleString()} tenants visible
              </div>
            </div>
          </SaasSurfaceBody>
        </SaasSurface>

        {tab === "subscriptions" ? (
          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <SaasSurface>
              <SaasSurfaceBody>
                <SaasSectionHeader title="Tenant subscriptions" subtitle="Create or update billing subscriptions per tenant." />
                <SaasTableWrap>
                  <table className="min-w-full text-left">
                    <thead style={{ background: "var(--ink-50)" }}>
                      <tr className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--ink-500)" }}>
                        <th className="px-4 py-3">Tenant</th>
                        <th className="px-4 py-3">Plan</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTenants.map((tenant) => (
                        <tr
                          key={tenant.tenantId}
                          onClick={() => setSelectedTenantId(tenant.tenantId)}
                          style={{ borderTop: "1px solid var(--ink-200)", background: tenant.tenantId === selectedTenantId ? "var(--ink-50)" : "transparent", cursor: "pointer" }}
                        >
                          <td className="px-4 py-3">
                            <div className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>{tenant.tenantName}</div>
                            <div className="text-[12px]" style={{ color: "var(--ink-500)" }}>{tenant.branchCount} branches</div>
                          </td>
                          <td className="px-4 py-3 text-[12px]" style={{ color: "var(--ink-700)" }}>{tenant.subscription?.planCode ?? "No subscription"}</td>
                          <td className="px-4 py-3">
                            <SaasBadge label={(tenant.subscription?.status ?? "DRAFT").toLowerCase()} tone={statusTone(tenant.subscription?.status ?? "DRAFT")} />
                          </td>
                          <td className="px-4 py-3 text-right text-[13px]" style={{ color: "var(--ink-900)" }}>
                            {tenant.subscription ? money(tenant.subscription.amount, tenant.subscription.currency) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </SaasTableWrap>
              </SaasSurfaceBody>
            </SaasSurface>

            <SaasSurface>
              <SaasSurfaceBody>
                <SaasSectionHeader title={selectedTenant ? `${selectedTenant.tenantName} subscription` : "Subscription editor"} subtitle="Save directly into the SaaS billing backend." />
                {!selectedTenant ? null : (
                  <div className="space-y-3">
                    <Field label="Plan code"><input value={draft.planCode} onChange={(event) => setDraft((current) => ({ ...current, planCode: event.target.value }))} className={inputClass} style={inputStyle} /></Field>
                    <Field label="Status">
                      <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as SubscriptionStatus }))} className={inputClass} style={inputStyle}>
                        <option value="TRIALING">Trialing</option>
                        <option value="ACTIVE">Active</option>
                        <option value="PAST_DUE">Past due</option>
                        <option value="SUSPENDED">Suspended</option>
                        <option value="CANCELED">Canceled</option>
                      </select>
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Amount"><input value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} type="number" className={inputClass} style={inputStyle} /></Field>
                      <Field label="Currency"><input value={draft.currency} onChange={(event) => setDraft((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} className={inputClass} style={inputStyle} /></Field>
                      <Field label="Trial ends"><input value={draft.trialEndsAt} onChange={(event) => setDraft((current) => ({ ...current, trialEndsAt: event.target.value }))} type="date" className={inputClass} style={inputStyle} /></Field>
                      <Field label="Next invoice"><input value={draft.nextInvoiceAt} onChange={(event) => setDraft((current) => ({ ...current, nextInvoiceAt: event.target.value }))} type="date" className={inputClass} style={inputStyle} /></Field>
                      <Field label="Period start"><input value={draft.billingPeriodStart} onChange={(event) => setDraft((current) => ({ ...current, billingPeriodStart: event.target.value }))} type="date" className={inputClass} style={inputStyle} /></Field>
                      <Field label="Period end"><input value={draft.billingPeriodEnd} onChange={(event) => setDraft((current) => ({ ...current, billingPeriodEnd: event.target.value }))} type="date" className={inputClass} style={inputStyle} /></Field>
                    </div>
                    <SaasToolbarButton label={saving ? "Saving..." : "Save Subscription"} onClick={() => { void saveSubscription(); }} variant="primary" />
                  </div>
                )}
              </SaasSurfaceBody>
            </SaasSurface>
          </div>
        ) : null}

        {tab === "invoices" ? (
          <SaasSurface>
            <SaasSurfaceBody>
              <SaasSectionHeader title="Invoices" subtitle={`${invoices.length} SaaS invoices`} />
              <SaasTableWrap>
                <table className="min-w-full text-left">
                  <thead style={{ background: "var(--ink-50)" }}>
                    <tr className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--ink-500)" }}>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Tenant</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3">Due</th>
                      <th className="px-4 py-3">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} style={{ borderTop: "1px solid var(--ink-200)" }}>
                        <td className="px-4 py-3">
                          <div className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>{invoice.invoiceNumber}</div>
                          <div className="text-[12px]" style={{ color: "var(--ink-500)" }}>{invoice.planCode ?? "No plan"}</div>
                        </td>
                        <td className="px-4 py-3 text-[12px]" style={{ color: "var(--ink-700)" }}>{invoice.tenantName}</td>
                        <td className="px-4 py-3"><SaasBadge label={invoice.status.toLowerCase()} tone={statusTone(invoice.status)} /></td>
                        <td className="px-4 py-3 text-right text-[13px]" style={{ color: "var(--ink-900)" }}>{money(invoice.amount, invoice.currency)}</td>
                        <td className="px-4 py-3 text-[12px]" style={{ color: "var(--ink-500)" }}>{invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString("en-US") : "-"}</td>
                        <td className="px-4 py-3 text-[12px]" style={{ color: "var(--ink-500)" }}>{invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString("en-US") : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SaasTableWrap>
            </SaasSurfaceBody>
          </SaasSurface>
        ) : null}

        {tab === "risk" ? (
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <SaasSurface>
              <SaasSurfaceBody>
                <SaasSectionHeader title="Subscription risk" subtitle="Tenants that need subscription follow-up." />
                <div className="space-y-3">
                  {overdueTenants.length === 0 ? (
                    <div className="rounded-[var(--r-md)] px-4 py-10 text-center text-[13px]" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)", color: "var(--ink-500)" }}>
                      No subscription risk is active.
                    </div>
                  ) : (
                    overdueTenants.map((tenant) => (
                      <div key={tenant.tenantId} className="rounded-[var(--r-md)] p-4" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>{tenant.tenantName}</div>
                            <div className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>{tenant.subscription?.planCode ?? "No plan"} · {tenant.branchCount} branches</div>
                          </div>
                          <SaasBadge label={(tenant.subscription?.status ?? "trialing").toLowerCase()} tone={statusTone(tenant.subscription?.status ?? "TRIALING")} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SaasSurfaceBody>
            </SaasSurface>

            <SaasSurface>
              <SaasSurfaceBody>
                <SaasSectionHeader title="Invoice risk" subtitle="Overdue invoices and open exposure." />
                <div className="space-y-3">
                  {overdueInvoices.length === 0 ? (
                    <div className="rounded-[var(--r-md)] px-4 py-10 text-center text-[13px]" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)", color: "var(--ink-500)" }}>
                      No overdue invoices are active.
                    </div>
                  ) : (
                    overdueInvoices.map((invoice) => (
                      <div key={invoice.id} className="rounded-[var(--r-md)] p-4" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>{invoice.invoiceNumber}</div>
                            <div className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>{invoice.tenantName} · due {invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString("en-US") : "-"}</div>
                          </div>
                          <div className="text-[13px] font-semibold" style={{ color: "var(--bad)" }}>{money(invoice.amount, invoice.currency)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SaasSurfaceBody>
            </SaasSurface>
          </div>
        ) : null}
      </SaasPage>
    </div>
  );
}

function BillingTabBar({
  active,
  onChange,
}: {
  active: BillingTab;
  onChange: (tab: BillingTab) => void;
}) {
  return (
    <div className="px-5 pt-5 md:px-6 md:pt-6">
      <div className="mx-auto flex max-w-[1520px] flex-wrap gap-0 overflow-hidden rounded-[var(--r-lg)] bg-[var(--ink-0)]" style={{ border: "1px solid var(--ink-200)", boxShadow: "0 12px 30px rgba(15, 23, 42, 0.04)" }}>
        {[
          { key: "subscriptions", label: "Subscriptions" },
          { key: "invoices", label: "Invoices" },
          { key: "risk", label: "Billing Risk" },
          { key: "network-sales", label: "Network Sales" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key as BillingTab)}
            className="inline-flex h-12 items-center justify-center px-6 text-[12px] font-semibold md:text-[13px]"
            style={
              active === item.key
                ? { background: "var(--ink-900)", color: "var(--ink-0)", boxShadow: "0 14px 30px rgba(15, 23, 42, 0.18)" }
                : { background: "var(--ink-0)", color: "var(--ink-700)", borderRight: "1px solid var(--ink-200)" }
            }
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const inputClass = "h-11 w-full rounded-[var(--r-md)] px-3 text-[13px] outline-none";
const inputStyle = {
  background: "var(--ink-0)",
  border: "1px solid var(--ink-200)",
  color: "var(--ink-900)",
} as const;

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-[12px] font-semibold" style={{ color: "var(--ink-700)" }}>{label}</div>
      {children}
    </label>
  );
}
