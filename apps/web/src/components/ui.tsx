"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

/* ── Status Pill ─────────────────────────────────────── */

const pillMap: Record<string, { bg: string; fg: string; border: string }> = {
  AVAILABLE:      { bg: "var(--ok-soft)",     fg: "var(--ok)",      border: "#bbf7d0" },
  OCCUPIED:       { bg: "#eff6ff",            fg: "#1d4ed8",        border: "#bfdbfe" },
  RESERVED:       { bg: "#f5f3ff",            fg: "#6d28d9",        border: "#ddd6fe" },
  CLEANING:       { bg: "var(--warn-soft)",   fg: "var(--warn)",    border: "#fde68a" },
  OUT_OF_SERVICE:  { bg: "var(--ink-100)",     fg: "var(--ink-500)", border: "var(--ink-200)" },
  PLACED:         { bg: "#eff6ff",            fg: "#1d4ed8",        border: "#bfdbfe" },
  CONFIRMED:      { bg: "#eef2ff",            fg: "#4338ca",        border: "#c7d2fe" },
  IN_KITCHEN:     { bg: "var(--warn-soft)",   fg: "var(--warn)",    border: "#fde68a" },
  READY:          { bg: "var(--ok-soft)",     fg: "var(--ok)",      border: "#bbf7d0" },
  SERVED:         { bg: "#f0fdfa",            fg: "#0d9488",        border: "#99f6e4" },
  COMPLETED:      { bg: "var(--ink-100)",     fg: "var(--ink-500)", border: "var(--ink-200)" },
  CANCELLED:      { bg: "var(--bad-soft)",    fg: "var(--bad)",     border: "#fecaca" },
  NEW:            { bg: "var(--bad-soft)",    fg: "var(--bad)",     border: "#fecaca" },
  CLAIMED:        { bg: "var(--warn-soft)",   fg: "var(--warn)",    border: "#fde68a" },
  ACTIVE:         { bg: "var(--ok-soft)",     fg: "var(--ok)",      border: "#bbf7d0" },
  OPEN:           { bg: "var(--ok-soft)",     fg: "var(--ok)",      border: "#bbf7d0" },
  CLOSED:         { bg: "var(--ink-100)",     fg: "var(--ink-500)", border: "var(--ink-200)" },
  PENDING:        { bg: "var(--ink-100)",     fg: "var(--ink-500)", border: "var(--ink-200)" },
  IN_PROGRESS:    { bg: "var(--warn-soft)",   fg: "var(--warn)",    border: "#fde68a" },
  UNPAID:         { bg: "var(--bad-soft)",    fg: "var(--bad)",     border: "#fecaca" },
  PARTIALLY_PAID: { bg: "var(--warn-soft)",   fg: "var(--warn)",    border: "#fde68a" },
  PAID:           { bg: "var(--ok-soft)",     fg: "var(--ok)",      border: "#bbf7d0" },
};

export function StatusPill({ status, className = "" }: { status: string; className?: string }) {
  const c = pillMap[status] ?? { bg: "var(--ink-100)", fg: "var(--ink-500)", border: "var(--ink-200)" };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

/* ── Loading ─────────────────────────────────────────── */

export function LoadingScreen({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full" style={{ border: "3px solid var(--ink-200)", borderTopColor: "var(--accent)" }} />
      <p className="text-sm" style={{ color: "var(--ink-500)" }}>{message}</p>
    </div>
  );
}

export function LoadingDots() {
  return (
    <span className="inline-flex gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0ms]" style={{ background: "var(--accent)" }} />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]" style={{ background: "var(--accent)" }} />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]" style={{ background: "var(--accent)" }} />
    </span>
  );
}

/* ── Inline Spinner (for buttons) ───────────────────── */

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full"
      style={{ width: size, height: size, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff" }}
    />
  );
}

/* ── Empty State ─────────────────────────────────────── */

