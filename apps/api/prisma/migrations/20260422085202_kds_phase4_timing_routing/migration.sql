-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "defaultStationId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "readyAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_defaultStationId_fkey" FOREIGN KEY ("defaultStationId") REFERENCES "KitchenStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
