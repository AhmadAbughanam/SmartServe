import { Injectable, Logger, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  BusinessInsight,
  BusinessInsightsResponse,
  InsightPriority,
} from '@smart-restaurant/shared-types';
import {
  AI_FALLBACK_MESSAGE,
  validateBusinessInsightSummaryPayload,
} from '../ai/ai-output-validation.js';

@Injectable()
export class BusinessInsightsService {
  private readonly logger = new Logger(BusinessInsightsService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async generateInsights(
    tenantId: string,
    staffId: string,
    scope: 'TENANT' | 'BRANCH',
    targetBranchId?: string,
    fromDate?: Date,
    toDate?: Date,
  ): Promise<BusinessInsightsResponse> {
    const insights: BusinessInsight[] = [];
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const effectiveFrom = fromDate || startOfDay;
    const effectiveTo = toDate || now;
    if (toDate) {
      effectiveTo.setUTCHours(23, 59, 59, 999);
    }

    // ---------------------------------------------------------
    // Rule 1: INVENTORY - Check for active Low Stock Alerts
    // ---------------------------------------------------------
    const inventoryAlertsCount = await this.prisma.lowStockAlert.count({
      where: {
        tenantId,
        branchId: scope === 'BRANCH' ? targetBranchId : undefined,
        status: 'OPEN',
      },
    });

    if (inventoryAlertsCount > 0) {
      insights.push({
        id: randomUUID(),
        category: 'INVENTORY',
        priority: inventoryAlertsCount >= 3 ? 'HIGH' : 'MEDIUM',
        title: 'Active Low Stock Alerts',
        description: `There are ${inventoryAlertsCount} active low-stock alerts triggering right now.`,
        recommendedAction: 'Check the Inventory dashboard and create supplier purchase orders for depleted items.',
        metricValue: `${inventoryAlertsCount} alerts`,
        sourceMetadata: {
          sourceMetrics: ['open low-stock alerts'],
          currentValue: inventoryAlertsCount,
          threshold: 1,
          triggerRule: 'OPEN_LOW_STOCK_ALERT_COUNT_GT_0',
          confidence: 'HIGH',
          affectedBranchIds: targetBranchId ? [targetBranchId] : undefined,
        },
      });
    }

    // ---------------------------------------------------------
    // Rule 2: OPERATIONS - Too many pending Service Requests
    // ---------------------------------------------------------
    const pendingRequestsCount = await this.prisma.serviceRequest.count({
      where: {
        tenantId,
        branchId: scope === 'BRANCH' ? targetBranchId : undefined,
        status: { in: ['NEW', 'CLAIMED'] },
      },
    });

    if (pendingRequestsCount > 4) {
      insights.push({
        id: randomUUID(),
        category: 'OPERATIONS',
        priority: 'MEDIUM',
        title: 'High Floor Traffic',
        description: `You have ${pendingRequestsCount} active service requests pending from tables.`,
        recommendedAction: 'Ensure enough floor staff are monitoring the waiter dashboard.',
        metricValue: `${pendingRequestsCount} requests`,
        sourceMetadata: {
          sourceMetrics: ['active service requests'],
          currentValue: pendingRequestsCount,
          threshold: 4,
          triggerRule: 'ACTIVE_SERVICE_REQUEST_COUNT_GT_4',
          confidence: 'HIGH',
          affectedBranchIds: targetBranchId ? [targetBranchId] : undefined,
        },
      });
    }

    // ---------------------------------------------------------
    // Rule 3: KITCHEN - Check for long prep times
    // ---------------------------------------------------------
    const completedItems = await this.prisma.orderItem.findMany({
      where: {
        tenantId,
        branchId: scope === 'BRANCH' ? targetBranchId : undefined,
        readyAt: { gte: effectiveFrom, lte: effectiveTo },
        startedAt: { not: null },
      },
      select: {
        startedAt: true,
        readyAt: true,
      },
    });

    // Only trigger if there's a meaningful sample size to avoid noise
    if (completedItems.length > 5) {
      const prepTimes = completedItems
        .map((item) => item.readyAt!.getTime() - item.startedAt!.getTime())
        .filter((time) => time > 0);

      if (prepTimes.length > 0) {
        const avgPrepTimeMillis =
          prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length;
        const avgPrepTimeMinutes = Math.round(avgPrepTimeMillis / 60000);

        if (avgPrepTimeMinutes > 20) {
          // Threshold: 20 minutes
          insights.push({
            id: randomUUID(),
            category: 'KITCHEN',
            priority: 'HIGH',
            title: 'Slow Kitchen Prep Times',
            description: `Average item preparation time today is ${avgPrepTimeMinutes} minutes, which is above the 20-minute target.`,
            recommendedAction:
              'Review KDS for bottlenecks. Check if specific stations or items are causing delays.',
            metricValue: `${avgPrepTimeMinutes} min avg`,
            sourceMetadata: {
              sourceMetrics: ['average item prep minutes', 'completed prep samples'],
              currentValue: avgPrepTimeMinutes,
              threshold: 20,
              triggerRule: 'AVERAGE_PREP_MINUTES_GT_20_WITH_SAMPLE_GT_5',
              confidence: prepTimes.length >= 20 ? 'HIGH' : 'MEDIUM',
              affectedBranchIds: targetBranchId ? [targetBranchId] : undefined,
            },
          });
        }
      }
    }

    // ---------------------------------------------------------
    // Rule 4: MENU - Identify top and zero sellers
    // ---------------------------------------------------------
    const salesData = await this.prisma.orderItem.groupBy({
      by: ['menuItemId'],
      where: {
        tenantId,
        branchId: scope === 'BRANCH' ? targetBranchId : undefined,
        order: {
          orderDateTime: { gte: effectiveFrom, lte: effectiveTo },
          orderStatus: { not: 'CANCELLED' },
        },
      },
      _sum: {
        quantity: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
    });

    if (salesData.length > 0) {
      const topSellerId = salesData[0].menuItemId;
      const topSellerMenuItem = await this.prisma.menuItem.findUnique({
        where: { id: topSellerId },
        select: { name: true },
      });

      if (topSellerMenuItem) {
        insights.push({
          id: randomUUID(),
          category: 'MENU',
          priority: 'LOW',
          title: 'Top Selling Item Today',
          description: `"${topSellerMenuItem.name}" is your most popular item today with ${salesData[0]._sum.quantity} units sold.`,
          recommendedAction:
            'Ensure you have enough inventory for this item to meet demand.',
          metricValue: `${salesData[0]._sum.quantity} sold`,
          sourceMetadata: {
            sourceMetrics: ['order item quantity sold'],
            currentValue: salesData[0]._sum.quantity ?? 0,
            threshold: 'highest item quantity in period',
            triggerRule: 'TOP_ITEM_BY_QUANTITY_SOLD',
            confidence: salesData.length >= 3 ? 'MEDIUM' : 'LOW',
            affectedBranchIds: targetBranchId ? [targetBranchId] : undefined,
          },
        });
      }

      const soldItemIds = salesData.map((item) => item.menuItemId);
      const zeroSellers = await this.prisma.menuItem.findMany({
        where: {
          tenantId,
          ...(scope === 'BRANCH' && {
            OR: [{ branchId: targetBranchId }, { branchId: null }],
          }),
          isActive: true,
          isUnavailable: false,
          id: { notIn: soldItemIds },
        },
        select: { name: true },
        take: 3,
      });

      if (zeroSellers.length > 2) {
        insights.push({
          id: randomUUID(),
          category: 'MENU',
          priority: 'MEDIUM',
          title: 'Unsold Menu Items',
          description: `These active items have had zero sales today: ${zeroSellers.map((i) => i.name).join(', ')}.`,
          recommendedAction:
            'Consider running a promotion or highlighting these items to staff to boost sales.',
          metricValue: `${zeroSellers.length} items`,
          sourceMetadata: {
            sourceMetrics: ['active available items with zero sales'],
            currentValue: zeroSellers.length,
            threshold: 2,
            triggerRule: 'ZERO_SELLER_ACTIVE_ITEM_COUNT_GT_2',
            confidence: salesData.length >= 5 ? 'MEDIUM' : 'LOW',
            affectedBranchIds: targetBranchId ? [targetBranchId] : undefined,
          },
        });
      }
    }

    // ---------------------------------------------------------
    // Rule 5: OPERATIONS - High Cancellation Rate
    // ---------------------------------------------------------
    const orderStats = await this.prisma.order.groupBy({
      by: ['orderStatus'],
      where: {
        tenantId,
        branchId: scope === 'BRANCH' ? targetBranchId : undefined,
        orderDateTime: { gte: effectiveFrom, lte: effectiveTo },
      },
      _count: true,
    });

    let totalOrders = 0;
    let cancelledOrders = 0;
    orderStats.forEach((stat) => {
      totalOrders += stat._count;
      if (stat.orderStatus === 'CANCELLED') {
        cancelledOrders = stat._count;
      }
    });

    if (totalOrders > 5 && cancelledOrders > 0) {
      const cancelRate = Math.round((cancelledOrders / totalOrders) * 100);
      if (cancelRate >= 10) {
        insights.push({
          id: randomUUID(),
          category: 'OPERATIONS',
          priority: cancelRate >= 20 ? 'HIGH' : 'MEDIUM',
          title: 'High Order Cancellation Rate',
          description: `${cancelRate}% of orders (${cancelledOrders} out of ${totalOrders}) were cancelled in this period.`,
          recommendedAction: 'Investigate if cancellations are due to stockouts, slow service, or customer errors.',
          metricValue: `${cancelRate}% rate`,
          sourceMetadata: {
            sourceMetrics: ['cancelled orders', 'total orders', 'cancellation rate'],
            currentValue: `${cancelRate}%`,
            threshold: '10%',
            triggerRule: 'CANCEL_RATE_GTE_10_WITH_TOTAL_ORDERS_GT_5',
            confidence: totalOrders >= 20 ? 'HIGH' : 'MEDIUM',
            affectedBranchIds: targetBranchId ? [targetBranchId] : undefined,
          },
        });
      }
    }

    // ---------------------------------------------------------
    // Rule 6: SALES - Refund Spike
    // ---------------------------------------------------------
    const refundStats = await this.prisma.refund.aggregate({
      where: {
        tenantId,
        branchId: scope === 'BRANCH' ? targetBranchId : undefined,
        status: 'COMPLETED',
        createdAt: { gte: effectiveFrom, lte: effectiveTo },
      },
      _count: true,
      _sum: { amount: true },
    });

    const refundCount = refundStats._count;
    const refundAmount = refundStats._sum.amount ? Number(refundStats._sum.amount) : 0;

    // Trigger if there are multiple refunds or a significant dollar amount refunded
    if (refundCount >= 3 || refundAmount > 50) {
      insights.push({
        id: randomUUID(),
        category: 'SALES',
        priority: refundCount >= 5 || refundAmount > 100 ? 'HIGH' : 'MEDIUM',
        title: 'Unusual Refund Volume',
        description: `There have been ${refundCount} completed refunds totaling $${refundAmount.toFixed(2)} in this period.`,
        recommendedAction: 'Review refunded orders to identify recurring complaints or billing mistakes.',
        metricValue: `${refundCount} refunds`,
        sourceMetadata: {
          sourceMetrics: ['completed refund count', 'completed refund amount'],
          currentValue: `${refundCount} refunds / $${refundAmount.toFixed(2)}`,
          threshold: '3 refunds or $50.00',
          triggerRule: 'REFUND_COUNT_GTE_3_OR_REFUND_AMOUNT_GT_50',
          confidence: refundCount >= 5 || refundAmount > 100 ? 'HIGH' : 'MEDIUM',
          affectedBranchIds: targetBranchId ? [targetBranchId] : undefined,
        },
      });
    }

    // ---------------------------------------------------------
    // Rule 7: REVIEWS - Monitor Customer Sentiment
    // ---------------------------------------------------------
    const reviewStats = await this.prisma.review.aggregate({
      where: {
        tenantId,
        branchId: scope === 'BRANCH' ? targetBranchId : undefined,
        createdAt: { gte: effectiveFrom, lte: effectiveTo },
      },
      _count: true,
      _avg: { overallRating: true },
    });

    const avgRating = reviewStats._avg.overallRating;
    const reviewCount = reviewStats._count;

    if (reviewCount >= 3 && avgRating !== null && avgRating < 4.0) {
      insights.push({
        id: randomUUID(),
        category: 'REVIEWS',
        priority: avgRating <= 3.0 ? 'HIGH' : 'MEDIUM',
        title: 'Low Customer Sentiment',
        description: `Average rating is ${avgRating.toFixed(1)} stars across ${reviewCount} recent reviews.`,
        recommendedAction: 'Read the latest customer feedback in the Analytics dashboard to identify and resolve recurring complaints.',
        metricValue: `${avgRating.toFixed(1)}/5`,
        sourceMetadata: {
          sourceMetrics: ['review count', 'average overall rating'],
          currentValue: Number(avgRating.toFixed(1)),
          threshold: 4,
          triggerRule: 'AVERAGE_RATING_LT_4_WITH_REVIEW_COUNT_GTE_3',
          confidence: reviewCount >= 10 ? 'HIGH' : 'MEDIUM',
          affectedBranchIds: targetBranchId ? [targetBranchId] : undefined,
        },
      });
    }

    // ---------------------------------------------------------
    // Rule 8: TENANT SCOPE - Branch Comparisons
    // ---------------------------------------------------------
    if (scope === 'TENANT') {
      const branches = await this.prisma.branch.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, name: true },
      });

      if (branches.length > 1) {
        // 8a. Best-performing branch by revenue
        const branchRevenue = await this.prisma.order.groupBy({
          by: ['branchId'],
          where: {
            tenantId,
            orderDateTime: { gte: effectiveFrom, lte: effectiveTo },
            orderStatus: 'COMPLETED',
          },
          _sum: { totalAmount: true },
        });

        if (branchRevenue.length > 1) {
          branchRevenue.sort(
            (a, b) => Number(b._sum.totalAmount || 0) - Number(a._sum.totalAmount || 0),
          );
          const bestBranchId = branchRevenue[0].branchId;
          const bestBranchAmount = Number(branchRevenue[0]._sum.totalAmount || 0);

          if (bestBranchId && bestBranchAmount > 0) {
            const bestBranchName =
              branches.find((b) => b.id === bestBranchId)?.name || 'Unknown Branch';
            insights.push({
              id: randomUUID(),
              category: 'SALES',
              priority: 'LOW',
              title: 'Top Performing Branch',
              description: `"${bestBranchName}" is your top performing branch with $${bestBranchAmount.toFixed(
                2,
              )} in revenue this period.`,
              metricValue: `$${bestBranchAmount.toFixed(2)}`,
              sourceMetadata: {
                sourceMetrics: ['completed order total amount by branch'],
                currentValue: bestBranchAmount,
                triggerRule: 'TOP_REVENUE_BRANCH',
                confidence: 'HIGH',
                affectedBranchIds: [bestBranchId],
              },
            });
          }
        }

        // 8b. Branch with most low-stock warnings
        const branchStockAlerts = await this.prisma.lowStockAlert.groupBy({
          by: ['branchId'],
          where: { tenantId, status: 'OPEN' },
          _count: true,
        });

        if (branchStockAlerts.length > 0) {
          branchStockAlerts.sort((a, b) => b._count - a._count);
          const worstStockBranch = branchStockAlerts[0];
          if (worstStockBranch.branchId && worstStockBranch._count > 0) {
            const name =
              branches.find((b) => b.id === worstStockBranch.branchId)?.name ||
              'Unknown Branch';
            insights.push({
              id: randomUUID(),
              category: 'INVENTORY',
              priority: 'MEDIUM',
              title: 'Most Low-Stock Alerts',
              description: `"${name}" has the highest number of active low-stock alerts (${worstStockBranch._count}).`,
              metricValue: `${worstStockBranch._count} alerts`,
              sourceMetadata: {
                sourceMetrics: ['open low stock alerts by branch'],
                currentValue: worstStockBranch._count,
                triggerRule: 'MOST_LOW_STOCK_ALERTS_BRANCH',
                confidence: 'HIGH',
                affectedBranchIds: [worstStockBranch.branchId],
              },
            });
          }
        }

        // 8c. Branch with lowest review rating
        const branchReviews = await this.prisma.review.groupBy({
          by: ['branchId'],
          where: { tenantId, createdAt: { gte: effectiveFrom, lte: effectiveTo } },
          _avg: { overallRating: true },
          _count: true,
        });

        const validBranchReviews = branchReviews.filter(
          (r) => r._count >= 3 && r._avg.overallRating !== null && r.branchId !== null,
        );

        if (validBranchReviews.length > 0) {
          validBranchReviews.sort(
            (a, b) => (a._avg.overallRating || 0) - (b._avg.overallRating || 0),
          );
          const lowestReviewBranch = validBranchReviews[0];
          if (lowestReviewBranch.branchId) {
            const name =
              branches.find((b) => b.id === lowestReviewBranch.branchId)?.name ||
              'Unknown Branch';
            insights.push({
              id: randomUUID(),
              category: 'REVIEWS',
              priority: 'MEDIUM',
              title: 'Lowest Rated Branch',
              description: `"${name}" has the lowest average rating (${lowestReviewBranch._avg.overallRating?.toFixed(
                1,
              )}) across ${lowestReviewBranch._count} reviews.`,
              metricValue: `${lowestReviewBranch._avg.overallRating?.toFixed(1)}/5`,
              sourceMetadata: {
                sourceMetrics: ['average overall rating by branch', 'review count'],
                currentValue: Number(lowestReviewBranch._avg.overallRating?.toFixed(1)),
                triggerRule: 'LOWEST_RATING_BRANCH',
                confidence: 'MEDIUM',
                affectedBranchIds: [lowestReviewBranch.branchId],
              },
            });
          }
        }
      }
    }

