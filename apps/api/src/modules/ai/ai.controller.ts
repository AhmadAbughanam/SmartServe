import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
} from "@nestjs/common";
import { RecommendationService } from "./recommendation.service.js";
import { CartRecommendationDto, ChatbotQueryDto } from "./dto/ai.dto.js";
import { MenuChatRequestDto } from "./dto/menu-chat-request.dto.js";
import { MenuChatbotService } from "./menu-chatbot.service.js";
import { Public } from "../auth/decorators/public.decorator.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import type { AuthenticatedCustomer, AuthenticatedStaff } from "../auth/types/auth.types.js";
import type { MenuChatResponse } from "@smart-restaurant/shared-types";

@Controller("ai")
export class AiController {
  constructor(
    @Inject(RecommendationService)
    private readonly recommendationService: RecommendationService,
    @Inject(MenuChatbotService)
    private readonly menuChatbotService: MenuChatbotService,
  ) {}

  /**
   * Branch recommendations — public or customer-auth.
   * Accepts optional sessionId, categoryId, userId via query params.
   */
  @Public()
  @Get("recommendations")
  getBranchRecommendations(
    @Query("branchId") branchId: string,
    @Query("sessionId") sessionId: string | undefined,
    @Query("categoryId") categoryId: string | undefined,
    @Query("limit") limit: string | undefined,
  ) {
    return this.recommendationService.getBranchRecommendations(branchId, {
      sessionId,
      categoryId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  /**
   * Cart-based recommendations — "frequently bought together".
   */
  @Public()
  @Post("recommendations/cart")
  getCartRecommendations(@Body() dto: CartRecommendationDto) {
    return this.recommendationService.getCartRecommendations(
      dto.branchId,
      dto.cartItemIds,
      dto.limit,
    );
  }

  /**
   * Customer-specific recommendations.
   * Requires customer auth so we know the userId.
   */
  @Get("recommendations/customer")
  getCustomerRecommendations(
    @Query("branchId") branchId: string,
    @Query("limit") limit: string | undefined,
    @CurrentUser() user: AuthenticatedCustomer,
  ) {
    return this.recommendationService.getCustomerRecommendations(
      user.userId,
      branchId,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  /** Canonical customer menu chatbot endpoint. */
  @Public()
  @Post("menu-chat")
  menuChat(@Body() dto: MenuChatRequestDto): Promise<MenuChatResponse> {
    return this.menuChatbotService.chat(dto);
  }

  /** Legacy alias kept temporarily during frontend migration. */
  @Public()
  @Post("chatbot/menu")
  chatbotMenu(@Body() dto: ChatbotQueryDto): Promise<MenuChatResponse> {
    return this.menuChatbotService.chat({
      branchId: dto.branchId,
      sessionId: dto.sessionId,
      message: dto.message,
      cartItems: [],
    });
  }

  /** Admin: recompute co-purchase recommendation stats. */
  @Post("recommendations/recompute")
  @RequirePermissions("admin:write")
  recomputeStats(
    @Query("branchId") branchId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.recommendationService.recomputeStats(branchId, staff.tenantId);
  }
}
