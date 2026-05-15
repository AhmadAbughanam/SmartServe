CREATE TABLE "OperationalEventLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "sessionId" TEXT,
    "tableId" TEXT,
    "orderId" TEXT,
    "actorStaffId" TEXT,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalEventLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentEventLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "orderId" TEXT,
    "sessionId" TEXT,
    "paymentId" TEXT,
    "eventType" TEXT NOT NULL,
    "provider" TEXT,
    "externalId" TEXT,
    "amount" DECIMAL(12,2),
    "status" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEventLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OperationalEventLog_tenantId_branchId_createdAt_idx" ON "OperationalEventLog"("tenantId", "branchId", "createdAt");
CREATE INDEX "OperationalEventLog_sessionId_createdAt_idx" ON "OperationalEventLog"("sessionId", "createdAt");
CREATE INDEX "OperationalEventLog_orderId_createdAt_idx" ON "OperationalEventLog"("orderId", "createdAt");
CREATE INDEX "OperationalEventLog_eventType_createdAt_idx" ON "OperationalEventLog"("eventType", "createdAt");

CREATE INDEX "PaymentEventLog_tenantId_branchId_createdAt_idx" ON "PaymentEventLog"("tenantId", "branchId", "createdAt");
CREATE INDEX "PaymentEventLog_paymentId_createdAt_idx" ON "PaymentEventLog"("paymentId", "createdAt");
CREATE INDEX "PaymentEventLog_externalId_idx" ON "PaymentEventLog"("externalId");
CREATE INDEX "PaymentEventLog_eventType_createdAt_idx" ON "PaymentEventLog"("eventType", "createdAt");

ALTER TABLE "OperationalEventLog" ADD CONSTRAINT "OperationalEventLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalEventLog" ADD CONSTRAINT "OperationalEventLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalEventLog" ADD CONSTRAINT "OperationalEventLog_actorStaffId_fkey" FOREIGN KEY ("actorStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentEventLog" ADD CONSTRAINT "PaymentEventLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentEventLog" ADD CONSTRAINT "PaymentEventLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
