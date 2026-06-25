CREATE UNIQUE INDEX "Session_active_table_unique_idx"
ON "Session"("tableId")
WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "Payment_orderId_paymentReference_key"
ON "Payment"("orderId", "paymentReference");

DROP INDEX IF EXISTS "Refund_providerRefundId_idx";
CREATE UNIQUE INDEX "Refund_providerRefundId_key"
ON "Refund"("providerRefundId")
WHERE "providerRefundId" IS NOT NULL;
