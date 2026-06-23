"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { DemandForecastResponse } from "@smart-restaurant/shared-types";
import { authGet, get } from "../../../lib/api";
import type { MenuCategory } from "../../../lib/types";
import { InlineAlert } from "../../ui";

const sv = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function tomorrowDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function confidenceStyle(confidence: string) {
  if (confidence === "HIGH") return { background: "var(--ok-soft)", color: "var(--ok)", border: "1px solid #bbf7d0" };
  if (confidence === "MEDIUM") return { background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" };
  return { background: "var(--bad-soft)", color: "var(--bad)", border: "1px solid #fecaca" };
}

function warningStyle(severity: string) {
  if (severity === "HIGH") return { background: "var(--bad-soft)", color: "var(--bad)", border: "1px solid #fecaca" };
  if (severity === "MEDIUM") return { background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" };
  return { background: "var(--ink-100)", color: "var(--ink-600)", border: "1px solid var(--ink-200)" };
}

export function DemandForecastPanel({
  branchId,
}: {
  branchId: string;
}) {
  const [date, setDate] = useState(tomorrowDate);
  const [categoryId, setCategoryId] = useState("");
  const [kitchenStationId, setKitchenStationId] = useState("");
  const [lookbackDays, setLookbackDays] = useState(30);
  const [weatherAdjustment, setWeatherAdjustment] = useState<number | "">("");
  const [eventAdjustment, setEventAdjustment] = useState<number | "">("");

  const { data: categories } = useQuery({
    queryKey: ["forecast-categories", branchId],
    queryFn: () => get<MenuCategory[]>(`/api/menu?branchId=${branchId}`),
    enabled: !!branchId,
  });

  const { data: stations } = useQuery({
    queryKey: ["forecast-stations", branchId],
    queryFn: () => authGet<{ id: string; name: string }[]>(`/api/kds/stations?branchId=${branchId}`),
    enabled: !!branchId,
  });

  const forecastQuery = useMemo(() => {
    const params = new URLSearchParams({
      branchId,
      date,
      lookbackDays: String(lookbackDays),
    });
    if (categoryId) params.set("categoryId", categoryId);
    if (kitchenStationId) params.set("kitchenStationId", kitchenStationId);
    if (weatherAdjustment) params.set("weatherAdjustment", String(weatherAdjustment));
    if (eventAdjustment) params.set("eventAdjustment", String(eventAdjustment));
    return `/api/admin/ai/demand-forecast?${params.toString()}`;
  }, [branchId, categoryId, kitchenStationId, date, lookbackDays, weatherAdjustment, eventAdjustment]);

  const {
    data: forecast,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["demand-forecast", branchId, date, categoryId, kitchenStationId, lookbackDays, weatherAdjustment, eventAdjustment],
    queryFn: () => authGet<DemandForecastResponse>(forecastQuery),
    enabled: !!branchId && !!date,
  });

  const peakHour = forecast?.hourlyDemand.reduce(
    (best, slot) => (!best || slot.expectedOrders > best.expectedOrders ? slot : best),
    null as null | { hour: number; expectedOrders: number },
  );
  const topItem = forecast?.items[0];

  return (
    <section className="mb-5 rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-edge)", color: "var(--accent)" }}>
              <svg {...sv}><path d="M3 3v18h18" /><path d="M7 14l3-3 3 2 5-6" /></svg>
            </div>
            <h2 className="font-serif text-[15px] font-bold" style={{ color: "var(--ink-900)" }}>
              Demand <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Forecast</em>
            </h2>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-6">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
            style={{ border: "1px solid var(--ink-200)", background: "var(--ink-0)", color: "var(--ink-900)" }}
          />
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className="rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
            style={{ border: "1px solid var(--ink-200)", background: "var(--ink-0)", color: "var(--ink-900)" }}
          >
            <option value="">All categories</option>
            {(categories ?? []).map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <select
            value={kitchenStationId}
            onChange={(event) => setKitchenStationId(event.target.value)}
            className="rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
            style={{ border: "1px solid var(--ink-200)", background: "var(--ink-0)", color: "var(--ink-900)" }}
          >
            <option value="">All stations</option>
            {(stations ?? []).map((station) => (
              <option key={station.id} value={station.id}>{station.name}</option>
            ))}
          </select>
          <select
            value={lookbackDays}
            onChange={(event) => setLookbackDays(Number(event.target.value))}
            className="rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
            style={{ border: "1px solid var(--ink-200)", background: "var(--ink-0)", color: "var(--ink-900)" }}
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
          </select>
          <select
            value={weatherAdjustment}
            onChange={(event) => setWeatherAdjustment(event.target.value === "" ? "" : Number(event.target.value))}
            className="rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
            style={{ border: "1px solid var(--ink-200)", background: "var(--ink-0)", color: "var(--ink-900)" }}
          >
            <option value="">Normal Weather</option>
            <option value={1.2}>Good Weather (+20%)</option>
            <option value={0.8}>Bad Weather (-20%)</option>
            <option value={0.5}>Extreme Weather (-50%)</option>
          </select>
          <select
            value={eventAdjustment}
            onChange={(event) => setEventAdjustment(event.target.value === "" ? "" : Number(event.target.value))}
            className="rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
            style={{ border: "1px solid var(--ink-200)", background: "var(--ink-0)", color: "var(--ink-900)" }}
          >
            <option value="">No Special Event</option>
            <option value={1.3}>Local Event (+30%)</option>
            <option value={1.5}>Major Holiday (+50%)</option>
            <option value={0.7}>Competitor Promo (-30%)</option>
          </select>
        </div>
      </div>

      {isFetching && (
        <div className="rounded-[var(--r-md)] px-3 py-2 text-[12px]" style={{ background: "var(--ink-50)", color: "var(--ink-500)", border: "1px solid var(--ink-100)" }}>
          Loading forecast...
        </div>
      )}

      {error && (
        <div className="rounded-[var(--r-md)] px-3 py-2 text-[12px]" style={{ background: "var(--bad-soft)", color: "var(--bad)", border: "1px solid #fecaca" }}>
          Forecast unavailable.
        </div>
      )}

      {forecast && !error && (
        <>
          {forecast.summaryText && (
            <div className="mb-4 rounded-[var(--r-md)] p-3 text-[13px] font-medium" style={{ background: "var(--ink-50)", color: "var(--ink-800)", border: "1px solid var(--ink-200)" }}>
              {forecast.summaryText}
            </div>
          )}

          {forecast.aiFallbackMessage && (
            <InlineAlert tone="warning" title="AI narrative unavailable" className="mb-4">
              {forecast.aiFallbackMessage}
            </InlineAlert>
          )}

          {forecast.llmSummary && (
            <div className="mb-4 rounded-[var(--r-md)] p-3 text-[13px] font-medium" style={{ background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid var(--accent-edge)" }}>
              <div className="mb-1 font-mono text-[9px] uppercase tracking-widest opacity-80">
                AI Narrative Summary
              </div>
              {forecast.llmSummary}
            </div>
          )}

          {forecast.dataQualityWarnings.length > 0 && (
            <div className="mb-4 rounded-[var(--r-md)] p-3" style={{ background: "var(--ink-50)", color: "var(--ink-700)", border: "1px solid var(--ink-100)" }}>
              <div className="mb-2 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>
                Data quality warnings
              </div>
              <div className="grid gap-2">
                {forecast.dataQualityWarnings.map((warning) => (
                  <div key={`${warning.code}-${warning.message}`} className="flex flex-col gap-2 rounded-[var(--r-sm)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
                    <span className="text-[12px] font-semibold" style={{ color: "var(--ink-800)" }}>{warning.message}</span>
                    <span className="w-fit rounded-full px-2 py-1 font-mono text-[9px] font-bold" style={warningStyle(warning.severity)}>
                      {warning.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-4">
            {[
              { label: "Expected Orders", value: String(forecast.expectedOrders) },
              { label: "Expected Revenue", value: money(forecast.expectedRevenue) },
              { label: "Peak Hour", value: peakHour ? `${String(peakHour.hour).padStart(2, "0")}:00` : "N/A" },
              { label: "Top Item", value: topItem?.name ?? "N/A" },
            ].map((card) => (
              <div key={card.label} className="rounded-[var(--r-md)] p-3" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
                <div className="truncate font-serif text-[18px] font-extrabold" style={{ color: "var(--ink-900)" }}>{card.value}</div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>{card.label}</div>
              </div>
            ))}
          </div>

          {forecast.items.length === 0 ? (
            <div className="mt-4 rounded-[var(--r-md)] px-3 py-6 text-center text-[12px]" style={{ background: "var(--ink-50)", color: "var(--ink-500)", border: "1px solid var(--ink-100)" }}>
              No forecastable item history for this window.
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-4">
              {Array.from(new Set(forecast.items.map((i) => i.categoryName))).map((categoryName) => {
                const categoryItems = forecast.items.filter((i) => i.categoryName === categoryName);
                return (
                  <div key={categoryName} className="overflow-x-auto rounded-[var(--r-md)]" style={{ border: "1px solid var(--ink-200)" }}>
                    <div className="px-3 py-2 font-serif text-[14px] font-bold" style={{ background: "var(--ink-50)", borderBottom: "1px solid var(--ink-100)", color: "var(--ink-900)" }}>
                      {categoryName}
                    </div>
                    <table className="w-full min-w-[760px] text-left text-[12px]">
                      <thead style={{ background: "var(--ink-50)", color: "var(--ink-500)" }}>
                        <tr className="font-mono text-[9px] uppercase tracking-widest">
                          <th className="px-3 py-2">Item</th>
                          <th className="px-3 py-2 text-right">Expected Qty</th>
                          <th className="px-3 py-2 text-right">Expected Revenue</th>
                          <th className="px-3 py-2">Confidence</th>
                          <th className="px-3 py-2">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryItems.map((item) => (
                          <tr key={item.menuItemId} style={{ borderTop: "1px solid var(--ink-100)" }}>
                            <td className="px-3 py-2 font-semibold" style={{ color: "var(--ink-900)" }}>{item.name}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: "var(--ink-900)" }}>{item.expectedQuantity}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: "var(--accent)" }}>{money(item.expectedRevenue)}</td>
                            <td className="px-3 py-2">
                              <span className="rounded-full px-2 py-1 font-mono text-[9px] font-bold" style={confidenceStyle(item.confidence)}>
                                {item.confidence}
                              </span>
                            </td>
                            <td className="px-3 py-2" style={{ color: "var(--ink-500)" }}>{item.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}

          {forecast.ingredients && forecast.ingredients.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-[var(--r-md)]" style={{ border: "1px solid var(--ink-200)" }}>
              <div className="px-3 py-2 font-serif text-[14px] font-bold" style={{ background: "var(--ink-50)", borderBottom: "1px solid var(--ink-100)", color: "var(--ink-900)" }}>
                Ingredient Prep List
              </div>
              <table className="w-full min-w-[500px] text-left text-[12px]">
                <thead style={{ background: "var(--ink-50)", color: "var(--ink-500)" }}>
                  <tr className="font-mono text-[9px] uppercase tracking-widest">
                    <th className="px-3 py-2">Ingredient</th>
                    <th className="px-3 py-2">Unit</th>
                    <th className="px-3 py-2 text-right">Expected Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.ingredients.map((ing) => (
                    <tr key={ing.inventoryItemId} style={{ borderTop: "1px solid var(--ink-100)" }}>
                      <td className="px-3 py-2 font-semibold" style={{ color: "var(--ink-900)" }}>{ing.name}</td>
                      <td className="px-3 py-2" style={{ color: "var(--ink-600)" }}>{ing.unit}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: "var(--ink-900)" }}>{ing.expectedQuantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
