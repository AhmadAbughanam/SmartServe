export type InsightCategory = 'SALES' | 'MENU' | 'KITCHEN' | 'INVENTORY' | 'REVIEWS' | 'OPERATIONS';
export type InsightPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type InsightConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export interface BusinessInsightSourceMetadata {
  sourceMetrics: string[];
  currentValue?: string | number;
  previousValue?: string | number;
  threshold?: string | number;
  triggerRule: string;
  confidence: InsightConfidence;
  affectedBranchIds?: string[];
}

export interface BusinessInsight {
  id: string; // Unique identifier for the generated insight
  category: InsightCategory;
  priority: InsightPriority;
  title: string;
  description: string;
  recommendedAction?: string;
  metricValue?: string; // Optional raw metric to display (e.g., "25 mins", "-12%")
  sourceMetadata?: BusinessInsightSourceMetadata;
}

export interface BusinessInsightsRequest {
  branchId?: string; // If omitted, requests a tenant-wide summary (if allowed)
}

export interface BusinessInsightsResponse {
  insights: BusinessInsight[];
  generatedAt: string; // ISO timestamp
  scope: 'BRANCH' | 'TENANT';
  branchId?: string;
  from: string;
  to: string;
  summary: string;
  aiFallbackMessage?: string;
}
