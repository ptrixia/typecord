import { redis } from "@/lib/redis";

export const cacheKeys = {
  guild: (id: string) => `guild:${id}`,
  channels: (id: string) => `guild:${id}:channels`,
  roles: (id: string) => `guild:${id}:roles`,
  emojis: (id: string) => `guild:${id}:emojis`,
  stickers: (id: string) => `guild:${id}:stickers`,
  plugins: (id: string) => `guild:${id}:plugins`,
  permissions: (channelId: string, userId: string) => `channel:${channelId}:permissions:${userId}`,
  presence: (guildId: string) => `guild:${guildId}:presence`,
  search: (hash: string) => `search:${hash}`,
};

export async function invalidateGuildCache(guildId: string) {
  await redis.del(
    cacheKeys.guild(guildId),
    cacheKeys.channels(guildId),
    cacheKeys.roles(guildId),
    cacheKeys.emojis(guildId),
    cacheKeys.stickers(guildId),
    cacheKeys.plugins(guildId),
    cacheKeys.presence(guildId),
  );
}

export async function invalidateChannelCache(channelId: string, userIds: string[] = []) {
  const keys = userIds.map((userId) => cacheKeys.permissions(channelId, userId));
  if (keys.length) await redis.del(...keys);
}
