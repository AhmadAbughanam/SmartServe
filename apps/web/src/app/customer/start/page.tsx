"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError, get, post } from "../../../lib/api";
import { useCart } from "../../../lib/cart-store";
import { Cloche } from "../../../components/ui";
import type { BranchTablesResult, Session, TableAccessResult } from "../../../lib/types";
import type { GeoFenceCheckResponse, GeoFenceLocationInput } from "@smart-restaurant/shared-types";

const COPPER = "#0c0a09";
const COPPER_SOFT = "#f5f5f4";
const COPPER_EDGE = "#e7e5e4";
const COPPER_INK = "#1c1917";
const OK = "#16a34a";
const OK_DARK = "#15803d";

function StartSessionInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { dispatch } = useCart();

  const codeParam = params.get("code");
  const branchIdParam = params.get("branchId");
  const tableCodeParam = params.get("tableCode");

  const [branchId, setBranchId] = useState(branchIdParam ?? "");
  const [tableCode, setTableCode] = useState(tableCodeParam ?? "");
  const [branchName, setBranchName] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(!!codeParam);

  useEffect(() => {
    if (!codeParam) return;
    setResolving(true);
    get<TableAccessResult>(`/api/table-access/${encodeURIComponent(codeParam)}`)
      .then((result) => { setBranchId(result.branchId); setTableCode(result.tableCode ?? ""); setBranchName(result.branch.name); })
      .catch((e) => setError(e instanceof Error ? e.message : "Invalid QR/NFC code"))
      .finally(() => setResolving(false));
  }, [codeParam]);

  const { data: branchTables, isLoading: loadingTables } = useQuery({
    queryKey: ["customer-branch-tables", branchId],
    queryFn: () => get<BranchTablesResult>(`/api/table-access/branches/${branchId}/tables`),
    enabled: !!branchId,
  });

  useEffect(() => {
    if (!branchTables) return;
    setBranchName((current) => current ?? branchTables.branch.name);
  }, [branchTables]);

  async function handleStart() {
    if (!branchId || !tableCode) return;
    setLoading(true); setError(null); setStatusMessage(null);
    try {
      const location = await resolveRequiredLocation(branchId);
      const session = await post<Session>("/api/sessions/start", {
        branchId,
        tableCode,
        guestCount,
        ...(location ? { location } : {}),
      });
      if (location) setStatusMessage("Location confirmed. Welcome!");
      dispatch({
        type: "SET_SESSION",
        sessionId: session.id,
        branchId: session.branchId,
        branchName,
        tableCode: session.table?.tableCode ?? tableCode,
        guestCount: session.guestCount,
      });
      router.push(`/customer/session/${session.id}/menu`);
    } catch (e) { setError(geoFenceMessage(e)); }
    finally { setLoading(false); setStatusMessage(null); }
  }

  async function resolveRequiredLocation(currentBranchId: string): Promise<GeoFenceLocationInput | undefined> {
    setStatusMessage("Checking your branch location...");
    const check = await post<GeoFenceCheckResponse>("/api/geofencing/check", {
      branchId: currentBranchId,
      action: "START_TABLE_SESSION",
    });

    if (check.allowed) return undefined;
    if (check.reason !== "LOCATION_REQUIRED") {
      throw new Error(messageForGeoFenceReason(check.reason));
    }

    const location = await requestBrowserLocation();
    setStatusMessage("Checking your branch location...");
    return location;
  }

  function requestBrowserLocation(): Promise<GeoFenceLocationInput> {
    if (!("geolocation" in navigator)) {
      return Promise.reject(new Error("This branch requires location verification to start a table session. Please enable location permission and try again."));
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
          });
        },
        () => reject(new Error("This branch requires location verification to start a table session. Please enable location permission and try again.")),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
      );
    });
  }

  function geoFenceMessage(error: unknown) {
    if (error instanceof ApiError && typeof error.body === "object" && error.body) {
      const body = error.body as { code?: string; message?: string };
      if (body.code === "GEOFENCE_OUTSIDE_RADIUS") {
        return "You appear to be outside this restaurant's ordering area. Please scan the QR code while inside the branch.";
      }
      if (body.code === "GEOFENCE_LOCATION_REQUIRED") {
        return "This branch requires location verification to start a table session. Please enable location permission and try again.";
      }
      if (body.code === "GEOFENCE_LOCATION_LOW_ACCURACY" || body.code === "GEOFENCE_UNAVAILABLE") {
        return "We could not confirm your location accurately. Please try again closer to the branch.";
      }
      if (body.code === "GEOFENCE_INVALID_LOCATION") {
        return "We could not confirm your location accurately. Please try again closer to the branch.";
      }
      if (typeof body.message === "string") return messageForGeoFenceReason(body.message);
    }
    if (error instanceof Error) return error.message;
    return "Failed to start session";
  }

  function messageForGeoFenceReason(reason: string) {
    if (reason === "OUTSIDE_RADIUS") {
      return "You appear to be outside this restaurant's ordering area. Please scan the QR code while inside the branch.";
    }
    if (reason === "LOCATION_REQUIRED") {
      return "This branch requires location verification to start a table session. Please enable location permission and try again.";
    }
    if (reason === "LOW_ACCURACY" || reason === "BRANCH_LOCATION_UNAVAILABLE") {
      return "We could not confirm your location accurately. Please try again closer to the branch.";
    }
    return reason;
  }

  if (resolving) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center" style={{ background: "var(--ink-50)" }}>
        <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: COPPER_SOFT }}>
          <div className="h-5 w-5 animate-spin rounded-full" style={{ border: `2px solid ${COPPER_EDGE}`, borderTopColor: COPPER }} />
        </div>
        <p className="mt-3 text-[12px]" style={{ color: "var(--ink-500)" }}>Finding your table...</p>
      </main>
    );
  }

  if (!branchId) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5" style={{ background: "var(--ink-50)" }}>
        <div className="w-full max-w-sm rounded-[16px] p-6 text-center" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>
            <svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          </div>
          <h1 className="mt-4 font-serif text-[20px] font-extrabold" style={{ color: "var(--ink-900)" }}>Couldn&apos;t find your table</h1>
          <p className="mt-1.5 text-[12px]" style={{ color: "var(--ink-500)" }}>{error ?? "Please scan a valid table QR code or enter a branch code."}</p>
          <button onClick={() => router.push("/customer")} className="mt-5 w-full rounded-[12px] py-3 text-[12px] font-semibold text-white" style={{ background: COPPER }}>Back to check-in</button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col" style={{ background: "var(--ink-50)" }}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-6 pt-7 relative">
        <button onClick={() => router.push("/customer")} aria-label="Back" className="absolute left-5 top-7 flex h-10 w-10 items-center justify-center rounded-[12px] transition active:scale-[0.98]" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--ink-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>

        {/* Brand */}
        <div className="text-center">
          <Cloche size={36} color={COPPER} />
          <h1 className="mt-1.5 font-serif text-[15px] font-semibold tracking-[0.22em]" style={{ color: "var(--ink-900)" }}>TASTE HOUSE</h1>
          <p className="mt-0.5 font-serif text-[8px] font-medium tracking-[0.3em]" style={{ color: COPPER }}>CAFÉ &middot; KITCHEN</p>
        </div>

        {/* Heading */}
        <div className="mt-6 text-center">
          <h2 className="inline-flex items-center gap-1 font-serif text-[30px] font-extrabold leading-tight" style={{ color: "var(--ink-900)" }}>
            You&apos;re all set
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={COPPER} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3l1.91 5.84L20 11l-6.09 2.16L12 19l-1.91-5.84L4 11l6.09-2.16z" />
              <path d="M19 3v4M21 5h-4" />
            </svg>
          </h2>
          <p className="mt-1.5 text-[12px] leading-snug" style={{ color: "var(--ink-500)" }}>We found your table. Let&apos;s start<br />your ordering session.</p>
        </div>

        {/* Branch + Table card */}
        <div className="mt-5 rounded-[16px] overflow-hidden" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full" style={{ background: COPPER_SOFT, color: COPPER }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-6 9 6v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px]" style={{ color: "var(--ink-500)" }}>Branch</div>
              <div className="text-[14px] font-semibold leading-tight truncate" style={{ color: "var(--ink-900)" }}>{branchName ?? "Loading..."}</div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid var(--ink-200)" }} />
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full" style={{ background: COPPER_SOFT, color: COPPER }}>
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M5 7v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V7" /><path d="M5 7h14" /><line x1="8" y1="20" x2="8" y2="16" /><line x1="16" y1="20" x2="16" y2="16" /></svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px]" style={{ color: "var(--ink-500)" }}>Table</div>
              <div className="text-[14px] font-semibold leading-tight" style={{ color: "var(--ink-900)" }}>{tableCode || "Choose a table"}</div>
            </div>
            <span className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: tableCode ? "var(--ok-soft)" : COPPER_SOFT, color: tableCode ? OK_DARK : COPPER_INK, border: tableCode ? "1px solid #bbf7d0" : `1px solid ${COPPER_EDGE}` }}>
              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
              {tableCode ? "Table Selected" : "Select Table"}
            </span>
          </div>
        </div>

        {/* Table selector */}
        <div className="mt-5">
          <h3 className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>Which table are you at?</h3>
          {loadingTables ? (
            <div className="mt-3 rounded-[12px] p-3 text-[11px]" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)", color: "var(--ink-500)" }}>
              Loading tables...
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(branchTables?.tables ?? []).map((table) => {
                const selected = tableCode === table.tableCode;
                const disabled = table.status !== "AVAILABLE" && table.status !== "RESERVED";
                return (
                  <button
                    key={table.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => { setTableCode(table.tableCode); setError(null); }}
                    className="min-h-[74px] rounded-[12px] px-2.5 py-2 text-left transition disabled:opacity-45 active:scale-[0.98]"
                    style={{
                      background: selected ? COPPER : "var(--ink-0)",
                      color: selected ? "#fff" : "var(--ink-800)",
                      border: `1.5px solid ${selected ? COPPER : "var(--ink-200)"}`,
                    }}
                  >
                    <div className="text-[14px] font-bold leading-tight">{table.tableCode}</div>
                    <div className="mt-1 text-[10px]" style={{ color: selected ? "#fff7ed" : "var(--ink-500)" }}>
                      {table.capacity} seats
                    </div>
                    <div className="mt-1 text-[9px] font-semibold uppercase" style={{ color: selected ? "#fff7ed" : disabled ? "var(--bad)" : OK_DARK }}>
                      {table.status.replace(/_/g, " ")}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {!loadingTables && branchTables?.tables.length === 0 && (
            <div className="mt-3 rounded-[12px] p-3 text-[11px]" style={{ background: "var(--bad-soft)", border: "1px solid #fecaca", color: "var(--bad)" }}>
              No tables are configured for this branch yet.
            </div>
          )}
        </div>

        {/* Guest count */}
        <div className="mt-6">
          <h3 className="text-[14px] font-semibold" style={{ color: "var(--ink-900)" }}>How many guests are joining?</h3>
          <div className="mt-3 grid grid-cols-8 gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
              const selected = guestCount === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setGuestCount(n)}
                  className="aspect-square rounded-[10px] font-serif text-[16px] font-extrabold transition"
                  style={{
                    background: selected ? COPPER : "var(--ink-0)",
                    color: selected ? "#fff" : "var(--ink-700)",
                    border: `1.5px solid ${selected ? COPPER : "var(--ink-200)"}`,
                  }}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        {/* Update hint */}
        <button
          type="button"
          className="mt-3.5 flex items-center gap-2.5 rounded-[12px] p-3 text-left"
          style={{ background: COPPER_SOFT, border: `1px solid ${COPPER_EDGE}` }}
        >
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ background: COPPER_EDGE, color: COPPER_INK }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold" style={{ color: COPPER_INK }}>You can update guest count later</div>
            <div className="mt-0.5 text-[10px] leading-snug" style={{ color: "#9a6210" }}>You can adjust the guest count anytime during your session.</div>
          </div>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={COPPER_INK} strokeWidth={2.5} strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>

        {error && (
          <div className="mt-3 rounded-[10px] px-3 py-2 text-[11px]" style={{ background: "var(--bad-soft)", border: "1px solid #fecaca", color: "var(--bad)" }}>{error}</div>
        )}

        {statusMessage && !error && (
          <div className="mt-3 rounded-[10px] px-3 py-2 text-[11px]" style={{ background: "var(--ok-soft)", border: "1px solid #bbf7d0", color: OK_DARK }}>{statusMessage}</div>
        )}

        {/* Start session */}
        <button
          onClick={handleStart}
          disabled={loading || !tableCode}
          className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-[14px] py-4 text-[14px] font-semibold text-white transition disabled:opacity-50 active:scale-[0.98]"
          style={{ background: COPPER, boxShadow: `0 12px 28px -8px rgba(194,132,29,0.55)` }}
        >
          {loading ? (statusMessage ?? "Starting...") : !tableCode ? "Choose a Table" : (
            <>
              Start Session
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
            </>
          )}
        </button>

        {/* Change Table */}
        <button onClick={() => router.push("/customer")} className="mt-3 text-center text-[12px] font-semibold underline underline-offset-[3px]" style={{ color: COPPER }}>
          Change Table
        </button>

        {/* Feature chips */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            { label: "Fast Ordering", sub: "Quick & easy ordering at your table", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M12 14l4-4M12 6v8" /><circle cx="12" cy="12" r="10" /><path d="M12 2v2M12 22v-2M2 12h2M22 12h-2" /></svg>, color: COPPER, soft: COPPER_SOFT },
            { label: "Live Service", sub: "Our team is here when you need us", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M3 11h18M5 11a7 7 0 0 1 14 0M12 4v3M2 18h20" /></svg>, color: COPPER, soft: COPPER_SOFT },
            { label: "Secure Session", sub: "Your data is safe and protected", icon: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 11 12 14 16 9" /></svg>, color: OK, soft: "var(--ok-soft)" },
          ].map(c => (
            <div key={c.label} className="flex flex-col items-center gap-1.5 rounded-[12px] px-2 py-3 text-center" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: c.soft, color: c.color }}>{c.icon}</span>
              <span className="text-[10.5px] font-semibold leading-tight" style={{ color: "var(--ink-700)" }}>{c.label}</span>
              <span className="text-[8.5px] leading-tight" style={{ color: "var(--ink-400)" }}>{c.sub}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function StartPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center" style={{ background: "var(--ink-50)" }}><div className="h-6 w-6 animate-spin rounded-full" style={{ border: `2px solid var(--ink-200)`, borderTopColor: COPPER }} /></div>}>
      <StartSessionInner />
    </Suspense>
  );
}
