-- CreateEnum
CREATE TYPE "ReportFrequency" AS ENUM ('DAILY', 'WEEKLY');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'REPORT';

-- CreateTable
CREATE TABLE "ScheduledBusinessSummary" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "frequency" "ReportFrequency" NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduledBusinessSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledBusinessSummary_tenantId_branchId_reportDate_idx" ON "ScheduledBusinessSummary"("tenantId", "branchId", "reportDate");

-- AddForeignKey
ALTER TABLE "ScheduledBusinessSummary" ADD CONSTRAINT "ScheduledBusinessSummary_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledBusinessSummary" ADD CONSTRAINT "ScheduledBusinessSummary_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
