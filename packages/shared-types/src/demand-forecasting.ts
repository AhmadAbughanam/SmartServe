export type ForecastConfidence = "LOW" | "MEDIUM" | "HIGH";

export interface DemandForecastRequest {
  branchId: string;
  date: string;
  categoryId?: string;
  kitchenStationId?: string;
  lookbackDays?: number;
  weatherAdjustment?: number;
  eventAdjustment?: number;
}

export interface DemandForecastItem {
  menuItemId: string;
  name: string;
  categoryName: string;
  expectedQuantity: number;
  expectedRevenue: number;
  confidence: ForecastConfidence;
  reason: string;
  sampleMode?: "SAME_WEEKDAY" | "RECENT_DAYS";
  quantitySold?: number;
  sampleDays?: number;
  sameWeekdaySalesDays?: number;
  priceUsed?: number;
  confidenceReason?: string;
}

export interface HourlyDemandForecast {
  hour: number;
  expectedOrders: number;
}

export interface IngredientForecast {
  inventoryItemId: string;
  name: string;
  unit: string;
  expectedQuantity: number;
}

export type DemandForecastWarningSeverity = "LOW" | "MEDIUM" | "HIGH";

export interface DemandForecastDataQualityWarning {
  code:
    | "LOW_SAMPLE_SIZE"
    | "SPARSE_HISTORY"
    | "NO_FORECASTABLE_ITEMS"
    | "ADJUSTMENT_FACTOR_APPLIED"
    | "FALLBACK_MODEL_USED";
  severity: DemandForecastWarningSeverity;
  message: string;
}

export interface DemandForecastResponse {
  branchId: string;
  forecastDate: string;
  lookbackDays: number;
  expectedOrders: number;
  expectedRevenue: number;
  summaryText?: string;
  llmSummary?: string;
  aiFallbackMessage?: string;
  items: DemandForecastItem[];
  hourlyDemand: HourlyDemandForecast[];
  ingredients: IngredientForecast[];
  dataQualityWarnings: DemandForecastDataQualityWarning[];
}
