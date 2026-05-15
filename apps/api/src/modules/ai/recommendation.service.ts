import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
import { OrderStatus, type Prisma } from "@prisma/client";
import type {
  MenuRecommendationItem,
  MenuRecommendationRequest,
  MenuRecommendationResponse,
  RecommendationType,
} from "@smart-restaurant/shared-types";
import { PrismaService } from "../../prisma/prisma.service.js";
import crypto from "node:crypto";

interface RecommendedItem {
  menuItemId: string;
  name: string;
  price: string;
  reason: string;
  score: number;
}

type RecommendationCandidate = MenuRecommendationItem & {
  strongestScore: number;
};

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Canonical menu recommendation endpoint implementation.
   *
   * This intentionally lives on the existing recommendation service so the new
   * /recommendations/menu route does not duplicate the older /ai recommendation
   * logic or data ownership.
   */
  async getMenuRecommendations(
    input: MenuRecommendationRequest,
  ): Promise<MenuRecommendationResponse> {
    const limit = Math.min(Math.max(input.limit ?? 6, 1), 20);
    const cartItemIds = [...new Set(input.cartItems.map((item) => item.menuItemId))];

    const branch = await this.prisma.branch.findUnique({
      where: { id: input.branchId },
      select: { tenantId: true },
    });
    if (!branch) return { recommendations: [] };

    if (input.tenantId && input.tenantId !== branch.tenantId) {
      throw new BadRequestException("Branch does not belong to tenant");
    }

    let effectiveUserId = input.userId;
    if (input.sessionId) {
      const session = await this.prisma.session.findFirst({
        where: {
          id: input.sessionId,
          tenantId: branch.tenantId,
          branchId: input.branchId,
        },
        select: { userId: true },
      });
      if (!session) {
        throw new BadRequestException("Session does not belong to branch");
      }
      effectiveUserId = session.userId ?? effectiveUserId;
    }

    const candidates = new Map<string, RecommendationCandidate>();

    const addCandidate = (
      menuItemId: string,
      name: string,
      score: number,
      type: RecommendationType,
      reason: string,
      strategyMetadata: Partial<MenuRecommendationItem["metadata"]>
    ) => {
      if (cartItemIds.includes(menuItemId)) return;

      const existing = candidates.get(menuItemId);
      if (!existing) {
        candidates.set(menuItemId, {
          menuItemId,
          name,
          reason,
          score,
          type,
          strongestScore: score,
          metadata: {
            strategySource: type,
            ...strategyMetadata,
            scoreContributionPerStrategy: { [type]: score },
          },
        });
        return;
      }

      existing.score += score;
      if (existing.metadata.scoreContributionPerStrategy) {
        existing.metadata.scoreContributionPerStrategy[type] = score;
      }
      
      if (strategyMetadata.historicalSalesCount) existing.metadata.historicalSalesCount = strategyMetadata.historicalSalesCount;
      if (strategyMetadata.coPurchaseCount) existing.metadata.coPurchaseCount = strategyMetadata.coPurchaseCount;
      if (strategyMetadata.timeOfDaySignal) existing.metadata.timeOfDaySignal = strategyMetadata.timeOfDaySignal;
      if (strategyMetadata.reorderSignal) existing.metadata.reorderSignal = strategyMetadata.reorderSignal;

      if (score > existing.strongestScore) {
        existing.reason = reason;
        existing.type = type;
        existing.metadata.strategySource = type;
        existing.strongestScore = score;
      }
    };

    await this.addPopularCandidates({
      tenantId: branch.tenantId,
      branchId: input.branchId,
      cartItemIds,
      limit,
      addCandidate,
    });

    if (cartItemIds.length > 0) {
      await this.addFrequentlyBoughtCandidates({
        tenantId: branch.tenantId,
        branchId: input.branchId,
        cartItemIds,
        limit,
        addCandidate,
      });
    }

    if (effectiveUserId) {
      await this.addReorderCandidates({
        tenantId: branch.tenantId,
        branchId: input.branchId,
        userId: effectiveUserId,
        cartItemIds,
        limit,
        addCandidate,
      });
    }

    await this.addTimeBasedCandidates({
      tenantId: branch.tenantId,
      branchId: input.branchId,
      cartItemIds,
      limit,
      addCandidate,
    });

    let fallbackUsed = false;
    if (candidates.size === 0) {
      fallbackUsed = true;
      await this.addAvailableMenuFallbackCandidates({
        tenantId: branch.tenantId,
        branchId: input.branchId,
        cartItemIds,
        limit,
        addCandidate,
      });
    }

    const recommendations = [...candidates.values()]
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name) || a.menuItemId.localeCompare(b.menuItemId))
      .slice(0, limit)
      .map(({ strongestScore: _strongestScore, ...item }) => item);

    await this.logMenuRecommendations({
      tenantId: branch.tenantId,
      branchId: input.branchId,
      userId: effectiveUserId,
      sessionId: input.sessionId,
      cartItemIds,
      recommendations,
      limit,
      surface: input.surface,
      trigger: input.trigger,
      candidatePoolSize: candidates.size,
      fallbackUsed,
    });

    return { recommendations };
  }

  private async addPopularCandidates(input: {
    tenantId: string;
    branchId: string;
    cartItemIds: string[];
    limit: number;
    addCandidate: (
      menuItemId: string,
      name: string,
      score: number,
      type: RecommendationType,
      reason: string,
      strategyMetadata: Partial<MenuRecommendationItem["metadata"]>
    ) => void;
  }) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const nowMs = Date.now();

    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        tenantId: input.tenantId,
        branchId: input.branchId,
        menuItemId: { notIn: input.cartItemIds },
        order: {
          orderStatus: OrderStatus.COMPLETED,
          orderDateTime: { gte: thirtyDaysAgo },
        },
      },
      select: {
        menuItemId: true,
        quantity: true,
        order: { select: { orderDateTime: true } },
      },
      take: 1000,
    });

    const scoreByItem = new Map<string, number>();
    const quantityByItem = new Map<string, number>();

    for (const item of orderItems) {
      const daysAgo = Math.max(1, (nowMs - item.order.orderDateTime.getTime()) / (1000 * 60 * 60 * 24));
      const weight = Math.max(0.5, 1.0 - (daysAgo / 30) * 0.5); // Recent gets 1.0, 30 days ago gets 0.5
      
      const weightedScore = item.quantity * weight;
      
      scoreByItem.set(item.menuItemId, (scoreByItem.get(item.menuItemId) ?? 0) + weightedScore);
      quantityByItem.set(item.menuItemId, (quantityByItem.get(item.menuItemId) ?? 0) + item.quantity);
    }

    const rankedIds = [...scoreByItem.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, input.limit * 4)
      .map(([id]) => id);

    const items = await this.loadAvailableMenuItems(
      input.tenantId,
      input.branchId,
      rankedIds,
    );

    for (const item of items) {
      const score = scoreByItem.get(item.id) ?? 0;
      const quantity = quantityByItem.get(item.id) ?? 0;
      input.addCandidate(
        item.id,
        item.name,
        40 + score,
        "POPULAR",
        "Popular with guests at this branch",
        { historicalSalesCount: quantity }
      );
    }
  }

  private async addFrequentlyBoughtCandidates(input: {
    tenantId: string;
    branchId: string;
    cartItemIds: string[];
    limit: number;
    addCandidate: (
      menuItemId: string,
      name: string,
      score: number,
      type: RecommendationType,
      reason: string,
      strategyMetadata: Partial<MenuRecommendationItem["metadata"]>
    ) => void;
  }) {
    const ordersWithCartItems = await this.prisma.orderItem.findMany({
      where: {
        tenantId: input.tenantId,
        branchId: input.branchId,
        menuItemId: { in: input.cartItemIds },
        order: { orderStatus: OrderStatus.COMPLETED },
      },
      select: { orderId: true },
      distinct: ["orderId"],
      take: 200,
    });

    if (!ordersWithCartItems.length) return;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const nowMs = Date.now();

    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        tenantId: input.tenantId,
        branchId: input.branchId,
        orderId: { in: ordersWithCartItems.map((item) => item.orderId) },
        menuItemId: { notIn: input.cartItemIds },
        order: { 
          orderStatus: OrderStatus.COMPLETED,
          orderDateTime: { gte: thirtyDaysAgo },
        },
      },
      select: {
        menuItemId: true,
        quantity: true,
        order: { select: { orderDateTime: true } },
      },
      take: 1000,
    });

    const scoreByItem = new Map<string, number>();
    const quantityByItem = new Map<string, number>();

    for (const item of orderItems) {
      const daysAgo = Math.max(1, (nowMs - item.order.orderDateTime.getTime()) / (1000 * 60 * 60 * 24));
      const weight = Math.max(0.5, 1.0 - (daysAgo / 30) * 0.5);
      
      const weightedScore = item.quantity * weight;
      
      scoreByItem.set(item.menuItemId, (scoreByItem.get(item.menuItemId) ?? 0) + weightedScore);
      quantityByItem.set(item.menuItemId, (quantityByItem.get(item.menuItemId) ?? 0) + item.quantity);
    }

    const rankedIds = [...scoreByItem.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, input.limit * 4)
      .map(([id]) => id);

    const items = await this.loadAvailableMenuItems(
      input.tenantId,
      input.branchId,
      rankedIds,
    );

    for (const item of items) {
      const score = scoreByItem.get(item.id) ?? 0;
      const quantity = quantityByItem.get(item.id) ?? 0;
      input.addCandidate(
        item.id,
        item.name,
        35 + score * 2,
        "FREQUENTLY_BOUGHT",
        "Frequently ordered together",
        { coPurchaseCount: quantity }
      );
    }
  }

  private async addReorderCandidates(input: {
    tenantId: string;
    branchId: string;
    userId: string;
    cartItemIds: string[];
    limit: number;
    addCandidate: (
      menuItemId: string,
      name: string,
      score: number,
      type: RecommendationType,
      reason: string,
      strategyMetadata: Partial<MenuRecommendationItem["metadata"]>
    ) => void;
  }) {
    const nowMs = Date.now();
    const ninetyDaysAgo = new Date(nowMs - 90 * 24 * 60 * 60 * 1000);

    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        tenantId: input.tenantId,
        branchId: input.branchId,
        menuItemId: { notIn: input.cartItemIds },
        order: {
          userId: input.userId,
          orderStatus: OrderStatus.COMPLETED,
          orderDateTime: { gte: ninetyDaysAgo },
        },
      },
      select: {
        menuItemId: true,
        quantity: true,
        order: { select: { orderDateTime: true } },
      },
      take: 500,
    });

    const scoreByItem = new Map<string, number>();
    const quantityByItem = new Map<string, number>();

    for (const item of orderItems) {
      const daysAgo = Math.max(1, (nowMs - item.order.orderDateTime.getTime()) / (1000 * 60 * 60 * 24));
      const weight = Math.max(0.5, 1.0 - (daysAgo / 90) * 0.5);

      const weightedScore = item.quantity * weight;

      scoreByItem.set(item.menuItemId, (scoreByItem.get(item.menuItemId) ?? 0) + weightedScore);
      quantityByItem.set(item.menuItemId, (quantityByItem.get(item.menuItemId) ?? 0) + item.quantity);
    }

    const rankedIds = [...scoreByItem.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, input.limit * 4)
      .map(([id]) => id);

    const items = await this.loadAvailableMenuItems(
      input.tenantId,
      input.branchId,
      rankedIds,
    );

    for (const item of items) {
      const score = scoreByItem.get(item.id) ?? 0;
      const quantity = quantityByItem.get(item.id) ?? 0;
      input.addCandidate(
        item.id,
        item.name,
        30 + score * 2,
        "REORDER",
        "You ordered this before",
        { reorderSignal: quantity }
      );
    }
  }

  private async addTimeBasedCandidates(input: {
    tenantId: string;
    branchId: string;
    cartItemIds: string[];
    limit: number;
    addCandidate: (
      menuItemId: string,
      name: string,
      score: number,
      type: RecommendationType,
      reason: string,
      strategyMetadata: Partial<MenuRecommendationItem["metadata"]>
    ) => void;
  }) {
    const now = new Date();
    const currentDay = now.getDay();
    const currentHour = now.getHours();
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const orderItems = await this.prisma.orderItem.findMany({
      where: {
        tenantId: input.tenantId,
        branchId: input.branchId,
        menuItemId: { notIn: input.cartItemIds },
        order: {
          orderStatus: OrderStatus.COMPLETED,
          orderDateTime: { gte: sixtyDaysAgo },
        },
      },
      select: {
        menuItemId: true,
        quantity: true,
        order: { select: { orderDateTime: true } },
      },
      take: 1000,
    });

    const scoreByItem = new Map<string, number>();
    const quantityByItem = new Map<string, number>();
    const nowMs = Date.now();

    for (const item of orderItems) {
      const orderedAt = item.order.orderDateTime;
      if (orderedAt.getDay() !== currentDay || orderedAt.getHours() !== currentHour) {
        continue;
      }

      const daysAgo = Math.max(1, (nowMs - orderedAt.getTime()) / (1000 * 60 * 60 * 24));
      const weight = Math.max(0.5, 1.0 - (daysAgo / 60) * 0.5); // Recent gets 1.0, 60 days gets 0.5
      const weightedScore = item.quantity * weight;

      scoreByItem.set(item.menuItemId, (scoreByItem.get(item.menuItemId) ?? 0) + weightedScore);
      quantityByItem.set(
        item.menuItemId,
        (quantityByItem.get(item.menuItemId) ?? 0) + item.quantity,
      );
    }

    const rankedIds = [...scoreByItem.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, input.limit * 4)
      .map(([menuItemId]) => menuItemId);

    const items = await this.loadAvailableMenuItems(
      input.tenantId,
      input.branchId,
      rankedIds,
    );

    for (const item of items) {
      const score = scoreByItem.get(item.id) ?? 0;
      const quantity = quantityByItem.get(item.id) ?? 0;
      input.addCandidate(
        item.id,
        item.name,
        15 + score,
        "TIME_BASED",
        "Popular around this time",
        { timeOfDaySignal: `${currentDay}-${currentHour}`, historicalSalesCount: quantity }
      );
    }
  }

  private async loadAvailableMenuItems(
    tenantId: string,
    branchId: string,
    ids: string[],
  ) {
    if (!ids.length) return [];
    return this.prisma.menuItem.findMany({
      where: {
        id: { in: ids },
        tenantId,
        isActive: true,
        isUnavailable: false,
        OR: [{ branchId }, { branchId: null }],
      },
      select: { id: true, name: true },
    });
  }

  private async addAvailableMenuFallbackCandidates(input: {
    tenantId: string;
    branchId: string;
    cartItemIds: string[];
    limit: number;
    addCandidate: (
      menuItemId: string,
      name: string,
      score: number,
      type: RecommendationType,
      reason: string,
      strategyMetadata: Partial<MenuRecommendationItem["metadata"]>
    ) => void;
  }) {
    const items = await this.prisma.menuItem.findMany({
      where: {
        tenantId: input.tenantId,
        isActive: true,
        isUnavailable: false,
        id: { notIn: input.cartItemIds },
        OR: [{ branchId: input.branchId }, { branchId: null }],
      },
      select: { id: true, name: true },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      take: input.limit,
    });

    for (const [index, item] of items.entries()) {
      input.addCandidate(
        item.id,
        item.name,
        5 - index * 0.1,
        "AVAILABLE",
        "Available on the current branch menu",
        {}
      );
    }
  }

  private async logMenuRecommendations(input: {
    tenantId: string;
    branchId: string;
    userId?: string;
    sessionId?: string;
    cartItemIds: string[];
    recommendations: MenuRecommendationItem[];
    limit: number;
    surface?: string;
    trigger?: string;
    candidatePoolSize: number;
    fallbackUsed: boolean;
  }) {
    try {
      const metadata = this.toInputJsonObject({
        algorithmVersion: "menu-rec-rule-v1",
        limit: input.limit,
        surface: input.surface,
        trigger: input.trigger,
        candidatePoolSize: input.candidatePoolSize,
        fallbackUsed: input.fallbackUsed,
        recommendations: input.recommendations.map((item) => ({
          menuItemId: item.menuItemId,
          score: item.score,
          reason: item.reason,
          type: item.type,
          metadata: item.metadata,
        })),
      });

      await this.prisma.recommendationLog.create({
        data: {
          tenantId: input.tenantId,
          branchId: input.branchId,
          userId: input.userId,
          sessionId: input.sessionId,
          inputCartItemIds: input.cartItemIds,
          recommendedItemIds: input.recommendations.map((item) => item.menuItemId),
          recommendationTypes: input.recommendations.map((item) => item.type),
          metadata,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to write recommendation log: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private toInputJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
  }

  async trackInteraction(input: {
    tenantId?: string;
    branchId: string;
    userId?: string;
    sessionId?: string;
    menuItemId: string;
    interactionType: any; // using any temporarily to bypass import issues, it's Prisma.RecommendationInteractionType internally
    surface?: string;
    traceId?: string;
  }) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: input.branchId },
      select: { tenantId: true },
    });
    if (!branch) return;

    try {
      await this.prisma.recommendationInteraction.create({
        data: {
          tenantId: branch.tenantId,
          branchId: input.branchId,
          userId: input.userId,
          sessionId: input.sessionId,
          menuItemId: input.menuItemId,
          interactionType: input.interactionType,
          surface: input.surface,
          traceId: input.traceId,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to track recommendation interaction: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Branch-level recommendations.
   * Scoring:
   * 1. Top sellers by quantity in the last 30 days (score = quantity * 10)
   * 2. If categoryId provided, filter to that category
   * 3. If userId known, boost items the user has ordered before
   * 4. Exclude inactive/unavailable items
   */
  async getBranchRecommendations(
    branchId: string,
    options: { sessionId?: string; categoryId?: string; userId?: string; limit?: number },
  ): Promise<{ traceId: string; recommendations: RecommendedItem[] }> {
    const traceId = crypto.randomUUID();
    const limit = options.limit ?? 6;

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { tenantId: true },
    });
    if (!branch) return { traceId, recommendations: [] };

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get top sellers
    const topSellers = await this.prisma.orderItem.groupBy({
      by: ["menuItemId"],
      where: {
        branchId,
        tenantId: branch.tenantId,
        order: {
          orderStatus: { not: OrderStatus.CANCELLED },
          orderDateTime: { gte: thirtyDaysAgo },
        },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: limit * 2,
    });

    const menuItemIds = topSellers.map((s) => s.menuItemId);

    // Load item details
    const where: Record<string, unknown> = {
      id: { in: menuItemIds },
      isActive: true,
      isUnavailable: false,
    };
    if (options.categoryId) where["categoryId"] = options.categoryId;

    let items = await this.prisma.menuItem.findMany({
      where,
      select: {
        id: true,
        name: true,
        price: true,
        categoryId: true,
        dietaryInfo: true,
        category: { select: { name: true } },
      },
    });

    // If not enough from top sellers, fill with active items
    if (items.length < limit) {
      const fallback = await this.prisma.menuItem.findMany({
        where: {
          tenantId: branch.tenantId,
          isActive: true,
          isUnavailable: false,
          id: { notIn: items.map((i) => i.id) },
          OR: [{ branchId }, { branchId: null }],
          ...(options.categoryId ? { categoryId: options.categoryId } : {}),
        },
        select: {
          id: true,
          name: true,
          price: true,
          categoryId: true,
          dietaryInfo: true,
          category: { select: { name: true } },
        },
        take: limit - items.length,
        orderBy: { name: "asc" },
      });
      items = [...items, ...fallback];
    }

    // Score
    const salesMap = new Map(
      topSellers.map((s) => [s.menuItemId, s._sum.quantity ?? 0]),
    );

    // User history boost
    let userStats = new Map<string, number>();
    if (options.userId) {
      const stats = await this.prisma.userItemStat.findMany({
        where: { userId: options.userId, menuItemId: { in: items.map((i) => i.id) } },
      });
      userStats = new Map(stats.map((s) => [s.menuItemId, s.timesOrdered]));
    }

    const scored: RecommendedItem[] = items.map((item) => {
      const sales = salesMap.get(item.id) ?? 0;
      const userOrders = userStats.get(item.id) ?? 0;
      const popularityScore = sales * 10;
      const personalScore = userOrders * 5;
      const score = popularityScore + personalScore + (sales === 0 ? 1 : 0);

      let reason = "Popular item";
      if (personalScore > 0 && popularityScore > 0) reason = "Popular & you've enjoyed this before";
      else if (personalScore > 0) reason = "Based on your order history";
      else if (popularityScore === 0) reason = "Try something new";

      return {
        menuItemId: item.id,
        name: item.name,
        price: item.price.toString(),
        reason,
        score,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return { traceId, recommendations: scored.slice(0, limit) };
  }

  /**
   * Cart-based recommendations: "customers who ordered X also ordered Y".
   * Uses co-purchase analysis from order history.
   */
  async getCartRecommendations(
    branchId: string,
    cartItemIds: string[],
    limit: number = 4,
  ): Promise<{ traceId: string; recommendations: RecommendedItem[] }> {
    const traceId = crypto.randomUUID();

    if (!cartItemIds.length) {
      return this.getBranchRecommendations(branchId, { limit });
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { tenantId: true },
    });
    if (!branch) return { traceId, recommendations: [] };

    // Find orders that contain the cart items
    const ordersWithCartItems = await this.prisma.orderItem.findMany({
      where: {
        menuItemId: { in: cartItemIds },
        branchId,
        order: { orderStatus: { not: OrderStatus.CANCELLED } },
      },
      select: { orderId: true },
      distinct: ["orderId"],
      take: 100,
    });

    const orderIds = ordersWithCartItems.map((o) => o.orderId);

    if (!orderIds.length) {
      return this.getBranchRecommendations(branchId, { limit });
    }

    // Find other items in those orders (co-purchased)
    const coPurchased = await this.prisma.orderItem.groupBy({
      by: ["menuItemId"],
      where: {
        orderId: { in: orderIds },
        menuItemId: { notIn: cartItemIds },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: limit * 2,
    });

    const coIds = coPurchased.map((c) => c.menuItemId);
    const items = await this.prisma.menuItem.findMany({
      where: { id: { in: coIds }, isActive: true, isUnavailable: false },
      select: { id: true, name: true, price: true },
    });

    const salesMap = new Map(coPurchased.map((c) => [c.menuItemId, c._sum.quantity ?? 0]));

    const scored: RecommendedItem[] = items.map((item) => ({
      menuItemId: item.id,
      name: item.name,
      price: item.price.toString(),
      reason: "Frequently ordered together",
      score: (salesMap.get(item.id) ?? 0) * 10,
    }));

    scored.sort((a, b) => b.score - a.score);

    if (scored.length < limit) {
      const fallback = await this.getBranchRecommendations(branchId, { limit: limit - scored.length });
      const existingIds = new Set([...scored.map((s) => s.menuItemId), ...cartItemIds]);
      for (const r of fallback.recommendations) {
        if (!existingIds.has(r.menuItemId) && scored.length < limit) {
          scored.push({ ...r, reason: "Popular item" });
        }
      }
    }

    return { traceId, recommendations: scored.slice(0, limit) };
  }

  /**
   * Customer-specific recommendations based on UserItemStat.
   */
  async getCustomerRecommendations(
    userId: string,
    branchId: string,
    limit: number = 6,
  ): Promise<{ traceId: string; recommendations: RecommendedItem[] }> {
    return this.getBranchRecommendations(branchId, { userId, limit });
  }

  /**
   * Recompute co-purchase RecommendationStat from recent order history.
   */
  async recomputeStats(branchId: string, tenantId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const orders = await this.prisma.order.findMany({
      where: { branchId, tenantId, orderStatus: { not: OrderStatus.CANCELLED }, orderDateTime: { gte: thirtyDaysAgo } },
      select: { orderItems: { select: { menuItemId: true } } },
    });

    const pairCounts = new Map<string, number>();
    for (const order of orders) {
      const ids = [...new Set(order.orderItems.map((i) => i.menuItemId))];
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const key = [ids[i], ids[j]].sort().join("::");
          pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        }
      }
    }

    await this.prisma.recommendationStat.deleteMany({ where: { tenantId, branchId } });

    const now = new Date();
    const records: Array<{ tenantId: string; branchId: string; menuItemId: string; coPurchasedItemId: string; count: number; lastComputedAt: Date }> = [];
    for (const [key, count] of pairCounts) {
      if (count < 2) continue;
      const [a, b] = key.split("::");
      records.push({ tenantId, branchId, menuItemId: a, coPurchasedItemId: b, count, lastComputedAt: now });
      records.push({ tenantId, branchId, menuItemId: b, coPurchasedItemId: a, count, lastComputedAt: now });
    }

    if (records.length > 0) {
      await this.prisma.recommendationStat.createMany({ data: records });
    }

    return { recomputed: true, pairsFound: pairCounts.size, recordsWritten: records.length };
  }
}
