-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('SAAS_OWNER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "globalRole" "GlobalRole";

-- CreateIndex
CREATE INDEX "User_globalRole_idx" ON "User"("globalRole");
