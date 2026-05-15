import { Controller, Get, Post, Param, Body, Inject } from "@nestjs/common";
import { ReviewsService } from "./reviews.service.js";
import { Public } from "../auth/decorators/public.decorator.js";
import { CreateReviewDto } from "./dto/create-review.dto.js";

@Public()
@Controller()
export class ReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviews: ReviewsService) {}

  @Post("sessions/:sessionId/orders/:orderId/reviews")
  async create(
    @Param("sessionId") sessionId: string,
    @Param("orderId") orderId: string,
    @Body() body: CreateReviewDto,
  ) {
    return this.reviews.createReview(orderId, sessionId, body);
  }

  @Get("sessions/:sessionId/orders/:orderId/reviews")
  async get(
    @Param("sessionId") sessionId: string,
    @Param("orderId") orderId: string,
  ) {
    return this.reviews.getReviewForOrder(orderId, sessionId);
  }
}
