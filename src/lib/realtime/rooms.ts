export function userRoom(userId: string) {
  return `tc:user:${userId}`;
}

export function guildRoom(guildId: string) {
  return `tc:guild:${guildId}`;
}

export function botRoom(botId: string) {
  return `tc:bot:${botId}`;
}

export function channelRoom(channelId: string) {
  return `tc:channel:${channelId}`;
}

export function voiceRoomName(
  guildId: string,
  channelId: string,
) {
  return `tc:voice:${guildId}:${channelId}`;
}

export function parseVoiceRoomName(roomName: string) {
  const parts = roomName.split(":");

  if (
    parts.length !== 4 ||
    parts[0] !== "tc" ||
    parts[1] !== "voice"
  ) {
    return null;
  }

  const guildId = parts[2];
  const channelId = parts[3];

  if (!guildId || !channelId) {
    return null;
  }

  return {
    guildId,
    channelId,
  };
}