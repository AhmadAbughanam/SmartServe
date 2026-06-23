-- CreateEnum
CREATE TYPE "TenantSubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SaasInvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'OVERDUE');

-- CreateTable
CREATE TABLE "TenantSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "status" "TenantSubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "trialEndsAt" TIMESTAMP(3),
    "billingPeriodStart" TIMESTAMP(3),
    "billingPeriodEnd" TIMESTAMP(3),
    "nextInvoiceAt" TIMESTAMP(3),
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaasInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "status" "SaasInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaasInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantSubscription_tenantId_key" ON "TenantSubscription"("tenantId");

-- CreateIndex
CREATE INDEX "TenantSubscription_status_idx" ON "TenantSubscription"("status");

-- CreateIndex
CREATE INDEX "TenantSubscription_nextInvoiceAt_idx" ON "TenantSubscription"("nextInvoiceAt");

-- CreateIndex
CREATE UNIQUE INDEX "SaasInvoice_invoiceNumber_key" ON "SaasInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "SaasInvoice_tenantId_createdAt_idx" ON "SaasInvoice"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "SaasInvoice_status_dueAt_idx" ON "SaasInvoice"("status", "dueAt");

-- CreateIndex
CREATE INDEX "SaasInvoice_subscriptionId_idx" ON "SaasInvoice"("subscriptionId");

-- AddForeignKey
ALTER TABLE "TenantSubscription" ADD CONSTRAINT "TenantSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasInvoice" ADD CONSTRAINT "SaasInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaasInvoice" ADD CONSTRAINT "SaasInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "TenantSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
