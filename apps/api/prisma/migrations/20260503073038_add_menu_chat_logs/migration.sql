-- CreateTable
CREATE TABLE "MenuChatLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "messageIntent" TEXT,
    "messageHash" TEXT,
    "messagePreview" TEXT,
    "suggestedItemIds" JSONB NOT NULL,
    "safetyNotes" JSONB,
    "usedAiService" BOOLEAN NOT NULL DEFAULT false,
    "usedFallback" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MenuChatLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuChatLog_tenantId_branchId_createdAt_idx" ON "MenuChatLog"("tenantId", "branchId", "createdAt");

-- CreateIndex
CREATE INDEX "MenuChatLog_userId_idx" ON "MenuChatLog"("userId");

-- CreateIndex
CREATE INDEX "MenuChatLog_sessionId_idx" ON "MenuChatLog"("sessionId");

-- AddForeignKey
ALTER TABLE "MenuChatLog" ADD CONSTRAINT "MenuChatLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuChatLog" ADD CONSTRAINT "MenuChatLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuChatLog" ADD CONSTRAINT "MenuChatLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuChatLog" ADD CONSTRAINT "MenuChatLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
