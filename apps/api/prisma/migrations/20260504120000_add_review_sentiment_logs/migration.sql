-- CreateTable
CREATE TABLE "ReviewSentimentLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "requestedById" TEXT,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "menuItemId" TEXT,
    "totalReviews" INTEGER NOT NULL,
    "averageRating" DECIMAL(3,2),
    "sentiment" TEXT NOT NULL,
    "commonIssues" JSONB,
    "affectedItems" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewSentimentLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewSentimentLog_tenantId_branchId_createdAt_idx" ON "ReviewSentimentLog"("tenantId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewSentimentLog_requestedById_idx" ON "ReviewSentimentLog"("requestedById");

-- AddForeignKey
ALTER TABLE "ReviewSentimentLog" ADD CONSTRAINT "ReviewSentimentLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewSentimentLog" ADD CONSTRAINT "ReviewSentimentLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewSentimentLog" ADD CONSTRAINT "ReviewSentimentLog_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
