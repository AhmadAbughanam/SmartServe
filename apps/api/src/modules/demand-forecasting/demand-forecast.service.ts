import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  OrderPaymentStatus,
  OrderStatus,
  PaymentStatus,
  type Prisma,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import type {
  DemandForecastDataQualityWarning,
  DemandForecastItem,
  DemandForecastResponse,
  ForecastConfidence,
  HourlyDemandForecast,
  IngredientForecast,
} from "@smart-restaurant/shared-types";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";
import type { DemandForecastQueryDto } from "./dto/demand-forecast-query.dto.js";
import { DemandForecastLlmService } from "./demand-forecast-llm.service.js";
import {
  AI_FALLBACK_MESSAGE,
  validateDemandForecastMlPayload,
} from "../ai/ai-output-validation.js";

const DEFAULT_LOOKBACK_DAYS = 30;
const FORECAST_SOURCE = "DEMAND_FORECASTING_ENGINE_MVP";

const FULL_WEEKDAY_NAMES: Record<string, string> = {
  Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday",
  Thu: "Thursday", Fri: "Friday", Sat: "Saturday"
};

type MinimalOrder = {
  id: string;
  orderDateTime: Date;
  orderItems: { menuItemId: string; quantity: number }[];
  statusHistory: { toStatus: OrderStatus; changedAt: Date }[];
  payments: { paymentStatus: PaymentStatus; paymentDate: Date }[];
};

