import { NextRequest, NextResponse } from "next/server";

import {
  AccessToken,
  TrackSource,
} from "livekit-server-sdk";

import { db } from "@/lib/db";

import {
  Permissions,
  hasPermission,
  normalizePermissions,
} from "@/lib/permissions";

import { getCurrentUser } from "@/lib/current-user";

import { voiceRoomName } from "@/lib/realtime/rooms";

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
        },
      );
    }

    const channelId =
      request.nextUrl.searchParams.get(
        "channelId",
      );

    if (!channelId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Canal inválido.",
        },
        {
          status: 400,
        },
      );
    }

    const channel =
      await db.channel.findUnique({
        where: {
          id: channelId,
        },

        select: {
          id: true,
          guildId: true,
          type: true,
        },
      });

    if (!channel) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Canal não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    const type =
      String(channel.type);

    if (
      type !== "GUILD_VOICE" &&
      type !== "GUILD_STAGE"
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Este não é um canal de voz.",
        },
        {
          status: 400,
        },
      );
    }

    const guild =
      await db.guild.findUnique({
        where: {
          id: channel.guildId,
        },

        select: {
          ownerId: true,
        },
      });

    if (!guild) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Servidor não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    const member =
      await db.member.findUnique({
        where: {
          userId_guildId: {
            userId:
              user.id,

            guildId:
              channel.guildId,
          },
        },

        select: {
          roles: {
            select: {
              permissions: true,
            },
          },
        },
      });

    if (!member) {
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

    const owner =
      guild.ownerId === user.id;

    let permissions = 0n;

    for (const role of member.roles) {
      permissions |=
        normalizePermissions(
          role.permissions,
        );
    }

    const canConnect =
      owner ||
      hasPermission(
        permissions,
        Permissions.CONNECT,
      );

    if (!canConnect) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Você não possui permissão para conectar neste canal.",
        },
        {
          status: 403,
        },
      );
    }

    const canSpeak =
      owner ||
      hasPermission(
        permissions,
        Permissions.SPEAK,
      );

    const canStream =
      owner ||
      hasPermission(
        permissions,
        Permissions.STREAM,
      );

    const allowedSources:
      TrackSource[] = [];

    if (canSpeak) {
      allowedSources.push(
        TrackSource.MICROPHONE,
      );
    }

    if (canStream) {
      allowedSources.push(
        TrackSource.CAMERA,
        TrackSource.SCREEN_SHARE,
        TrackSource.SCREEN_SHARE_AUDIO,
      );
    }

    const apiKey =
      process.env
        .LIVEKIT_API_KEY;

    const apiSecret =
      process.env
        .LIVEKIT_API_SECRET;

    const serverUrl =
      process.env
        .NEXT_PUBLIC_LIVEKIT_URL;

    if (
      !apiKey ||
      !apiSecret ||
      !serverUrl
    ) {
      throw new Error(
        "LiveKit não configurado.",
      );
    }

    const room =
      voiceRoomName(
        channel.guildId,
        channel.id,
      );

    const accessToken =
      new AccessToken(
        apiKey,
        apiSecret,
        {
          identity:
            user.id,

          ttl: "10m",

          metadata:
            JSON.stringify({
              userId:
                user.id,

              guildId:
                channel.guildId,

              channelId:
                channel.id,
            }),
        },
      );

    accessToken.addGrant({
      roomJoin: true,
      room,

      canSubscribe: true,

      canPublish:
        allowedSources.length >
        0,

      canPublishSources:
        allowedSources,

      canPublishData: false,
    });

    const token =
      await accessToken.toJwt();

    return NextResponse.json(
      {
        success: true,

        token,

        serverUrl,

        room,

        permissions: {
          connect:
            canConnect,

          speak:
            canSpeak,

          stream:
            canStream,
        },
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error) {
    console.error(
      "[LIVEKIT_TOKEN_ERROR]",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Não foi possível entrar no canal de voz.",
      },
      {
        status: 500,
      },
    );
  }
}