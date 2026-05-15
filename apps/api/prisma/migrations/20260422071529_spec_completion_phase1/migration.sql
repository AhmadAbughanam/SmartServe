-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('KDS', 'WAITER', 'POS', 'ADMIN', 'CDS', 'OTHER');

-- CreateEnum
CREATE TYPE "AccessTagType" AS ENUM ('QR', 'NFC');

-- CreateEnum
CREATE TYPE "ServiceChargeType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "StockAdjustmentSource" AS ENUM ('MANUAL', 'ORDER_AUTO', 'WASTE', 'CORRECTION', 'DELIVERY');

-- CreateEnum
CREATE TYPE "LowStockAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "GiftCardTransactionType" AS ENUM ('ISSUED', 'REDEEMED', 'ADJUSTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TableShape" AS ENUM ('RECTANGLE', 'CIRCLE', 'SQUARE', 'L_SHAPE');

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "allergensJson" JSONB,
ADD COLUMN     "isSpicy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isVegetarian" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "lastEditedByStaffId" TEXT;

-- AlterTable
ALTER TABLE "Table" ADD COLUMN     "posX" INTEGER,
ADD COLUMN     "posY" INTEGER,
ADD COLUMN     "shape" "TableShape",
ADD COLUMN     "zone" TEXT;

-- CreateTable
CREATE TABLE "BranchDevice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceType" "DeviceType" NOT NULL,
    "apiKeyHash" TEXT,
    "capabilitiesJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableAccessTag" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "AccessTagType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableAccessTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchSettings" (
    "branchId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "serviceChargeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "serviceChargeType" "ServiceChargeType" NOT NULL DEFAULT 'PERCENT',
    "serviceChargeValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tipsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tipPresetsJson" JSONB,
    "paymentConfigJson" JSONB,
    "featureFlagsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchSettings_pkey" PRIMARY KEY ("branchId")
);

-- CreateTable
CREATE TABLE "StockAdjustment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "delta" DECIMAL(12,3) NOT NULL,
    "reason" TEXT,
    "createdByStaffId" TEXT,
    "sourceType" "StockAdjustmentSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LowStockAlert" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "thresholdSnapshot" DECIMAL(12,3) NOT NULL,
    "stockSnapshot" DECIMAL(12,3) NOT NULL,
    "status" "LowStockAlertStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "LowStockAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT,
    "orderId" TEXT,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCardTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "giftCardId" TEXT NOT NULL,
    "orderId" TEXT,
    "type" "GiftCardTransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByStaffId" TEXT,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "GiftCardTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationStat" (
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "coPurchasedItemId" TEXT NOT NULL,
    "categoryId" TEXT,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastComputedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationStat_pkey" PRIMARY KEY ("tenantId","branchId","menuItemId","coPurchasedItemId")
);

-- CreateTable
CREATE TABLE "ReviewIssueTag" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "ReviewIssueTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BranchDevice_branchId_idx" ON "BranchDevice"("branchId");

-- CreateIndex
CREATE INDEX "BranchDevice_tenantId_idx" ON "BranchDevice"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchDevice_branchId_name_key" ON "BranchDevice"("branchId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TableAccessTag_code_key" ON "TableAccessTag"("code");

-- CreateIndex
CREATE INDEX "TableAccessTag_branchId_idx" ON "TableAccessTag"("branchId");

-- CreateIndex
CREATE INDEX "TableAccessTag_tableId_idx" ON "TableAccessTag"("tableId");

-- CreateIndex
CREATE INDEX "BranchSettings_tenantId_idx" ON "BranchSettings"("tenantId");

-- CreateIndex
CREATE INDEX "StockAdjustment_inventoryItemId_createdAt_idx" ON "StockAdjustment"("inventoryItemId", "createdAt");

-- CreateIndex
CREATE INDEX "StockAdjustment_branchId_createdAt_idx" ON "StockAdjustment"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "LowStockAlert_branchId_status_idx" ON "LowStockAlert"("branchId", "status");

-- CreateIndex
CREATE INDEX "LowStockAlert_inventoryItemId_idx" ON "LowStockAlert"("inventoryItemId");

-- CreateIndex
CREATE INDEX "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");

-- CreateIndex
CREATE INDEX "CouponRedemption_branchId_redeemedAt_idx" ON "CouponRedemption"("branchId", "redeemedAt");

-- CreateIndex
CREATE INDEX "GiftCardTransaction_giftCardId_createdAt_idx" ON "GiftCardTransaction"("giftCardId", "createdAt");

-- CreateIndex
CREATE INDEX "GiftCardTransaction_branchId_createdAt_idx" ON "GiftCardTransaction"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewIssueTag_reviewId_idx" ON "ReviewIssueTag"("reviewId");

-- CreateIndex
CREATE INDEX "ReviewIssueTag_tag_idx" ON "ReviewIssueTag"("tag");

-- AddForeignKey
ALTER TABLE "BranchDevice" ADD CONSTRAINT "BranchDevice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchDevice" ADD CONSTRAINT "BranchDevice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableAccessTag" ADD CONSTRAINT "TableAccessTag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableAccessTag" ADD CONSTRAINT "TableAccessTag_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableAccessTag" ADD CONSTRAINT "TableAccessTag_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchSettings" ADD CONSTRAINT "BranchSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchSettings" ADD CONSTRAINT "BranchSettings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LowStockAlert" ADD CONSTRAINT "LowStockAlert_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LowStockAlert" ADD CONSTRAINT "LowStockAlert_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LowStockAlert" ADD CONSTRAINT "LowStockAlert_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCardTransaction" ADD CONSTRAINT "GiftCardTransaction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCardTransaction" ADD CONSTRAINT "GiftCardTransaction_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCardTransaction" ADD CONSTRAINT "GiftCardTransaction_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "GiftCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCardTransaction" ADD CONSTRAINT "GiftCardTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCardTransaction" ADD CONSTRAINT "GiftCardTransaction_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationStat" ADD CONSTRAINT "RecommendationStat_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationStat" ADD CONSTRAINT "RecommendationStat_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationStat" ADD CONSTRAINT "RecommendationStat_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationStat" ADD CONSTRAINT "RecommendationStat_coPurchasedItemId_fkey" FOREIGN KEY ("coPurchasedItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationStat" ADD CONSTRAINT "RecommendationStat_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewIssueTag" ADD CONSTRAINT "ReviewIssueTag_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
