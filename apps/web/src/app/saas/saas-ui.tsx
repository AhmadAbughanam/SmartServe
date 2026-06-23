"use client";

import type { CSSProperties, ReactNode } from "react";

export const saasIconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function SaasPage({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-full p-5 md:p-6">
      <div className="mx-auto max-w-[1520px]">
        <div className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-start md:justify-between" style={{ borderColor: "var(--ink-200)" }}>
          <div className="max-w-3xl">
            {eyebrow && (
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--ink-500)" }}>
                {eyebrow}
              </div>
            )}
            <h1 className="mt-1 font-serif text-[30px] font-extrabold tracking-tight leading-none md:text-[36px]" style={{ color: "var(--ink-900)" }}>
              {title}
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed md:text-[14px]" style={{ color: "var(--ink-500)" }}>
              {description}
            </p>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
        </div>
        <div className="mt-5 space-y-5">{children}</div>
      </div>
    </div>
  );
}

export function SaasSurface({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section
      className={`rounded-[var(--r-lg)] bg-[var(--ink-0)] ${className}`}
      style={{ border: "1px solid var(--ink-200)", ...style }}
    >
      {children}
    </section>
  );
}

export function SaasSurfaceBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`p-4 md:p-5 ${className}`}>{children}</div>;
}

export function SaasToolbarButton({
  label,
  icon,
  onClick,
  variant = "secondary",
}: {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: "secondary" | "primary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--r-md)] px-4 text-[12px] font-semibold transition md:h-11 md:text-[13px]"
      style={
        variant === "primary"
          ? { background: "var(--ink-900)", color: "var(--ink-0)" }
          : { background: "var(--ink-0)", color: "var(--ink-900)", border: "1px solid var(--ink-200)" }
      }
    >
      {icon}
      {label}
    </button>
  );
}

export function SaasSearchField({
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
      className="flex h-10 min-w-0 items-center gap-2 rounded-[var(--r-md)] px-3 md:h-11"
      style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}
    >
      <svg {...saasIconProps} style={{ color: "var(--ink-500)" }}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full min-w-0 bg-transparent text-[13px] outline-none"
        style={{ color: "var(--ink-900)" }}
      />
    </label>
  );
}

export function SaasLiveBadge({ lastUpdated }: { lastUpdated: Date }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-semibold" style={{ background: "var(--ok-soft)", color: "var(--ok)", border: "1px solid #bbf7d0" }}>
      <span className="h-2 w-2 rounded-full" style={{ background: "var(--ok)", animation: "pulse-dot 2s infinite" }} />
      Live
      <span style={{ color: "var(--ink-500)" }}>{lastUpdated.toLocaleTimeString("en-US")}</span>
    </div>
  );
}

export function SaasSectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="font-serif text-[20px] font-bold tracking-tight" style={{ color: "var(--ink-900)" }}>
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-[12px]" style={{ color: "var(--ink-500)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function SaasMetricCard({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  const toneStyle =
    tone === "ok"
      ? { color: "var(--ok)", background: "var(--ok-soft)", border: "#bbf7d0" }
      : tone === "warn"
        ? { color: "var(--warn)", background: "var(--warn-soft)", border: "#fde68a" }
        : tone === "bad"
          ? { color: "var(--bad)", background: "var(--bad-soft)", border: "#fecaca" }
          : { color: "var(--ink-900)", background: "var(--ink-50)", border: "var(--ink-200)" };

  return (
    <SaasSurface>
      <SaasSurfaceBody>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--ink-500)" }}>
              {label}
            </div>
            <div className="mt-3 font-serif text-[28px] font-extrabold leading-none" style={{ color: "var(--ink-900)" }}>
              {value}
            </div>
            <div className="mt-2 text-[12px]" style={{ color: "var(--ink-500)" }}>
              {detail}
            </div>
          </div>
          <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: toneStyle.color, background: toneStyle.background, border: `1px solid ${toneStyle.border}` }}>
            {tone === "neutral" ? "Live" : tone}
          </span>
        </div>
      </SaasSurfaceBody>
    </SaasSurface>
  );
}

export function SaasBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  const toneStyle =
    tone === "ok"
      ? { color: "var(--ok)", background: "var(--ok-soft)", border: "#bbf7d0" }
      : tone === "warn"
        ? { color: "var(--warn)", background: "var(--warn-soft)", border: "#fde68a" }
        : tone === "bad"
          ? { color: "var(--bad)", background: "var(--bad-soft)", border: "#fecaca" }
          : { color: "var(--ink-600)", background: "var(--ink-100)", border: "var(--ink-200)" };

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
      style={{ color: toneStyle.color, background: toneStyle.background, border: `1px solid ${toneStyle.border}` }}
    >
      {label}
    </span>
  );
}

export function SaasTableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-[var(--r-md)]" style={{ border: "1px solid var(--ink-200)" }}>{children}</div>;
}

