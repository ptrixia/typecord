import "server-only";

import { emitToGuild } from "@/lib/realtime/emitter";
import type { RealtimeEventName } from "@/lib/realtime/contracts";

type GuildDispatchData = Record<string, unknown>;

export async function dispatchGuildEvent(
  guildId: string,
  event: RealtimeEventName,
  data: GuildDispatchData = {},
) {
  if (!guildId) {
    return null;
  }

  try {
    return await emitToGuild(guildId, event, {
      guildId,
      ...data,
    });
  } catch (error) {
    console.error(`[GUILD_EVENT_${event}_ERROR]`, error);
    return null;
  }
}
