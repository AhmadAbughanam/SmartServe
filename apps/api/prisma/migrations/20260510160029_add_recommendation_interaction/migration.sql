-- CreateEnum
CREATE TYPE "RecommendationInteractionType" AS ENUM ('IMPRESSION', 'CLICK', 'ADD_TO_CART', 'PURCHASED', 'DISMISSED');

-- CreateTable
CREATE TABLE "RecommendationInteraction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "menuItemId" TEXT NOT NULL,
    "interactionType" "RecommendationInteractionType" NOT NULL,
    "surface" TEXT,
    "traceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandForecastAccuracy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "lookbackDays" INTEGER NOT NULL,
    "forecastedOrders" INTEGER NOT NULL,
    "actualOrders" INTEGER NOT NULL,
    "forecastedRevenue" DECIMAL(12,2) NOT NULL,
    "actualRevenue" DECIMAL(12,2) NOT NULL,
    "itemAccuracy" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemandForecastAccuracy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecommendationInteraction_tenantId_branchId_createdAt_idx" ON "RecommendationInteraction"("tenantId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationInteraction_traceId_idx" ON "RecommendationInteraction"("traceId");

-- CreateIndex
CREATE INDEX "DemandForecastAccuracy_tenantId_branchId_date_idx" ON "DemandForecastAccuracy"("tenantId", "branchId", "date");

-- AddForeignKey
ALTER TABLE "RecommendationInteraction" ADD CONSTRAINT "RecommendationInteraction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationInteraction" ADD CONSTRAINT "RecommendationInteraction_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationInteraction" ADD CONSTRAINT "RecommendationInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationInteraction" ADD CONSTRAINT "RecommendationInteraction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationInteraction" ADD CONSTRAINT "RecommendationInteraction_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandForecastAccuracy" ADD CONSTRAINT "DemandForecastAccuracy_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandForecastAccuracy" ADD CONSTRAINT "DemandForecastAccuracy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
