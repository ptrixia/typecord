-- Product features: onboarding, events, automod, moderation notes,
-- polls, voice messages, stickers, soundboard, templates and rich presence.

CREATE TYPE "RichPresenceType" AS ENUM ('PLAYING', 'LISTENING', 'WATCHING', 'STREAMING', 'COMPETING', 'CUSTOM');
CREATE TYPE "ScheduledEventStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELED');
CREATE TYPE "ScheduledEventEntityType" AS ENUM ('VOICE', 'STAGE', 'EXTERNAL');
CREATE TYPE "AutoModTriggerType" AS ENUM ('SPAM', 'SUSPICIOUS_LINK', 'BLOCKED_WORD', 'CAPS_LOCK', 'FLOOD');
CREATE TYPE "AutoModActionType" AS ENUM ('BLOCK_MESSAGE', 'WARN', 'TIMEOUT');
CREATE TYPE "ModerationActionType" AS ENUM ('WARNING', 'TIMEOUT');

CREATE TABLE "RichPresence" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "RichPresenceType" NOT NULL DEFAULT 'CUSTOM',
  "name" VARCHAR(128) NOT NULL,
  "details" VARCHAR(128),
  "state" VARCHAR(128),
  "url" TEXT,
  "startedAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RichPresence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DirectVoiceMessage" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "durationSeconds" INTEGER NOT NULL,
  "waveform" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DirectVoiceMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuildOnboarding" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "rules" TEXT,
  "questions" JSONB,
  "suggestedChannels" JSONB,
  "autoRoleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuildOnboarding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduledEvent" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "creatorId" TEXT,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "location" VARCHAR(200),
  "coverUrl" TEXT,
  "entityType" "ScheduledEventEntityType" NOT NULL DEFAULT 'EXTERNAL',
  "channelId" TEXT,
  "scheduledStartAt" TIMESTAMP(3) NOT NULL,
  "scheduledEndAt" TIMESTAMP(3),
  "status" "ScheduledEventStatus" NOT NULL DEFAULT 'SCHEDULED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScheduledEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutoModRule" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "triggerType" "AutoModTriggerType" NOT NULL,
  "actionType" "AutoModActionType" NOT NULL DEFAULT 'BLOCK_MESSAGE',
  "keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "exemptRoleIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "exemptChannelIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "threshold" INTEGER NOT NULL DEFAULT 0,
  "durationSeconds" INTEGER,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutoModRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModerationAction" (
  "id" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "moderatorId" TEXT,
  "type" "ModerationActionType" NOT NULL,
  "reason" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VoiceMessage" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "durationSeconds" INTEGER NOT NULL,
  "waveform" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VoiceMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Poll" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "question" VARCHAR(300) NOT NULL,
  "allowMultiple" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PollOption" (
  "id" TEXT NOT NULL,
  "pollId" TEXT NOT NULL,
  "label" VARCHAR(120) NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PollVote" (
  "id" TEXT NOT NULL,
  "optionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Sticker" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(32) NOT NULL,
  "description" VARCHAR(200),
  "url" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "creatorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Sticker_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SoundboardSound" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(32) NOT NULL,
  "emoji" VARCHAR(32),
  "url" TEXT NOT NULL,
  "durationSeconds" INTEGER NOT NULL DEFAULT 5,
  "volume" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "guildId" TEXT NOT NULL,
  "creatorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SoundboardSound_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServerTemplate" (
  "id" TEXT NOT NULL,
  "guildId" TEXT,
  "creatorId" TEXT,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "code" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "uses" INTEGER NOT NULL DEFAULT 0,
  "public" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServerTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RichPresence_userId_key" ON "RichPresence"("userId");
CREATE INDEX "RichPresence_type_idx" ON "RichPresence"("type");
CREATE INDEX "RichPresence_expiresAt_idx" ON "RichPresence"("expiresAt");

CREATE UNIQUE INDEX "DirectVoiceMessage_messageId_key" ON "DirectVoiceMessage"("messageId");

CREATE UNIQUE INDEX "GuildOnboarding_guildId_key" ON "GuildOnboarding"("guildId");

CREATE INDEX "ScheduledEvent_guildId_scheduledStartAt_idx" ON "ScheduledEvent"("guildId", "scheduledStartAt");
CREATE INDEX "ScheduledEvent_status_idx" ON "ScheduledEvent"("status");

CREATE INDEX "AutoModRule_guildId_idx" ON "AutoModRule"("guildId");
CREATE INDEX "AutoModRule_guildId_enabled_idx" ON "AutoModRule"("guildId", "enabled");

CREATE INDEX "ModerationAction_guildId_idx" ON "ModerationAction"("guildId");
CREATE INDEX "ModerationAction_targetUserId_idx" ON "ModerationAction"("targetUserId");
CREATE INDEX "ModerationAction_moderatorId_idx" ON "ModerationAction"("moderatorId");
CREATE INDEX "ModerationAction_expiresAt_idx" ON "ModerationAction"("expiresAt");

CREATE UNIQUE INDEX "VoiceMessage_messageId_key" ON "VoiceMessage"("messageId");

CREATE UNIQUE INDEX "Poll_messageId_key" ON "Poll"("messageId");
CREATE INDEX "Poll_expiresAt_idx" ON "Poll"("expiresAt");
CREATE INDEX "PollOption_pollId_idx" ON "PollOption"("pollId");
CREATE UNIQUE INDEX "PollVote_optionId_userId_key" ON "PollVote"("optionId", "userId");
CREATE INDEX "PollVote_userId_idx" ON "PollVote"("userId");

CREATE UNIQUE INDEX "Sticker_guildId_name_key" ON "Sticker"("guildId", "name");
CREATE INDEX "Sticker_guildId_idx" ON "Sticker"("guildId");

CREATE UNIQUE INDEX "SoundboardSound_guildId_name_key" ON "SoundboardSound"("guildId", "name");
CREATE INDEX "SoundboardSound_guildId_idx" ON "SoundboardSound"("guildId");

CREATE UNIQUE INDEX "ServerTemplate_code_key" ON "ServerTemplate"("code");
CREATE INDEX "ServerTemplate_guildId_idx" ON "ServerTemplate"("guildId");
CREATE INDEX "ServerTemplate_public_idx" ON "ServerTemplate"("public");

ALTER TABLE "RichPresence" ADD CONSTRAINT "RichPresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DirectVoiceMessage" ADD CONSTRAINT "DirectVoiceMessage_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "DirectMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuildOnboarding" ADD CONSTRAINT "GuildOnboarding_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledEvent" ADD CONSTRAINT "ScheduledEvent_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutoModRule" ADD CONSTRAINT "AutoModRule_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VoiceMessage" ADD CONSTRAINT "VoiceMessage_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Sticker" ADD CONSTRAINT "Sticker_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SoundboardSound" ADD CONSTRAINT "SoundboardSound_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServerTemplate" ADD CONSTRAINT "ServerTemplate_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE SET NULL ON UPDATE CASCADE;
