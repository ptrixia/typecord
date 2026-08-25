import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { getCurrentUser } from "@/lib/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
) {
  try {
    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Não autorizado.",
        },
        {
          status: 401,
          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    }

    const guildId =
      request.nextUrl.searchParams.get(
        "guildId",
      );

    if (!guildId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Servidor inválido.",
        },
        {
          status: 400,
        },
      );
    }

    const membership =
      await db.member.findUnique({
        where: {
          userId_guildId: {
            userId: user.id,
            guildId,
          },
        },

        select: {
          id: true,
        },
      });

    if (!membership) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Você não pertence a este servidor.",
        },
        {
          status: 403,
        },
      );
    }

    const voiceChannels =
      await db.channel.findMany({
        where: {
          guildId,
          type: "GUILD_VOICE",
        },

        select: {
          id: true,
        },
      });

    const entries =
      await Promise.all(
        voiceChannels.map(
          async (channel) => {
            const userIds =
              await redis.smembers(
                `typecord:voice:channel:${channel.id}`,
              );

            return [
              String(channel.id),
              userIds,
            ] as const;
          },
        ),
      );

    return NextResponse.json(
      {
        success: true,
        channels:
          Object.fromEntries(
            entries,
          ),
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    console.error(
      "[VOICE_STATE_GET_ERROR]",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Não foi possível carregar o estado dos canais de voz.",
      },
      {
        status: 500,
      },
    );
  }
}