export function EmptyState({
  icon = "📭",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-5xl">{icon}</span>
      <h3 className="mt-4 text-lg font-semibold" style={{ color: "var(--ink-900)" }}>{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm" style={{ color: "var(--ink-500)" }}>{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ── Error Display ───────────────────────────────────── */

type AlertTone = "info" | "success" | "warning" | "error";

const alertToneMap: Record<AlertTone, { bg: string; fg: string; border: string; title: string }> = {
  info: { bg: "var(--accent-soft)", fg: "var(--accent-ink)", border: "var(--accent-edge)", title: "Notice" },
  success: { bg: "var(--ok-soft)", fg: "var(--ok)", border: "#bbf7d0", title: "Success" },
  warning: { bg: "var(--warn-soft)", fg: "var(--warn)", border: "#fde68a", title: "Attention" },
  error: { bg: "var(--bad-soft)", fg: "var(--bad)", border: "#fecaca", title: "Unable to complete" },
};

export function InlineAlert({
  tone = "info",
  title,
  children,
  action,
  className = "",
}: {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const c = alertToneMap[tone];
  return (
    <div
      className={`rounded-[var(--r-md)] px-3 py-2.5 text-sm ${className}`}
      style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[9px] font-bold uppercase tracking-widest opacity-80">{title ?? c.title}</div>
          <div className="mt-1 text-[12px] leading-relaxed">{children}</div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}

export function PermissionDeniedState({
  title = "No permission",
  description = "Your account does not have access to this page or branch.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6 text-center">
      <div className="max-w-sm rounded-[var(--r-lg)] p-6" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>
          <span className="text-xl font-bold">!</span>
        </div>
        <h1 className="mt-4 font-serif text-[22px] font-extrabold" style={{ color: "var(--ink-900)" }}>{title}</h1>
        <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--ink-500)" }}>{description}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

export function DashboardCardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-[var(--r-lg)] p-4" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }} aria-hidden>
      <div className="h-8 w-8 animate-pulse rounded-[var(--r-md)]" style={{ background: "var(--ink-100)" }} />
      <div className="mt-4 h-6 w-24 animate-pulse rounded" style={{ background: "var(--ink-100)" }} />
      <div className="mt-3 space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div key={index} className="h-3 animate-pulse rounded" style={{ width: `${90 - index * 18}%`, background: "var(--ink-100)" }} />
        ))}
      </div>
    </div>
  );
}

export function ErrorDisplay({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-[var(--r-xl)] p-6" style={{ background: "var(--bad-soft)" }}>
        <span className="text-3xl">!</span>
        <h3 className="mt-3 text-lg font-semibold" style={{ color: "var(--bad)" }}>Something went wrong</h3>
        <p className="mt-2 max-w-sm text-sm" style={{ color: "#991b1b" }}>{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 rounded-[var(--r-md)] px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
            style={{ background: "var(--bad)", color: "#fff" }}
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}

/* ── KPI Card ────────────────────────────────────────── */

export function KpiCard({
  label,
  value,
  subtitle,
  trend,
  className = "",
}: {
  label: string;
  value: string;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
}) {
  return (
    <div className={`rounded-[var(--r-lg)] p-4 ${className}`} style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
      <p className="font-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>{label}</p>
      <p className="mt-1.5 text-2xl font-bold" style={{ color: "var(--ink-900)" }}>{value}</p>
      {subtitle && <p className="mt-1 text-xs" style={{ color: "var(--ink-500)" }}>{subtitle}</p>}
      {trend && trend !== "neutral" && (
        <p className="mt-1 font-mono text-xs" style={{ color: trend === "up" ? "var(--ok)" : "var(--bad)" }}>
          {trend === "up" ? "\u2191" : "\u2193"}
        </p>
      )}
    </div>
  );
}

/* ── Section Header ──────────────────────────────────── */

export function SectionHeader({
  title,
  subtitle,
  accent,
  action,
}: {
  title: string;
  subtitle?: string;
  accent?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="font-serif text-xl font-bold tracking-tight" style={{ color: "var(--ink-900)" }}>
          {title}{accent && <>{" "}<em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>{accent}</em></>}
        </h2>
        {subtitle && <p className="mt-0.5 font-mono text-[11px]" style={{ color: "var(--ink-500)" }}>{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

/* ── Button ──────────────────────────────────────────── */

type BtnVariant = "primary" | "secondary" | "danger" | "ghost";

const btnStyles: Record<BtnVariant, { bg: string; color: string; border?: string }> = {
  primary:   { bg: "var(--ink-900)", color: "var(--ink-0)" },
  secondary: { bg: "var(--ink-0)",   color: "var(--ink-900)", border: "1px solid var(--ink-200)" },
  danger:    { bg: "var(--bad)",     color: "#fff" },
  ghost:     { bg: "transparent",    color: "var(--ink-700)" },
};

export function Btn({
  children, variant = "primary", size = "md", loading, disabled, className = "", ...props
}: {
  children: ReactNode;
  variant?: BtnVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className">) {
  const s = btnStyles[variant];
  const pad = size === "sm" ? "px-3 py-1.5 text-xs" : size === "lg" ? "px-6 py-3.5 text-sm" : "px-4 py-2.5 text-sm";
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--r-md)] font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${pad} ${className}`}
      style={{ background: s.bg, color: s.color, border: s.border }}
      {...props}
    >
      {loading && <Spinner size={size === "sm" ? 12 : 16} />}
      {children}
    </button>
  );
}

/* ── Toast System ────────────────────────────────────── */

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

const ToastCtx = createContext<{ toast: (msg: string, type?: ToastType) => void }>({ toast: () => {} });

export function useToast() { return useContext(ToastCtx); }

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const colors: Record<ToastType, { bg: string; fg: string; icon: string }> = {
    success: { bg: "var(--ok)",   fg: "#fff", icon: "\u2713" },
    error:   { bg: "var(--bad)",  fg: "#fff", icon: "!" },
    info:    { bg: "var(--ink-900)", fg: "var(--ink-0)", icon: "i" },
  };

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2" style={{ maxWidth: 360 }}>
        {toasts.map(t => {
          const c = colors[t.type];
          return (
            <div
              key={t.id}
              className="flex items-center gap-2.5 rounded-[var(--r-md)] px-4 py-3 text-sm font-medium shadow-lg animate-in fade-in slide-in-from-bottom-2"
              style={{ background: c.bg, color: c.fg }}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold" style={{ background: "rgba(255,255,255,0.25)" }}>{c.icon}</span>
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

/* ── Confirm Dialog ──────────────────────────────────── */

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-[var(--r-xl)] p-6"
        style={{ background: "var(--ink-0)" }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-serif text-lg font-bold" style={{ color: "var(--ink-900)" }}>{title}</h3>
        {description && <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-500)" }}>{description}</p>}
        <div className="mt-5 flex justify-end gap-2.5">
          <Btn variant="secondary" size="sm" onClick={onCancel} disabled={loading}>{cancelLabel}</Btn>
          <Btn variant={variant} size="sm" onClick={onConfirm} loading={loading}>{confirmLabel}</Btn>
        </div>
      </div>
    </div>
  );
}

/* ── Input Field ─────────────────────────────────────── */

export function Field({
  label, error, children, className = "",
}: {
  label: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="font-mono text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--ink-500)" }}>{label}</label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs" style={{ color: "var(--bad)" }}>{error}</p>}
    </div>
  );
}

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  fontSize: 14,
  borderRadius: "var(--r-md)",
  border: "1px solid var(--ink-200)",
  background: "var(--ink-0)",
  color: "var(--ink-900)",
  outline: "none",
};

/* ── Customer brand marks & decor ───────────────────── */

/** Cloche / dome icon used as the customer-facing brand mark. */
export function Cloche({ size = 28, color = "var(--accent)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 5v2.5" />
      <path d="M14.5 5h3" />
      <path d="M5 22c0-6 5-10 11-10s11 4 11 10" />
      <line x1="3.5" y1="22" x2="28.5" y2="22" />
      <path d="M5.5 25.5h21" opacity="0.5" />
    </svg>
  );
}

/** Decorative leaf sprig — used in payment success/cancel headers. Pure CSS, no asset. */
export function Sprig({ side = "left", color = "var(--ok)" }: { side?: "left" | "right"; color?: string }) {
  const flip = side === "right" ? { transform: "scaleX(-1)" } : undefined;
  return (
    <svg width={56} height={36} viewBox="0 0 56 36" fill="none" style={flip} aria-hidden>
      <path d="M4 28 C 14 22, 24 14, 38 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <ellipse cx="14" cy="22" rx="5" ry="2.6" transform="rotate(-25 14 22)" fill={color} opacity="0.85" />
      <ellipse cx="24" cy="16" rx="5.4" ry="2.6" transform="rotate(-30 24 16)" fill={color} opacity="0.7" />
      <ellipse cx="34" cy="9" rx="4.6" ry="2.4" transform="rotate(-35 34 9)" fill={color} opacity="0.55" />
    </svg>
  );
}

/** Branch / Table / Guests chip used across customer screens. */
export function InfoPill({
  icon,
  label,
  value,
  className = "",
}: {
  icon: ReactNode;
  label?: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-1 items-center gap-2 rounded-[var(--r-md)] px-2.5 py-2 ${className}`}
      style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}
    >
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{icon}</span>
      <div className="min-w-0 flex-1">
        {label && <div className="text-[8.5px] uppercase tracking-wider truncate" style={{ color: "var(--ink-500)" }}>{label}</div>}
        <div className="text-[12px] font-semibold leading-tight truncate" style={{ color: "var(--ink-900)" }}>{value}</div>
      </div>
    </div>
  );
}

/** Horizontal step indicator — 4 steps, marks completed/active/upcoming. */
export function StatusStepper({
  steps,
  activeIndex,
  className = "",
}: {
  steps: Array<{ label: string; icon: ReactNode; sub?: string }>;
  activeIndex: number;
  className?: string;
}) {
  return (
    <div className={`flex items-start ${className}`}>
      {steps.map((s, i) => {
        const isDone = i < activeIndex;
        const isActive = i === activeIndex;
        const dotBg = isDone ? "var(--ok)" : isActive ? "var(--accent)" : "var(--ink-100)";
        const dotFg = isDone || isActive ? "var(--ink-0)" : "var(--ink-400)";
        const lineBg = i < activeIndex ? "var(--ok)" : "var(--ink-200)";
        return (
          <div key={i} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              <div className="flex-1 h-[2px]" style={{ background: i === 0 ? "transparent" : lineBg }} />
              <div
                className="relative flex h-9 w-9 items-center justify-center rounded-full transition"
                style={{
                  background: dotBg,
                  color: dotFg,
                  boxShadow: isActive ? "0 0 0 4px rgba(249,115,22,0.18)" : "none",
                }}
              >
                {isDone ? (
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : s.icon}
              </div>
              <div className="flex-1 h-[2px]" style={{ background: i === steps.length - 1 ? "transparent" : (i < activeIndex ? "var(--ok)" : "var(--ink-200)") }} />
            </div>
            <div className="mt-1.5 text-[10px] font-semibold text-center" style={{ color: isDone ? "var(--ok)" : isActive ? "var(--accent)" : "var(--ink-400)" }}>{s.label}</div>
            {s.sub && <div className="text-[8.5px] text-center" style={{ color: "var(--ink-400)" }}>{s.sub}</div>}
          </div>
        );
      })}
    </div>
  );
}

/* ── Card ────────────────────────────────────────────── */

export function Card({ children, className = "", padding = true }: { children: ReactNode; className?: string; padding?: boolean }) {
  return (
    <div
      className={`rounded-[var(--r-lg)] ${padding ? "p-5" : ""} ${className}`}
      style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}
    >
      {children}
    </div>
  );
}
