import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import {
  assertConversationMember,
  directMessageInclude,
  serializeDirectMessage,
} from "@/lib/direct-messages.server";
import { emitToUser } from "@/lib/realtime/emitter";
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

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    if (!isSameOriginRequest(request)) {
      return sameOriginError();
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "Não autorizado." },
        { status: 401 },
      );
    }

    const limited = await enforceRateLimit(
      request,
      "dm-reaction",
      90,
      60,
      currentUser.id,
    );
    if (limited) return limited;

    const { messageId } = await context.params;
    const parsed = reactionSchema.safeParse(
      await request.json().catch(() => null),
    );

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Emoji inválido." },
        { status: 400 },
      );
    }

    const message = await db.directMessage.findUnique({
      where: { id: messageId },
      select: {
        conversationId: true,
        deleted: true,
      },
    });

    if (!message || message.deleted) {
      return NextResponse.json(
        { success: false, message: "Mensagem inválida." },
        { status: 404 },
      );
    }

    await assertConversationMember(message.conversationId, currentUser.id);

    const emoji = parsed.data.emoji;
    const existing = await db.directMessageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId: currentUser.id,
          emoji,
        },
      },
      select: { id: true },
    });

    let reacted: boolean;

    if (existing) {
      await db.directMessageReaction.delete({ where: { id: existing.id } });
      reacted = false;
    } else {
      await db.directMessageReaction.create({
        data: {
          messageId,
          userId: currentUser.id,
          emoji,
        },
      });
      reacted = true;
    }

    const updated = await db.directMessage.findUnique({
      where: { id: messageId },
      include: directMessageInclude,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, message: "Mensagem não encontrada." },
        { status: 404 },
      );
    }

    const participants = await db.directConversationParticipant.findMany({
      where: { conversationId: message.conversationId },
      select: { userId: true },
    });

    await Promise.allSettled(
      participants.map((participant) =>
        emitToUser(participant.userId, "MESSAGE_UPDATE", {
          conversationId: message.conversationId,
          message: serializeDirectMessage(updated, participant.userId),
        }),
      ),
    );

    return NextResponse.json(
      {
        success: true,
        reacted,
        message: serializeDirectMessage(updated, currentUser.id),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, message: "Sem acesso a esta conversa." },
        { status: 403 },
      );
    }

    console.error("[DIRECT_MESSAGE_REACTION]", error);
    return NextResponse.json(
      { success: false, message: "Não foi possível atualizar a reação." },
      { status: 500 },
    );
  }
}
