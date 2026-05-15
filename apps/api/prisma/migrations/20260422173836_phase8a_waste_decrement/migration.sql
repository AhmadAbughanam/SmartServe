-- CreateEnum
CREATE TYPE "WasteType" AS ENUM ('WASTE', 'REMAKE');

-- CreateEnum
CREATE TYPE "WasteReason" AS ENUM ('BURNT', 'WRONG_ITEM', 'CUSTOMER_CHANGE', 'DAMAGED', 'QUALITY_ISSUE', 'OTHER');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "inventoryDecrementedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WasteRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "orderId" TEXT,
    "orderItemId" TEXT,
    "menuItemId" TEXT NOT NULL,
    "stationId" TEXT,
    "type" "WasteType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "reasonCode" "WasteReason" NOT NULL,
    "note" TEXT,
    "createdByStaffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WasteRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WasteRecord_branchId_createdAt_idx" ON "WasteRecord"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "WasteRecord_menuItemId_idx" ON "WasteRecord"("menuItemId");

-- AddForeignKey
ALTER TABLE "WasteRecord" ADD CONSTRAINT "WasteRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteRecord" ADD CONSTRAINT "WasteRecord_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteRecord" ADD CONSTRAINT "WasteRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteRecord" ADD CONSTRAINT "WasteRecord_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteRecord" ADD CONSTRAINT "WasteRecord_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
