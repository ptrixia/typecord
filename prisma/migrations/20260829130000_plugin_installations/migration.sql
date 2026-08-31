CREATE TABLE IF NOT EXISTS "GuildPluginInstallation" (
  "id" TEXT NOT NULL DEFAULT typecord_snowflake_id(),
  "guildId" TEXT NOT NULL,
  "pluginId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "settings" JSONB,
  "installedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuildPluginInstallation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GuildPluginInstallation_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GuildPluginInstallation_installedById_fkey" FOREIGN KEY ("installedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "GuildPluginInstallation_guildId_pluginId_key" ON "GuildPluginInstallation"("guildId", "pluginId");
CREATE INDEX IF NOT EXISTS "GuildPluginInstallation_guildId_enabled_idx" ON "GuildPluginInstallation"("guildId", "enabled");
CREATE INDEX IF NOT EXISTS "GuildPluginInstallation_pluginId_idx" ON "GuildPluginInstallation"("pluginId");
