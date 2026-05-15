import { Controller, Get, Inject, Query } from "@nestjs/common";
import type { ReviewSentimentResponse } from "@smart-restaurant/shared-types";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";
import { ReviewSentimentQueryDto } from "./dto/review-sentiment-query.dto.js";
import { ReviewSentimentService } from "./review-sentiment.service.js";

@Controller()
export class ReviewSentimentController {
  constructor(
    @Inject(ReviewSentimentService)
    private readonly reviewSentimentService: ReviewSentimentService,
  ) {}

  @Get("admin/ai/review-sentiment")
  @RequirePermissions("analytics:read")
  getReviewSentiment(
    @Query() query: ReviewSentimentQueryDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ): Promise<ReviewSentimentResponse> {
    return this.reviewSentimentService.getReviewSentiment(query, staff);
  }
}
