-- Customer menu item favorites.
-- Stores only aggregate preference metadata: user, tenant, branch, menu item, timestamp.
CREATE TABLE "MenuItemFavorite" (
    "userId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuItemFavorite_pkey" PRIMARY KEY ("userId", "menuItemId", "branchId")
);

CREATE INDEX "MenuItemFavorite_userId_branchId_idx" ON "MenuItemFavorite"("userId", "branchId");
CREATE INDEX "MenuItemFavorite_tenantId_branchId_idx" ON "MenuItemFavorite"("tenantId", "branchId");
CREATE INDEX "MenuItemFavorite_menuItemId_idx" ON "MenuItemFavorite"("menuItemId");

ALTER TABLE "MenuItemFavorite" ADD CONSTRAINT "MenuItemFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuItemFavorite" ADD CONSTRAINT "MenuItemFavorite_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MenuItemFavorite" ADD CONSTRAINT "MenuItemFavorite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MenuItemFavorite" ADD CONSTRAINT "MenuItemFavorite_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
