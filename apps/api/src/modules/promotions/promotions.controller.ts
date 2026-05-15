import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import type { GiftCardStatus } from "@prisma/client";
import { PromotionsService } from "./promotions.service.js";
import { CreateDiscountDto, UpdateDiscountDto } from "./dto/discount.dto.js";
import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from "./dto/coupon.dto.js";
import { CreateGiftCardDto, UpdateGiftCardDto, RedeemGiftCardDto } from "./dto/gift-card.dto.js";
import { CurrentStaff } from "../auth/decorators/current-staff.decorator.js";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator.js";
import type { AuthenticatedStaff } from "../auth/types/auth.types.js";

@Controller("promotions")
export class PromotionsController {
  constructor(
    @Inject(PromotionsService)
    private readonly promotionsService: PromotionsService,
  ) {}

  // ── Discounts ────────────────────────────────────────

  @Get("discounts")
  @RequirePermissions("promotions:read")
  listDiscounts(
    @Query("branchId") branchId: string | undefined,
    @Query("active") active: string | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.promotionsService.listDiscounts(staff.tenantId, branchId, active === "true");
  }

  @Get("discounts/:discountId")
  @RequirePermissions("promotions:read")
  getDiscount(
    @Param("discountId") discountId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.promotionsService.getDiscount(discountId, staff.tenantId);
  }

  @Post("discounts")
  @RequirePermissions("promotions:write")
  createDiscount(
    @Body() dto: CreateDiscountDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.promotionsService.createDiscount(staff.tenantId, dto, staff.staffId, staff.branchId);
  }

  @Patch("discounts/:discountId")
  @RequirePermissions("promotions:write")
  updateDiscount(
    @Param("discountId") discountId: string,
    @Body() dto: UpdateDiscountDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.promotionsService.updateDiscount(discountId, staff.tenantId, dto, staff.staffId, staff.branchId);
  }

  @Delete("discounts/:discountId")
  @RequirePermissions("promotions:write")
  deleteDiscount(
    @Param("discountId") discountId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.promotionsService.deleteDiscount(discountId, staff.tenantId, staff.staffId, staff.branchId);
  }

  // ── Coupons ──────────────────────────────────────────

  @Get("coupons")
  @RequirePermissions("coupons:read")
  listCoupons(
    @Query("active") active: string | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.promotionsService.listCoupons(staff.tenantId, active === "true");
  }

  @Get("coupons/:couponId")
  @RequirePermissions("coupons:read")
  getCoupon(
    @Param("couponId") couponId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.promotionsService.getCoupon(couponId, staff.tenantId);
  }

  @Post("coupons")
  @RequirePermissions("coupons:write")
  createCoupon(
    @Body() dto: CreateCouponDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.promotionsService.createCoupon(staff.tenantId, dto, staff.staffId, staff.branchId);
  }

  @Patch("coupons/:couponId")
  @RequirePermissions("coupons:write")
  updateCoupon(
    @Param("couponId") couponId: string,
    @Body() dto: UpdateCouponDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.promotionsService.updateCoupon(couponId, staff.tenantId, dto, staff.staffId, staff.branchId);
  }

  @Delete("coupons/:couponId")
  @RequirePermissions("coupons:write")
  deleteCoupon(
    @Param("couponId") couponId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.promotionsService.deleteCoupon(couponId, staff.tenantId, staff.staffId, staff.branchId);
  }

  @Post("coupons/validate")
  @RequirePermissions("coupons:read")
  validateCoupon(
    @Body() dto: ValidateCouponDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.promotionsService.validateCoupon(staff.tenantId, dto.code);
  }

  // ── Gift Cards ───────────────────────────────────────

  @Get("gift-cards")
  @RequirePermissions("gift-cards:read")
  listGiftCards(
    @Query("status") status: GiftCardStatus | undefined,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.promotionsService.listGiftCards(staff.tenantId, status);
  }

  @Get("gift-cards/:giftCardId")
  @RequirePermissions("gift-cards:read")
  getGiftCard(
    @Param("giftCardId") giftCardId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.promotionsService.getGiftCard(giftCardId, staff.tenantId);
  }

  @Post("gift-cards")
  @RequirePermissions("gift-cards:write")
  createGiftCard(
    @Body() dto: CreateGiftCardDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.promotionsService.createGiftCard(staff.tenantId, dto, staff.staffId, staff.branchId);
  }

  @Patch("gift-cards/:giftCardId")
  @RequirePermissions("gift-cards:write")
  updateGiftCard(
    @Param("giftCardId") giftCardId: string,
    @Body() dto: UpdateGiftCardDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.promotionsService.updateGiftCard(giftCardId, staff.tenantId, dto, staff.staffId, staff.branchId);
  }

  @Delete("gift-cards/:giftCardId")
  @RequirePermissions("gift-cards:write")
  deleteGiftCard(
    @Param("giftCardId") giftCardId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.promotionsService.deleteGiftCard(giftCardId, staff.tenantId, staff.staffId, staff.branchId);
  }

  @Post("gift-cards/:giftCardId/redeem")
  @RequirePermissions("gift-cards:redeem")
  redeemGiftCard(
    @Param("giftCardId") giftCardId: string,
    @Body() dto: RedeemGiftCardDto,
    @CurrentStaff() staff: AuthenticatedStaff,
  ) {
    return this.promotionsService.redeemGiftCard(giftCardId, staff.tenantId, dto, staff.staffId, staff.branchId);
  }
}
