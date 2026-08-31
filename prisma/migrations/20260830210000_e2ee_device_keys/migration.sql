CREATE TABLE "UserDeviceKey" (
    "id" TEXT NOT NULL DEFAULT typecord_snowflake_id(),
    "userId" TEXT NOT NULL,
    "deviceId" VARCHAR(128) NOT NULL,
    "label" VARCHAR(128),
    "publicKey" TEXT NOT NULL,
    "fingerprint" VARCHAR(128) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserDeviceKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserDeviceKey_userId_deviceId_key" ON "UserDeviceKey"("userId", "deviceId");
CREATE INDEX "UserDeviceKey_userId_revokedAt_idx" ON "UserDeviceKey"("userId", "revokedAt");
CREATE INDEX "UserDeviceKey_fingerprint_idx" ON "UserDeviceKey"("fingerprint");

ALTER TABLE "UserDeviceKey" ADD CONSTRAINT "UserDeviceKey_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
