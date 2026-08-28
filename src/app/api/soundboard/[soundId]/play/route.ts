import { NextRequest, NextResponse } from "next/server";

import { getEffectiveChannelPermissions } from "@/lib/channel-permissions";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { Permissions, hasPermission } from "@/lib/permissions";
import { emitToChannel } from "@/lib/realtime/emitter";
import {
  enforceRateLimit,
  isSameOriginRequest,
  sameOriginError,
} from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ soundId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    if (!isSameOriginRequest(request)) return sameOriginError();

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "Não autorizado." },
        { status: 401 },
      );
    }

    const limited = await enforceRateLimit(
      request,
      "soundboard-play",
      20,
      60,
      currentUser.id,
    );
    if (limited) return limited;

    const { soundId } = await context.params;
    const body = await request.json().catch(() => null);
    const channelId = typeof body?.channelId === "string" ? body.channelId.trim() : "";

    const sound = await db.soundboardSound.findUnique({
      where: { id: soundId },
    });

    if (!sound) {
      return NextResponse.json(
        { success: false, message: "Som não encontrado." },
        { status: 404 },
      );
    }

    const channel = await db.channel.findFirst({
      where: {
        id: channelId,
        guildId: sound.guildId,
        type: { in: ["GUILD_VOICE", "GUILD_VIDEO"] },
      },
      select: { id: true },
    });

    if (!channel) {
      return NextResponse.json(
        { success: false, message: "Canal de voz inválido." },
        { status: 400 },
      );
    }

    const permissions = await getEffectiveChannelPermissions(
      sound.guildId,
      currentUser.id,
      channel.id,
    );

    if (
      !hasPermission(permissions, Permissions.CONNECT) ||
      !hasPermission(permissions, Permissions.USE_SOUNDBOARD)
    ) {
      return NextResponse.json(
        { success: false, message: "Você não possui permissão para usar o soundboard." },
        { status: 403 },
      );
    }

    await emitToChannel(channel.id, "SOUNDBOARD_PLAY", {
      guildId: sound.guildId,
      channelId: channel.id,
      sound: {
        id: sound.id,
        name: sound.name,
        emoji: sound.emoji,
        url: sound.url.startsWith("/api/files")
          ? sound.url
          : `/api/files?key=${encodeURIComponent(sound.url)}`,
        durationSeconds: sound.durationSeconds,
        volume: sound.volume,
      },
      userId: currentUser.id,
    });

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[SOUNDBOARD_PLAY]", error);
    return NextResponse.json(
      { success: false, message: "Não foi possível tocar o som." },
      { status: 500 },
    );
  }
}
