"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { ReviewSentimentResponse } from "@smart-restaurant/shared-types";
import { authGet, get } from "../../../lib/api";
import type { MenuCategory } from "../../../lib/types";

const sv = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function sentimentStyle(sentiment: string) {
  if (sentiment === "POSITIVE") return { background: "var(--ok-soft)", color: "var(--ok)", border: "1px solid #bbf7d0" };
  if (sentiment === "NEGATIVE") return { background: "var(--bad-soft)", color: "var(--bad)", border: "1px solid #fecaca" };
  if (sentiment === "MIXED") return { background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" };
  return { background: "var(--ink-100)", color: "var(--ink-600)", border: "1px solid var(--ink-200)" };
}

function severityStyle(severity: string) {
  if (severity === "HIGH") return { background: "var(--bad-soft)", color: "var(--bad)", border: "1px solid #fecaca" };
  if (severity === "MEDIUM") return { background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" };
  return { background: "var(--ink-100)", color: "var(--ink-600)", border: "1px solid var(--ink-200)" };
}

function alertStyle(severity: string) {
  if (severity === "HIGH") return { background: "var(--bad-soft)", color: "var(--bad)", border: "1px solid #fecaca" };
  return { background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" };
}

function trendStyle(direction: string) {
  if (direction === "IMPROVING") return { background: "var(--ok-soft)", color: "var(--ok)", border: "1px solid #bbf7d0" };
  if (direction === "DECLINING") return { background: "var(--bad-soft)", color: "var(--bad)", border: "1px solid #fecaca" };
  if (direction === "STABLE") return { background: "var(--ink-100)", color: "var(--ink-600)", border: "1px solid var(--ink-200)" };
  return { background: "var(--ink-50)", color: "var(--ink-500)", border: "1px solid var(--ink-100)" };
}

function itemTimelineStyle(direction: string) {
  if (direction === "WORSENING") return { background: "var(--bad-soft)", color: "var(--bad)", border: "1px solid #fecaca" };
  if (direction === "IMPROVING") return { background: "var(--ok-soft)", color: "var(--ok)", border: "1px solid #bbf7d0" };
  return { background: "var(--ink-100)", color: "var(--ink-600)", border: "1px solid var(--ink-200)" };
}

function ratingText(value: number) {
  return value > 0 ? value.toFixed(2) : "N/A";
}

function trendText(sentiment: ReviewSentimentResponse) {
  const trend = sentiment.trend;
  if (trend.direction === "NO_PRIOR_DATA") return "No prior data";
  const sign = trend.averageRatingDelta > 0 ? "+" : "";
  return `${sign}${trend.averageRatingDelta.toFixed(2)} rating`;
}

function minutesText(value: number | null) {
  return value === null ? "N/A" : `${value.toFixed(1)}m`;
}

export function ReviewSentimentPanel({
  branchId,
  token,
}: {
  branchId: string;
  token: string | null;
}) {
  const [from, setFrom] = useState(() => daysAgoDate(6));
  const [to, setTo] = useState(todayDate);
  const [menuItemId, setMenuItemId] = useState("");

  const { data: categories } = useQuery({
    queryKey: ["review-sentiment-menu", branchId],
    queryFn: () => get<MenuCategory[]>(`/api/menu?branchId=${branchId}`),
    enabled: !!branchId,
  });

  const menuItems = useMemo(
    () => (categories ?? []).flatMap((category) => category.menuItems ?? []),
    [categories],
  );

  const sentimentQuery = useMemo(() => {
    const params = new URLSearchParams({ branchId, from, to });
    if (menuItemId) params.set("menuItemId", menuItemId);
    return `/api/admin/ai/review-sentiment?${params.toString()}`;
  }, [branchId, from, menuItemId, to]);

  const {
    data: sentiment,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["review-sentiment", branchId, from, to, menuItemId],
    queryFn: () => authGet<ReviewSentimentResponse>(sentimentQuery, token!),
    enabled: !!token && !!branchId && !!from && !!to,
  });

  const topComplaint = sentiment?.commonIssues[0];

  return (
    <section data-testid="review-sentiment-panel" className="mb-5 rounded-[var(--r-lg)] p-5" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-edge)", color: "var(--accent)" }}>
              <svg {...sv}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 9h8M8 13h5" /></svg>
            </div>
            <h2 className="font-serif text-[15px] font-bold" style={{ color: "var(--ink-900)" }}>
              Review <em className="font-serif italic font-medium" style={{ color: "var(--accent)" }}>Sentiment</em>
            </h2>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <input
            data-testid="review-sentiment-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
            style={{ border: "1px solid var(--ink-200)", background: "var(--ink-0)", color: "var(--ink-900)" }}
          />
          <input
            data-testid="review-sentiment-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none"
            style={{ border: "1px solid var(--ink-200)", background: "var(--ink-0)", color: "var(--ink-900)" }}
          />
          <select
            data-testid="review-sentiment-menu-item"
            value={menuItemId}
            onChange={(event) => setMenuItemId(event.target.value)}
            className="rounded-[var(--r-md)] px-3 py-2 text-[12px] outline-none sm:col-span-2 xl:col-span-2"
            style={{ border: "1px solid var(--ink-200)", background: "var(--ink-0)", color: "var(--ink-900)" }}
          >
            <option value="">All menu items</option>
            {menuItems.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>
      </div>

      {isFetching && (
        <div data-testid="review-sentiment-loading" className="rounded-[var(--r-md)] px-3 py-2 text-[12px]" style={{ background: "var(--ink-50)", color: "var(--ink-500)", border: "1px solid var(--ink-100)" }}>
          Loading review sentiment...
        </div>
      )}

      {error && (
        <div data-testid="review-sentiment-error" className="rounded-[var(--r-md)] px-3 py-2 text-[12px]" style={{ background: "var(--bad-soft)", color: "var(--bad)", border: "1px solid #fecaca" }}>
          Review sentiment unavailable.
        </div>
      )}

      {sentiment && !error && (
        <>
          <div data-testid="review-sentiment-cards" className="grid gap-3 md:grid-cols-4">
            {[
              { label: "Total Reviews", value: String(sentiment.totalReviews) },
              { label: "Average Rating", value: ratingText(sentiment.averageRating) },
              { label: "Sentiment", value: sentiment.sentiment },
              { label: "Top Complaint", value: topComplaint?.issue ?? "None" },
              { label: "Rating Trend", value: trendText(sentiment) },
            ].map((card) => (
              <div key={card.label} className="rounded-[var(--r-md)] p-3" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
                <div className="truncate font-serif text-[18px] font-extrabold" style={{ color: "var(--ink-900)" }}>{card.value}</div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>{card.label}</div>
              </div>
            ))}
          </div>

          <div data-testid="review-sentiment-summary" className="mt-4 rounded-[var(--r-md)] p-4 text-[13px] leading-6" style={{ background: "var(--ink-50)", color: "var(--ink-700)", border: "1px solid var(--ink-100)" }}>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full px-2 py-1 font-mono text-[9px] font-bold" style={sentimentStyle(sentiment.sentiment)}>
                {sentiment.sentiment}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>
                {sentiment.from} to {sentiment.to}
              </span>
            </div>
            {sentiment.summary}
          </div>

          <div data-testid="review-sentiment-insight" className="mt-3 rounded-[var(--r-md)] px-3 py-2 text-[12px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)", border: "1px solid var(--accent-edge)" }}>
            Most common issue this period: {topComplaint?.issue ?? "none"}
          </div>

          <div data-testid="review-sentiment-action-suggestions" className="mt-3 rounded-[var(--r-md)] p-3" style={{ background: "var(--ink-50)", color: "var(--ink-700)", border: "1px solid var(--ink-100)" }}>
            <div className="mb-2 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>
              Suggested actions
            </div>
            {sentiment.actionSuggestions.length === 0 ? (
              <div className="text-[12px]" style={{ color: "var(--ink-500)" }}>No action suggestions for this period.</div>
            ) : (
              <div className="grid gap-2">
                {sentiment.actionSuggestions.map((suggestion) => (
                  <div key={suggestion.id} className="rounded-[var(--r-sm)] p-3" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
                    <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-[13px] font-bold" style={{ color: "var(--ink-900)" }}>{suggestion.title}</div>
                      <span className="w-fit rounded-full px-2 py-1 font-mono text-[9px] font-bold" style={severityStyle(suggestion.severity)}>
                        {suggestion.severity}
                      </span>
                    </div>
                    <div className="text-[12px] font-semibold" style={{ color: "var(--ink-800)" }}>{suggestion.action}</div>
                    <div className="mt-1 text-[11px]" style={{ color: "var(--ink-500)" }}>{suggestion.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div data-testid="review-sentiment-trend" className="mt-3 rounded-[var(--r-md)] px-3 py-2 text-[12px]" style={{ background: "var(--ink-50)", color: "var(--ink-700)", border: "1px solid var(--ink-100)" }}>
            <span className="mr-2 rounded-full px-2 py-1 font-mono text-[9px] font-bold" style={trendStyle(sentiment.trend.direction)}>
              {sentiment.trend.direction.replace(/_/g, " ")}
            </span>
            Previous period {sentiment.trend.previousFrom} to {sentiment.trend.previousTo}: {sentiment.trend.previousTotalReviews} reviews, average rating {ratingText(sentiment.trend.previousAverageRating)}.
            {sentiment.trend.topIssueChanged && (
              <span> Top issue changed from {sentiment.trend.previousTopIssue ?? "none"} to {sentiment.trend.currentTopIssue ?? "none"}.</span>
            )}
          </div>

          <div data-testid="review-sentiment-alerts" className="mt-3 rounded-[var(--r-md)] p-3" style={{ background: "var(--ink-50)", color: "var(--ink-700)", border: "1px solid var(--ink-100)" }}>
            <div className="mb-2 font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>
              Sentiment alerts
            </div>
            {sentiment.alerts.length === 0 ? (
              <div className="text-[12px]" style={{ color: "var(--ink-500)" }}>No complaint spikes detected.</div>
            ) : (
              <div className="grid gap-2">
                {sentiment.alerts.map((alert) => (
                  <div key={`${alert.type}-${alert.issue ?? alert.ratingDelta ?? alert.message}`} className="flex flex-col gap-2 rounded-[var(--r-sm)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
                    <span className="text-[12px] font-semibold" style={{ color: "var(--ink-800)" }}>{alert.message}</span>
                    <span className="w-fit rounded-full px-2 py-1 font-mono text-[9px] font-bold" style={alertStyle(alert.severity)}>
                      {alert.severity}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div data-testid="review-sentiment-item-timelines" className="mt-4 rounded-[var(--r-md)]" style={{ border: "1px solid var(--ink-200)" }}>
            <div className="px-3 py-2 font-mono text-[9px] uppercase tracking-widest" style={{ background: "var(--ink-50)", color: "var(--ink-500)", borderBottom: "1px solid var(--ink-200)" }}>
              Item complaint timelines
            </div>
            {sentiment.itemTimelines.length === 0 ? (
              <div className="px-3 py-6 text-center text-[12px]" style={{ color: "var(--ink-400)" }}>No item complaint timeline signals found.</div>
            ) : (
              <div className="grid gap-3 p-3">
                {sentiment.itemTimelines.map((item) => (
                  <div key={item.menuItemId} className="rounded-[var(--r-sm)] p-3" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-[13px] font-bold" style={{ color: "var(--ink-900)" }}>{item.name}</div>
                        <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>{item.totalIssueCount} issue signals</div>
                      </div>
                      <span className="w-fit rounded-full px-2 py-1 font-mono text-[9px] font-bold" style={itemTimelineStyle(item.direction)}>
                        {item.direction.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="grid gap-2 md:grid-cols-4">
                      {item.points.map((point) => (
                        <div key={`${item.menuItemId}-${point.from}`} className="rounded-[var(--r-sm)] px-2 py-2" style={{ background: "var(--ink-50)", border: "1px solid var(--ink-100)" }}>
                          <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>{point.from} to {point.to}</div>
                          <div className="mt-1 text-[12px] font-semibold" style={{ color: "var(--ink-900)" }}>{point.issueCount} issues</div>
                          <div className="text-[11px]" style={{ color: "var(--ink-600)" }}>{point.reviewCount} reviews, {ratingText(point.averageRating)} avg</div>
                          <div className="text-[11px] capitalize" style={{ color: "var(--ink-500)" }}>{point.topIssue ?? "No top issue"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div data-testid="review-sentiment-operational-correlations" className="mt-4 rounded-[var(--r-md)] p-3" style={{ background: "var(--ink-50)", color: "var(--ink-700)", border: "1px solid var(--ink-100)" }}>
            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>
                Operational correlation
              </div>
              <span className="w-fit rounded-full px-2 py-1 font-mono text-[9px] font-bold" style={trendStyle(sentiment.operationalCorrelations.signal === "KITCHEN_DELAY" || sentiment.operationalCorrelations.signal === "SERVICE_DELAY" || sentiment.operationalCorrelations.signal === "BOTH" ? "DECLINING" : "STABLE")}>
                {sentiment.operationalCorrelations.signal.replace(/_/g, " ")}
              </span>
            </div>
            <div className="text-[12px] font-semibold" style={{ color: "var(--ink-800)" }}>
              {sentiment.operationalCorrelations.summary}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Late Reviews", value: String(sentiment.operationalCorrelations.lateIssueReviewCount) },
                { label: "Kitchen Avg", value: minutesText(sentiment.operationalCorrelations.averageKitchenMinutes) },
                { label: "Late Kitchen Avg", value: minutesText(sentiment.operationalCorrelations.lateReviewsAverageKitchenMinutes) },
                { label: "Ready To Served", value: minutesText(sentiment.operationalCorrelations.lateReviewsAverageReadyToServedMinutes) },
                { label: "Service Requests", value: String(sentiment.operationalCorrelations.serviceRequestCount) },
              ].map((metric) => (
                <div key={metric.label} className="rounded-[var(--r-sm)] px-2 py-2" style={{ background: "var(--ink-0)", border: "1px solid var(--ink-200)" }}>
                  <div className="text-[13px] font-bold" style={{ color: "var(--ink-900)" }}>{metric.value}</div>
                  <div className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--ink-500)" }}>{metric.label}</div>
                </div>
              ))}
            </div>
          </div>

          {sentiment.totalReviews === 0 ? (
            <div data-testid="review-sentiment-empty" className="mt-4 rounded-[var(--r-md)] px-3 py-6 text-center text-[12px]" style={{ background: "var(--ink-50)", color: "var(--ink-500)", border: "1px solid var(--ink-100)" }}>
              No reviews were found for this branch and date range.
            </div>
          ) : (
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div data-testid="review-sentiment-common-issues" className="overflow-x-auto rounded-[var(--r-md)]" style={{ border: "1px solid var(--ink-200)" }}>
                <table className="w-full min-w-[420px] text-left text-[12px]">
                  <thead style={{ background: "var(--ink-50)", color: "var(--ink-500)" }}>
                    <tr className="font-mono text-[9px] uppercase tracking-widest">
                      <th className="px-3 py-2">Issue</th>
                      <th className="px-3 py-2 text-right">Count</th>
                      <th className="px-3 py-2">Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sentiment.commonIssues.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center" style={{ color: "var(--ink-400)" }}>No issue tags in this period.</td>
                      </tr>
                    ) : sentiment.commonIssues.map((issue) => (
                      <tr key={issue.issue} style={{ borderTop: "1px solid var(--ink-100)" }}>
                        <td className="px-3 py-2 font-semibold capitalize" style={{ color: "var(--ink-900)" }}>{issue.issue}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: "var(--ink-900)" }}>{issue.count}</td>
                        <td className="px-3 py-2">
                          <span className="rounded-full px-2 py-1 font-mono text-[9px] font-bold" style={severityStyle(issue.severity)}>
                            {issue.severity}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div data-testid="review-sentiment-affected-items" className="overflow-x-auto rounded-[var(--r-md)]" style={{ border: "1px solid var(--ink-200)" }}>
                <div className="px-3 py-2 font-mono text-[9px] uppercase tracking-widest" style={{ background: "var(--ink-50)", color: "var(--ink-500)", borderBottom: "1px solid var(--ink-200)" }}>
                  Repeated negative feedback by menu item
                </div>
                <table className="w-full min-w-[560px] text-left text-[12px]">
                  <thead style={{ background: "var(--ink-50)", color: "var(--ink-500)" }}>
                    <tr className="font-mono text-[9px] uppercase tracking-widest">
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Avg Rating</th>
                      <th className="px-3 py-2 text-right">Issue Count</th>
                      <th className="px-3 py-2">Top Issue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sentiment.affectedItems.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center" style={{ color: "var(--ink-400)" }}>No affected menu items found.</td>
                      </tr>
                    ) : sentiment.affectedItems.map((item) => (
                      <tr key={item.menuItemId} style={{ borderTop: "1px solid var(--ink-100)" }}>
                        <td className="px-3 py-2 font-semibold" style={{ color: "var(--ink-900)" }}>{item.name}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: "var(--ink-900)" }}>{ratingText(item.averageRating)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: "var(--bad)" }}>{item.issueCount}</td>
                        <td className="px-3 py-2 capitalize" style={{ color: "var(--ink-600)" }}>{item.topIssue ?? "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
