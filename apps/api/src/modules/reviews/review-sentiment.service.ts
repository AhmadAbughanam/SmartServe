import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  ReviewAffectedItem,
  ReviewCommonIssue,
  ReviewItemComplaintTimeline,
  ReviewItemComplaintTimelineDirection,
  ReviewOperationalCorrelations,
  ReviewOperationalCorrelationSignal,
  ReviewActionSuggestion,
  ReviewSentimentAlert,
  ReviewIssueSeverity,
  ReviewSentiment,
  ReviewSentimentResponse,
  ReviewSentimentTrend,
} from "@smart-restaurant/shared-types";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";
import type { ReviewSentimentQueryDto } from "./dto/review-sentiment-query.dto.js";
import { AI_FALLBACK_MESSAGE, validateReviewSentimentSummaryPayload } from "../ai/ai-output-validation.js";
import { normalizeAiEngineControls } from "../ai/ai-engine-controls.js";

const MAX_RANGE_DAYS = 180;
const REVIEW_SENTIMENT_SOURCE = "REVIEW_SENTIMENT_ANALYZER_MVP";

type ReviewWithSignals = Prisma.ReviewGetPayload<{
  include: {
    issueTags: { select: { tag: true } };
    itemReviews: {
      include: { menuItem: { select: { id: true; name: true } } };
    };
    order: {
      select: {
        id: true;
        orderDateTime: true;
        statusHistory: {
          select: { toStatus: true; changedAt: true };
          orderBy: { changedAt: "asc" };
        };
        orderItems: { select: { startedAt: true; readyAt: true } };
        session: {
          select: {
            serviceRequests: { select: { createdAt: true } };
          };
        };
      };
    };
  };
}>;

