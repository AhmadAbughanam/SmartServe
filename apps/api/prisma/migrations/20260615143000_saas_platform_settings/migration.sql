-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "platformName" TEXT NOT NULL DEFAULT 'Smart Restaurant OS',
    "supportEmail" TEXT,
    "supportPhone" TEXT,
    "maintenanceModeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT,
    "ownerProvisioningEnabled" BOOLEAN NOT NULL DEFAULT true,
    "auditRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "defaultSystemHealthWindowHours" INTEGER NOT NULL DEFAULT 24,
    "defaultRevenueRangeDays" INTEGER NOT NULL DEFAULT 30,
    "announcementJson" JSONB,
    "changeLogJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);
