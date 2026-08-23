-- CreateTable
CREATE TABLE "Embed" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "url" TEXT,
    "color" TEXT,
    "timestamp" TEXT,
    "authorName" TEXT,
    "authorUrl" TEXT,
    "authorIcon" TEXT,
    "footerText" TEXT,
    "footerIcon" TEXT,
    "imageUrl" TEXT,
    "thumbnailUrl" TEXT,
    "fields" JSONB,
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Embed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Embed_messageId_idx" ON "Embed"("messageId");

-- AddForeignKey
ALTER TABLE "Embed" ADD CONSTRAINT "Embed_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