@Injectable()
export class ReviewSentimentService {
  private readonly logger = new Logger(ReviewSentimentService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getReviewSentiment(
    query: ReviewSentimentQueryDto,
    staff: AuthenticatedStaff,
  ): Promise<ReviewSentimentResponse> {
    const from = parseIsoDateOnly(query.from, "from");
    const to = parseIsoDateOnly(query.to, "to");
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException("from must be before or equal to to");
    }

    const rangeDays = daysInclusive(from, to);
    if (rangeDays > MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `Date range cannot exceed ${MAX_RANGE_DAYS} days`,
      );
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: query.branchId },
      select: { id: true, tenantId: true },
    });
    if (!branch) throw new NotFoundException("Branch not found");
    this.assertStaffCanAnalyzeBranch(staff, branch.tenantId, branch.id);
    const engineControls = await this.loadBranchAiControls(branch.tenantId, branch.id);

    if (query.menuItemId) {
      const menuItem = await this.prisma.menuItem.findFirst({
        where: {
          id: query.menuItemId,
          tenantId: branch.tenantId,
          OR: [{ branchId: branch.id }, { branchId: null }],
        },
        select: { id: true },
      });
      if (!menuItem) throw new NotFoundException("Menu item not found");
    }

    const previousFrom = addUtcDays(from, -rangeDays);
    const previousTo = addUtcDays(from, -1);
    const [reviews, previousReviews] = await Promise.all([
      this.findScopedReviews({
        tenantId: branch.tenantId,
        branchId: branch.id,
        from,
        to,
        menuItemId: query.menuItemId,
      }),
      this.findScopedReviews({
        tenantId: branch.tenantId,
        branchId: branch.id,
        from: previousFrom,
        to: previousTo,
        menuItemId: query.menuItemId,
      }),
    ]);

    const totalReviews = reviews.length;
    const averageRating = calculateAverageRating(reviews);
    let commonIssues = calculateCommonIssues(reviews);
    let affectedItems = calculateAffectedItems(reviews, query.menuItemId);
    let itemTimelines = calculateItemTimelines(reviews, from, to, query.menuItemId);
    const operationalCorrelations = calculateOperationalCorrelations(reviews);
    let sentiment = determineSentiment(
      totalReviews,
      averageRating,
      commonIssues,
    );
    const inference = await this.applyReviewInference({
      branchId: branch.id,
      tenantId: branch.tenantId,
      query,
      from,
      to,
      reviews,
      controls: engineControls?.reviewSentiment,
      base: { sentiment, commonIssues, affectedItems, itemTimelines },
    });
    sentiment = inference.sentiment;
    commonIssues = inference.commonIssues;
    affectedItems = inference.affectedItems;
    itemTimelines = inference.itemTimelines;
    const previousCommonIssues = calculateCommonIssues(previousReviews);
    const trend = calculateTrend({
      currentAverageRating: averageRating,
      currentCommonIssues: commonIssues,
      currentTotalReviews: totalReviews,
      previousAverageRating: calculateAverageRating(previousReviews),
      previousCommonIssues,
      previousFrom,
      previousTo,
      previousTotalReviews: previousReviews.length,
    });
    const alerts = calculateAlerts({
      averageRatingDelta: trend.averageRatingDelta,
      commonIssues,
      previousCommonIssues,
      previousTotalReviews: previousReviews.length,
    });
    const actionSuggestions = calculateActionSuggestions({
      alerts,
      affectedItems,
      commonIssues,
      itemTimelines,
      operationalCorrelations,
      sentiment,
      trend,
    });

    let finalSummary = buildSummary({
      totalReviews,
      averageRating,
      sentiment,
      commonIssues,
      affectedItems,
      trend,
      alerts,
      itemTimelines,
      operationalCorrelations,
    });

    let aiFallbackMessage: string | undefined;
    const aiServiceUrl = process.env.AI_SERVICE_URL;

    if (aiServiceUrl && totalReviews > 0) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      try {
        const fetchRes = await fetch(`${aiServiceUrl}/review-sentiment/summarize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            totalReviews,
            averageRating,
            sentiment,
            commonIssues,
            affectedItems,
            trend,
            alerts,
            itemTimelines,
            operationalCorrelations,
            actionSuggestions,
          }),
          signal: controller.signal,
        });

        if (fetchRes.ok) {
          const data = await fetchRes.json();
          const validated = validateReviewSentimentSummaryPayload(data);
          if (validated) {
            finalSummary = validated;
          } else {
            aiFallbackMessage = AI_FALLBACK_MESSAGE;
            this.logger.warn(`FastAPI review sentiment summary failed validation branch=${branch.id}`);
          }
        } else {
          aiFallbackMessage = AI_FALLBACK_MESSAGE;
          this.logger.warn(`FastAPI LLM boundary returned status: ${fetchRes.status}`);
        }
      } catch (error) {
        aiFallbackMessage = AI_FALLBACK_MESSAGE;
        this.logger.warn("Failed to fetch polished summary from FastAPI", error);
      } finally {
        clearTimeout(timeout);
      }
    }

    const response: ReviewSentimentResponse = {
      branchId: branch.id,
      from: query.from,
      to: query.to,
      totalReviews,
      averageRating,
      sentiment,
      summary: finalSummary,
      aiFallbackMessage,
      commonIssues,
      affectedItems,
      trend,
      alerts,
      itemTimelines,
      operationalCorrelations,
      actionSuggestions,
      engine: inference.mode === "ml" ? "ML" : "RULES",
      modelVersion: inference.modelVersion,
      confidence: inference.confidence,
    };

    void this.writeAuditLog(response, {
      tenantId: branch.tenantId,
      requestedById: staff.staffId,
      fromDate: from,
      toDate: to,
      menuItemId: query.menuItemId,
      engineMode: inference.mode,
      shadowPayload: inference.shadowPayload,
      modelVersion: inference.modelVersion,
    });

    return response;
  }

  private assertStaffCanAnalyzeBranch(
    staff: AuthenticatedStaff,
    branchTenantId: string,
    branchId: string,
  ) {
    if (staff.tenantId !== branchTenantId) {
      throw new ForbiddenException("Cannot analyze another tenant's branch");
    }

    const canSwitchBranch =
      staff.primaryRole === "OWNER" || staff.primaryRole === "MANAGER";
    if (!canSwitchBranch && staff.branchId !== branchId) {
      throw new ForbiddenException(
        "Branch-bound staff cannot analyze another branch",
      );
    }
  }

  private findScopedReviews(params: {
    tenantId: string;
    branchId: string;
    from: Date;
    to: Date;
    menuItemId?: string;
  }) {
    return this.prisma.review.findMany({
      where: {
        tenantId: params.tenantId,
        branchId: params.branchId,
        createdAt: { gte: params.from, lt: addUtcDays(params.to, 1) },
        ...(params.menuItemId
          ? { itemReviews: { some: { menuItemId: params.menuItemId } } }
          : {}),
      },
      include: {
        issueTags: { select: { tag: true } },
        itemReviews: {
          include: { menuItem: { select: { id: true, name: true } } },
        },
        order: {
          select: {
            id: true,
            orderDateTime: true,
            statusHistory: {
              select: { toStatus: true, changedAt: true },
              orderBy: { changedAt: "asc" },
            },
            orderItems: { select: { startedAt: true, readyAt: true } },
            session: {
              select: {
                serviceRequests: { select: { createdAt: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  private async loadBranchAiControls(tenantId: string, branchId: string) {
    const settings = await this.prisma.branchSettings.findFirst({
      where: { tenantId, branchId },
      select: { aiConfigJson: true },
    });
    return normalizeAiEngineControls(settings?.aiConfigJson);
  }

  private async applyReviewInference(input: {
    branchId: string;
    tenantId: string;
    query: ReviewSentimentQueryDto;
    from: Date;
    to: Date;
    reviews: ReviewWithSignals[];
    controls?: ReturnType<typeof normalizeAiEngineControls>["reviewSentiment"];
    base: {
      sentiment: ReviewSentiment;
      commonIssues: ReviewCommonIssue[];
      affectedItems: ReviewAffectedItem[];
      itemTimelines: ReviewItemComplaintTimeline[];
    };
  }) {
    if (
      !input.controls ||
      input.controls.engineMode === "rules" ||
      input.reviews.length < 3 ||
      !process.env.AI_SERVICE_URL
    ) {
      return {
        mode: "rules" as const,
        sentiment: input.base.sentiment,
        commonIssues: input.base.commonIssues,
        affectedItems: input.base.affectedItems,
        itemTimelines: input.base.itemTimelines,
        modelVersion: undefined,
        confidence: undefined,
        shadowPayload: null,
      };
    }

    const controls = input.controls;
    const inferred = await this.fetchReviewInference({
      ...input,
      controls,
    });
    if (!inferred || inferred.confidence < controls.confidenceThreshold) {
      return {
        mode: "rules" as const,
        sentiment: input.base.sentiment,
        commonIssues: input.base.commonIssues,
        affectedItems: input.base.affectedItems,
        itemTimelines: input.base.itemTimelines,
        modelVersion: inferred?.modelVersion,
        confidence: inferred?.confidence,
        shadowPayload: null,
      };
    }

    if (controls.engineMode === "shadow") {
      return {
        mode: "shadow" as const,
        sentiment: input.base.sentiment,
        commonIssues: input.base.commonIssues,
        affectedItems: input.base.affectedItems,
        itemTimelines: input.base.itemTimelines,
        modelVersion: inferred.modelVersion,
        confidence: inferred.confidence,
        shadowPayload: {
          sentiment: inferred.sentiment,
          commonIssues: inferred.commonIssues,
          affectedItems: inferred.affectedItems,
          itemTimelines: inferred.itemTimelines,
        },
      };
    }

    return {
      mode: "ml" as const,
      sentiment: inferred.sentiment,
      commonIssues: inferred.commonIssues,
      affectedItems: inferred.affectedItems,
      itemTimelines: inferred.itemTimelines,
      modelVersion: inferred.modelVersion,
      confidence: inferred.confidence,
      shadowPayload: {
        sentiment: inferred.sentiment,
        commonIssues: inferred.commonIssues,
        affectedItems: inferred.affectedItems,
        itemTimelines: inferred.itemTimelines,
      },
    };
  }

  private async fetchReviewInference(input: {
    branchId: string;
    tenantId: string;
    query: ReviewSentimentQueryDto;
    from: Date;
    to: Date;
    reviews: ReviewWithSignals[];
    controls: ReturnType<typeof normalizeAiEngineControls>["reviewSentiment"];
    base: {
      sentiment: ReviewSentiment;
      commonIssues: ReviewCommonIssue[];
      affectedItems: ReviewAffectedItem[];
      itemTimelines: ReviewItemComplaintTimeline[];
    };
  }) {
    const aiServiceUrl = process.env.AI_SERVICE_URL;
    if (!aiServiceUrl) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), input.controls.timeoutMs);
    try {
      const response = await fetch(`${aiServiceUrl}/review-sentiment/infer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: input.tenantId,
          branchId: input.branchId,
          from: input.query.from,
          to: input.query.to,
          menuItemId: input.query.menuItemId,
          confidenceThreshold: input.controls.confidenceThreshold,
          modelFamily: input.controls.modelFamily,
          modelVersionPin: input.controls.modelVersionPin,
          reviews: input.reviews.map((review) => ({
            id: review.id,
            createdAt: review.createdAt.toISOString(),
            overallRating: review.overallRating,
            comment: review.comment,
            issueTags: review.issueTags.map((tag) => tag.tag),
            itemReviews: review.itemReviews.map((itemReview) => ({
              menuItemId: itemReview.menuItemId,
              menuItemName: itemReview.menuItem.name,
              rating: itemReview.rating,
              comment: itemReview.comment,
            })),
          })),
          baseline: input.base,
        }),
        signal: controller.signal,
      });
      if (!response.ok) return null;
      const data = (await response.json()) as unknown;
      return validateReviewSentimentInferencePayload(data);
    } catch (error) {
      this.logger.debug(
        `Review sentiment inference unavailable: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async writeAuditLog(
    response: ReviewSentimentResponse,
    details: {
      tenantId: string;
      requestedById: string;
      fromDate: Date;
      toDate: Date;
      menuItemId?: string;
      engineMode: "rules" | "shadow" | "ml";
      shadowPayload: Record<string, unknown> | null;
      modelVersion?: string;
    },
  ) {
    try {
      await this.prisma.reviewSentimentLog.create({
        data: {
          tenantId: details.tenantId,
          branchId: response.branchId,
          requestedById: details.requestedById,
          fromDate: details.fromDate,
          toDate: details.toDate,
          menuItemId: details.menuItemId,
          totalReviews: response.totalReviews,
          averageRating:
            response.totalReviews > 0
              ? new Decimal(response.averageRating)
              : undefined,
          sentiment: response.sentiment,
          commonIssues: {
            source: REVIEW_SENTIMENT_SOURCE,
            engineMode: details.engineMode,
            modelVersion: details.modelVersion,
            items: toJson(response.commonIssues),
            alerts: toJson(response.alerts),
            actionSuggestions: toJson(response.actionSuggestions),
          },
          affectedItems: {
            source: REVIEW_SENTIMENT_SOURCE,
            shadowPayload: toJson(details.shadowPayload),
            items: toJson(response.affectedItems),
            itemTimelines: toJson(response.itemTimelines),
            operationalCorrelations: toJson(response.operationalCorrelations),
          },
        },
      });
    } catch (error) {
      console.warn("Review sentiment audit log write failed", error);
    }
  }
}

function validateReviewSentimentInferencePayload(value: unknown): {
  sentiment: ReviewSentiment;
  commonIssues: ReviewCommonIssue[];
  affectedItems: ReviewAffectedItem[];
  itemTimelines: ReviewItemComplaintTimeline[];
  confidence: number;
  modelVersion: string;
} | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    record.sentiment !== "POSITIVE" &&
    record.sentiment !== "NEUTRAL" &&
    record.sentiment !== "NEGATIVE" &&
    record.sentiment !== "MIXED"
  ) {
    return null;
  }
  if (typeof record.confidence !== "number" || !Number.isFinite(record.confidence)) return null;
  if (typeof record.modelVersion !== "string" || !record.modelVersion.trim()) return null;
  if (!Array.isArray(record.commonIssues) || !Array.isArray(record.affectedItems) || !Array.isArray(record.itemTimelines)) {
    return null;
  }

  const commonIssues: ReviewCommonIssue[] = [];
  for (const item of record.commonIssues) {
    if (!item || typeof item !== "object") return null;
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.issue !== "string" || !candidate.issue.trim()) return null;
    if (typeof candidate.count !== "number" || !Number.isFinite(candidate.count)) return null;
    if (candidate.severity !== "LOW" && candidate.severity !== "MEDIUM" && candidate.severity !== "HIGH") {
      return null;
    }
    commonIssues.push({
      issue: candidate.issue,
      count: candidate.count,
      severity: candidate.severity,
    });
  }

  const affectedItems: ReviewAffectedItem[] = [];
  for (const item of record.affectedItems) {
    if (!item || typeof item !== "object") return null;
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.menuItemId !== "string" || !candidate.menuItemId.trim()) return null;
    if (typeof candidate.name !== "string" || !candidate.name.trim()) return null;
    if (typeof candidate.averageRating !== "number" || !Number.isFinite(candidate.averageRating)) return null;
    if (typeof candidate.issueCount !== "number" || !Number.isFinite(candidate.issueCount)) return null;
    affectedItems.push({
      menuItemId: candidate.menuItemId,
      name: candidate.name,
      averageRating: candidate.averageRating,
      issueCount: candidate.issueCount,
      topIssue: typeof candidate.topIssue === "string" ? candidate.topIssue : undefined,
    });
  }

  const itemTimelines: ReviewItemComplaintTimeline[] = [];
  for (const item of record.itemTimelines) {
    if (!item || typeof item !== "object") return null;
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.menuItemId !== "string" ||
      typeof candidate.name !== "string" ||
      typeof candidate.totalIssueCount !== "number" ||
      !Array.isArray(candidate.points)
    ) {
      return null;
    }
    if (
      candidate.direction !== "IMPROVING" &&
      candidate.direction !== "WORSENING" &&
      candidate.direction !== "STABLE" &&
      candidate.direction !== "INSUFFICIENT_DATA"
    ) {
      return null;
    }
    const points = [];
    for (const point of candidate.points) {
      if (!point || typeof point !== "object") return null;
      const row = point as Record<string, unknown>;
      if (
        typeof row.from !== "string" ||
        typeof row.to !== "string" ||
        typeof row.reviewCount !== "number" ||
        typeof row.averageRating !== "number" ||
        typeof row.issueCount !== "number"
      ) {
        return null;
      }
      points.push({
        from: row.from,
        to: row.to,
        reviewCount: row.reviewCount,
        averageRating: row.averageRating,
        issueCount: row.issueCount,
        topIssue: typeof row.topIssue === "string" ? row.topIssue : undefined,
      });
    }
    itemTimelines.push({
      menuItemId: candidate.menuItemId,
      name: candidate.name,
      totalIssueCount: candidate.totalIssueCount,
      direction: candidate.direction,
      points,
    });
  }

  return {
    sentiment: record.sentiment,
    commonIssues,
    affectedItems,
    itemTimelines,
    confidence: record.confidence,
    modelVersion: record.modelVersion,
  };
}

function calculateCommonIssues(reviews: ReviewWithSignals[]) {
  const counts = new Map<string, number>();
  for (const review of reviews) {
    for (const issueTag of review.issueTags) {
      const issue = normalizeIssueTag(issueTag.tag);
      counts.set(issue, (counts.get(issue) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([issue, count]) => ({
      issue,
      count,
      severity: severityForCount(count),
    }))
    .sort((a, b) => b.count - a.count || a.issue.localeCompare(b.issue))
    .slice(0, 5);
}

function calculateAffectedItems(
  reviews: ReviewWithSignals[],
  menuItemId?: string,
): ReviewAffectedItem[] {
  const byItem = new Map<
    string,
    {
      name: string;
      ratings: number[];
      issueCount: number;
      issueCounts: Map<string, number>;
    }
  >();

  for (const review of reviews) {
    const reviewIssues = review.issueTags.map((issueTag) =>
      normalizeIssueTag(issueTag.tag),
    );

    for (const itemReview of review.itemReviews) {
      if (menuItemId && itemReview.menuItemId !== menuItemId) continue;

      const item = byItem.get(itemReview.menuItemId) ?? {
        name: itemReview.menuItem.name,
        ratings: [],
        issueCount: 0,
        issueCounts: new Map<string, number>(),
      };
      item.ratings.push(itemReview.rating);

      if (itemReview.rating <= 3 || reviewIssues.length > 0) {
        item.issueCount += Math.max(1, reviewIssues.length);
        for (const issue of reviewIssues) {
          item.issueCounts.set(issue, (item.issueCounts.get(issue) ?? 0) + 1);
        }
      }

      byItem.set(itemReview.menuItemId, item);
    }
  }

  return [...byItem.entries()]
    .filter(([, item]) => item.issueCount > 0)
    .map(([id, item]) => ({
      menuItemId: id,
      name: item.name,
      averageRating: round2(
        item.ratings.reduce((sum, rating) => sum + rating, 0) /
          item.ratings.length,
      ),
      issueCount: item.issueCount,
      topIssue: topIssue(item.issueCounts),
    }))
    .sort(
      (a, b) =>
        b.issueCount - a.issueCount ||
        a.averageRating - b.averageRating ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 10);
}

function calculateItemTimelines(
  reviews: ReviewWithSignals[],
  from: Date,
  to: Date,
  menuItemId?: string,
): ReviewItemComplaintTimeline[] {
  const buckets = buildTimelineBuckets(from, to);
  const byItem = new Map<
    string,
    {
      name: string;
      buckets: Array<{
        ratings: number[];
        issueCount: number;
        issueCounts: Map<string, number>;
      }>;
    }
  >();

  for (const review of reviews) {
    const bucketIndex = buckets.findIndex(
      (bucket) =>
        review.createdAt.getTime() >= bucket.from.getTime() &&
        review.createdAt.getTime() < addUtcDays(bucket.to, 1).getTime(),
    );
    if (bucketIndex < 0) continue;

    const reviewIssues = review.issueTags.map((issueTag) =>
      normalizeIssueTag(issueTag.tag),
    );

    for (const itemReview of review.itemReviews) {
      if (menuItemId && itemReview.menuItemId !== menuItemId) continue;

      const item = byItem.get(itemReview.menuItemId) ?? {
        name: itemReview.menuItem.name,
        buckets: buckets.map(() => ({
          ratings: [],
          issueCount: 0,
          issueCounts: new Map<string, number>(),
        })),
      };
      const bucket = item.buckets[bucketIndex];
      bucket.ratings.push(itemReview.rating);

      if (itemReview.rating <= 3 || reviewIssues.length > 0) {
        bucket.issueCount += Math.max(1, reviewIssues.length);
        for (const issue of reviewIssues) {
          bucket.issueCounts.set(issue, (bucket.issueCounts.get(issue) ?? 0) + 1);
        }
      }

      byItem.set(itemReview.menuItemId, item);
    }
  }

  return [...byItem.entries()]
    .map(([id, item]) => {
      const points = item.buckets.map((bucket, index) => ({
        from: formatDateOnly(buckets[index].from),
        to: formatDateOnly(buckets[index].to),
        reviewCount: bucket.ratings.length,
        averageRating: bucket.ratings.length
          ? round2(
              bucket.ratings.reduce((sum, rating) => sum + rating, 0) /
                bucket.ratings.length,
            )
          : 0,
        issueCount: bucket.issueCount,
        topIssue: topIssue(bucket.issueCounts),
      }));
      const totalIssueCount = points.reduce((sum, point) => sum + point.issueCount, 0);

      return {
        menuItemId: id,
        name: item.name,
        totalIssueCount,
        direction: timelineDirection(points),
        points,
      };
    })
    .filter((item) => item.totalIssueCount > 0)
    .sort(
      (a, b) =>
        b.totalIssueCount - a.totalIssueCount ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 5);
}

function calculateOperationalCorrelations(
  reviews: ReviewWithSignals[],
): ReviewOperationalCorrelations {
  const allKitchenMinutes: number[] = [];
  const lateKitchenMinutes: number[] = [];
  const allReadyToServedMinutes: number[] = [];
  const lateReadyToServedMinutes: number[] = [];
  let serviceRequestCount = 0;
  let lateReviewsServiceRequestCount = 0;
  let lateIssueReviewCount = 0;

  for (const review of reviews) {
    const isLateReview = review.issueTags
      .map((issueTag) => normalizeIssueTag(issueTag.tag))
      .includes("late");
    if (isLateReview) lateIssueReviewCount += 1;

    const kitchenMinutes = kitchenDurationMinutes(review);
    if (kitchenMinutes !== null) {
      allKitchenMinutes.push(kitchenMinutes);
      if (isLateReview) lateKitchenMinutes.push(kitchenMinutes);
    }

    const readyToServedMinutes = readyToServedDurationMinutes(review);
    if (readyToServedMinutes !== null) {
      allReadyToServedMinutes.push(readyToServedMinutes);
      if (isLateReview) lateReadyToServedMinutes.push(readyToServedMinutes);
    }

    const reviewServiceRequestCount =
      review.order.session.serviceRequests.filter(
        (request) =>
          request.createdAt.getTime() >= review.order.orderDateTime.getTime() &&
          request.createdAt.getTime() <= review.createdAt.getTime(),
      ).length;
    serviceRequestCount += reviewServiceRequestCount;
    if (isLateReview) lateReviewsServiceRequestCount += reviewServiceRequestCount;
  }

  const averageKitchenMinutes = averageOrNull(allKitchenMinutes);
  const lateReviewsAverageKitchenMinutes = averageOrNull(lateKitchenMinutes);
  const averageReadyToServedMinutes = averageOrNull(allReadyToServedMinutes);
  const lateReviewsAverageReadyToServedMinutes = averageOrNull(
    lateReadyToServedMinutes,
  );
  const signal = operationalSignal({
    averageKitchenMinutes,
    lateReviewsAverageKitchenMinutes,
    averageReadyToServedMinutes,
    lateReviewsAverageReadyToServedMinutes,
    lateIssueReviewCount,
  });

  return {
    reviewedOrderCount: reviews.length,
    lateIssueReviewCount,
    averageKitchenMinutes,
    lateReviewsAverageKitchenMinutes,
    averageReadyToServedMinutes,
    lateReviewsAverageReadyToServedMinutes,
    serviceRequestCount,
    lateReviewsServiceRequestCount,
    signal,
    summary: operationalSummary(signal, {
      lateIssueReviewCount,
      lateReviewsAverageKitchenMinutes,
      lateReviewsAverageReadyToServedMinutes,
      lateReviewsServiceRequestCount,
    }),
  };
}

function calculateAverageRating(reviews: ReviewWithSignals[]) {
  return reviews.length
    ? round2(
        reviews.reduce((sum, review) => sum + review.overallRating, 0) /
          reviews.length,
      )
    : 0;
}

function calculateTrend(params: {
  currentAverageRating: number;
  currentCommonIssues: ReviewCommonIssue[];
  currentTotalReviews: number;
  previousAverageRating: number;
  previousCommonIssues: ReviewCommonIssue[];
  previousFrom: Date;
  previousTo: Date;
  previousTotalReviews: number;
}): ReviewSentimentTrend {
  const averageRatingDelta =
    params.previousTotalReviews > 0
      ? round2(params.currentAverageRating - params.previousAverageRating)
      : 0;
  const currentTopIssue = params.currentCommonIssues[0]?.issue;
  const previousTopIssue = params.previousCommonIssues[0]?.issue;

  return {
    previousFrom: formatDateOnly(params.previousFrom),
    previousTo: formatDateOnly(params.previousTo),
    previousTotalReviews: params.previousTotalReviews,
    previousAverageRating: params.previousAverageRating,
    averageRatingDelta,
    reviewCountDelta: params.currentTotalReviews - params.previousTotalReviews,
    currentTopIssue,
    previousTopIssue,
    topIssueChanged:
      Boolean(currentTopIssue || previousTopIssue) &&
      currentTopIssue !== previousTopIssue,
    direction:
      params.previousTotalReviews === 0
        ? "NO_PRIOR_DATA"
        : averageRatingDelta >= 0.1
          ? "IMPROVING"
          : averageRatingDelta <= -0.1
            ? "DECLINING"
            : "STABLE",
  };
}

function calculateAlerts(params: {
  averageRatingDelta: number;
  commonIssues: ReviewCommonIssue[];
  previousCommonIssues: ReviewCommonIssue[];
  previousTotalReviews: number;
}): ReviewSentimentAlert[] {
  const previousByIssue = new Map(
    params.previousCommonIssues.map((issue) => [issue.issue, issue.count]),
  );
  const alerts: ReviewSentimentAlert[] = [];

  for (const issue of params.commonIssues) {
    const previousCount = previousByIssue.get(issue.issue) ?? 0;
    const countDelta = issue.count - previousCount;
    const doubled = previousCount === 0 ? issue.count >= 3 : issue.count >= previousCount * 2;
    if (issue.count >= 3 && countDelta >= 2 && doubled) {
      alerts.push({
        type: "ISSUE_SPIKE",
        severity: issue.count >= 8 || countDelta >= 6 ? "HIGH" : "MEDIUM",
        issue: issue.issue,
        currentCount: issue.count,
        previousCount,
        countDelta,
        message: `${issue.issue} complaints increased by ${countDelta} versus the previous period.`,
      });
    }
  }

  if (params.previousTotalReviews > 0 && params.averageRatingDelta <= -0.5) {
    alerts.push({
      type: "RATING_DECLINE",
      severity: params.averageRatingDelta <= -1 ? "HIGH" : "MEDIUM",
      ratingDelta: params.averageRatingDelta,
      message: `Average rating declined by ${Math.abs(params.averageRatingDelta).toFixed(2)} points versus the previous period.`,
    });
  }

  return alerts.sort(
    (a, b) =>
      alertSeverityRank(b.severity) - alertSeverityRank(a.severity) ||
      (b.countDelta ?? 0) - (a.countDelta ?? 0) ||
      a.message.localeCompare(b.message),
  );
}

function calculateActionSuggestions(params: {
  alerts: ReviewSentimentAlert[];
  affectedItems: ReviewAffectedItem[];
  commonIssues: ReviewCommonIssue[];
  itemTimelines: ReviewItemComplaintTimeline[];
  operationalCorrelations: ReviewOperationalCorrelations;
  sentiment: ReviewSentiment;
  trend: ReviewSentimentTrend;
}): ReviewActionSuggestion[] {
  const suggestions: ReviewActionSuggestion[] = [];
  const addSuggestion = (suggestion: ReviewActionSuggestion) => {
    if (suggestions.some((existing) => existing.id === suggestion.id)) return;
    suggestions.push(suggestion);
  };

  const operationalSignal = params.operationalCorrelations.signal;
  if (operationalSignal === "KITCHEN_DELAY" || operationalSignal === "BOTH") {
    addSuggestion({
      id: "review-action-kitchen-late-complaints",
      title: "Review prep workflow for late complaints",
      action:
        "Inspect KDS timing for late-complaint orders and check whether specific stations or prep steps are causing delays.",
      reason: params.operationalCorrelations.summary,
      severity: operationalSignal === "BOTH" ? "HIGH" : "MEDIUM",
      relatedIssue: "late",
    });
  }

  if (operationalSignal === "SERVICE_DELAY" || operationalSignal === "BOTH") {
    addSuggestion({
      id: "review-action-ready-handoff-delay",
      title: "Tighten ready-to-served handoff",
      action:
        "Ask waiters to monitor ready orders more closely and confirm whether handoff notifications are being acted on quickly.",
      reason: params.operationalCorrelations.summary,
      severity: operationalSignal === "BOTH" ? "HIGH" : "MEDIUM",
      relatedIssue: "late",
    });
  }

  const topAffected = params.affectedItems[0];
  if (topAffected && (topAffected.issueCount >= 2 || topAffected.averageRating <= 3)) {
    addSuggestion({
      id: `review-action-item-${topAffected.menuItemId}`,
      title: `Inspect ${topAffected.name} consistency`,
      action:
        "Review recipe execution, plating, and service notes for this item before the next busy period.",
      reason: `${topAffected.name} has ${topAffected.issueCount} issue signals and ${topAffected.averageRating.toFixed(2)} average item rating.`,
      severity: topAffected.issueCount >= 5 || topAffected.averageRating <= 2.5 ? "HIGH" : "MEDIUM",
      relatedIssue: topAffected.topIssue,
      menuItemId: topAffected.menuItemId,
      menuItemName: topAffected.name,
    });
  }

  const worseningTimeline = params.itemTimelines.find(
    (item) => item.direction === "WORSENING",
  );
  if (worseningTimeline) {
    addSuggestion({
      id: `review-action-worsening-${worseningTimeline.menuItemId}`,
      title: `Watch worsening feedback for ${worseningTimeline.name}`,
      action:
        "Compare recent preparation and service notes for this item against earlier periods to find what changed.",
      reason: `${worseningTimeline.name} has worsening item-level complaint signals across the selected range.`,
      severity: worseningTimeline.totalIssueCount >= 5 ? "HIGH" : "MEDIUM",
      menuItemId: worseningTimeline.menuItemId,
      menuItemName: worseningTimeline.name,
    });
  }

  const topAlert = params.alerts[0];
  if (topAlert) {
    addSuggestion({
      id: `review-action-alert-${topAlert.type}-${topAlert.issue ?? "rating"}`,
      title:
        topAlert.type === "RATING_DECLINE"
          ? "Investigate the rating decline"
          : `Investigate ${topAlert.issue} complaint spike`,
      action:
        topAlert.type === "RATING_DECLINE"
          ? "Review the affected period by shift, order timing, and item feedback to isolate the decline driver."
          : "Compare recent complaints with kitchen timing, service requests, and affected menu items for the same period.",
      reason: topAlert.message,
      severity: topAlert.severity,
      relatedIssue: topAlert.issue,
    });
  }

  const topIssue = params.commonIssues[0];
  if (topIssue && suggestions.length < 3) {
    addSuggestion({
      id: `review-action-common-issue-${topIssue.issue}`,
      title: `Address repeated ${topIssue.issue} feedback`,
      action:
        "Brief staff on the repeated issue and spot-check the affected workflow during the next service window.",
      reason: `${topIssue.issue} appears ${topIssue.count} time${topIssue.count === 1 ? "" : "s"} in normalized review tags.`,
      severity: topIssue.severity,
      relatedIssue: topIssue.issue,
    });
  }

  if (
    params.sentiment === "NEGATIVE" ||
    params.trend.direction === "DECLINING"
  ) {
    addSuggestion({
      id: "review-action-manager-review",
      title: "Run a manager review of recent feedback",
      action:
        "Have a manager review aggregate feedback, affected items, and operational timing before changing menu or staffing decisions.",
      reason:
        params.sentiment === "NEGATIVE"
          ? "Overall review sentiment is negative for the selected period."
          : "Average rating is declining versus the previous period.",
      severity: params.sentiment === "NEGATIVE" ? "HIGH" : "MEDIUM",
    });
  }

  return suggestions
    .sort(
      (a, b) =>
        actionSeverityRank(b.severity) - actionSeverityRank(a.severity) ||
        a.title.localeCompare(b.title),
    )
    .slice(0, 4);
}

function determineSentiment(
  totalReviews: number,
  averageRating: number,
  commonIssues: ReviewCommonIssue[],
): ReviewSentiment {
  if (totalReviews === 0) return "NEUTRAL";
  if (averageRating >= 4.2) return "POSITIVE";
  if (averageRating < 3.2) return "NEGATIVE";
  return commonIssues.length > 0 ? "MIXED" : "NEUTRAL";
}

function buildSummary(params: {
  totalReviews: number;
  averageRating: number;
  sentiment: ReviewSentiment;
  commonIssues: ReviewCommonIssue[];
  affectedItems: ReviewAffectedItem[];
  trend: ReviewSentimentTrend;
  alerts: ReviewSentimentAlert[];
  itemTimelines: ReviewItemComplaintTimeline[];
  operationalCorrelations: ReviewOperationalCorrelations;
}) {
  if (params.totalReviews === 0) {
    return "No customer reviews were found for this period.";
  }

  const base =
    params.sentiment === "POSITIVE"
      ? `Customer feedback is positive for this period. Average rating is ${params.averageRating} across ${params.totalReviews} reviews.`
      : params.sentiment === "NEUTRAL"
        ? `Customer feedback is generally neutral for this period. Average rating is ${params.averageRating} across ${params.totalReviews} reviews.`
        : `Customer feedback is ${params.sentiment.toLowerCase()} for this period. Average rating is ${params.averageRating} across ${params.totalReviews} reviews.${issueSummary(params.commonIssues)}`;

  return `${base}${affectedItemsSummary(params.affectedItems)}${trendSummary(params.trend)}${alertSummary(params.alerts)}${timelineSummary(params.itemTimelines)}${operationalSummarySentence(params.operationalCorrelations)}`;
}

function issueSummary(commonIssues: ReviewCommonIssue[]) {
  const top = commonIssues.slice(0, 2).map((issue) => issue.issue);
  if (top.length === 0) return "";
  if (top.length === 1) return ` The most common issue is ${top[0]}.`;
  return ` The most common issues are ${top[0]} and ${top[1]}.`;
}

function affectedItemsSummary(affectedItems: ReviewAffectedItem[]) {
  const top = affectedItems.slice(0, 2).map((item) => item.name);
  if (top.length === 0) return "";
  if (top.length === 1) return ` Mostly affecting ${top[0]}.`;
  return ` Mostly affecting ${top[0]} and ${top[1]}.`;
}

function trendSummary(trend: ReviewSentimentTrend) {
  if (trend.direction === "NO_PRIOR_DATA") return "";
  if (trend.direction === "IMPROVING") {
    return ` Average rating improved by ${trend.averageRatingDelta.toFixed(2)} points versus the previous period.`;
  }
  if (trend.direction === "DECLINING") {
    return ` Average rating declined by ${Math.abs(trend.averageRatingDelta).toFixed(2)} points versus the previous period.`;
  }
  return " Average rating is stable versus the previous period.";
}

function alertSummary(alerts: ReviewSentimentAlert[]) {
  const top = alerts[0];
  if (!top) return "";
  return ` Alert: ${top.message}`;
}

function timelineSummary(itemTimelines: ReviewItemComplaintTimeline[]) {
  const worsening = itemTimelines.find((item) => item.direction === "WORSENING");
  if (!worsening) return "";
  return ` ${worsening.name} has worsening item-level complaint signals.`;
}

function operationalSummarySentence(
  correlations: ReviewOperationalCorrelations,
) {
  if (correlations.signal === "NONE" || correlations.signal === "INSUFFICIENT_DATA") {
    return "";
  }
  return ` ${correlations.summary}`;
}

function alertSeverityRank(severity: ReviewSentimentAlert["severity"]) {
  return severity === "HIGH" ? 2 : 1;
}

function actionSeverityRank(severity: ReviewActionSuggestion["severity"]) {
  if (severity === "HIGH") return 3;
  if (severity === "MEDIUM") return 2;
  return 1;
}

function buildTimelineBuckets(from: Date, to: Date) {
  const totalDays = daysInclusive(from, to);
  const bucketCount = Math.min(4, totalDays);
  const baseDays = Math.floor(totalDays / bucketCount);
  const remainder = totalDays % bucketCount;
  const buckets: Array<{ from: Date; to: Date }> = [];
  let cursor = new Date(from);

  for (let index = 0; index < bucketCount; index++) {
    const size = baseDays + (index < remainder ? 1 : 0);
    const bucketFrom = new Date(cursor);
    const bucketTo = addUtcDays(bucketFrom, size - 1);
    buckets.push({ from: bucketFrom, to: bucketTo });
    cursor = addUtcDays(bucketTo, 1);
  }

  return buckets;
}

function timelineDirection(
  points: ReviewItemComplaintTimeline["points"],
): ReviewItemComplaintTimelineDirection {
  const activePoints = points.filter((point) => point.reviewCount > 0);
  if (activePoints.length < 2) return "INSUFFICIENT_DATA";

  const first = activePoints[0];
  const last = activePoints[activePoints.length - 1];
  const issueDelta = last.issueCount - first.issueCount;
  const ratingDelta = last.averageRating - first.averageRating;

  if (issueDelta >= 2 || (issueDelta > 0 && ratingDelta <= -0.5)) {
    return "WORSENING";
  }
  if (issueDelta <= -2 || (issueDelta < 0 && ratingDelta >= 0.5)) {
    return "IMPROVING";
  }
  return "STABLE";
}

function kitchenDurationMinutes(review: ReviewWithSignals) {
  const readyAt = firstStatusAt(review, "READY") ?? latestItemReadyAt(review);
  if (!readyAt) return null;
  return minutesBetween(review.order.orderDateTime, readyAt);
}

function readyToServedDurationMinutes(review: ReviewWithSignals) {
  const readyAt = firstStatusAt(review, "READY") ?? latestItemReadyAt(review);
  const servedAt = firstStatusAt(review, "SERVED");
  if (!readyAt || !servedAt || servedAt.getTime() < readyAt.getTime()) {
    return null;
  }
  return minutesBetween(readyAt, servedAt);
}

function firstStatusAt(review: ReviewWithSignals, status: string) {
  return review.order.statusHistory.find((entry) => entry.toStatus === status)
    ?.changedAt;
}

function latestItemReadyAt(review: ReviewWithSignals) {
  const readyTimes = review.order.orderItems
    .map((item) => item.readyAt)
    .filter((value): value is Date => Boolean(value));
  if (readyTimes.length === 0) return null;
  return new Date(Math.max(...readyTimes.map((value) => value.getTime())));
}

function minutesBetween(from: Date, to: Date) {
  return round2((to.getTime() - from.getTime()) / 60_000);
}

function averageOrNull(values: number[]) {
  if (values.length === 0) return null;
  return round2(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function operationalSignal(params: {
  averageKitchenMinutes: number | null;
  lateReviewsAverageKitchenMinutes: number | null;
  averageReadyToServedMinutes: number | null;
  lateReviewsAverageReadyToServedMinutes: number | null;
  lateIssueReviewCount: number;
}): ReviewOperationalCorrelationSignal {
  if (params.lateIssueReviewCount === 0) return "NONE";

  const kitchenDelay =
    params.averageKitchenMinutes !== null &&
    params.lateReviewsAverageKitchenMinutes !== null &&
    params.lateReviewsAverageKitchenMinutes >= params.averageKitchenMinutes + 5;
  const serviceDelay =
    params.averageReadyToServedMinutes !== null &&
    params.lateReviewsAverageReadyToServedMinutes !== null &&
    params.lateReviewsAverageReadyToServedMinutes >=
      params.averageReadyToServedMinutes + 3;

  if (kitchenDelay && serviceDelay) return "BOTH";
  if (kitchenDelay) return "KITCHEN_DELAY";
  if (serviceDelay) return "SERVICE_DELAY";
  if (
    params.averageKitchenMinutes === null &&
    params.averageReadyToServedMinutes === null
  ) {
    return "INSUFFICIENT_DATA";
  }
  return "NONE";
}

function operationalSummary(
  signal: ReviewOperationalCorrelationSignal,
  details: {
    lateIssueReviewCount: number;
    lateReviewsAverageKitchenMinutes: number | null;
    lateReviewsAverageReadyToServedMinutes: number | null;
    lateReviewsServiceRequestCount: number;
  },
) {
  if (signal === "INSUFFICIENT_DATA") {
    return "Operational timing data is not available for reviewed orders.";
  }
  if (signal === "NONE") {
    return details.lateIssueReviewCount === 0
      ? "No late-complaint correlation was detected for this period."
      : "Late complaints did not show a clear operational timing correlation.";
  }

  const kitchenText =
    details.lateReviewsAverageKitchenMinutes !== null
      ? `late-complaint orders averaged ${details.lateReviewsAverageKitchenMinutes} kitchen minutes`
      : "kitchen timing was unavailable";
  const serviceText =
    details.lateReviewsAverageReadyToServedMinutes !== null
      ? `${details.lateReviewsAverageReadyToServedMinutes} minutes from ready to served`
      : "ready-to-served timing was unavailable";

  if (signal === "KITCHEN_DELAY") {
    return `Operational correlation: ${kitchenText}.`;
  }
  if (signal === "SERVICE_DELAY") {
    return `Operational correlation: late-complaint orders averaged ${serviceText}.`;
  }
  return `Operational correlation: ${kitchenText} and ${serviceText}.`;
}

function severityForCount(count: number): ReviewIssueSeverity {
  if (count >= 10) return "HIGH";
  if (count >= 4) return "MEDIUM";
  return "LOW";
}

function topIssue(issueCounts: Map<string, number>) {
  return [...issueCounts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0]?.[0];
}

function normalizeIssueTag(tag: string) {
  return tag.trim().toLowerCase().replace(/[_-]+/g, " ");
}

function parseIsoDateOnly(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(`${field} must be an ISO date`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new BadRequestException(`${field} must be a valid ISO date`);
  }
  return date;
}

function daysInclusive(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

function addUtcDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
