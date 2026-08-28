import { NextRequest, NextResponse } from "next/server";
import { AccessToken, TrackSource } from "livekit-server-sdk";

import { getEffectiveChannelPermissions } from "@/lib/channel-permissions";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { Permissions, hasPermission } from "@/lib/permissions";
import { enforceRateLimit } from "@/lib/request-security";
import { voiceRoomName } from "@/lib/realtime/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Não autorizado." },
        { status: 401 },
      );
    }

    const limited = await enforceRateLimit(request, "livekit-token", 30, 60, user.id);
    if (limited) return limited;

    const channelId = request.nextUrl.searchParams.get("channelId")?.trim() ?? "";

    if (!channelId) {
      return NextResponse.json(
        { success: false, message: "Canal inválido." },
        { status: 400 },
      );
    }

    const channel = await db.channel.findUnique({
      where: { id: channelId },
      select: { id: true, guildId: true, type: true },
    });

    if (!channel) {
      return NextResponse.json(
        { success: false, message: "Canal não encontrado." },
        { status: 404 },
      );
    }

    if (channel.type !== "GUILD_VOICE" && channel.type !== "GUILD_VIDEO") {
      return NextResponse.json(
        { success: false, message: "Este não é um canal de voz/vídeo." },
        { status: 400 },
      );
    }

    const permissions = await getEffectiveChannelPermissions(
      channel.guildId,
      user.id,
      channel.id,
    );

    if (
      !hasPermission(permissions, Permissions.VIEW_CHANNEL) ||
      !hasPermission(permissions, Permissions.CONNECT)
    ) {
      return NextResponse.json(
        { success: false, message: "Você não possui permissão para conectar neste canal." },
        { status: 403 },
      );
    }

    const canSpeak = hasPermission(permissions, Permissions.SPEAK);
    const canStream = hasPermission(permissions, Permissions.STREAM);
    const allowedSources: TrackSource[] = [];

    if (canSpeak) {
      allowedSources.push(TrackSource.MICROPHONE);
    }

    if (canStream) {
      allowedSources.push(
        TrackSource.CAMERA,
        TrackSource.SCREEN_SHARE,
        TrackSource.SCREEN_SHARE_AUDIO,
      );
    }

    const apiKey = process.env.LIVEKIT_API_KEY?.trim();
    const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
    const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL?.trim();

    if (!apiKey || !apiSecret || !serverUrl) {
      throw new Error("LiveKit não configurado.");
    }

    const room = voiceRoomName(channel.guildId, channel.id);
    const accessToken = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      ttl: "10m",
      metadata: JSON.stringify({
        userId: user.id,
        guildId: channel.guildId,
        channelId: channel.id,
      }),
    });

    accessToken.addGrant({
      roomJoin: true,
      room,
      canSubscribe: true,
      canPublish: allowedSources.length > 0,
      canPublishSources: allowedSources,
      canPublishData: false,
    });

    return NextResponse.json(
      {
        success: true,
        token: await accessToken.toJwt(),
        serverUrl,
        room,
        permissions: {
          connect: true,
          speak: canSpeak,
          stream: canStream,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[LIVEKIT_TOKEN_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Não foi possível entrar no canal de voz." },
      { status: 500 },
    );
  }
}
