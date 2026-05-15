-- CreateTable
CREATE TABLE "DemandForecastLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "requestedById" TEXT,
    "forecastDate" TIMESTAMP(3) NOT NULL,
    "lookbackDays" INTEGER NOT NULL,
    "categoryId" TEXT,
    "expectedOrders" INTEGER NOT NULL,
    "expectedRevenue" DECIMAL(12,2),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemandForecastLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DemandForecastLog_tenantId_branchId_createdAt_idx" ON "DemandForecastLog"("tenantId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "DemandForecastLog_requestedById_idx" ON "DemandForecastLog"("requestedById");

-- AddForeignKey
ALTER TABLE "DemandForecastLog" ADD CONSTRAINT "DemandForecastLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandForecastLog" ADD CONSTRAINT "DemandForecastLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandForecastLog" ADD CONSTRAINT "DemandForecastLog_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
