import type {
  GatewayEvent,
} from "./events";

import {
  emitToBot,
  emitToBots,
} from "@/lib/realtime/emitter";

import type {
  RealtimeEventName,
} from "@/lib/realtime/contracts";

export class GatewayService {
  async dispatch<T>(
    botId: string,
    event: GatewayEvent,
    data: T,
  ) {
    if (!botId) {
      return null;
    }

    console.log(
      `[GATEWAY] ${event} -> bot ${botId}`,
    );

    return emitToBot(
      botId,
      event as RealtimeEventName,
      data,
    );
  }

  async broadcast<T>(
    botIds: string[],
    event: GatewayEvent,
    data: T,
  ) {
    const uniqueBots = [
      ...new Set(
        botIds.filter(
          (
            botId,
          ): botId is string =>
            typeof botId ===
              "string" &&
            botId.length > 0,
        ),
      ),
    ];

    if (
      uniqueBots.length === 0
    ) {
      return null;
    }

    console.log(
      `[GATEWAY] Broadcast ${event} para ${uniqueBots.length} bot(s)`,
    );

    return emitToBots(
      uniqueBots,
      event as RealtimeEventName,
      data,
    );
  }
}

export const gatewayService =
  new GatewayService();