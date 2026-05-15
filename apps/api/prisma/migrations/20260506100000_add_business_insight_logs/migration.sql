CREATE TABLE "BusinessInsightLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "requestedById" TEXT,
    "scope" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "insightCount" INTEGER NOT NULL,
    "categories" JSONB,
    "priorities" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessInsightLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessInsightLog_tenantId_branchId_createdAt_idx" ON "BusinessInsightLog"("tenantId", "branchId", "createdAt");
CREATE INDEX "BusinessInsightLog_requestedById_idx" ON "BusinessInsightLog"("requestedById");

ALTER TABLE "BusinessInsightLog" ADD CONSTRAINT "BusinessInsightLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BusinessInsightLog" ADD CONSTRAINT "BusinessInsightLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BusinessInsightLog" ADD CONSTRAINT "BusinessInsightLog_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
