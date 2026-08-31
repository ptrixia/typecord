CREATE TABLE "DirectConversationFolder" (
  "id" TEXT NOT NULL DEFAULT typecord_snowflake_id(),
  "userId" TEXT NOT NULL,
  "name" VARCHAR(48) NOT NULL,
  "color" VARCHAR(16),
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DirectConversationFolder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DirectConversationFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "DirectConversationParticipant" ADD COLUMN "isFavorite" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DirectConversationParticipant" ADD COLUMN "folderId" TEXT;
ALTER TABLE "DirectConversationParticipant" ADD CONSTRAINT "DirectConversationParticipant_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "DirectConversationFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "DirectConversationFolder_userId_name_key" ON "DirectConversationFolder"("userId", "name");
CREATE INDEX "DirectConversationFolder_userId_position_idx" ON "DirectConversationFolder"("userId", "position");
CREATE INDEX "DirectConversationParticipant_folderId_idx" ON "DirectConversationParticipant"("folderId");
