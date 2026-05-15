export const AI_FALLBACK_MESSAGE =
  "AI summary is temporarily unavailable, but analytics were generated successfully.";

export interface ValidatedBusinessInsightSummary {
  summary: string;
}

export interface ValidatedDemandForecastMlItem {
  menuItemId: string;
  expectedQuantity: number;
}

export interface ValidatedDemandForecastMlResponse {
  items: ValidatedDemandForecastMlItem[];
}

export function extractJsonObjectText(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

export function validateBusinessInsightSummaryPayload(
  value: unknown,
): ValidatedBusinessInsightSummary | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.summary !== "string") return null;

  const summary = record.summary.trim();
  if (!summary || summary.length > 600) return null;

  return { summary };
}

export function validateDemandForecastLlmSummaryPayload(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.summary !== "string") return null;

  const summary = record.summary.trim();
  if (!summary || summary.length > 400) return null;

  return summary;
}

export function validateReviewSentimentSummaryPayload(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.summary !== "string") return null;

  const summary = record.summary.trim();
  if (!summary || summary.length > 600) return null;

  return summary;
}

export function validateDemandForecastMlPayload(
  value: unknown,
): ValidatedDemandForecastMlResponse | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.items)) return null;

  const items: ValidatedDemandForecastMlItem[] = [];
  for (const item of record.items) {
    if (!item || typeof item !== "object") return null;
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.menuItemId !== "string" || !candidate.menuItemId.trim()) {
      return null;
    }
    if (typeof candidate.expectedQuantity !== "number" || !Number.isFinite(candidate.expectedQuantity)) {
      return null;
    }
    if (candidate.expectedQuantity < 0) return null;

    items.push({
      menuItemId: candidate.menuItemId,
      expectedQuantity: candidate.expectedQuantity,
    });
  }

  return { items };
}
