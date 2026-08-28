import { NextRequest, NextResponse } from "next/server";

import { canUserAccessChannel } from "@/lib/channel-permissions";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { Permissions } from "@/lib/permissions";
import { redis } from "@/lib/redis";
import { enforceRateLimit } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Não autorizado." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const limited = await enforceRateLimit(
      request,
      "voice-state-read",
      120,
      60,
      user.id,
    );
    if (limited) return limited;

    const guildId = request.nextUrl.searchParams.get("guildId")?.trim() ?? "";
    if (!guildId || guildId.length > 128) {
      return NextResponse.json(
        { success: false, message: "Servidor inválido." },
        { status: 400 },
      );
    }

    const membership = await db.member.findUnique({
      where: { userId_guildId: { userId: user.id, guildId } },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json(
        { success: false, message: "Você não pertence a este servidor." },
        { status: 403 },
      );
    }

    const voiceChannels = await db.channel.findMany({
      where: {
        guildId,
        type: { in: ["GUILD_VOICE", "GUILD_VIDEO"] },
      },
      select: { id: true },
    });

    const visibleChannels = (
      await Promise.all(
        voiceChannels.map(async (channel) =>
          (await canUserAccessChannel(user.id, channel.id, [Permissions.VIEW_CHANNEL]))
            ? channel
            : null,
        ),
      )
    ).filter((channel): channel is { id: string } => channel !== null);

    const entries = await Promise.all(
      visibleChannels.map(async (channel) => {
        const userIds = await redis.smembers(`typecord:voice:channel:${channel.id}`);
        return [channel.id, userIds] as const;
      }),
    );

    return NextResponse.json(
      { success: true, channels: Object.fromEntries(entries) },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    console.error("[VOICE_STATE_GET_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Não foi possível carregar o estado dos canais de voz." },
      { status: 500 },
    );
  }
}
