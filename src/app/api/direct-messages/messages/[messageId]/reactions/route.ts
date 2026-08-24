// ROTA: /api/direct-messages/messages/[messageId]/reactions
// MÉTODOS: POST
// POST: Alterna uma reação do usuário autenticado em uma mensagem direta.

import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { assertConversationMember } from "@/lib/direct-messages.server";

type RouteContext = {
  params: Promise<{
    messageId: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "Não autorizado." },
        { status: 401 },
      );
    }

    const { messageId } = await context.params;
    const body = (await request.json()) as {
      emoji?: unknown;
    };

    const emoji =
      typeof body.emoji === "string" ? body.emoji.trim() : "";

    if (!emoji || emoji.length > 16) {
      return NextResponse.json(
        { success: false, message: "Emoji inválido." },
        { status: 400 },
      );
    }

    const message = await db.directMessage.findUnique({
      where: {
        id: messageId,
      },
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

    await assertConversationMember(
      message.conversationId,
      currentUser.id,
    );

    const existing = await db.directMessageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId: currentUser.id,
          emoji,
        },
      },
    });

    if (existing) {
      await db.directMessageReaction.delete({
        where: {
          id: existing.id,
        },
      });

      return NextResponse.json({
        success: true,
        reacted: false,
      });
    }

    await db.directMessageReaction.create({
      data: {
        messageId,
        userId: currentUser.id,
        emoji,
      },
    });

    return NextResponse.json({
      success: true,
      reacted: true,
    });
  } catch (error) {
    console.error("[DIRECT_MESSAGE_REACTION]", error);

    return NextResponse.json(
      { success: false, message: "Não foi possível atualizar a reação." },
      { status: 500 },
    );
  }
}
