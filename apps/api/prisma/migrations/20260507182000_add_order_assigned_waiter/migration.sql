-- Assign orders to the waiter responsible for serving them.
ALTER TABLE "Order" ADD COLUMN "assignedWaiterId" TEXT;

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_assignedWaiterId_fkey"
  FOREIGN KEY ("assignedWaiterId") REFERENCES "Staff"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Order_assignedWaiterId_orderStatus_idx" ON "Order"("assignedWaiterId", "orderStatus");
