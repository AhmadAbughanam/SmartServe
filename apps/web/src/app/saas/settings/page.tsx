"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authGet, authPatch, getApiErrorMessage } from "../../../lib/api";
import { ErrorDisplay, useToast } from "../../../components/ui";
import {
  SaasBadge,
  SaasLiveBadge,
  SaasPage,
  SaasToolbarButton,
} from "../saas-ui";

interface Announcement {
  id: string;
  title: string;
  message: string;
  tone: "info" | "warning" | "success";
  enabled: boolean;
}

interface PlatformSettingsResponse {
  settings: {
    id: string;
    platformName: string;
    supportEmail: string | null;
    supportPhone: string | null;
    maintenanceModeEnabled: boolean;
    maintenanceMessage: string | null;
    ownerProvisioningEnabled: boolean;
    auditRetentionDays: number;
    defaultSystemHealthWindowHours: number;
    defaultRevenueRangeDays: number;
    announcements: Announcement[];
    updatedAt: string;
  };
  runtime: {
    environment: string;
    paymentProvider: string;
    smsProvider: string;
    aiServiceUrl: string;
    storageEndpoint: string;
    buildVersion: string;
    commitSha: string;
  };
  recentChanges: Array<{
    id: string;
    createdAt: string;
    message: string;
    metadata: Record<string, unknown> | null;
  }>;
}

