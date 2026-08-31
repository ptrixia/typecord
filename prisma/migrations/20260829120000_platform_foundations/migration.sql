ALTER TABLE "Channel" ADD COLUMN IF NOT EXISTS "temporaryExpiresAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "Guild" ADD COLUMN IF NOT EXISTS "accentColor" TEXT NOT NULL DEFAULT '#5865F2';
ALTER TABLE "Guild" ADD COLUMN IF NOT EXISTS "backgroundUrl" TEXT;

CREATE TABLE IF NOT EXISTS "ChannelReadState" (
  "id" TEXT NOT NULL DEFAULT typecord_snowflake_id(),
  "userId" TEXT NOT NULL,
  "channelId" TEXT NOT NULL,
  "lastReadMessageId" TEXT,
  "unreadCount" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChannelReadState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChannelReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChannelReadState_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ChannelReadState_userId_channelId_key" ON "ChannelReadState"("userId", "channelId");
CREATE INDEX IF NOT EXISTS "ChannelReadState_channelId_unreadCount_idx" ON "ChannelReadState"("channelId", "unreadCount");

CREATE TABLE IF NOT EXISTS "Upload" (
  "id" TEXT NOT NULL DEFAULT typecord_snowflake_id(),
  "key" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "ownerId" TEXT NOT NULL,
  "channelId" TEXT,
  "messageId" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Upload_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Upload_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Upload_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Upload_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Upload_key_key" ON "Upload"("key");
CREATE INDEX IF NOT EXISTS "Upload_ownerId_idx" ON "Upload"("ownerId");
CREATE INDEX IF NOT EXISTS "Upload_messageId_idx" ON "Upload"("messageId");
CREATE INDEX IF NOT EXISTS "Upload_expiresAt_idx" ON "Upload"("expiresAt");

CREATE TYPE "PermissionProposalStatus" AS ENUM ('OPEN', 'APPROVED', 'REJECTED', 'EXPIRED');
CREATE TABLE IF NOT EXISTS "PermissionProposal" (
  "id" TEXT NOT NULL DEFAULT typecord_snowflake_id(),
  "channelId" TEXT NOT NULL,
  "proposerId" TEXT NOT NULL,
  "permission" TEXT NOT NULL,
  "reason" TEXT,
  "status" "PermissionProposalStatus" NOT NULL DEFAULT 'OPEN',
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PermissionProposal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PermissionProposal_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PermissionProposal_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PermissionProposal_channelId_status_idx" ON "PermissionProposal"("channelId", "status");
CREATE INDEX IF NOT EXISTS "PermissionProposal_expiresAt_idx" ON "PermissionProposal"("expiresAt");

CREATE TABLE IF NOT EXISTS "ChannelSubscription" (
  "id" TEXT NOT NULL DEFAULT typecord_snowflake_id(),
  "channelId" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "priceCents" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelSubscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChannelSubscription_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ChannelSubscription_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ChannelSubscription_channelId_key" ON "ChannelSubscription"("channelId");
