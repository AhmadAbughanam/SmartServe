export interface RecommendationRequest {
  tenantId: string;
  branchId: string;
  sessionId?: string;
  itemsInCart: string[];
}

export interface RecommendationResult {
  items: string[];
  rationale?: string;
}

export interface AiProvider {
  recommend(input: RecommendationRequest): Promise<RecommendationResult>;
}

