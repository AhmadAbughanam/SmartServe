import { Injectable, Inject, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";

const VALID_ISSUE_TAGS = ["COLD", "LATE", "WRONG_ITEM", "TASTE", "OTHER"] as const;

@Injectable()
export class ReviewsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createReview(
    orderId: string,
    sessionId: string,
    data: {
      overallRating: number;
      comment?: string;
      issueTags?: string[];
      itemReviews?: Array<{ menuItemId: string; rating: number; comment?: string }>;
    },
  ) {
    // Validate order belongs to session and is completed
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, sessionId },
      include: { orderItems: true },
    });
    if (!order) throw new NotFoundException("Order not found in this session");
    if (order.orderStatus !== "COMPLETED" && order.orderStatus !== "SERVED") {
      throw new BadRequestException("Reviews can only be submitted after the order is served");
    }

    // Check for existing review
    const existing = await this.prisma.review.findFirst({
      where: { orderId },
    });
    if (existing) throw new BadRequestException("A review already exists for this order");

    // Validate rating range
    if (data.overallRating < 1 || data.overallRating > 5) {
      throw new BadRequestException("Rating must be between 1 and 5");
    }

    // Validate issue tags
    if (data.issueTags?.length) {
      for (const tag of data.issueTags) {
        if (!VALID_ISSUE_TAGS.includes(tag as typeof VALID_ISSUE_TAGS[number])) {
          throw new BadRequestException(`Invalid issue tag: ${tag}`);
        }
      }
    }

    // Validate item reviews reference actual order items
    if (data.itemReviews?.length) {
      const orderMenuItemIds = new Set(order.orderItems.map((oi) => oi.menuItemId));
      for (const ir of data.itemReviews) {
        if (!orderMenuItemIds.has(ir.menuItemId)) {
          throw new BadRequestException(`Item ${ir.menuItemId} is not in this order`);
        }
        if (ir.rating < 1 || ir.rating > 5) {
          throw new BadRequestException("Item rating must be between 1 and 5");
        }
      }
    }

    return this.prisma.review.create({
      data: {
        tenantId: order.tenantId,
        branchId: order.branchId,
        orderId,
        overallRating: data.overallRating,
        comment: data.comment,
        issueTags: data.issueTags?.length
          ? { create: data.issueTags.map((tag) => ({ tag })) }
          : undefined,
        itemReviews: data.itemReviews?.length
          ? { create: data.itemReviews.map((ir) => ({ menuItemId: ir.menuItemId, rating: ir.rating, comment: ir.comment })) }
          : undefined,
      },
      include: { issueTags: true, itemReviews: true },
    });
  }

  async getReviewForOrder(orderId: string, sessionId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, sessionId },
    });
    if (!order) throw new NotFoundException("Order not found in this session");

    return this.prisma.review.findFirst({
      where: { orderId },
      include: { issueTags: true, itemReviews: { include: { menuItem: { select: { id: true, name: true } } } } },
    });
  }
}