@Injectable()
export class DemandForecastService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DemandForecastLlmService)
    private readonly llmService: DemandForecastLlmService,
  ) {}

  async getDemandForecast(
    query: DemandForecastQueryDto,
    staff: AuthenticatedStaff,
  ): Promise<DemandForecastResponse> {
    const lookbackDays = normalizeLookbackDays(query.lookbackDays);
    const targetDateStr = query.date;

    const branch = await this.prisma.branch.findUnique({
      where: { id: query.branchId },
      select: { id: true, tenantId: true, timezone: true },
    });
    if (!branch) throw new NotFoundException("Branch not found");
    this.assertStaffCanForecastBranch(staff, branch.tenantId, branch.id);

    const timeZone = branch.timezone || "UTC";

    const [targetYear, targetMonth, targetDay] = targetDateStr.split("-").map(Number);
    const targetDateUtc = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, 12, 0, 0));
    const targetWeekdayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][targetDateUtc.getUTCDay()];
    const targetWeekdayName = FULL_WEEKDAY_NAMES[targetWeekdayShort];

    const lookbackStartUtcApprox = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay - lookbackDays - 2));
    const targetStartUtcApprox = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay + 2));

    if (query.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: query.categoryId,
          tenantId: branch.tenantId,
          OR: [{ branchId: branch.id }, { branchId: null }],
        },
        select: { id: true },
      });
      if (!category) throw new NotFoundException("Category not found");
    }

    if (query.kitchenStationId) {
      const station = await this.prisma.kitchenStation.findFirst({
        where: {
          id: query.kitchenStationId,
          tenantId: branch.tenantId,
          branchId: branch.id,
        },
        select: { id: true },
      });
      if (!station) throw new NotFoundException("Kitchen station not found");
    }

    const menuItems = await this.prisma.menuItem.findMany({
      where: {
        tenantId: branch.tenantId,
        isActive: true,
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.kitchenStationId ? { defaultStationId: query.kitchenStationId } : {}),
        OR: [{ branchId: branch.id }, { branchId: null }]
      },
      select: {
        id: true,
        name: true,
        price: true,
        category: { select: { name: true } },
        inventoryLinks: {
          select: {
            qtyPerItem: true,
            inventoryItem: {
              select: { id: true, name: true, unit: true }
            }
          }
        }
      }
    });
    const menuItemsMap = new Map(menuItems.map(item => [item.id, item]));

    const rawOrders = await this.prisma.order.findMany({
      where: {
        tenantId: branch.tenantId,
        branchId: branch.id,
        orderDateTime: { gte: lookbackStartUtcApprox, lt: targetStartUtcApprox },
        orderStatus: { not: OrderStatus.CANCELLED },
        paymentStatus: { not: OrderPaymentStatus.REFUNDED },
        OR: [
          { orderStatus: { in: [OrderStatus.SERVED, OrderStatus.COMPLETED] } },
          { paymentStatus: OrderPaymentStatus.PAID },
        ],
      },
      select: {
        id: true,
        orderDateTime: true,
        orderItems: { select: { menuItemId: true, quantity: true } },
        statusHistory: {
          where: { toStatus: { in: [OrderStatus.COMPLETED, OrderStatus.SERVED] } },
          select: { toStatus: true, changedAt: true },
          orderBy: { changedAt: "desc" },
        },
        payments: {
          where: { paymentStatus: PaymentStatus.COMPLETED },
          select: { paymentStatus: true, paymentDate: true },
          orderBy: { paymentDate: "desc" },
        },
      },
      orderBy: { orderDateTime: "asc" },
    });

    const validLookbackDayKeys = new Set<string>();
    for (let i = 1; i <= lookbackDays; i++) {
      const d = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay - i, 12, 0, 0));
      validLookbackDayKeys.add(d.toISOString().slice(0, 10));
    }

    const orders: MinimalOrder[] = [];
    for (const order of rawOrders) {
      const ts = selectForecastTimestamp(order);
      const dateKey = getZonedDateKey(ts, timeZone);
      if (validLookbackDayKeys.has(dateKey)) {
        const validItems = order.orderItems.filter(oi => menuItemsMap.has(oi.menuItemId));
        if (validItems.length > 0) {
          orders.push({ ...order, orderItems: validItems });
        }
      }
    }

    const sameWeekdayOrders = orders.filter(order => {
      const ts = selectForecastTimestamp(order);
      return getZonedWeekdayShort(ts, timeZone) === targetWeekdayShort;
    });

    const sameWeekdayOrderDayKeys = new Set(
      sameWeekdayOrders.map(order => getZonedDateKey(selectForecastTimestamp(order), timeZone))
    );
    const recentOrderDayKeys = new Set(
      orders.map(order => getZonedDateKey(selectForecastTimestamp(order), timeZone))
    );

    const useSameWeekday = sameWeekdayOrderDayKeys.size >= 3;
    const forecastOrders = useSameWeekday ? sameWeekdayOrders : orders;
    const sampleDays = Math.max(
      1,
      useSameWeekday ? sameWeekdayOrderDayKeys.size : recentOrderDayKeys.size,
    );
    const confidenceSampleDays = sameWeekdayOrderDayKeys.size;
    const adjustmentFactor = (query.weatherAdjustment ?? 1.0) * (query.eventAdjustment ?? 1.0);
    
    let itemForecast: DemandForecastItem[];
    let fallbackModelUsed = false;
    try {
      itemForecast = await this.calculateItemsWithML(
        orders,
        targetDateStr,
        sampleDays,
        confidenceSampleDays,
        targetWeekdayName,
        lookbackDays,
        useSameWeekday,
        menuItemsMap,
        timeZone
      );
      // Ensure ML quantities apply the explicit adjustment factor
      if (adjustmentFactor !== 1.0) {
        for (const item of itemForecast) {
          item.expectedQuantity = Math.round(item.expectedQuantity * adjustmentFactor);
          item.expectedRevenue = roundMoney(item.expectedQuantity * (item.priceUsed ?? 0));
        }
      }
    } catch (err) {
      console.warn("ML demand forecast failed, falling back to MVP statistical method", err);
      fallbackModelUsed = true;
      itemForecast = this.calculateItems(
        forecastOrders,
        sampleDays,
        confidenceSampleDays,
        targetWeekdayName,
        lookbackDays,
        useSameWeekday,
        menuItemsMap as any,
        targetDateUtc,
        timeZone,
        adjustmentFactor,
      );
    }

    const expectedOrders = this.calculateExpectedOrders(forecastOrders, sampleDays, adjustmentFactor);
    const expectedRevenue = roundMoney(
      itemForecast.reduce((sum, item) => sum + item.expectedRevenue, 0),
    );
    const hourlyDemand = this.calculateHourlyDemand(forecastOrders, sampleDays, timeZone, adjustmentFactor);
    const dataQualityWarnings = buildDataQualityWarnings({
      adjustmentFactor,
      confidenceSampleDays,
      fallbackModelUsed,
      forecastItemCount: itemForecast.length,
      historicalOrderCount: forecastOrders.length,
      lookbackDays,
      sampleDays,
      useSameWeekday,
    });

    const expectedIngredients = new Map<string, IngredientForecast>();
    for (const item of itemForecast) {
      const mi = menuItemsMap.get(item.menuItemId);
      if (!mi || !mi.inventoryLinks) continue;
      for (const link of mi.inventoryLinks) {
        const inv = link.inventoryItem;
        const qtyNeeded = item.expectedQuantity * link.qtyPerItem.toNumber();
        if (qtyNeeded <= 0) continue;
        const existing = expectedIngredients.get(inv.id);
        if (existing) {
          existing.expectedQuantity += qtyNeeded;
        } else {
          expectedIngredients.set(inv.id, {
            inventoryItemId: inv.id,
            name: inv.name,
            unit: inv.unit,
            expectedQuantity: qtyNeeded,
          });
        }
      }
    }
    const ingredients = Array.from(expectedIngredients.values())
      .sort((a, b) => b.expectedQuantity - a.expectedQuantity)
      .map(i => ({ ...i, expectedQuantity: Math.round(i.expectedQuantity * 1000) / 1000 }));

    const peakHourSlot = hourlyDemand.reduce(
      (best, slot) => (!best || slot.expectedOrders > best.expectedOrders ? slot : best),
      null as null | HourlyDemandForecast,
    );

    const llmInput = {
      expectedOrders,
      expectedRevenue,
      peakHour: peakHourSlot ? peakHourSlot.hour : null,
      topItems: itemForecast.slice(0, 3).map(i => ({ name: i.name, quantity: i.expectedQuantity })),
      weatherAdjustment: query.weatherAdjustment ?? 1.0,
      eventAdjustment: query.eventAdjustment ?? 1.0,
    };

    const llmSummary = await this.llmService?.generateSummary(llmInput);
    const aiFallbackMessage = llmSummary ? undefined : AI_FALLBACK_MESSAGE;

    const response: DemandForecastResponse = {
      branchId: branch.id,
      forecastDate: query.date,
      lookbackDays,
      expectedOrders,
      expectedRevenue,
      summaryText: this.buildForecastSummary(expectedOrders, expectedRevenue, hourlyDemand, itemForecast),
      llmSummary: llmSummary ?? undefined,
      aiFallbackMessage,
      items: itemForecast,
      hourlyDemand,
      ingredients,
      dataQualityWarnings,
    };

    void this.writeAuditLog(response, {
      tenantId: branch.tenantId,
      requestedById: staff.staffId,
      categoryId: query.categoryId,
      forecastDate: targetDateUtc,
      sampleDays,
      sampleMode: useSameWeekday ? "SAME_WEEKDAY" : "ALL_RECENT_DAYS",
      historicalOrderCount: forecastOrders.length,
      fallbackModelUsed,
    });

    return response;
  }

  private buildForecastSummary(
    expectedOrders: number,
    expectedRevenue: number,
    hourlyDemand: HourlyDemandForecast[],
    itemForecast: DemandForecastItem[],
  ): string {
    const peakHourSlot = hourlyDemand.reduce(
      (best, slot) => (!best || slot.expectedOrders > best.expectedOrders ? slot : best),
      null as null | HourlyDemandForecast,
    );
    const topItem = itemForecast.length > 0 ? itemForecast[0] : null;

    let summary = `Expected to handle ${expectedOrders} orders generating $${expectedRevenue.toFixed(2)} in revenue.`;
    if (peakHourSlot) {
      const formattedHour = `${String(peakHourSlot.hour).padStart(2, "0")}:00`;
      summary += ` Peak hour is projected around ${formattedHour}.`;
    }
    if (topItem) {
      summary += ` Top expected item is ${topItem.name}.`;
    }
    return summary;
  }

  private assertStaffCanForecastBranch(
    staff: AuthenticatedStaff,
    branchTenantId: string,
    branchId: string,
  ) {
    if (staff.tenantId !== branchTenantId) {
      throw new ForbiddenException("Cannot forecast another tenant's branch");
    }

    const canSwitchBranch =
      staff.primaryRole === "OWNER" || staff.primaryRole === "MANAGER";
    if (!canSwitchBranch && staff.branchId !== branchId) {
      throw new ForbiddenException(
        "Branch-bound staff cannot forecast another branch",
      );
    }
  }

  private async calculateItemsWithML(
    orders: MinimalOrder[],
    targetDateStr: string,
    sampleDays: number,
    confidenceSampleDays: number,
    weekdayName: string,
    lookbackDays: number,
    sameWeekday: boolean,
    menuItemsMap: Map<string, any>,
    timeZone: string,
  ): Promise<DemandForecastItem[]> {
    const aiServiceUrl = process.env.AI_SERVICE_URL || "http://localhost:8000";
    
    // Group all order items into history by date per menuItemId
    const historyByItem = new Map<string, Map<string, number>>();
    
    for (const order of orders) {
      const ts = selectForecastTimestamp(order);
      const dateKey = getZonedDateKey(ts, timeZone);
      for (const item of order.orderItems) {
        if (!historyByItem.has(item.menuItemId)) {
          historyByItem.set(item.menuItemId, new Map());
        }
        const itemHistory = historyByItem.get(item.menuItemId)!;
        itemHistory.set(dateKey, (itemHistory.get(dateKey) ?? 0) + item.quantity);
      }
    }

    const mlItemsRequest = Array.from(historyByItem.entries()).map(([menuItemId, historyMap]) => ({
      menuItemId,
      history: Array.from(historyMap.entries()).map(([date, quantity]) => ({ date, quantity }))
    }));

    if (mlItemsRequest.length === 0) {
      return [];
    }

    const requestPayload = {
      targetDate: targetDateStr,
      items: mlItemsRequest,
      countryCode: "US"
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    let res: Response;
    try {
      res = await fetch(`${aiServiceUrl}/forecast/demand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      throw new Error(`ML service returned status ${res.status}`);
    }

    const data = await res.json() as unknown;
    const validated = validateDemandForecastMlPayload(data);
    if (!validated) {
      throw new Error("ML service returned invalid forecast shape");
    }

    const mlResults = validated.items;

    return mlResults
      .filter(ml => menuItemsMap.has(ml.menuItemId))
      .map(ml => {
        const mi = menuItemsMap.get(ml.menuItemId)!;
        const expectedQuantity = Math.round(ml.expectedQuantity);
        const priceUsed = mi.price.toNumber();
        const expectedRevenue = roundMoney(expectedQuantity * priceUsed);
        const confidence = confidenceForSampleDays(confidenceSampleDays);
        const quantitySold = Array.from(historyByItem.get(ml.menuItemId)?.values() ?? []).reduce((a, b) => a + b, 0);
        const reasonStr = buildForecastReason({
          confidence,
          confidenceSampleDays,
          expectedQuantity,
          lookbackDays,
          priceUsed,
          quantitySold,
          sameWeekday,
          sampleDays,
          weekdayName,
        }) + " (AI Optimized)";
        
        return {
          menuItemId: ml.menuItemId,
          name: mi.name,
          categoryName: mi.category?.name ?? "Uncategorized",
          expectedQuantity,
          expectedRevenue,
          confidence,
          reason: reasonStr,
          sampleMode: (sameWeekday ? "SAME_WEEKDAY" : "RECENT_DAYS") as "SAME_WEEKDAY" | "RECENT_DAYS",
          quantitySold,
          sampleDays,
          sameWeekdaySalesDays: confidenceSampleDays,
          priceUsed,
          confidenceReason: confidence === "HIGH" ? "Strong weekday sales history" : (confidence === "MEDIUM" ? "Moderate weekday sales history" : "Weak or insufficient weekday sales history"),
        };
      })
      .sort((a, b) => b.expectedQuantity - a.expectedQuantity);
  }

  private calculateItems(
    orders: MinimalOrder[],
    sampleDays: number,
    confidenceSampleDays: number,
    weekdayName: string,
    lookbackDays: number,
    sameWeekday: boolean,
    menuItemsMap: Map<string, { name: string; price: Decimal; category: { name: string } | null }>,
    targetDateUtc: Date,
    timeZone: string,
    adjustmentFactor: number,
  ): DemandForecastItem[] {
    const byItem = new Map<
      string,
      {
        name: string;
        categoryName: string;
        price: Decimal;
        rawQuantity: number;
        weightedQuantity: number;
      }
    >();

    const targetDateMs = targetDateUtc.getTime();
    
    // Calculate weights per day to normalize correctly
    const dayWeights = new Map<string, number>();
    for (const order of orders) {
      const ts = selectForecastTimestamp(order);
      const dateKey = getZonedDateKey(ts, timeZone);
      if (!dayWeights.has(dateKey)) {
        const daysAgo = Math.max(1, (targetDateMs - ts.getTime()) / (1000 * 60 * 60 * 24));
        // Linear decay: oldest day in lookback gets 0.5 weight, newest gets 1.0
        const weight = Math.max(0.5, 1.0 - (daysAgo / lookbackDays) * 0.5);
        dayWeights.set(dateKey, weight);
      }
    }
    
    const sumOfWeights = Array.from(dayWeights.values()).reduce((a, b) => a + b, 0);
    const weightNormalization = sumOfWeights > 0 ? (sampleDays / sumOfWeights) : 1;

    for (const order of orders) {
      const ts = selectForecastTimestamp(order);
      const dateKey = getZonedDateKey(ts, timeZone);
      const weight = (dayWeights.get(dateKey) ?? 1) * weightNormalization;

      for (const item of order.orderItems) {
        const mi = menuItemsMap.get(item.menuItemId);
        if (!mi) continue;
        const existing = byItem.get(item.menuItemId) ?? {
          name: mi.name,
          categoryName: mi.category?.name ?? "Uncategorized",
          price: mi.price,
          rawQuantity: 0,
          weightedQuantity: 0,
        };
        existing.rawQuantity += item.quantity;
        existing.weightedQuantity += item.quantity * weight;
        byItem.set(item.menuItemId, existing);
      }
    }

    return [...byItem.entries()]
      .map(([menuItemId, item]) => {
        const baseExpected = item.weightedQuantity / sampleDays;
        const expectedQuantity = Math.round(baseExpected * adjustmentFactor);
        const priceUsed = item.price.toNumber();
        const expectedRevenue = roundMoney(expectedQuantity * priceUsed);
        const confidence = confidenceForSampleDays(confidenceSampleDays);
        const reasonStr = buildForecastReason({
          confidence,
          confidenceSampleDays,
          expectedQuantity,
          lookbackDays,
          priceUsed,
          quantitySold: item.rawQuantity,
          sameWeekday,
          sampleDays,
          weekdayName,
        }) + (adjustmentFactor !== 1.0 ? ` (Adjusted by ${adjustmentFactor}x)` : "");

        return {
          menuItemId,
          name: item.name,
          categoryName: item.categoryName,
          expectedQuantity,
          expectedRevenue,
          confidence,
          reason: reasonStr,
          sampleMode: (sameWeekday ? "SAME_WEEKDAY" : "RECENT_DAYS") as "SAME_WEEKDAY" | "RECENT_DAYS",
          quantitySold: item.rawQuantity,
          sampleDays,
          sameWeekdaySalesDays: confidenceSampleDays,
          priceUsed,
          confidenceReason: confidence === "HIGH" ? "Strong weekday sales history" : (confidence === "MEDIUM" ? "Moderate weekday sales history" : "Weak or insufficient weekday sales history"),
        };
      })
      .sort((a, b) => b.expectedQuantity - a.expectedQuantity);
  }

  private calculateExpectedOrders(orders: MinimalOrder[], sampleDays: number, adjustmentFactor: number) {
    return Math.round((orders.length / sampleDays) * adjustmentFactor);
  }

  private calculateHourlyDemand(
    orders: MinimalOrder[],
    sampleDays: number,
    timeZone: string,
    adjustmentFactor: number,
  ): HourlyDemandForecast[] {
    const hourly = new Map<number, number>();

    for (const order of orders) {
      const timestamp = selectForecastTimestamp(order);
      const hour = getZonedHour(timestamp, timeZone);
      hourly.set(hour, (hourly.get(hour) ?? 0) + 1);
    }

    return [...hourly.entries()]
      .map(([hour, count]) => ({
        hour,
        expectedOrders: Math.round((count / sampleDays) * adjustmentFactor),
      }))
      .filter((slot) => slot.expectedOrders > 0)
      .sort((a, b) => a.hour - b.hour);
  }

  private async writeAuditLog(
    response: DemandForecastResponse,
    details: {
      tenantId: string;
      requestedById: string;
      categoryId?: string;
      forecastDate: Date;
      sampleDays: number;
      sampleMode: string;
      historicalOrderCount: number;
      fallbackModelUsed: boolean;
    },
  ) {
    try {
      await this.prisma.demandForecastLog.create({
        data: {
          tenantId: details.tenantId,
          branchId: response.branchId,
          requestedById: details.requestedById,
          forecastDate: details.forecastDate,
          lookbackDays: response.lookbackDays,
          categoryId: details.categoryId,
          expectedOrders: response.expectedOrders,
          expectedRevenue: new Decimal(response.expectedRevenue),
          metadata: toJson({
            source: FORECAST_SOURCE,
            sampleDays: details.sampleDays,
            sampleMode: details.sampleMode,
            historicalOrderCount: details.historicalOrderCount,
            forecastItemCount: response.items.length,
            fallbackModelUsed: details.fallbackModelUsed,
            dataQualityWarnings: response.dataQualityWarnings,
          }),
        },
      });
    } catch (error) {
      console.warn("Demand forecast audit log write failed", error);
    }
  }
}

function normalizeLookbackDays(value: DemandForecastQueryDto["lookbackDays"]) {
  if (value === undefined || value === null) return DEFAULT_LOOKBACK_DAYS;
  return Number(value);
}

function confidenceForSampleDays(sampleDays: number): ForecastConfidence {
  if (sampleDays >= 6) return "HIGH";
  if (sampleDays >= 3) return "MEDIUM";
  return "LOW";
}

function buildDataQualityWarnings(params: {
  adjustmentFactor: number;
  confidenceSampleDays: number;
  fallbackModelUsed: boolean;
  forecastItemCount: number;
  historicalOrderCount: number;
  lookbackDays: number;
  sampleDays: number;
  useSameWeekday: boolean;
}): DemandForecastDataQualityWarning[] {
  const warnings: DemandForecastDataQualityWarning[] = [];

  if (params.forecastItemCount === 0) {
    warnings.push({
      code: "NO_FORECASTABLE_ITEMS",
      severity: "HIGH",
      message:
        "No forecastable item history was found for this branch and filter window.",
    });
  }

  if (params.confidenceSampleDays < 3) {
    warnings.push({
      code: "LOW_SAMPLE_SIZE",
      severity: params.confidenceSampleDays === 0 ? "HIGH" : "MEDIUM",
      message: `Only ${params.confidenceSampleDays} matching weekday sales day${params.confidenceSampleDays === 1 ? "" : "s"} were found, so confidence is limited.`,
    });
  }

  if (params.historicalOrderCount < Math.max(3, Math.ceil(params.lookbackDays / 10))) {
    warnings.push({
      code: "SPARSE_HISTORY",
      severity: params.historicalOrderCount === 0 ? "HIGH" : "MEDIUM",
      message: `Only ${params.historicalOrderCount} historical order${params.historicalOrderCount === 1 ? "" : "s"} contributed to this forecast.`,
    });
  }

  if (params.adjustmentFactor !== 1) {
    warnings.push({
      code: "ADJUSTMENT_FACTOR_APPLIED",
      severity: Math.abs(params.adjustmentFactor - 1) >= 0.3 ? "MEDIUM" : "LOW",
      message: `Weather and event multipliers changed the forecast by ${params.adjustmentFactor.toFixed(2)}x.`,
    });
  }

  if (params.fallbackModelUsed) {
    warnings.push({
      code: "FALLBACK_MODEL_USED",
      severity: "MEDIUM",
      message:
        "The ML forecasting service was unavailable or rejected the request, so the deterministic fallback model was used.",
    });
  }

  if (!params.useSameWeekday && params.forecastItemCount > 0) {
    warnings.push({
      code: "LOW_SAMPLE_SIZE",
      severity: "LOW",
      message:
        "Same-weekday history was sparse, so recent sales days were used instead.",
    });
  }

  return warnings;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function buildForecastReason(params: {
  confidence: ForecastConfidence;
  confidenceSampleDays: number;
  expectedQuantity: number;
  lookbackDays: number;
  priceUsed: number;
  quantitySold: number;
  sameWeekday: boolean;
  sampleDays: number;
  weekdayName: string;
}) {
  const basis = params.sameWeekday
    ? `${params.sampleDays} similar ${params.weekdayName}${params.sampleDays === 1 ? "" : "s"}`
    : `${params.sampleDays} recent sales day${params.sampleDays === 1 ? "" : "s"}`;
  const suffix = params.sameWeekday
    ? ""
    : `; only ${params.confidenceSampleDays} matching ${params.weekdayName}${params.confidenceSampleDays === 1 ? "" : "s"} had sales`;

  return `${params.quantitySold} sold over ${basis}${suffix}. Forecast: ${params.expectedQuantity}.`;
}

function selectForecastTimestamp(order: MinimalOrder) {
  const completed = order.statusHistory.find(
    (entry) => entry.toStatus === OrderStatus.COMPLETED,
  );
  if (completed) return completed.changedAt;

  const served = order.statusHistory.find(
    (entry) => entry.toStatus === OrderStatus.SERVED,
  );
  if (served) return served.changedAt;

  const paid = order.payments.find(
    (payment) => payment.paymentStatus === PaymentStatus.COMPLETED,
  );
  return paid?.paymentDate ?? order.orderDateTime;
}

function getZonedDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function getZonedWeekdayShort(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
}

function getZonedHour(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
  }).formatToParts(date);
  const hourPart = parts.find((p) => p.type === "hour");
  const hour = Number(hourPart?.value);
  return hour === 24 ? 0 : hour;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
