/*
  Warnings:

  - You are about to drop the column `bannerPositionY` on the `Guild` table. All the data in the column will be lost.
  - You are about to drop the column `mentionable` on the `Role` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Guild" DROP COLUMN "bannerPositionY";

-- AlterTable
ALTER TABLE "Role" DROP COLUMN "mentionable",
ADD COLUMN     "managed" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "permissions" SET DEFAULT '0';

-- CreateIndex
CREATE INDEX "Role_guildId_position_idx" ON "Role"("guildId", "position");
