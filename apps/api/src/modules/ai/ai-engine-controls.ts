import type { Prisma } from "@prisma/client";

export type AiEngineMode = "rules" | "shadow" | "ml";

export interface FeatureAiEngineControls {
  engineMode: AiEngineMode;
  confidenceThreshold: number;
  timeoutMs: number;
  fallbackEnabled: boolean;
  modelFamily: string;
  modelVersionPin?: string;
}

export interface NormalizedAiEngineControls {
  recommendations: FeatureAiEngineControls;
  businessInsights: FeatureAiEngineControls;
  reviewSentiment: FeatureAiEngineControls;
}

type JsonRecord = Record<string, unknown>;

const DEFAULT_TIMEOUT_MS = 3500;

export function normalizeAiEngineControls(
  raw: Prisma.JsonValue | null | undefined,
): NormalizedAiEngineControls {
  const config =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as JsonRecord)
      : {};

  return {
    recommendations: {
      engineMode: normalizeMode(config.recommendationsEngine),
      confidenceThreshold: normalizeThreshold(config.recommendationsConfidenceThreshold, 0.55),
      timeoutMs: normalizeTimeout(config.recommendationsTimeoutMs),
      fallbackEnabled: normalizeBoolean(config.recommendationsFallbackEnabled, true),
      modelFamily: normalizeFamily(config.recommendationsModelFamily, "gradient_boosting_ranker_v1"),
      modelVersionPin: normalizeVersionPin(config.recommendationsModelVersionPin),
    },
    businessInsights: {
      engineMode: normalizeMode(config.businessInsightsEngine),
      confidenceThreshold: normalizeThreshold(config.businessInsightsConfidenceThreshold, 0.5),
      timeoutMs: normalizeTimeout(config.businessInsightsTimeoutMs),
      fallbackEnabled: normalizeBoolean(config.businessInsightsFallbackEnabled, true),
      modelFamily: normalizeFamily(config.businessInsightsModelFamily, "isolation_forest_v1"),
      modelVersionPin: normalizeVersionPin(config.businessInsightsModelVersionPin),
    },
    reviewSentiment: {
      engineMode: normalizeMode(config.reviewSentimentEngine),
      confidenceThreshold: normalizeThreshold(config.reviewSentimentConfidenceThreshold, 0.55),
      timeoutMs: normalizeTimeout(config.reviewSentimentTimeoutMs),
      fallbackEnabled: normalizeBoolean(config.reviewSentimentFallbackEnabled, true),
      modelFamily: normalizeFamily(config.reviewSentimentModelFamily, "tfidf_logreg_v1"),
      modelVersionPin: normalizeVersionPin(config.reviewSentimentModelVersionPin),
    },
  };
}

export function serializeAiEngineControls(
  base: JsonRecord,
  controls: NormalizedAiEngineControls,
): Prisma.InputJsonObject {
  return {
    ...base,
    recommendationsEngine: controls.recommendations.engineMode,
    recommendationsConfidenceThreshold: controls.recommendations.confidenceThreshold,
    recommendationsTimeoutMs: controls.recommendations.timeoutMs,
    recommendationsFallbackEnabled: controls.recommendations.fallbackEnabled,
    recommendationsModelFamily: controls.recommendations.modelFamily,
    recommendationsModelVersionPin: controls.recommendations.modelVersionPin ?? null,
    businessInsightsEngine: controls.businessInsights.engineMode,
    businessInsightsConfidenceThreshold: controls.businessInsights.confidenceThreshold,
    businessInsightsTimeoutMs: controls.businessInsights.timeoutMs,
    businessInsightsFallbackEnabled: controls.businessInsights.fallbackEnabled,
    businessInsightsModelFamily: controls.businessInsights.modelFamily,
    businessInsightsModelVersionPin: controls.businessInsights.modelVersionPin ?? null,
    reviewSentimentEngine: controls.reviewSentiment.engineMode,
    reviewSentimentConfidenceThreshold: controls.reviewSentiment.confidenceThreshold,
    reviewSentimentTimeoutMs: controls.reviewSentiment.timeoutMs,
    reviewSentimentFallbackEnabled: controls.reviewSentiment.fallbackEnabled,
    reviewSentimentModelFamily: controls.reviewSentiment.modelFamily,
    reviewSentimentModelVersionPin: controls.reviewSentiment.modelVersionPin ?? null,
  } as Prisma.InputJsonObject;
}

function normalizeMode(value: unknown): AiEngineMode {
  return value === "shadow" || value === "ml" ? value : "rules";
}

function normalizeThreshold(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(Math.max(value, 0), 1);
}

function normalizeTimeout(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.max(Math.floor(value), 750), 10_000);
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeFamily(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeVersionPin(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
