import { pusherServer } from "@/lib/pusher";
import type {
    GatewayEvent,
    GatewayPayload,
} from "./events";

export class GatewayService {
    private sequence = new Map<string, number>();

    getBotChannel(botId: string) {
        return `private-bot-${botId}`;
    }

    private nextSequence(botId: string) {
        const current =
            this.sequence.get(botId) ?? 0;

        const next = current + 1;

        this.sequence.set(botId, next);

        return next;
    }

    async dispatch<T>(
        botId: string,
        event: GatewayEvent,
        data: T,
    ) {
        const payload: GatewayPayload<T> = {
            op: 0,
            t: event,
            s: this.nextSequence(botId),
            d: data,
        };

        console.log(
            `[GATEWAY] ${event} -> bot ${botId}`,
        );

        await pusherServer.trigger(
            this.getBotChannel(botId),
            event,
            payload,
        );
    }

    async broadcast<T>(
        botIds: string[],
        event: GatewayEvent,
        data: T,
    ) {
        const uniqueBots = [
            ...new Set(botIds),
        ];

        console.log(
            `[GATEWAY] Broadcast ${event} para ${uniqueBots.length} bot(s)`,
        );

        await Promise.all(
            uniqueBots.map((botId) =>
                this.dispatch(
                    botId,
                    event,
                    data,
                ),
            ),
        );
    }
}

export const gatewayService =
    new GatewayService();