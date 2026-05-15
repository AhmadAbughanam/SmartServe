export type ReviewSentiment = "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MIXED";

export type ReviewIssueSeverity = "LOW" | "MEDIUM" | "HIGH";

export type ReviewSentimentTrendDirection =
  | "IMPROVING"
  | "DECLINING"
  | "STABLE"
  | "NO_PRIOR_DATA";

export type ReviewSentimentAlertType = "ISSUE_SPIKE" | "RATING_DECLINE";

export type ReviewSentimentAlertSeverity = "MEDIUM" | "HIGH";

export interface ReviewSentimentRequest {
  branchId: string;
  from: string;
  to: string;
  menuItemId?: string;
}

export interface ReviewCommonIssue {
  issue: string;
  count: number;
  severity: ReviewIssueSeverity;
}

export interface ReviewAffectedItem {
  menuItemId: string;
  name: string;
  averageRating: number;
  issueCount: number;
  topIssue?: string;
}

export interface ReviewSentimentTrend {
  previousFrom: string;
  previousTo: string;
  previousTotalReviews: number;
  previousAverageRating: number;
  averageRatingDelta: number;
  reviewCountDelta: number;
  currentTopIssue?: string;
  previousTopIssue?: string;
  topIssueChanged: boolean;
  direction: ReviewSentimentTrendDirection;
}

export interface ReviewSentimentAlert {
  type: ReviewSentimentAlertType;
  severity: ReviewSentimentAlertSeverity;
  message: string;
  issue?: string;
  currentCount?: number;
  previousCount?: number;
  countDelta?: number;
  ratingDelta?: number;
}

export type ReviewItemComplaintTimelineDirection =
  | "IMPROVING"
  | "WORSENING"
  | "STABLE"
  | "INSUFFICIENT_DATA";

export interface ReviewItemComplaintTimelinePoint {
  from: string;
  to: string;
  reviewCount: number;
  averageRating: number;
  issueCount: number;
  topIssue?: string;
}

export interface ReviewItemComplaintTimeline {
  menuItemId: string;
  name: string;
  totalIssueCount: number;
  direction: ReviewItemComplaintTimelineDirection;
  points: ReviewItemComplaintTimelinePoint[];
}

export type ReviewOperationalCorrelationSignal =
  | "KITCHEN_DELAY"
  | "SERVICE_DELAY"
  | "BOTH"
  | "NONE"
  | "INSUFFICIENT_DATA";

export interface ReviewOperationalCorrelations {
  reviewedOrderCount: number;
  lateIssueReviewCount: number;
  averageKitchenMinutes: number | null;
  lateReviewsAverageKitchenMinutes: number | null;
  averageReadyToServedMinutes: number | null;
  lateReviewsAverageReadyToServedMinutes: number | null;
  serviceRequestCount: number;
  lateReviewsServiceRequestCount: number;
  signal: ReviewOperationalCorrelationSignal;
  summary: string;
}

export type ReviewActionSuggestionSeverity = "LOW" | "MEDIUM" | "HIGH";

export interface ReviewActionSuggestion {
  id: string;
  title: string;
  action: string;
  reason: string;
  severity: ReviewActionSuggestionSeverity;
  relatedIssue?: string;
  menuItemId?: string;
  menuItemName?: string;
}

export interface ReviewSentimentResponse {
  branchId: string;
  from: string;
  to: string;
  totalReviews: number;
  averageRating: number;
  sentiment: ReviewSentiment;
  summary: string;
  aiFallbackMessage?: string;
  commonIssues: ReviewCommonIssue[];
  affectedItems: ReviewAffectedItem[];
  trend: ReviewSentimentTrend;
  alerts: ReviewSentimentAlert[];
  itemTimelines: ReviewItemComplaintTimeline[];
  operationalCorrelations: ReviewOperationalCorrelations;
  actionSuggestions: ReviewActionSuggestion[];
}
