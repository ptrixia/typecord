ALTER TABLE "Channel" ADD COLUMN "threadStarterMessageId" TEXT;

CREATE UNIQUE INDEX "Channel_threadStarterMessageId_key" ON "Channel"("threadStarterMessageId");

ALTER TABLE "Channel"
ADD CONSTRAINT "Channel_threadStarterMessageId_fkey"
FOREIGN KEY ("threadStarterMessageId") REFERENCES "Message"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