    // ---------------------------------------------------------
    // Sort, Cap, and Log
    // ---------------------------------------------------------
    
    // Sorting mechanism to bubble up HIGH priority issues
    const priorityWeight: Record<InsightPriority, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    insights.sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

    // Avoid overwhelming managers: Cap to top 5 most critical insights
    const finalInsights = insights.slice(0, 5);

    let polishedSummary = `Found ${finalInsights.length} priority insights for the selected period.`;
    let aiFallbackMessage: string | undefined;
    const aiServiceUrl = process.env.AI_SERVICE_URL;
    
    if (aiServiceUrl && finalInsights.length > 0) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      try {
        const response = await fetch(`${aiServiceUrl}/business-insights/summarize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scope,
            insights: finalInsights.map((i) => ({
              category: i.category,
              priority: i.priority,
              title: i.title,
              description: i.description,
              metricValue: i.metricValue
            }))
          }),
          signal: controller.signal,
        });
        
        if (response.ok) {
          const data = (await response.json()) as unknown;
          const validated = validateBusinessInsightSummaryPayload(data);
          if (validated) {
            polishedSummary = validated.summary;
          } else {
            aiFallbackMessage = AI_FALLBACK_MESSAGE;
            this.logger.warn(
              `FastAPI business insight summary failed validation tenant=${tenantId} scope=${scope} branch=${targetBranchId ?? 'tenant'} insightCount=${finalInsights.length}`,
            );
          }
        } else {
          aiFallbackMessage = AI_FALLBACK_MESSAGE;
          this.logger.warn(`FastAPI LLM boundary returned status: ${response.status}`);
        }
      } catch (error) {
        aiFallbackMessage = AI_FALLBACK_MESSAGE;
        this.logger.warn('Failed to fetch polished summary from FastAPI', error);
      } finally {
        clearTimeout(timeout);
      }
    }

    try {
      await this.prisma.businessInsightLog.create({
        data: {
          tenantId,
          branchId: scope === 'BRANCH' ? targetBranchId : null,
          requestedById: staffId,
          scope,
          fromDate: effectiveFrom,
          toDate: effectiveTo,
          insightCount: finalInsights.length,
          categories: finalInsights.map((i) => i.category),
          priorities: finalInsights.map((i) => i.priority),
        },
      });
    } catch (error) {
      // Log is strictly audit metadata; a failure here should not crash the dashboard insight delivery
      this.logger.warn('Failed to write BusinessInsightLog', error);
    }

    return {
      insights: finalInsights,
      generatedAt: now.toISOString(),
      scope,
      branchId: targetBranchId,
      from: effectiveFrom.toISOString().slice(0, 10),
      to: effectiveTo.toISOString().slice(0, 10),
      summary: polishedSummary,
      aiFallbackMessage,
    };
  }
}
