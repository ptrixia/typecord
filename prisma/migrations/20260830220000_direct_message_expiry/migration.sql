ALTER TABLE "DirectMessage" ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE INDEX "DirectMessage_expiresAt_idx" ON "DirectMessage"("expiresAt");
