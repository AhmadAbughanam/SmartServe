import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DiscountType, GiftCardStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../../prisma/prisma.service.js";
import type { CreateDiscountDto, UpdateDiscountDto } from "./dto/discount.dto.js";
import type { CreateCouponDto, UpdateCouponDto } from "./dto/coupon.dto.js";
import type { CreateGiftCardDto, UpdateGiftCardDto, RedeemGiftCardDto } from "./dto/gift-card.dto.js";

@Injectable()
export class PromotionsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ── Discounts ────────────────────────────────────────

  async listDiscounts(tenantId: string, branchId?: string, activeOnly?: boolean) {
    const where: Record<string, unknown> = { tenantId };
    if (branchId) where["OR"] = [{ branchId }, { branchId: null }];
    if (activeOnly) where["isActive"] = true;

    return this.prisma.discount.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { coupons: true } },
        coupons: { select: { _count: { select: { redemptions: true } } } },
      },
    });
  }

  async getDiscount(discountId: string, tenantId: string) {
    const d = await this.prisma.discount.findUnique({
      where: { id: discountId },
      include: { coupons: true },
    });
    if (!d || d.tenantId !== tenantId) throw new NotFoundException("Discount not found");
    return d;
  }

  async createDiscount(tenantId: string, dto: CreateDiscountDto, staffId: string, staffBranchId: string) {
    if (dto.type === DiscountType.PERCENT && dto.value > 100) {
      throw new BadRequestException("Percentage discount cannot exceed 100%");
    }

    if (dto.branchId) {
      const branch = await this.prisma.branch.findFirst({ where: { id: dto.branchId, tenantId } });
      if (!branch) throw new BadRequestException("Branch not found in tenant");
    }

    const discount = await this.prisma.discount.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        value: dto.value,
        scope: dto.scope ?? "ORDER",
        branchId: dto.branchId,
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
      },
    });

    await this.audit(tenantId, dto.branchId ?? staffBranchId, staffId, "DISCOUNT_CREATED", "Discount", discount.id, null, {
      name: dto.name, type: dto.type, value: dto.value,
    });

    return discount;
  }

  async updateDiscount(discountId: string, tenantId: string, dto: UpdateDiscountDto, staffId: string, staffBranchId: string) {
    const d = await this.prisma.discount.findUnique({ where: { id: discountId } });
    if (!d || d.tenantId !== tenantId) throw new NotFoundException("Discount not found");

    if (dto.value !== undefined && d.type === DiscountType.PERCENT && dto.value > 100) {
      throw new BadRequestException("Percentage discount cannot exceed 100%");
    }

    const updated = await this.prisma.discount.update({
      where: { id: discountId },
      data: {
        name: dto.name,
        description: dto.description,
        value: dto.value,
        scope: dto.scope,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
        isActive: dto.isActive,
      },
    });

    await this.audit(tenantId, d.branchId ?? staffBranchId, staffId, "DISCOUNT_UPDATED", "Discount", discountId,
      { name: d.name, value: d.value.toString(), isActive: d.isActive },
      { name: updated.name, value: updated.value.toString(), isActive: updated.isActive },
    );

    return updated;
  }

  async deleteDiscount(discountId: string, tenantId: string, staffId: string, staffBranchId: string) {
    const d = await this.prisma.discount.findUnique({
      where: { id: discountId },
      include: { _count: { select: { coupons: true } } },
    });
    if (!d || d.tenantId !== tenantId) throw new NotFoundException("Discount not found");

    if (d._count.coupons > 0) {
      const updated = await this.prisma.discount.update({
        where: { id: discountId },
        data: { isActive: false },
      });
      await this.audit(tenantId, d.branchId ?? staffBranchId, staffId, "DISCOUNT_DISABLED", "Discount", discountId,
        { isActive: d.isActive }, { isActive: updated.isActive, reason: "Linked coupons preserve history" },
      );
      return { deleted: false, disabled: true, discount: updated };
    }

    await this.prisma.discount.delete({ where: { id: discountId } });
    await this.audit(tenantId, d.branchId ?? staffBranchId, staffId, "DISCOUNT_DELETED", "Discount", discountId,
      { name: d.name, value: d.value.toString(), isActive: d.isActive }, null,
    );
    return { deleted: true, disabled: false, id: discountId };
  }

  // ── Coupons ──────────────────────────────────────────

  async listCoupons(tenantId: string, activeOnly?: boolean) {
    const where: Record<string, unknown> = { tenantId };
    if (activeOnly) where["isActive"] = true;

    return this.prisma.coupon.findMany({
      where,
      orderBy: { code: "asc" },
      include: { discount: { select: { name: true, type: true, value: true, isActive: true } } },
    });
  }

  async getCoupon(couponId: string, tenantId: string) {
    const c = await this.prisma.coupon.findUnique({
      where: { id: couponId },
      include: { discount: true },
    });
    if (!c || c.tenantId !== tenantId) throw new NotFoundException("Coupon not found");
    return c;
  }

  async createCoupon(tenantId: string, dto: CreateCouponDto, staffId: string, staffBranchId: string) {
    const discount = await this.prisma.discount.findUnique({ where: { id: dto.discountId } });
    if (!discount || discount.tenantId !== tenantId) {
      throw new BadRequestException("Discount not found in tenant");
    }

    const coupon = await this.prisma.coupon.create({
      data: {
        tenantId,
        code: dto.code.toUpperCase(),
        discountId: dto.discountId,
        maxRedemptions: dto.maxRedemptions,
        perUserLimit: dto.perUserLimit,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      include: { discount: { select: { name: true, type: true, value: true } } },
    });

    await this.audit(tenantId, staffBranchId, staffId, "COUPON_CREATED", "Coupon", coupon.id, null, {
      code: coupon.code, discountId: dto.discountId,
    });

    return coupon;
  }

  async updateCoupon(couponId: string, tenantId: string, dto: UpdateCouponDto, staffId: string, staffBranchId: string) {
    const c = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    if (!c || c.tenantId !== tenantId) throw new NotFoundException("Coupon not found");

    if (dto.discountId) {
      const discount = await this.prisma.discount.findUnique({ where: { id: dto.discountId } });
      if (!discount || discount.tenantId !== tenantId) {
        throw new BadRequestException("Discount not found in tenant");
      }
    }

    const updated = await this.prisma.coupon.update({
      where: { id: couponId },
      data: {
        code: dto.code ? dto.code.toUpperCase() : undefined,
        discountId: dto.discountId,
        maxRedemptions: dto.maxRedemptions,
        perUserLimit: dto.perUserLimit,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        isActive: dto.isActive,
      },
    });

    await this.audit(tenantId, staffBranchId, staffId, "COUPON_UPDATED", "Coupon", couponId,
      { isActive: c.isActive }, { isActive: updated.isActive },
    );

    return updated;
  }

  async deleteCoupon(couponId: string, tenantId: string, staffId: string, staffBranchId: string) {
    const c = await this.prisma.coupon.findUnique({
      where: { id: couponId },
      include: { _count: { select: { redemptions: true } } },
    });
    if (!c || c.tenantId !== tenantId) throw new NotFoundException("Coupon not found");

    if (c._count.redemptions > 0) {
      const updated = await this.prisma.coupon.update({
        where: { id: couponId },
        data: { isActive: false },
      });
      await this.audit(tenantId, staffBranchId, staffId, "COUPON_DISABLED", "Coupon", couponId,
        { code: c.code, isActive: c.isActive }, { code: updated.code, isActive: updated.isActive, reason: "Redemption history preserved" },
      );
      return { deleted: false, disabled: true, coupon: updated };
    }

    await this.prisma.coupon.delete({ where: { id: couponId } });
    await this.audit(tenantId, staffBranchId, staffId, "COUPON_DELETED", "Coupon", couponId,
      { code: c.code, isActive: c.isActive }, null,
    );
    return { deleted: true, disabled: false, id: couponId };
  }

  async validateCoupon(tenantId: string, code: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { tenantId_code: { tenantId, code: code.toUpperCase() } },
      include: { discount: true },
    });

    if (!coupon) {
      return { valid: false, reason: "Coupon not found" };
    }
    if (!coupon.isActive) {
      return { valid: false, reason: "Coupon is inactive" };
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return { valid: false, reason: "Coupon has expired" };
    }
    if (!coupon.discount.isActive) {
      return { valid: false, reason: "Associated discount is inactive" };
    }
    if (coupon.discount.endAt && coupon.discount.endAt < new Date()) {
      return { valid: false, reason: "Associated discount has expired" };
    }

    return {
      valid: true,
      couponId: coupon.id,
      code: coupon.code,
      discount: {
        id: coupon.discount.id,
        name: coupon.discount.name,
        type: coupon.discount.type,
        value: coupon.discount.value.toString(),
      },
    };
  }

  // ── Gift Cards ───────────────────────────────────────

  async listGiftCards(tenantId: string, statusFilter?: GiftCardStatus) {
    const where: Record<string, unknown> = { tenantId };
    if (statusFilter) where["status"] = statusFilter;

    return this.prisma.giftCard.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }

  async getGiftCard(giftCardId: string, tenantId: string) {
    const gc = await this.prisma.giftCard.findUnique({ where: { id: giftCardId } });
    if (!gc || gc.tenantId !== tenantId) throw new NotFoundException("Gift card not found");
    return gc;
  }

  async createGiftCard(tenantId: string, dto: CreateGiftCardDto, staffId: string, staffBranchId: string) {
    const gc = await this.prisma.giftCard.create({
      data: {
        tenantId,
        code: dto.code.toUpperCase(),
        initialAmount: dto.initialAmount,
        balanceAmount: dto.initialAmount,
        status: GiftCardStatus.ACTIVE,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    await this.audit(tenantId, staffBranchId, staffId, "GIFT_CARD_CREATED", "GiftCard", gc.id, null, {
      code: gc.code, initialAmount: dto.initialAmount,
    });

    return gc;
  }

  async updateGiftCard(giftCardId: string, tenantId: string, dto: UpdateGiftCardDto, staffId: string, staffBranchId: string) {
    const gc = await this.prisma.giftCard.findUnique({ where: { id: giftCardId } });
    if (!gc || gc.tenantId !== tenantId) throw new NotFoundException("Gift card not found");

    const updated = await this.prisma.giftCard.update({
      where: { id: giftCardId },
      data: {
        status: dto.status,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });

    await this.audit(tenantId, staffBranchId, staffId, "GIFT_CARD_UPDATED", "GiftCard", giftCardId,
      { status: gc.status }, { status: updated.status },
    );

    return updated;
  }

  async deleteGiftCard(giftCardId: string, tenantId: string, staffId: string, staffBranchId: string) {
    const gc = await this.prisma.giftCard.findUnique({
      where: { id: giftCardId },
      include: { _count: { select: { transactions: true } } },
    });
    if (!gc || gc.tenantId !== tenantId) throw new NotFoundException("Gift card not found");

    if (gc._count.transactions > 0 || !gc.balanceAmount.eq(gc.initialAmount)) {
      const updated = await this.prisma.giftCard.update({
        where: { id: giftCardId },
        data: { status: GiftCardStatus.DISABLED },
      });
      await this.audit(tenantId, staffBranchId, staffId, "GIFT_CARD_DISABLED", "GiftCard", giftCardId,
        { code: gc.code, status: gc.status }, { code: updated.code, status: updated.status, reason: "Transaction history preserved" },
      );
      return { deleted: false, disabled: true, giftCard: updated };
    }

    await this.prisma.giftCard.delete({ where: { id: giftCardId } });
    await this.audit(tenantId, staffBranchId, staffId, "GIFT_CARD_DELETED", "GiftCard", giftCardId,
      { code: gc.code, status: gc.status, initialAmount: gc.initialAmount.toString() }, null,
    );
    return { deleted: true, disabled: false, id: giftCardId };
  }

  async redeemGiftCard(giftCardId: string, tenantId: string, dto: RedeemGiftCardDto, staffId: string, staffBranchId: string) {
    const gc = await this.prisma.giftCard.findUnique({ where: { id: giftCardId } });
    if (!gc || gc.tenantId !== tenantId) throw new NotFoundException("Gift card not found");

    if (gc.status !== GiftCardStatus.ACTIVE) {
      throw new BadRequestException(`Cannot redeem: gift card is ${gc.status}`);
    }
    if (gc.expiresAt && gc.expiresAt < new Date()) {
      throw new BadRequestException("Gift card has expired");
    }

    const redeemAmount = new Decimal(dto.amount);
    if (redeemAmount.gt(gc.balanceAmount)) {
      throw new BadRequestException(
        `Redemption amount ${dto.amount} exceeds balance ${gc.balanceAmount}`,
      );
    }

    const newBalance = gc.balanceAmount.sub(redeemAmount);
    const newStatus = newBalance.eq(0) ? GiftCardStatus.REDEEMED : gc.status;

    const updated = await this.prisma.giftCard.update({
      where: { id: giftCardId },
      data: { balanceAmount: newBalance, status: newStatus },
    });

    await this.audit(tenantId, staffBranchId, staffId, "GIFT_CARD_REDEEMED", "GiftCard", giftCardId, {
      balanceAmount: gc.balanceAmount.toString(), status: gc.status,
    }, {
      balanceAmount: newBalance.toString(), status: newStatus,
      redeemedAmount: dto.amount, orderId: dto.orderId ?? null,
    });

    return {
      ...updated,
      redeemedAmount: dto.amount,
      previousBalance: gc.balanceAmount.toString(),
    };
  }

  // ── Helpers ──────────────────────────────────────────

  private async audit(
    tenantId: string, branchId: string, actorStaffId: string,
    actionCode: string, entityType: string, entityId: string,
    beforeJson: unknown, afterJson: unknown,
  ) {
    await this.prisma.auditLog.create({
      data: {
        tenantId, branchId, actorStaffId, actionCode, entityType, entityId,
        beforeJson: beforeJson as any, afterJson: afterJson as any,
      },
    });
  }
}
