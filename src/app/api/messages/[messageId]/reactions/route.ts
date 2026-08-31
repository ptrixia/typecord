import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

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
  params: Promise<{ messageId: string }>;
};

const reactionSchema = z.object({
  emoji: z.string().trim().min(1).max(32),
});

function reactionGroups(reactions: Array<{ unicode: string | null; emoji?: { name: string } | null; member: { userId: string; user: { id: string; username: string; globalName: string | null } } }>, userId: string) {
  const grouped = new Map<string, { emoji: string; count: number; reactedByMe: boolean; users: Array<{ id: string; name: string }> }>();

  for (const reaction of reactions) {
    const emoji = reaction.unicode || reaction.emoji?.name || "";
    if (!emoji) continue;

    const current = grouped.get(emoji) ?? {
      emoji,
      count: 0,
      reactedByMe: false,
      users: [],
    };

    current.count += 1;
    current.reactedByMe ||= reaction.member.userId === userId;
    current.users.push({ id: reaction.member.user.id, name: reaction.member.user.globalName || reaction.member.user.username });
    grouped.set(emoji, current);
  }

  return Array.from(grouped.values());
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
      "guild-message-reaction",
      90,
      60,
      currentUser.id,
    );
    if (limited) return limited;

    const { messageId } = await context.params;
    const parsed = reactionSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Emoji inválido." },
        { status: 400 },
      );
    }

    const message = await db.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        deleted: true,
        channelId: true,
        channel: { select: { guildId: true } },
      },
    });

    if (!message || message.deleted) {
      return NextResponse.json(
        { success: false, message: "Mensagem inválida." },
        { status: 404 },
      );
    }

    const permissions = await getEffectiveChannelPermissions(
      message.channel.guildId,
      currentUser.id,
      message.channelId,
    );

    if (
      !hasPermission(permissions, Permissions.VIEW_CHANNEL) ||
      !hasPermission(permissions, Permissions.READ_MESSAGE_HISTORY) ||
      !hasPermission(permissions, Permissions.ADD_REACTIONS)
    ) {
      return NextResponse.json(
        { success: false, message: "Você não possui permissão para reagir." },
        { status: 403 },
      );
    }

    const member = await db.member.findUnique({
      where: {
        userId_guildId: {
          userId: currentUser.id,
          guildId: message.channel.guildId,
        },
      },
      select: { id: true },
    });

    if (!member) {
      return NextResponse.json(
        { success: false, message: "Você não é membro deste servidor." },
        { status: 403 },
      );
    }

    const emoji = parsed.data.emoji;
    const existing = await db.reaction.findFirst({
      where: {
        messageId: message.id,
        memberId: member.id,
        unicode: emoji,
        emojiId: null,
      },
      select: { id: true },
    });

    const reacted = !existing;

    if (existing) {
      await db.reaction.delete({ where: { id: existing.id } });
    } else {
      await db.reaction.create({
        data: {
          messageId: message.id,
          memberId: member.id,
          unicode: emoji,
        },
      });
    }

    const updated = await db.message.findUnique({
      where: { id: message.id },
      select: {
        id: true,
        reactions: {
          include: {
            emoji: true,
            member: { select: { userId: true, user: { select: { id: true, username: true, globalName: true } } } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const reactions = reactionGroups(updated?.reactions ?? [], currentUser.id);

    await emitToChannel(message.channelId, reacted ? "MESSAGE_REACTION_ADD" : "MESSAGE_REACTION_REMOVE", {
      guildId: message.channel.guildId,
      channelId: message.channelId,
      messageId: message.id,
      emoji,
      userId: currentUser.id,
      reactions,
    });

    await emitToChannel(message.channelId, "MESSAGE_UPDATE", {
      guildId: message.channel.guildId,
      channelId: message.channelId,
      message: {
        id: message.id,
        reactions,
      },
    });

    return NextResponse.json(
      {
        success: true,
        reacted,
        reactions,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[GUILD_MESSAGE_REACTION]", error);
    return NextResponse.json(
      { success: false, message: "Não foi possível atualizar a reação." },
      { status: 500 },
    );
  }
}
