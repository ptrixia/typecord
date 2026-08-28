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

const updateMessageSchema = z.object({
  content: z.string().trim().min(1).max(8000),
});

async function loadMessageForMutation(messageId: string) {
  return db.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      content: true,
      deleted: true,
      channelId: true,
      memberId: true,
      member: {
        select: {
          userId: true,
        },
      },
      channel: {
        select: {
          guildId: true,
        },
      },
    },
  });
}

async function getMutationContext(messageId: string, currentUserId: string) {
  const message = await loadMessageForMutation(messageId);

  if (!message) {
    return {
      error: NextResponse.json(
        { success: false, message: "Mensagem não encontrada." },
        { status: 404 },
      ),
    };
  }

  const permissions = await getEffectiveChannelPermissions(
    message.channel.guildId,
    currentUserId,
    message.channelId,
  );

  if (!hasPermission(permissions, Permissions.VIEW_CHANNEL)) {
    return {
      error: NextResponse.json(
        { success: false, message: "Sem acesso a este canal." },
        { status: 403 },
      ),
    };
  }

  return { message, permissions };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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
      "guild-message-edit",
      40,
      60,
      currentUser.id,
    );
    if (limited) return limited;

    const { messageId } = await context.params;
    const ctx = await getMutationContext(messageId, currentUser.id);
    if ("error" in ctx) return ctx.error;

    if (ctx.message.deleted) {
      return NextResponse.json(
        { success: false, message: "Essa mensagem foi apagada." },
        { status: 409 },
      );
    }

    if (ctx.message.member.userId !== currentUser.id) {
      return NextResponse.json(
        { success: false, message: "Você só pode editar suas próprias mensagens." },
        { status: 403 },
      );
    }

    const parsed = updateMessageSchema.safeParse(
      await request.json().catch(() => null),
    );

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message ?? "Conteúdo inválido.",
        },
        { status: 400 },
      );
    }

    const updated = await db.message.update({
      where: { id: ctx.message.id },
      data: {
        content: parsed.data.content,
        editedAt: new Date(),
      },
      select: {
        id: true,
        content: true,
        channelId: true,
        editedAt: true,
      },
    });

    await emitToChannel(updated.channelId, "MESSAGE_UPDATE", {
      guildId: ctx.message.channel.guildId,
      channelId: updated.channelId,
      message: updated,
    });

    return NextResponse.json(
      { success: true, message: updated },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[GUILD_MESSAGE_PATCH]", error);
    return NextResponse.json(
      { success: false, message: "Não foi possível editar a mensagem." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
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
      "guild-message-delete",
      35,
      60,
      currentUser.id,
    );
    if (limited) return limited;

    const { messageId } = await context.params;
    const ctx = await getMutationContext(messageId, currentUser.id);
    if ("error" in ctx) return ctx.error;

    const canManage = hasPermission(ctx.permissions, Permissions.MANAGE_MESSAGES);
    const isOwn = ctx.message.member.userId === currentUser.id;

    if (!isOwn && !canManage) {
      return NextResponse.json(
        { success: false, message: "Você não possui permissão para apagar esta mensagem." },
        { status: 403 },
      );
    }

    if (!ctx.message.deleted) {
      await db.$transaction([
        db.attachment.deleteMany({ where: { messageId: ctx.message.id } }),
        db.reaction.deleteMany({ where: { messageId: ctx.message.id } }),
        db.embed.deleteMany({ where: { messageId: ctx.message.id } }),
        db.message.update({
          where: { id: ctx.message.id },
          data: {
            deleted: true,
            content: "",
            editedAt: null,
          },
        }),
      ]);
    }

    await emitToChannel(ctx.message.channelId, "MESSAGE_DELETE", {
      guildId: ctx.message.channel.guildId,
      channelId: ctx.message.channelId,
      messageId: ctx.message.id,
    });

    return NextResponse.json(
      { success: true, messageId: ctx.message.id },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[GUILD_MESSAGE_DELETE]", error);
    return NextResponse.json(
      { success: false, message: "Não foi possível apagar a mensagem." },
      { status: 500 },
    );
  }
}
