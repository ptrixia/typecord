-- CreateTable
CREATE TABLE "GatewaySession" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "sessionTokenHash" TEXT NOT NULL,
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GatewaySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GatewaySession_sessionTokenHash_key" ON "GatewaySession"("sessionTokenHash");

-- CreateIndex
CREATE INDEX "GatewaySession_botId_idx" ON "GatewaySession"("botId");

-- CreateIndex
CREATE INDEX "GatewaySession_expiresAt_idx" ON "GatewaySession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Bot_userId_key" ON "Bot"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Bot_tokenHash_key" ON "Bot"("tokenHash");

-- CreateIndex
CREATE INDEX "Bot_userId_idx" ON "Bot"("userId");

-- AddForeignKey
ALTER TABLE "GatewaySession" ADD CONSTRAINT "GatewaySession_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bot" ADD CONSTRAINT "Bot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
