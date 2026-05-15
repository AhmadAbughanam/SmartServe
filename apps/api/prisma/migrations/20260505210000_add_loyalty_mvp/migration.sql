-- CreateEnum
CREATE TYPE "LoyaltyLedgerEntryType" AS ENUM ('EARN', 'REDEEM', 'REFUND_REVERSAL', 'EXPIRE', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LoyaltyRewardRedemptionStatus" AS ENUM ('ISSUED', 'REDEEMED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "LoyaltyProgram" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Default Loyalty Program',
  "pointsPerCurrency" DECIMAL(12,2) NOT NULL DEFAULT 1,
  "pointsPerReward" INTEGER NOT NULL DEFAULT 100,
  "rewardValue" DECIMAL(12,2) NOT NULL DEFAULT 5,
  "pointExpiryMonths" INTEGER NOT NULL DEFAULT 12,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LoyaltyProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyAccount" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "pointsBalance" INTEGER NOT NULL DEFAULT 0,
  "lifetimePoints" INTEGER NOT NULL DEFAULT 0,
  "tier" TEXT NOT NULL DEFAULT 'BRONZE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyLedgerEntry" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "branchId" TEXT,
  "accountId" TEXT NOT NULL,
  "orderId" TEXT,
  "paymentId" TEXT,
  "refundId" TEXT,
  "type" "LoyaltyLedgerEntryType" NOT NULL,
  "points" INTEGER NOT NULL,
  "description" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LoyaltyLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyReward" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "pointsCost" INTEGER NOT NULL,
  "rewardValue" DECIMAL(12,2) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LoyaltyReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyRewardRedemption" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "rewardId" TEXT NOT NULL,
  "couponId" TEXT,
  "pointsSpent" INTEGER NOT NULL,
  "status" "LoyaltyRewardRedemptionStatus" NOT NULL DEFAULT 'ISSUED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "redeemedAt" TIMESTAMP(3),

  CONSTRAINT "LoyaltyRewardRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyProgram_tenantId_key" ON "LoyaltyProgram"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyAccount_tenantId_userId_key" ON "LoyaltyAccount"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_tenantId_tier_idx" ON "LoyaltyAccount"("tenantId", "tier");

-- CreateIndex
CREATE INDEX "LoyaltyLedgerEntry_tenantId_accountId_createdAt_idx" ON "LoyaltyLedgerEntry"("tenantId", "accountId", "createdAt");

-- CreateIndex
CREATE INDEX "LoyaltyLedgerEntry_paymentId_idx" ON "LoyaltyLedgerEntry"("paymentId");

-- CreateIndex
CREATE INDEX "LoyaltyLedgerEntry_refundId_idx" ON "LoyaltyLedgerEntry"("refundId");

-- CreateIndex
CREATE INDEX "LoyaltyReward_tenantId_isActive_idx" ON "LoyaltyReward"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "LoyaltyRewardRedemption_tenantId_accountId_createdAt_idx" ON "LoyaltyRewardRedemption"("tenantId", "accountId", "createdAt");

-- AddForeignKey
ALTER TABLE "LoyaltyProgram" ADD CONSTRAINT "LoyaltyProgram_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LoyaltyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyReward" ADD CONSTRAINT "LoyaltyReward_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyReward" ADD CONSTRAINT "LoyaltyReward_programId_fkey" FOREIGN KEY ("programId") REFERENCES "LoyaltyProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRewardRedemption" ADD CONSTRAINT "LoyaltyRewardRedemption_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRewardRedemption" ADD CONSTRAINT "LoyaltyRewardRedemption_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LoyaltyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRewardRedemption" ADD CONSTRAINT "LoyaltyRewardRedemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "LoyaltyReward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyRewardRedemption" ADD CONSTRAINT "LoyaltyRewardRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;
