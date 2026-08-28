CREATE SEQUENCE IF NOT EXISTS "typecord_snowflake_sequence"
  AS bigint
  MINVALUE 0
  MAXVALUE 4095
  CYCLE;

CREATE OR REPLACE FUNCTION "typecord_snowflake_id"()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  custom_epoch_ms bigint := 1577836800000;
  current_ms bigint;
  sequence_id bigint;
  worker_id bigint := 1;
BEGIN
  current_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint - custom_epoch_ms;
  sequence_id := nextval('"typecord_snowflake_sequence"') % 4096;

  RETURN ((current_ms << 22) | (worker_id << 12) | sequence_id)::text;
END;
$$;

ALTER TABLE "GatewaySession" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "Bot" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "Embed" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "User" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "RichPresence" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "Account" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "Session" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "Relationship" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "DirectConversation" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "DirectConversationParticipant" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "DirectMessage" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "DirectVoiceMessage" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "DirectMessageAttachment" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "DirectMessageReaction" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "Guild" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "GuildOnboarding" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "ScheduledEvent" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "AutoModRule" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "ModerationAction" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "Role" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "Member" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "Category" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "Channel" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "Message" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "VoiceMessage" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "Poll" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "PollOption" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "PollVote" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "Attachment" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "Emoji" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "Sticker" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "SoundboardSound" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "Reaction" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "Invite" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "GuildBan" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "PermissionOverwrite" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "AuditLog" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
ALTER TABLE "ServerTemplate" ALTER COLUMN "id" SET DEFAULT "typecord_snowflake_id"();
