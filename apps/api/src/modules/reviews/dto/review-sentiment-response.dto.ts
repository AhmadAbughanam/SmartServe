import type {
  ReviewAffectedItem,
  ReviewCommonIssue,
  ReviewItemComplaintTimeline,
  ReviewOperationalCorrelations,
  ReviewActionSuggestion,
  ReviewSentimentAlert,
  ReviewSentiment,
  ReviewSentimentResponse,
  ReviewSentimentTrend,
} from "@smart-restaurant/shared-types";

export class ReviewSentimentResponseDto implements ReviewSentimentResponse {
  branchId!: string;
  from!: string;
  to!: string;
  totalReviews!: number;
  averageRating!: number;
  sentiment!: ReviewSentiment;
  summary!: string;
  commonIssues!: ReviewCommonIssue[];
  affectedItems!: ReviewAffectedItem[];
  trend!: ReviewSentimentTrend;
  alerts!: ReviewSentimentAlert[];
  itemTimelines!: ReviewItemComplaintTimeline[];
  operationalCorrelations!: ReviewOperationalCorrelations;
  actionSuggestions!: ReviewActionSuggestion[];
}
