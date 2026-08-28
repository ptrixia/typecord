import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getEffectiveChannelPermissions } from "@/lib/channel-permissions";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { Permissions, hasPermission } from "@/lib/permissions";
import { emitToGuild } from "@/lib/realtime/emitter";
import {
  enforceRateLimit,
  isSameOriginRequest,
  sameOriginError,
} from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ channelId: string }>;
};

const createThreadSchema = z.object({
  name: z.string().trim().min(1).max(100),
  private: z.boolean().optional().default(false),
});

function normalizeThreadName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .toLocaleLowerCase("pt-BR")
    .slice(0, 100);
}

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
      "thread-create",
      30,
      60,
      currentUser.id,
    );
    if (limited) return limited;

    const { channelId } = await context.params;
    const parent = await db.channel.findUnique({
      where: { id: channelId },
      select: {
        id: true,
        guildId: true,
        type: true,
      },
    });

    if (!parent || !["GUILD_TEXT", "GUILD_ANNOUNCEMENT"].includes(parent.type)) {
      return NextResponse.json(
        { success: false, message: "Canal pai inválido para thread." },
        { status: 400 },
      );
    }

    const parsed = createThreadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message ?? "Thread inválida." },
        { status: 400 },
      );
    }

    const permissions = await getEffectiveChannelPermissions(
      parent.guildId,
      currentUser.id,
      parent.id,
    );
    const required = parsed.data.private
      ? Permissions.CREATE_PRIVATE_THREADS
      : Permissions.CREATE_PUBLIC_THREADS;

    if (
      !hasPermission(permissions, Permissions.VIEW_CHANNEL) ||
      !hasPermission(permissions, required)
    ) {
      return NextResponse.json(
        { success: false, message: "Você não possui permissão para criar esta thread." },
        { status: 403 },
      );
    }

    const name = normalizeThreadName(parsed.data.name);
    if (!name) {
      return NextResponse.json(
        { success: false, message: "Nome de thread inválido." },
        { status: 400 },
      );
    }

    const thread = await db.channel.create({
      data: {
        guildId: parent.guildId,
        parentId: parent.id,
        name,
        type: parsed.data.private ? "PRIVATE_THREAD" : "PUBLIC_THREAD",
        position: 0,
      },
    });

    await db.auditLog.create({
      data: {
        guildId: parent.guildId,
        actorId: currentUser.id,
        action: "THREAD_CREATE",
        targetId: thread.id,
        metadata: { parentId: parent.id, name, private: parsed.data.private },
      },
    });

    await emitToGuild(parent.guildId, "CHANNEL_CREATE", {
      guildId: parent.guildId,
      channel: thread,
    });

    return NextResponse.json(
      { success: true, channel: thread },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[THREAD_CREATE]", error);
    return NextResponse.json(
      { success: false, message: "Não foi possível criar a thread." },
      { status: 500 },
    );
  }
}
