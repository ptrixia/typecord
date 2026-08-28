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
  params: Promise<{ messageId: string }>;
};

async function setPinned(request: NextRequest, context: RouteContext, pinned: boolean) {
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
    "guild-message-pin",
    40,
    60,
    currentUser.id,
  );
  if (limited) return limited;

  const { messageId } = await context.params;
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
    !hasPermission(permissions, Permissions.PIN_MESSAGES)
  ) {
    return NextResponse.json(
      { success: false, message: "Você não possui permissão para fixar mensagens." },
      { status: 403 },
    );
  }

  const updated = await db.message.update({
    where: { id: message.id },
    data: { isPinned: pinned },
    select: {
      id: true,
      isPinned: true,
      channelId: true,
    },
  });

  await db.auditLog.create({
    data: {
      guildId: message.channel.guildId,
      actorId: currentUser.id,
      action: pinned ? "MESSAGE_PIN" : "MESSAGE_UNPIN",
      targetId: message.id,
    },
  });

  await emitToChannel(message.channelId, "MESSAGE_UPDATE", {
    guildId: message.channel.guildId,
    channelId: message.channelId,
    message: updated,
  });

  return NextResponse.json(
    { success: true, message: updated },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    return await setPinned(request, context, true);
  } catch (error) {
    console.error("[GUILD_MESSAGE_PIN]", error);
    return NextResponse.json(
      { success: false, message: "Não foi possível fixar a mensagem." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    return await setPinned(request, context, false);
  } catch (error) {
    console.error("[GUILD_MESSAGE_UNPIN]", error);
    return NextResponse.json(
      { success: false, message: "Não foi possível desafixar a mensagem." },
      { status: 500 },
    );
  }
}
