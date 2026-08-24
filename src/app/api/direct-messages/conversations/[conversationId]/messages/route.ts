// ROTA: /api/direct-messages/conversations/[conversationId]/messages
// MÉTODOS: GET, POST
// GET: Lista as mensagens da conversa com paginação.
// POST: Envia uma nova mensagem, resposta e/ou anexos para a conversa.

import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import {
  assertConversationMember,
  directMessageInclude,
  isBlocked,
  serializeDirectMessage,
} from "@/lib/direct-messages.server";

type RouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

type IncomingAttachment = {
  url?: unknown;
  filename?: unknown;
  fileSize?: unknown;
  fileType?: unknown;
};

export async function GET(
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

    const { conversationId } = await context.params;
    await assertConversationMember(conversationId, currentUser.id);

    const before = request.nextUrl.searchParams.get("before");
    const take = Math.min(
      Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 50), 1),
      100,
    );

    const messages = await db.directMessage.findMany({
      where: {
        conversationId,
        ...(before
          ? {
              createdAt: {
                lt: new Date(before),
              },
            }
          : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
      take,
      include: directMessageInclude,
    });

    await db.directConversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: currentUser.id,
        },
      },
      data: {
        lastReadAt: new Date(),
        isHidden: false,
      },
    });

    return NextResponse.json({
      success: true,
      messages: messages
        .reverse()
        .map((message) =>
          serializeDirectMessage(message, currentUser.id),
        ),
      hasMore: messages.length === take,
    });
  } catch (error) {
    console.error("[DIRECT_MESSAGES_GET]", error);

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, message: "Sem acesso a esta conversa." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { success: false, message: "Não foi possível carregar as mensagens." },
      { status: 500 },
    );
  }
}

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

    const { conversationId } = await context.params;
    await assertConversationMember(conversationId, currentUser.id);

    const conversation = await db.directConversation.findUnique({
      where: { id: conversationId },
      select: {
        type: true,
        participants: {
          select: { userId: true },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, message: "Conversa não encontrada." },
        { status: 404 },
      );
    }

    if (conversation.type === "DM") {
      const otherUserId = conversation.participants.find(
        (participant) => participant.userId !== currentUser.id,
      )?.userId;

      if (
        otherUserId &&
        (await isBlocked(currentUser.id, otherUserId))
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Não é possível enviar mensagens nesta conversa.",
          },
          { status: 403 },
        );
      }
    }

    const body = (await request.json()) as {
      content?: unknown;
      replyToId?: unknown;
      attachments?: IncomingAttachment[];
    };

    const content =
      typeof body.content === "string" ? body.content.trim() : "";

    if (content.length > 8000) {
      return NextResponse.json(
        {
          success: false,
          message: "A mensagem não pode passar de 8.000 caracteres.",
        },
        { status: 400 },
      );
    }

    const attachments = Array.isArray(body.attachments)
      ? body.attachments
          .slice(0, 10)
          .filter(
            (attachment) =>
              typeof attachment.url === "string" &&
              typeof attachment.filename === "string" &&
              typeof attachment.fileSize === "number" &&
              Number.isFinite(attachment.fileSize) &&
              attachment.fileSize >= 0 &&
              typeof attachment.fileType === "string",
          )
          .map((attachment) => ({
            url: String(attachment.url),
            filename: String(attachment.filename).slice(0, 255),
            fileSize: Math.trunc(Number(attachment.fileSize)),
            fileType: String(attachment.fileType).slice(0, 150),
          }))
      : [];

    if (!content && attachments.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Digite uma mensagem ou adicione um arquivo.",
        },
        { status: 400 },
      );
    }

    const replyToId =
      typeof body.replyToId === "string" && body.replyToId.trim()
        ? body.replyToId.trim()
        : null;

    if (replyToId) {
      const replyMessage = await db.directMessage.findFirst({
        where: {
          id: replyToId,
          conversationId,
        },
        select: {
          id: true,
        },
      });

      if (!replyMessage) {
        return NextResponse.json(
          { success: false, message: "Mensagem respondida inválida." },
          { status: 400 },
        );
      }
    }

    const message = await db.$transaction(async (tx) => {
      const created = await tx.directMessage.create({
        data: {
          conversationId,
          authorId: currentUser.id,
          content,
          replyToId,
          attachments: {
            create: attachments,
          },
        },
        include: directMessageInclude,
      });

      await tx.directConversation.update({
        where: {
          id: conversationId,
        },
        data: {
          updatedAt: new Date(),
        },
      });

      await tx.directConversationParticipant.updateMany({
        where: {
          conversationId,
        },
        data: {
          isHidden: false,
        },
      });

      return created;
    });

    return NextResponse.json(
      {
        success: true,
        message: serializeDirectMessage(message, currentUser.id),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[DIRECT_MESSAGES_POST]", error);

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, message: "Sem acesso a esta conversa." },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { success: false, message: "Não foi possível enviar a mensagem." },
      { status: 500 },
    );
  }
}
