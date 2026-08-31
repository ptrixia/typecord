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
import { isE2EEEnvelope } from "@/lib/e2ee-envelope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ messageId: string }>;
};

const editMessageSchema = z.object({
  content: z.string().trim().min(1).max(24000),
});

async function getParticipantIds(conversationId: string) {
  const participants = await db.directConversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true },
  });

  return participants.map((participant) => participant.userId);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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
      "dm-message-edit",
      40,
      60,
      currentUser.id,
    );
    if (limited) return limited;

    const { messageId } = await context.params;
    const parsed = editMessageSchema.safeParse(
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

    const message = await db.directMessage.findUnique({
      where: { id: messageId },
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

    await assertConversationMember(message.conversationId, currentUser.id);

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
        { status: 409 },
      );
    }

    if (!isE2EEEnvelope(parsed.data.content)) {
      return NextResponse.json(
        { success: false, message: "Esta conversa exige criptografia de ponta a ponta." },
        { status: 422 },
      );
    }

    const updated = await db.directMessage.update({
      where: { id: message.id },
      data: {
        content: parsed.data.content,
        editedAt: new Date(),
      },
      include: directMessageInclude,
    });

    const participantIds = await getParticipantIds(message.conversationId);

    await Promise.allSettled(
      participantIds.map((userId) =>
        emitToUser(userId, "MESSAGE_UPDATE", {
          conversationId: message.conversationId,
          message: serializeDirectMessage(updated, userId),
        }),
      ),
    );

    return NextResponse.json(
      {
        success: true,
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

    console.error("[DIRECT_MESSAGE_PATCH]", error);
    return NextResponse.json(
      { success: false, message: "Não foi possível editar a mensagem." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
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
      "dm-message-delete",
      30,
      60,
      currentUser.id,
    );
    if (limited) return limited;

    const { messageId } = await context.params;
    const message = await db.directMessage.findUnique({
      where: { id: messageId },
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

    await assertConversationMember(message.conversationId, currentUser.id);

    if (message.authorId !== currentUser.id) {
      return NextResponse.json(
        {
          success: false,
          message: "Você só pode apagar suas próprias mensagens.",
        },
        { status: 403 },
      );
    }

    if (!message.deleted) {
      await db.$transaction([
        db.directMessageAttachment.deleteMany({
          where: { messageId: message.id },
        }),
        db.directMessageReaction.deleteMany({
          where: { messageId: message.id },
        }),
        db.directMessage.update({
          where: { id: message.id },
          data: {
            deleted: true,
            content: "",
            editedAt: null,
          },
        }),
      ]);
    }

    const participantIds = await getParticipantIds(message.conversationId);
    await Promise.allSettled(
      participantIds.map((userId) =>
        emitToUser(userId, "MESSAGE_DELETE", {
          conversationId: message.conversationId,
          messageId: message.id,
        }),
      ),
    );

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, message: "Sem acesso a esta conversa." },
        { status: 403 },
      );
    }

    console.error("[DIRECT_MESSAGE_DELETE]", error);
    return NextResponse.json(
      { success: false, message: "Não foi possível apagar a mensagem." },
      { status: 500 },
    );
  }
}
