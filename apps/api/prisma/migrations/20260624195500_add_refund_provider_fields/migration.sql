ALTER TABLE "Refund"
ADD COLUMN "providerRefundId" TEXT,
ADD COLUMN "providerStatus" TEXT;

CREATE INDEX "Refund_providerRefundId_idx" ON "Refund"("providerRefundId");
