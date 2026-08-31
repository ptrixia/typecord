ALTER TABLE "User" ADD COLUMN "admin" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "NotificationType" AS ENUM ('MENTION', 'REPLY', 'ROLE_MENTION', 'EVERYONE_MENTION', 'PIN', 'SYSTEM');

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL DEFAULT typecord_snowflake_id(),
  "userId" TEXT NOT NULL,
  "guildId" TEXT,
  "channelId" TEXT,
  "messageId" TEXT,
  "type" "NotificationType" NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "content" TEXT,
  "href" TEXT,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");
CREATE INDEX "Notification_guildId_createdAt_idx" ON "Notification"("guildId", "createdAt");
CREATE INDEX "Notification_messageId_idx" ON "Notification"("messageId");

CREATE TABLE "PlatformLog" (
  "id" TEXT NOT NULL DEFAULT typecord_snowflake_id(),
  "level" VARCHAR(16) NOT NULL,
  "event" VARCHAR(160) NOT NULL,
  "message" TEXT,
  "requestId" TEXT,
  "route" TEXT,
  "method" TEXT,
  "status" INTEGER,
  "durationMs" INTEGER,
  "userId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlatformLog_createdAt_idx" ON "PlatformLog"("createdAt");
CREATE INDEX "PlatformLog_level_createdAt_idx" ON "PlatformLog"("level", "createdAt");
CREATE INDEX "PlatformLog_route_createdAt_idx" ON "PlatformLog"("route", "createdAt");
