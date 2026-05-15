-- CreateTable
CREATE TABLE "RecommendationLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MENU_RECOMMENDATION_ENGINE',
    "inputCartItemIds" TEXT[],
    "recommendedItemIds" TEXT[],
    "recommendationTypes" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecommendationLog_tenantId_branchId_createdAt_idx" ON "RecommendationLog"("tenantId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationLog_userId_idx" ON "RecommendationLog"("userId");

-- CreateIndex
CREATE INDEX "RecommendationLog_sessionId_idx" ON "RecommendationLog"("sessionId");

-- AddForeignKey
ALTER TABLE "RecommendationLog" ADD CONSTRAINT "RecommendationLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationLog" ADD CONSTRAINT "RecommendationLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationLog" ADD CONSTRAINT "RecommendationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationLog" ADD CONSTRAINT "RecommendationLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
