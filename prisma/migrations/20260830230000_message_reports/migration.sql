CREATE TYPE "MessageReportStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');
CREATE TYPE "MessageReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'HATE_SPEECH', 'THREATS', 'SEXUAL_CONTENT', 'ILLEGAL_CONTENT', 'PERSONAL_DATA', 'OTHER');

CREATE TABLE "MessageReport" (
  "id" TEXT NOT NULL DEFAULT typecord_snowflake_id(),
  "messageId" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "reason" "MessageReportReason" NOT NULL,
  "details" TEXT,
  "status" "MessageReportStatus" NOT NULL DEFAULT 'OPEN',
  "reviewerId" TEXT,
  "resolution" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessageReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MessageReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MessageReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MessageReport_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MessageReport_messageId_reporterId_key" ON "MessageReport"("messageId", "reporterId");
CREATE INDEX "MessageReport_guildId_status_createdAt_idx" ON "MessageReport"("guildId", "status", "createdAt");
CREATE INDEX "MessageReport_reporterId_createdAt_idx" ON "MessageReport"("reporterId", "createdAt");
