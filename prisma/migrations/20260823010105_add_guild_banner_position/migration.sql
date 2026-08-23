-- AlterTable
ALTER TABLE "Guild" ADD COLUMN     "bannerPositionY" INTEGER NOT NULL DEFAULT 50;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mentionable" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PermissionOverwrite" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "roleId" TEXT,
    "memberId" TEXT,
    "allow" TEXT NOT NULL DEFAULT '0',
    "deny" TEXT NOT NULL DEFAULT '0',

    CONSTRAINT "PermissionOverwrite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PermissionOverwrite_channelId_idx" ON "PermissionOverwrite"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionOverwrite_channelId_roleId_key" ON "PermissionOverwrite"("channelId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "PermissionOverwrite_channelId_memberId_key" ON "PermissionOverwrite"("channelId", "memberId");

-- CreateIndex
CREATE INDEX "AuditLog_guildId_idx" ON "AuditLog"("guildId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- AddForeignKey
ALTER TABLE "PermissionOverwrite" ADD CONSTRAINT "PermissionOverwrite_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionOverwrite" ADD CONSTRAINT "PermissionOverwrite_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PermissionOverwrite" ADD CONSTRAINT "PermissionOverwrite_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
