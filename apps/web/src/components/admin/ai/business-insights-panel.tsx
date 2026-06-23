"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authGet } from "../../../lib/api";
import {
  BusinessInsightsResponse,
  InsightPriority,
} from "@smart-restaurant/shared-types";
import {
  Card,
  StatusPill,
  Spinner,
  ErrorDisplay,
  EmptyState,
  InlineAlert,
} from "../../ui";

interface BusinessInsightsPanelProps {
  branchId?: string; // If omitted, requests tenant-wide scope
}

const priorityStyles: Record<InsightPriority, string> = {
  HIGH: "border-l-4 border-[var(--brand-ember)]",
  MEDIUM: "border-l-4 border-amber-500",
  LOW: "border-l-4 border-blue-500",
};

export function BusinessInsightsPanel({ branchId }: BusinessInsightsPanelProps) {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const queryPath = useMemo(() => {
    const params = new URLSearchParams({ from, to });
    if (branchId) params.set("branchId", branchId);
    return `/api/admin/ai/business-insights?${params.toString()}`;
  }, [branchId, from, to]);

  const { data, isLoading, error, refetch } = useQuery<BusinessInsightsResponse>({
    queryKey: ["business-insights", branchId, from, to],
    queryFn: () => authGet<BusinessInsightsResponse>(queryPath),
    enabled: !!from && !!to,
    refetchInterval: 60000, // Auto-refresh every minute
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
        <div>
          <h2 className="text-xl font-black text-[var(--ink-900)]">
            Live Business Insights
          </h2>
          {data && (
            <span className="text-xs uppercase tracking-wider font-bold text-[var(--ink-500)] bg-[var(--sand-200)] px-2 py-1 rounded-md inline-block mt-2">
              Scope: {data.scope} | {data.from} to {data.to}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md px-3 py-1.5 text-sm border border-[var(--ink-200)] text-[var(--ink-900)]"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-md px-3 py-1.5 text-sm border border-[var(--ink-200)] text-[var(--ink-900)]"
          />
        </div>
      </div>

      {isLoading ? (
        <Card className="p-6 flex justify-center items-center min-h-[250px]">
          <Spinner size={24} />
        </Card>
      ) : error ? (
        <ErrorDisplay message="Failed to load business insights." onRetry={() => refetch()} />
      ) : !data || data.insights.length === 0 ? (
        <>
          {data?.aiFallbackMessage && (
            <InlineAlert tone="warning" title="AI summary unavailable" className="mb-3">
              {data.aiFallbackMessage}
            </InlineAlert>
          )}
          <EmptyState icon="*" title="You're all caught up!" description="No priority insights for this period." />
        </>
      ) : (
        <>
          {data.aiFallbackMessage && (
            <InlineAlert tone="warning" title="AI summary unavailable" className="mb-3">
              {data.aiFallbackMessage}
            </InlineAlert>
          )}
          {data.summary && (
            <div className="rounded-md p-3 text-sm text-[var(--ink-700)] bg-[var(--ink-50)] border border-[var(--ink-100)]">
              {data.summary}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4">
            {data.insights.map((insight) => (
              <Card key={insight.id} className={`p-4 ${priorityStyles[insight.priority]}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <StatusPill status={insight.category as any} />
                    <h3 className="font-bold text-[var(--ink-900)]">{insight.title}</h3>
                  </div>
                  {insight.metricValue && (
                    <span className="text-sm font-bold bg-[var(--sand-200)] px-2 py-1 rounded">
                      {insight.metricValue}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--ink-700)] mb-3">{insight.description}</p>
                {insight.recommendedAction && (
                  <div className="bg-[var(--brand-ember)]/10 p-3 rounded-md border border-[var(--brand-ember)]/20">
                    <span className="text-xs font-bold text-[var(--brand-ember)] uppercase tracking-wider block mb-1">
                      Recommended Action
                    </span>
                    <span className="text-sm text-[var(--ink-900)]">{insight.recommendedAction}</span>
                  </div>
                )}
                {insight.sourceMetadata && (
                  <div className="mt-3 grid gap-2 rounded-md border border-[var(--ink-100)] bg-[var(--ink-50)] p-3 text-xs text-[var(--ink-700)] md:grid-cols-2">
                    <div>
                      <span className="block font-mono text-[9px] uppercase tracking-widest text-[var(--ink-500)]">
                        Trigger
                      </span>
                      <span className="font-semibold text-[var(--ink-900)]">
                        {insight.sourceMetadata.triggerRule.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div>
                      <span className="block font-mono text-[9px] uppercase tracking-widest text-[var(--ink-500)]">
                        Confidence
                      </span>
                      <span className="font-semibold text-[var(--ink-900)]">
                        {insight.sourceMetadata.confidence}
                      </span>
                    </div>
                    <div>
                      <span className="block font-mono text-[9px] uppercase tracking-widest text-[var(--ink-500)]">
                        Current
                      </span>
                      <span className="font-semibold text-[var(--ink-900)]">
                        {insight.sourceMetadata.currentValue ?? "N/A"}
                      </span>
                    </div>
                    <div>
                      <span className="block font-mono text-[9px] uppercase tracking-widest text-[var(--ink-500)]">
                        Threshold
                      </span>
                      <span className="font-semibold text-[var(--ink-900)]">
                        {insight.sourceMetadata.threshold ?? "N/A"}
                      </span>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
