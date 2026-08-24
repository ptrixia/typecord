// ROTA: /api/direct-messages/messages/[messageId]
// MÉTODOS: PATCH, DELETE
// PATCH: Edita o conteúdo de uma mensagem direta do próprio autor.
// DELETE: Apaga logicamente uma mensagem direta do próprio autor.

import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import {
  assertConversationMember,
  directMessageInclude,
  serializeDirectMessage,
} from "@/lib/direct-messages.server";

type RouteContext = {
  params: Promise<{
    messageId: string;
  }>;
};

export async function PATCH(
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
      content?: unknown;
    };

    const message = await db.directMessage.findUnique({
      where: {
        id: messageId,
      },
      select: {
        id: true,
        authorId: true,
        conversationId: true,
        deleted: true,
      },
    });

    if (!message) {
      return NextResponse.json(
        { success: false, message: "Mensagem não encontrada." },
        { status: 404 },
      );
    }

    await assertConversationMember(
      message.conversationId,
      currentUser.id,
    );

    if (message.authorId !== currentUser.id) {
      return NextResponse.json(
        {
          success: false,
          message: "Você só pode editar suas próprias mensagens.",
        },
        { status: 403 },
      );
    }

    if (message.deleted) {
      return NextResponse.json(
        { success: false, message: "Essa mensagem foi apagada." },
        { status: 400 },
      );
    }

    const content =
      typeof body.content === "string" ? body.content.trim() : "";

    if (!content) {
      return NextResponse.json(
        { success: false, message: "A mensagem não pode ficar vazia." },
        { status: 400 },
      );
    }

    if (content.length > 8000) {
      return NextResponse.json(
        {
          success: false,
          message: "A mensagem não pode passar de 8.000 caracteres.",
        },
        { status: 400 },
      );
    }

    const updated = await db.directMessage.update({
      where: {
        id: message.id,
      },
      data: {
        content,
        editedAt: new Date(),
      },
      include: directMessageInclude,
    });

    return NextResponse.json({
      success: true,
      message: serializeDirectMessage(updated, currentUser.id),
    });
  } catch (error) {
    console.error("[DIRECT_MESSAGE_PATCH]", error);

    return NextResponse.json(
      { success: false, message: "Não foi possível editar a mensagem." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
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

    const message = await db.directMessage.findUnique({
      where: {
        id: messageId,
      },
      select: {
        id: true,
        authorId: true,
        conversationId: true,
      },
    });

    if (!message) {
      return NextResponse.json(
        { success: false, message: "Mensagem não encontrada." },
        { status: 404 },
      );
    }

    await assertConversationMember(
      message.conversationId,
      currentUser.id,
    );

    if (message.authorId !== currentUser.id) {
      return NextResponse.json(
        {
          success: false,
          message: "Você só pode apagar suas próprias mensagens.",
        },
        { status: 403 },
      );
    }

    await db.$transaction([
      db.directMessageAttachment.deleteMany({
        where: {
          messageId: message.id,
        },
      }),
      db.directMessageReaction.deleteMany({
        where: {
          messageId: message.id,
        },
      }),
      db.directMessage.update({
        where: {
          id: message.id,
        },
        data: {
          deleted: true,
          content: "",
          editedAt: null,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("[DIRECT_MESSAGE_DELETE]", error);

    return NextResponse.json(
      { success: false, message: "Não foi possível apagar a mensagem." },
      { status: 500 },
    );
  }
}
