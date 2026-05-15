import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import type { MenuRecommendationResponse } from "@smart-restaurant/shared-types";
import { Public } from "../auth/decorators/public.decorator.js";
import { RecommendationService } from "../ai/recommendation.service.js";
import { MenuRecommendationRequestDto } from "./dto/menu-recommendation-request.dto.js";
import { RecommendationTelemetryDto } from "./dto/recommendation-telemetry.dto.js";

@Controller("recommendations")
export class RecommendationsController {
  constructor(
    @Inject(RecommendationService)
    private readonly recommendationService: RecommendationService,
  ) {}

  @Public()
  @Post("menu")
  getMenuRecommendations(
    @Body() dto: MenuRecommendationRequestDto,
  ): Promise<MenuRecommendationResponse> {
    return this.recommendationService.getMenuRecommendations(dto);
  }

  @Public()
  @Post("telemetry")
  @HttpCode(202)
  trackInteraction(@Body() dto: RecommendationTelemetryDto): void {
    void this.recommendationService.trackInteraction(dto);
  }
}
