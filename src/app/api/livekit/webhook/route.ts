import { NextResponse } from "next/server";

import {
  WebhookReceiver,
} from "livekit-server-sdk";

import { redis } from "@/lib/redis";

import { emitToGuild } from "@/lib/realtime/emitter";

import {
  parseVoiceRoomName,
} from "@/lib/realtime/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getReceiver() {
  const apiKey =
    process.env.LIVEKIT_API_KEY;

  const apiSecret =
    process.env
      .LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error(
      "LiveKit não configurado.",
    );
  }

  return new WebhookReceiver(
    apiKey,
    apiSecret,
  );
}

export async function POST(
  request: Request,
) {
  try {
    const body =
      await request.text();

    const authorization =
      request.headers.get(
        "authorization",
      );

    const receiver =
      getReceiver();

    const event =
      await receiver.receive(
        body,
        authorization ??
          undefined,
      );

    if (event.id) {
      const processedKey =
        `typecord:livekit:webhook:${event.id}`;

      const first =
        await redis.set(
          processedKey,
          "1",
          "EX",
          86_400,
          "NX",
        );

      if (!first) {
        return NextResponse.json({
          success: true,
          duplicate: true,
        });
      }
    }

    const roomName =
      event.room?.name;

    if (!roomName) {
      return NextResponse.json({
        success: true,
      });
    }

    const room =
      parseVoiceRoomName(
        roomName,
      );

    if (!room) {
      return NextResponse.json({
        success: true,
      });
    }

    const participant =
      event.participant;

    if (!participant?.identity) {
      return NextResponse.json({
        success: true,
      });
    }

    const userId =
      participant.identity;

    if (
      event.event ===
      "participant_joined"
    ) {
      const state = {
        userId,

        guildId:
          room.guildId,

        channelId:
          room.channelId,

        connected: true,

        updatedAt:
          new Date().toISOString(),
      };

      await redis
        .multi()
        .set(
          `typecord:voice:user:${userId}`,
          JSON.stringify(state),
          "EX",
          86_400,
        )
        .sadd(
          `typecord:voice:channel:${room.channelId}`,
          userId,
        )
        .expire(
          `typecord:voice:channel:${room.channelId}`,
          86_400,
        )
        .exec();

      try {
        await emitToGuild(
          room.guildId,
          "VOICE_STATE_UPDATE",
          state,
        );
      } catch (error) {
        console.error(
          "[VOICE_JOIN_EMIT_ERROR]",
          error,
        );
      }
    }

    if (
      event.event ===
        "participant_left" ||
      event.event ===
        "participant_connection_aborted"
    ) {
      await redis
        .multi()
        .del(
          `typecord:voice:user:${userId}`,
        )
        .srem(
          `typecord:voice:channel:${room.channelId}`,
          userId,
        )
        .exec();

      try {
        await emitToGuild(
          room.guildId,
          "VOICE_STATE_UPDATE",
          {
            userId,

            guildId:
              room.guildId,

            channelId:
              room.channelId,

            connected: false,

            updatedAt:
              new Date().toISOString(),
          },
        );
      } catch (error) {
        console.error(
          "[VOICE_LEAVE_EMIT_ERROR]",
          error,
        );
      }
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "[LIVEKIT_WEBHOOK_ERROR]",
      error,
    );

    return NextResponse.json(
      {
        success: false,
      },
      {
        status: 401,
      },
    );
  }
}