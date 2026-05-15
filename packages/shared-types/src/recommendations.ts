export const recommendationTypes = [
  "POPULAR",
  "FREQUENTLY_BOUGHT",
  "REORDER",
  "TIME_BASED",
  "AVAILABLE",
] as const;

export type RecommendationType = (typeof recommendationTypes)[number];

export interface CartItemInput {
  menuItemId: string;
  quantity: number;
}

export interface MenuRecommendationRequest {
  tenantId?: string;
  branchId: string;
  userId?: string;
  sessionId?: string;
  cartItems: CartItemInput[];
  limit?: number;
  surface?: "menu_home" | "cart" | "item_detail" | "checkout";
  trigger?: "empty_cart" | "cart_aware" | "no_history_fallback";
}

export interface RecommendationMetadata {
  strategySource: string;
  historicalSalesCount?: number;
  coPurchaseCount?: number;
  timeOfDaySignal?: string;
  reorderSignal?: number;
  scoreContributionPerStrategy?: Record<string, number>;
}

export interface MenuRecommendationItem {
  menuItemId: string;
  name: string;
  reason: string;
  score: number;
  type: RecommendationType;
  metadata: RecommendationMetadata;
}

export interface MenuRecommendationResponse {
  recommendations: MenuRecommendationItem[];
}
