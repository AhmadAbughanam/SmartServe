import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DiscountType, LoyaltyLedgerEntryType, PaymentStatus, RefundStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "../../prisma/prisma.service.js";
import type {
  CreateLoyaltyRewardDto,
  ManualLoyaltyAdjustmentDto,
  UpdateLoyaltyProgramDto,
  UpdateLoyaltyRewardDto,
} from "./dto/loyalty.dto.js";

@Injectable()
export class LoyaltyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getProgram(tenantId: string) {
    const program = await this.ensureProgram(tenantId);
    await this.ensureDefaultReward(tenantId, program.id);
    return this.prisma.loyaltyProgram.findUniqueOrThrow({
      where: { tenantId },
      include: { rewards: { orderBy: { pointsCost: "asc" } } },
    });
  }

  async updateProgram(
    tenantId: string,
    dto: UpdateLoyaltyProgramDto,
    staffId: string,
    staffBranchId: string,
  ) {
    if (dto.pointsPerCurrency !== undefined && dto.pointsPerCurrency < 0) {
      throw new BadRequestException("Points per currency cannot be negative");
    }

    const before = await this.ensureProgram(tenantId);
    const updated = await this.prisma.loyaltyProgram.update({
      where: { tenantId },
      data: {
        name: dto.name,
        pointsPerCurrency: dto.pointsPerCurrency,
        pointsPerReward: dto.pointsPerReward,
        rewardValue: dto.rewardValue,
        pointExpiryMonths: dto.pointExpiryMonths,
        isActive: dto.isActive,
      },
      include: { rewards: { orderBy: { pointsCost: "asc" } } },
    });

    await this.audit(tenantId, staffBranchId, staffId, "LOYALTY_PROGRAM_UPDATED", "LoyaltyProgram", updated.id, {
      name: before.name,
      isActive: before.isActive,
      pointsPerCurrency: before.pointsPerCurrency.toString(),
      pointsPerReward: before.pointsPerReward,
      rewardValue: before.rewardValue.toString(),
    }, {
      name: updated.name,
      isActive: updated.isActive,
      pointsPerCurrency: updated.pointsPerCurrency.toString(),
      pointsPerReward: updated.pointsPerReward,
      rewardValue: updated.rewardValue.toString(),
    });

    return updated;
  }

  async listRewards(tenantId: string) {
    await this.getProgram(tenantId);
    return this.prisma.loyaltyReward.findMany({
      where: { tenantId },
      orderBy: [{ isActive: "desc" }, { pointsCost: "asc" }],
      include: { _count: { select: { redemptions: true } } },
    });
  }

  async createReward(tenantId: string, dto: CreateLoyaltyRewardDto, staffId: string, staffBranchId: string) {
    const program = await this.ensureProgram(tenantId);
    const reward = await this.prisma.loyaltyReward.create({
      data: {
        tenantId,
        programId: program.id,
        name: dto.name,
        pointsCost: dto.pointsCost,
        rewardValue: dto.rewardValue,
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit(tenantId, staffBranchId, staffId, "LOYALTY_REWARD_CREATED", "LoyaltyReward", reward.id, null, reward);
    return reward;
  }

  async updateReward(
    rewardId: string,
    tenantId: string,
    dto: UpdateLoyaltyRewardDto,
    staffId: string,
    staffBranchId: string,
  ) {
    const before = await this.prisma.loyaltyReward.findUnique({ where: { id: rewardId } });
    if (!before || before.tenantId !== tenantId) throw new NotFoundException("Loyalty reward not found");
    const updated = await this.prisma.loyaltyReward.update({
      where: { id: rewardId },
      data: {
        name: dto.name,
        pointsCost: dto.pointsCost,
        rewardValue: dto.rewardValue,
        isActive: dto.isActive,
      },
    });
    await this.audit(tenantId, staffBranchId, staffId, "LOYALTY_REWARD_UPDATED", "LoyaltyReward", rewardId, {
      name: before.name,
      pointsCost: before.pointsCost,
      rewardValue: before.rewardValue.toString(),
      isActive: before.isActive,
    }, {
      name: updated.name,
      pointsCost: updated.pointsCost,
      rewardValue: updated.rewardValue.toString(),
      isActive: updated.isActive,
    });
    return updated;
  }

  async deleteReward(rewardId: string, tenantId: string, staffId: string, staffBranchId: string) {
    const reward = await this.prisma.loyaltyReward.findUnique({
      where: { id: rewardId },
      include: { _count: { select: { redemptions: true } } },
    });
    if (!reward || reward.tenantId !== tenantId) throw new NotFoundException("Loyalty reward not found");

    if (reward._count.redemptions > 0) {
      const disabled = await this.prisma.loyaltyReward.update({
        where: { id: rewardId },
        data: { isActive: false },
      });
      await this.audit(tenantId, staffBranchId, staffId, "LOYALTY_REWARD_DISABLED", "LoyaltyReward", rewardId, {
        isActive: reward.isActive,
      }, {
        isActive: false,
        reason: "Historical redemptions preserve reward record",
      });
      return { deleted: false, disabled: true, reward: disabled };
    }

    await this.prisma.loyaltyReward.delete({ where: { id: rewardId } });
    await this.audit(tenantId, staffBranchId, staffId, "LOYALTY_REWARD_DELETED", "LoyaltyReward", rewardId, {
      name: reward.name,
      pointsCost: reward.pointsCost,
    }, null);
    return { deleted: true, disabled: false, id: rewardId };
  }

  async listMembers(tenantId: string) {
    const accounts = await this.prisma.loyaltyAccount.findMany({
      where: { tenantId },
      orderBy: [{ pointsBalance: "desc" }, { updatedAt: "desc" }],
      take: 50,
      include: {
        user: { select: { id: true, name: true, phone: true, email: true, lastVisitAt: true } },
        _count: { select: { ledgerEntries: true, redemptions: true } },
      },
    });

    const totals = accounts.reduce(
      (acc, account) => {
        acc.pointsBalance += account.pointsBalance;
        acc.lifetimePoints += account.lifetimePoints;
        return acc;
      },
      { pointsBalance: 0, lifetimePoints: 0 },
    );

    return {
      totalMembers: accounts.length,
      pointsLiability: totals.pointsBalance,
      lifetimePoints: totals.lifetimePoints,
      members: accounts,
    };
  }

  async adjustMember(
    userId: string,
    tenantId: string,
    dto: ManualLoyaltyAdjustmentDto,
    staffId: string,
    staffBranchId: string,
  ) {
    if (dto.points === 0) throw new BadRequestException("Adjustment points cannot be zero");
    const user = await this.prisma.user.findFirst({ where: { id: userId, OR: [{ tenantId }, { tenantId: null }] } });
    if (!user) throw new NotFoundException("Customer not found");
    const account = await this.ensureAccount(tenantId, userId);
    const newBalance = Math.max(0, account.pointsBalance + dto.points);
    const positiveLifetimeDelta = dto.points > 0 ? dto.points : 0;

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          pointsBalance: newBalance,
          lifetimePoints: { increment: positiveLifetimeDelta },
          tier: this.tierFor(account.lifetimePoints + positiveLifetimeDelta),
        },
      });
      await tx.loyaltyLedgerEntry.create({
        data: {
          tenantId,
          branchId: staffBranchId,
          accountId: account.id,
          type: LoyaltyLedgerEntryType.MANUAL_ADJUSTMENT,
          points: dto.points,
          description: dto.description ?? "Manual loyalty adjustment",
        },
      });
      return next;
    });

    await this.audit(tenantId, staffBranchId, staffId, "LOYALTY_POINTS_ADJUSTED", "LoyaltyAccount", account.id, {
      pointsBalance: account.pointsBalance,
    }, {
      pointsBalance: updated.pointsBalance,
      delta: dto.points,
    });
    return updated;
  }

  async redeemRewardForMember(userId: string, rewardId: string, tenantId: string) {
    const reward = await this.prisma.loyaltyReward.findFirst({ where: { id: rewardId, tenantId, isActive: true } });
    if (!reward) throw new NotFoundException("Active loyalty reward not found");
    const account = await this.ensureAccount(tenantId, userId);
    if (account.pointsBalance < reward.pointsCost) throw new BadRequestException("Not enough loyalty points");

    const code = await this.uniqueCouponCode(tenantId);
    return this.prisma.$transaction(async (tx) => {
      const discount = await tx.discount.create({
        data: {
          tenantId,
          name: `${reward.name} loyalty reward`,
          type: DiscountType.FIXED,
          value: reward.rewardValue,
          scope: "ORDER",
          isActive: true,
          description: "Generated from loyalty points redemption",
        },
      });
      const coupon = await tx.coupon.create({
        data: {
          tenantId,
          code,
          discountId: discount.id,
          maxRedemptions: 1,
          perUserLimit: 1,
          expiresAt: this.addDays(new Date(), 90),
          isActive: true,
        },
      });
      const updatedAccount = await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: { pointsBalance: { decrement: reward.pointsCost } },
      });
      await tx.loyaltyLedgerEntry.create({
        data: {
          tenantId,
          accountId: account.id,
          type: LoyaltyLedgerEntryType.REDEEM,
          points: -reward.pointsCost,
          description: `Redeemed ${reward.name}`,
        },
      });
      const redemption = await tx.loyaltyRewardRedemption.create({
        data: {
          tenantId,
          accountId: account.id,
          rewardId: reward.id,
          couponId: coupon.id,
          pointsSpent: reward.pointsCost,
        },
        include: { coupon: true, reward: true },
      });
      return { account: updatedAccount, redemption };
    });
  }

  async postEarnForPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: { select: { userId: true, tenantId: true, branchId: true } } },
    });
    if (!payment || payment.paymentStatus !== PaymentStatus.COMPLETED || !payment.order.userId) return;

    const program = await this.prisma.loyaltyProgram.findUnique({ where: { tenantId: payment.tenantId } });
    if (!program?.isActive) return;

    const existing = await this.prisma.loyaltyLedgerEntry.findFirst({
      where: { tenantId: payment.tenantId, paymentId, type: LoyaltyLedgerEntryType.EARN },
      select: { id: true },
    });
    if (existing) return;

    const points = Math.floor(payment.amount.toNumber() * program.pointsPerCurrency.toNumber());
    if (points <= 0) return;

    const account = await this.ensureAccount(payment.tenantId, payment.order.userId);
    await this.prisma.$transaction(async (tx) => {
      await tx.loyaltyLedgerEntry.create({
        data: {
          tenantId: payment.tenantId,
          branchId: payment.branchId,
          accountId: account.id,
          orderId: payment.orderId,
          paymentId: payment.id,
          type: LoyaltyLedgerEntryType.EARN,
          points,
          description: `Earned from payment ${payment.id}`,
          expiresAt: this.addMonths(new Date(), program.pointExpiryMonths),
        },
      });
      await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          pointsBalance: { increment: points },
          lifetimePoints: { increment: points },
          tier: this.tierFor(account.lifetimePoints + points),
        },
      });
    });
  }

  async reverseForRefund(refundId: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: { order: { select: { userId: true } } },
    });
    if (!refund || refund.status !== RefundStatus.COMPLETED || !refund.order.userId) return;

    const program = await this.prisma.loyaltyProgram.findUnique({ where: { tenantId: refund.tenantId } });
    if (!program?.isActive) return;

    const existing = await this.prisma.loyaltyLedgerEntry.findFirst({
      where: { tenantId: refund.tenantId, refundId, type: LoyaltyLedgerEntryType.REFUND_REVERSAL },
      select: { id: true },
    });
    if (existing) return;

    const rawPoints = Math.floor(refund.amount.toNumber() * program.pointsPerCurrency.toNumber());
    if (rawPoints <= 0) return;

    const account = await this.ensureAccount(refund.tenantId, refund.order.userId);
    const pointsToReverse = Math.min(rawPoints, account.pointsBalance);
    if (pointsToReverse <= 0) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.loyaltyLedgerEntry.create({
        data: {
          tenantId: refund.tenantId,
          branchId: refund.branchId,
          accountId: account.id,
          orderId: refund.orderId,
          paymentId: refund.paymentId,
          refundId: refund.id,
          type: LoyaltyLedgerEntryType.REFUND_REVERSAL,
          points: -pointsToReverse,
          description: `Reversed from refund ${refund.id}`,
        },
      });
      await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: { pointsBalance: { decrement: pointsToReverse } },
      });
    });
  }

  private async ensureProgram(tenantId: string) {
    return this.prisma.loyaltyProgram.upsert({
      where: { tenantId },
      update: {},
      create: {
        tenantId,
        name: "Default Loyalty Program",
        pointsPerCurrency: new Decimal(1),
        pointsPerReward: 100,
        rewardValue: new Decimal(5),
        pointExpiryMonths: 12,
        isActive: false,
      },
    });
  }

  private async ensureDefaultReward(tenantId: string, programId: string) {
    const existing = await this.prisma.loyaltyReward.findFirst({ where: { tenantId, programId } });
    if (existing) return existing;
    return this.prisma.loyaltyReward.create({
      data: {
        tenantId,
        programId,
        name: "$5 off next order",
        pointsCost: 100,
        rewardValue: new Decimal(5),
      },
    });
  }

  private async ensureAccount(tenantId: string, userId: string) {
    return this.prisma.loyaltyAccount.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      update: {},
      create: { tenantId, userId },
    });
  }

  private tierFor(lifetimePoints: number) {
    if (lifetimePoints >= 5000) return "PLATINUM";
    if (lifetimePoints >= 2000) return "GOLD";
    if (lifetimePoints >= 500) return "SILVER";
    return "BRONZE";
  }

  private addMonths(date: Date, months: number) {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private async uniqueCouponCode(tenantId: string) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = `LOYALTY-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const existing = await this.prisma.coupon.findUnique({ where: { tenantId_code: { tenantId, code } } });
      if (!existing) return code;
    }
    throw new BadRequestException("Could not generate a loyalty coupon code");
  }

  private async audit(
    tenantId: string,
    branchId: string,
    staffId: string,
    actionCode: string,
    entityType: string,
    entityId: string,
    beforeJson: unknown,
    afterJson: unknown,
  ) {
    await this.prisma.auditLog.create({
      data: {
        tenantId,
        branchId,
        actorStaffId: staffId,
        actionCode,
        entityType,
        entityId,
        beforeJson: beforeJson ?? undefined,
        afterJson: afterJson ?? undefined,
      },
    });
  }
}
