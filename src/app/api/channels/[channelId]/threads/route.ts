import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getEffectiveChannelPermissions } from "@/lib/channel-permissions";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { Permissions, hasPermission } from "@/lib/permissions";
import { emitToChannel, emitToGuild } from "@/lib/realtime/emitter";
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
  messageId: z.string().min(1),
});

function normalizeThreadName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .toLocaleLowerCase("pt-BR")
    .slice(0, 100);
}

function getDisplayContent(value: string) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed.content === "string" ? parsed.content : value;
  } catch {
    return value;
  }
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

    const starterMessage = await db.message.findFirst({
      where: { id: parsed.data.messageId, channelId: parent.id, deleted: false },
      select: { id: true, content: true },
    });
    if (!starterMessage) {
      return NextResponse.json(
        { success: false, message: "A mensagem que originou a thread não foi encontrada." },
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

    // Mensagens podem conter apenas emojis, símbolos ou menções. Depois da
    // normalização esses títulos ficam vazios, então usamos um nome seguro.
    const name = normalizeThreadName(parsed.data.name) || "thread";

    const member = await db.member.findUnique({
      where: { userId_guildId: { userId: currentUser.id, guildId: parent.guildId } },
      select: { id: true, user: { select: { id: true, username: true, globalName: true, avatarUrl: true } } },
    });
    if (!member) {
      return NextResponse.json({ success: false, message: "Você não é membro deste servidor." }, { status: 403 });
    }

    const { thread, threadMessage } = await db.$transaction(async (transaction) => {
      const createdThread = await transaction.channel.create({
        data: {
          guildId: parent.guildId,
          parentId: parent.id,
          name,
          type: parsed.data.private ? "PRIVATE_THREAD" : "PUBLIC_THREAD",
          position: 0,
          threadStarterMessageId: starterMessage.id,
        },
      });

      const createdMessage = await transaction.message.create({
        data: {
          content: `🧵 **${name}**\n[Abrir thread](/channels/${parent.guildId}/${createdThread.id})`,
          channelId: parent.id,
          memberId: member.id,
          replyToId: starterMessage.id,
        },
        select: {
          id: true,
          content: true,
          createdAt: true,
          editedAt: true,
          member: { select: { nickname: true, user: { select: { id: true, username: true, globalName: true, avatarUrl: true, bot: true } } } },
          replyTo: { select: { id: true, content: true, deleted: true, member: { select: { nickname: true, user: { select: { username: true, globalName: true, avatarUrl: true } } } } } },
        },
      });

      await transaction.auditLog.create({
        data: {
          guildId: parent.guildId,
          actorId: currentUser.id,
          action: "THREAD_CREATE",
          targetId: createdThread.id,
          metadata: { parentId: parent.id, name, private: parsed.data.private, messageId: starterMessage.id },
        },
      });

      return { thread: createdThread, threadMessage: createdMessage };
    });

    const serializedThreadMessage = {
      id: threadMessage.id,
      content: threadMessage.content,
      author: threadMessage.member.nickname || threadMessage.member.user.globalName || threadMessage.member.user.username,
      authorId: threadMessage.member.user.id,
      avatarUrl: threadMessage.member.user.avatarUrl,
      createdAt: threadMessage.createdAt.toISOString(),
      editedAt: threadMessage.editedAt?.toISOString() ?? null,
      reply: threadMessage.replyTo ? {
        messageId: threadMessage.replyTo.id,
        author: threadMessage.replyTo.member.nickname || threadMessage.replyTo.member.user.globalName || threadMessage.replyTo.member.user.username,
        content: threadMessage.replyTo.deleted ? "Mensagem apagada" : getDisplayContent(threadMessage.replyTo.content),
        avatarUrl: threadMessage.replyTo.member.user.avatarUrl,
      } : null,
      reactions: [],
      attachments: [],
      embeds: [],
      isBot: false,
      isBotVerified: false,
      isWebhook: false,
    };

    await emitToGuild(parent.guildId, "CHANNEL_CREATE", {
      guildId: parent.guildId,
      channel: thread,
    });
    await emitToChannel(parent.id, "MESSAGE_CREATE", {
      guildId: parent.guildId,
      channelId: parent.id,
      message: serializedThreadMessage,
    });

    return NextResponse.json(
      { success: true, channel: thread, message: serializedThreadMessage },
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