export default function SaasSettingsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PlatformSettingsResponse["settings"] | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["saas-platform-settings"],
    queryFn: () => authGet<PlatformSettingsResponse>("/api/saas/settings"),
    retry: false,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setLastUpdated(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (settingsQuery.data) {
      setForm(settingsQuery.data.settings);
      setLastUpdated(new Date());
    }
  }, [settingsQuery.data]);

  const settings = settingsQuery.data?.settings ?? null;
  const runtime = settingsQuery.data?.runtime ?? null;
  const recentChanges = settingsQuery.data?.recentChanges ?? [];

  const announcementCount = useMemo(
    () => form?.announcements.filter((item) => item.enabled).length ?? 0,
    [form],
  );

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      await authPatch("/api/saas/settings", null, {
        platformName: form.platformName,
        supportEmail: form.supportEmail,
        supportPhone: form.supportPhone,
        maintenanceModeEnabled: form.maintenanceModeEnabled,
        maintenanceMessage: form.maintenanceMessage,
        ownerProvisioningEnabled: form.ownerProvisioningEnabled,
        auditRetentionDays: form.auditRetentionDays,
        defaultSystemHealthWindowHours: form.defaultSystemHealthWindowHours,
        defaultRevenueRangeDays: form.defaultRevenueRangeDays,
        announcements: form.announcements,
      });
      toast("Platform settings saved");
      await qc.invalidateQueries({ queryKey: ["saas-platform-settings"] });
    } catch (error) {
      toast(getApiErrorMessage(error, "Failed to save platform settings."), "error");
    } finally {
      setSaving(false);
    }
  }

  function updateAnnouncement(index: number, patch: Partial<Announcement>) {
    if (!form) return;
    const announcements = form.announcements.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item,
    );
    setForm({ ...form, announcements });
  }

  function addAnnouncement() {
    if (!form) return;
    setForm({
      ...form,
      announcements: [
        ...form.announcements,
        {
          id: `announcement-${Date.now()}`,
          title: "New announcement",
          message: "Add platform guidance for tenant operators.",
          tone: "info",
          enabled: false,
        },
      ],
    });
  }

  function removeAnnouncement(id: string) {
    if (!form) return;
    setForm({
      ...form,
      announcements: form.announcements.filter((item) => item.id !== id),
    });
  }

  if (settingsQuery.isLoading) {
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

  if (settingsQuery.isError || !settings || !runtime || !form) {
    return (
      <ErrorDisplay
        message={getApiErrorMessage(settingsQuery.error, "Platform settings are unavailable.")}
        onRetry={() => settingsQuery.refetch()}
      />
    );
  }

  return (
    <SaasPage
      eyebrow="Platform configuration"
      title="Settings"
      description="Manage global SaaS identity, operating policies, provisioning controls, announcement banners, and runtime visibility from one platform-owned settings surface."
      actions={
        <>
          <SaasToolbarButton label="Refresh" onClick={() => settingsQuery.refetch()} />
          <SaasLiveBadge lastUpdated={lastUpdated} />
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SettingsMetricCard
          label="Maintenance mode"
          value={form.maintenanceModeEnabled ? "On" : "Off"}
          detail={form.maintenanceModeEnabled ? "Platform maintenance messaging is enabled" : "Platform is in normal operating mode"}
          badge={form.maintenanceModeEnabled ? "WARN" : "OK"}
          badgeTone={form.maintenanceModeEnabled ? "warn" : "ok"}
        />
        <SettingsMetricCard
          label="Owner provisioning"
          value={form.ownerProvisioningEnabled ? "Enabled" : "Blocked"}
          detail="Controls SaaS-level store-owner creation flow"
          badge={form.ownerProvisioningEnabled ? "OK" : "WARN"}
          badgeTone={form.ownerProvisioningEnabled ? "ok" : "warn"}
        />
        <SettingsMetricCard
          label="Announcements"
          value={announcementCount.toLocaleString()}
          detail={`${form.announcements.length.toLocaleString()} configured banners`}
          badge="LIVE"
          badgeTone="neutral"
        />
        <SettingsMetricCard
          label="Audit retention"
          value={`${form.auditRetentionDays}d`}
          detail="Global target retention window for audit review"
          badge="LIVE"
          badgeTone="neutral"
        />
        <SettingsMetricCard
          label="Runtime env"
          value={runtime.environment}
          detail={`Build ${runtime.buildVersion}`}
          badge={runtime.environment === "production" ? "OK" : "WARN"}
          badgeTone={runtime.environment === "production" ? "ok" : "warn"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <SectionCard
          number="1"
          title="Platform profile"
          subtitle="Identity and operating defaults for the SaaS control plane."
        >
          <div className="grid gap-5">
            <Field label="Platform name">
              <input value={form.platformName} onChange={(event) => setForm({ ...form, platformName: event.target.value })} className={inputClass} style={inputStyle} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Support email">
                <input value={form.supportEmail ?? ""} onChange={(event) => setForm({ ...form, supportEmail: event.target.value })} className={inputClass} style={inputStyle} />
              </Field>
              <Field label="Support phone">
                <input value={form.supportPhone ?? ""} onChange={(event) => setForm({ ...form, supportPhone: event.target.value })} className={inputClass} style={inputStyle} />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField label="Audit retention (days)" value={form.auditRetentionDays} onChange={(value) => setForm({ ...form, auditRetentionDays: value })} />
              <NumberField label="System health default (hours)" value={form.defaultSystemHealthWindowHours} onChange={(value) => setForm({ ...form, defaultSystemHealthWindowHours: value })} />
              <NumberField label="Revenue default (days)" value={form.defaultRevenueRangeDays} onChange={(value) => setForm({ ...form, defaultRevenueRangeDays: value })} />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          number="2"
          title="Access and maintenance"
          subtitle="Controls that materially affect SaaS operator workflows."
        >
          <div className="space-y-4">
            <TogglePanel
              label="Maintenance mode"
              description="Flags the platform as under maintenance and exposes a global maintenance message."
              checked={form.maintenanceModeEnabled}
              onChange={(checked) => setForm({ ...form, maintenanceModeEnabled: checked })}
            />

            <Field label="Maintenance message">
              <textarea value={form.maintenanceMessage ?? ""} onChange={(event) => setForm({ ...form, maintenanceMessage: event.target.value })} rows={4} className="w-full rounded-[var(--r-md)] px-3 py-3 text-[13px] outline-none" style={inputStyle} />
            </Field>

            <TogglePanel
              label="Owner provisioning"
              description="Controls whether SaaS owners can create new tenant owner accounts from the Tenants section."
              checked={form.ownerProvisioningEnabled}
              onChange={(checked) => setForm({ ...form, ownerProvisioningEnabled: checked })}
            />

            <CalloutPanel>
              Current enforcement: when owner provisioning is disabled, the backend rejects new `/api/saas/tenants/owners` requests.
            </CalloutPanel>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <SectionCard
            number="3"
            title="Announcement banners"
            subtitle="Platform-wide operator notices for future rollout surfaces."
            action={
              <button
                type="button"
                onClick={addAnnouncement}
                className="inline-flex h-11 items-center justify-center rounded-[var(--r-md)] px-4 text-[13px] font-semibold"
                style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}
              >
                + Add Banner
              </button>
            }
          >
            {form.announcements.length === 0 ? (
              <EmptyStateCard
                title="No platform announcements configured."
                description="Add a banner to notify operators across the platform."
                icon={<MegaphoneGlyph />}
              />
            ) : (
              <div className="space-y-4">
                {form.announcements.map((announcement, index) => (
                  <div key={announcement.id} className="rounded-[var(--r-md)] p-4" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <SaasBadge label={announcement.tone} tone={announcement.tone === "warning" ? "warn" : announcement.tone === "success" ? "ok" : "neutral"} />
                        <SaasBadge label={announcement.enabled ? "enabled" : "disabled"} tone={announcement.enabled ? "ok" : "neutral"} />
                      </div>
                      <button type="button" onClick={() => removeAnnouncement(announcement.id)} className="text-[12px] font-semibold" style={{ color: "var(--bad)" }}>
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-3">
                      <input value={announcement.title} onChange={(event) => updateAnnouncement(index, { title: event.target.value })} className={inputClass} style={inputStyle} />
                      <textarea value={announcement.message} onChange={(event) => updateAnnouncement(index, { message: event.target.value })} rows={3} className="rounded-[var(--r-md)] px-3 py-3 text-[13px] outline-none" style={inputStyle} />
                      <div className="grid gap-3 sm:grid-cols-[0.8fr_auto]">
                        <select value={announcement.tone} onChange={(event) => updateAnnouncement(index, { tone: event.target.value as Announcement["tone"] })} className={inputClass} style={inputStyle}>
                          <option value="info">Info</option>
                          <option value="warning">Warning</option>
                          <option value="success">Success</option>
                        </select>
                        <label className="inline-flex h-11 items-center gap-2 rounded-[var(--r-md)] px-3 text-[12px] font-semibold" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-700)" }}>
                          <input type="checkbox" checked={announcement.enabled} onChange={(event) => updateAnnouncement(index, { enabled: event.target.checked })} />
                          Enabled
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            number="5"
            title="Recent changes"
            subtitle="Last saved platform-setting changes."
          >
            {recentChanges.length === 0 ? (
              <EmptyStateCard
                title="No change history recorded yet."
                description="When changes are saved, they'll appear here."
                icon={<ClockGlyph />}
              />
            ) : (
              <div className="space-y-3">
                {recentChanges.map((change) => (
                  <div key={change.id} className="rounded-[var(--r-md)] p-4" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-200)" }}>
                    <div className="text-[13px] font-semibold" style={{ color: "var(--ink-900)" }}>{change.message}</div>
                    <div className="mt-1 text-[11px]" style={{ color: "var(--ink-500)" }}>{new Date(change.createdAt).toLocaleString("en-US")}</div>
                    {change.metadata ? (
                      <pre className="mt-3 overflow-x-auto rounded-[var(--r-sm)] px-3 py-2 text-[10px]" style={{ background: "var(--ink-0)", color: "var(--ink-700)", border: "1px solid var(--ink-200)" }}>
                        {JSON.stringify(change.metadata, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard
          number="4"
          title="Runtime summary"
          subtitle="Read-only environment and integration context from the backend runtime."
        >
          <RuntimeSummaryTable
            rows={[
              ["Environment", runtime.environment],
              ["Payment provider", runtime.paymentProvider],
              ["SMS provider", runtime.smsProvider],
              ["AI service", runtime.aiServiceUrl],
              ["Object storage", runtime.storageEndpoint],
              ["Build version", runtime.buildVersion],
              ["Commit", runtime.commitSha],
            ]}
          />
        </SectionCard>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => { void save(); }}
          disabled={saving}
          className="inline-flex h-12 items-center justify-center rounded-[var(--r-md)] px-5 text-[13px] font-semibold disabled:opacity-60"
          style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}
        >
          {saving ? "Saving settings..." : "Save Platform Settings"}
        </button>
        <button
          type="button"
          onClick={() => { window.location.href = "/saas/system-health"; }}
          className="inline-flex h-12 items-center justify-center rounded-[var(--r-md)] px-5 text-[13px] font-semibold"
          style={{ background: "var(--ink-0)", color: "var(--ink-900)", border: "1px solid var(--ink-200)" }}
        >
          Open System Health
        </button>
      </div>
    </SaasPage>
  );
}

function SettingsMetricCard({
  label,
  value,
  detail,
  badge,
  badgeTone,
}: {
  label: string;
  value: string;
  detail: string;
  badge: string;
  badgeTone: "ok" | "warn" | "neutral";
}) {
  const badgeStyle =
    badgeTone === "ok"
      ? { background: "#dcfce7", color: "#15803d" }
      : badgeTone === "warn"
        ? { background: "#fef3c7", color: "#b45309" }
        : { background: "var(--ink-50)", color: "var(--ink-700)" };

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
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--ink-500)" }}>{label}</div>
        <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={badgeStyle}>
          {badge}
        </span>
      </div>
      <div className="mt-4 text-[19px] font-semibold md:text-[20px]" style={{ color: "var(--ink-900)", fontFamily: "var(--font-serif)" }}>{value}</div>
      <div className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--ink-500)" }}>{detail}</div>
    </div>
  );
}

function SectionCard({
  number,
  title,
  subtitle,
  action,
  children,
}: {
  number: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-[var(--r-lg)] p-5"
      style={{
        background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
        border: "1px solid var(--ink-200)",
        boxShadow: "0 18px 38px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold" style={{ background: "var(--ink-900)", color: "var(--ink-0)" }}>
            {number}
          </span>
          <div>
            <div className="text-[32px] font-semibold leading-none" style={{ color: "var(--ink-900)", fontFamily: "var(--font-serif)" }}>{title}</div>
            <div className="mt-3 text-[13px]" style={{ color: "var(--ink-500)" }}>{subtitle}</div>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
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
    <Field label={label}>
      <input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} className={inputClass} style={inputStyle} />
    </Field>
  );
}

function TogglePanel({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-[var(--r-md)] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
      <div>
        <div className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>{label}</div>
        <div className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--ink-500)" }}>{description}</div>
      </div>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4" />
    </label>
  );
}

function CalloutPanel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[var(--r-md)] p-4 text-[12px]" style={{ background: "var(--ink-50)", color: "var(--ink-700)", border: "1px solid var(--ink-200)" }}>
      {children}
    </div>
  );
}

function EmptyStateCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[var(--r-md)] border border-dashed px-4 py-12 text-center" style={{ borderColor: "var(--ink-200)" }}>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "var(--ink-50)", color: "var(--ink-600)", border: "1px solid var(--ink-200)" }}>
        {icon}
      </div>
      <div className="mt-4 text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>{title}</div>
      <div className="mt-2 text-[12px]" style={{ color: "var(--ink-500)" }}>{description}</div>
    </div>
  );
}

function RuntimeSummaryTable({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="overflow-hidden rounded-[var(--r-md)]" style={{ border: "1px solid var(--ink-200)" }}>
      {rows.map(([label, value], index) => (
        <div
          key={label}
          className="flex items-start justify-between gap-4 px-4 py-4 text-[13px]"
          style={{ background: "var(--ink-0)", borderTop: index === 0 ? "none" : "1px solid var(--ink-200)" }}
        >
          <span style={{ color: "var(--ink-600)" }}>{label}</span>
          <span className="text-right" style={{ color: "var(--ink-900)" }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function MegaphoneGlyph() {
  return (
    <svg viewBox="0 0 24 24" style={glyphStyle()}>
      <path d="M3 11v2" />
      <path d="M7 10v4" />
      <path d="M11 8l7-3v14l-7-3H7a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h4Z" />
      <path d="m8 15 1.5 5" />
    </svg>
  );
}

function ClockGlyph() {
  return (
    <svg viewBox="0 0 24 24" style={glyphStyle()}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
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

const inputClass = "h-11 w-full rounded-[var(--r-md)] px-3 text-[13px] outline-none";
const inputStyle = {
  background: "var(--ink-0)",
  border: "1px solid var(--ink-200)",
  color: "var(--ink-900)",
} as const;
