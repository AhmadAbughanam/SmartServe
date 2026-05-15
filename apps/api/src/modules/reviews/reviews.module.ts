import { Module } from "@nestjs/common";
import { ReviewSentimentController } from "./review-sentiment.controller.js";
import { ReviewSentimentService } from "./review-sentiment.service.js";
import { ReviewsController } from "./reviews.controller.js";
import { ReviewsService } from "./reviews.service.js";

@Module({
  controllers: [ReviewsController, ReviewSentimentController],
  providers: [ReviewsService, ReviewSentimentService],
  exports: [ReviewsService, ReviewSentimentService],
})
export class ReviewsModule {}
