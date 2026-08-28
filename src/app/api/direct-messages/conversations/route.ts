// ROTA: /api/direct-messages/conversations/[conversationId]
// MÉTODOS: PATCH, DELETE
// PATCH: Edita um grupo, adiciona/remove membros ou permite sair do grupo.
// DELETE: Oculta uma DM para o usuário ou exclui permanentemente um grupo quando permitido.

import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import {
  assertConversationMember,
  getConversationForUser,
  serializeConversation,
} from "@/lib/direct-messages.server";

type RouteContext = {
  params: Promise<{
    conversationId: string;
  }>;
};

type PatchBody =
  | {
      action: "update";
      name?: string;
      iconUrl?: string | null;
    }
  | {
      action: "add_members";
      userIds: string[];
    }
  | {
      action: "remove_member";
      userId: string;
    }
  | {
      action: "leave";
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

    const { conversationId } = await context.params;
    await assertConversationMember(conversationId, currentUser.id);

    const conversation = await db.directConversation.findUnique({
      where: {
        id: conversationId,
      },
      include: {
        participants: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, message: "Conversa não encontrada." },
        { status: 404 },
      );
    }

    if (conversation.type !== "GROUP") {
      return NextResponse.json(
        {
          success: false,
          message: "Essa ação só está disponível em grupos.",
        },
        { status: 400 },
      );
    }

    const body = (await request.json()) as PatchBody;
    const isOwner = conversation.ownerId === currentUser.id;

    if (body.action === "update") {
      if (!isOwner) {
        return NextResponse.json(
          { success: false, message: "Apenas o dono pode editar o grupo." },
          { status: 403 },
        );
      }

      const name =
        body.name === undefined
          ? undefined
          : body.name.trim().slice(0, 100) || null;

      const updated = await db.directConversation.update({
        where: {
          id: conversation.id,
        },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(body.iconUrl !== undefined
            ? { iconUrl: body.iconUrl?.trim() || null }
            : {}),
        },
      });

      const full = await getConversationForUser(
        updated.id,
        currentUser.id,
      );

      return NextResponse.json({
        success: true,
        conversation: full
          ? serializeConversation(full, currentUser.id)
          : null,
      });
    }

    if (body.action === "add_members") {
      if (!isOwner) {
        return NextResponse.json(
          {
            success: false,
            message: "Apenas o dono pode adicionar participantes.",
          },
          { status: 403 },
        );
      }

      const existingIds = new Set(
        conversation.participants.map((participant) => participant.userId),
      );

      const userIds = Array.from(
        new Set(
          (body.userIds ?? [])
            .map((id) => id?.trim())
            .filter(
              (id): id is string =>
                Boolean(id) &&
                id !== currentUser.id &&
                !existingIds.has(id),
            ),
        ),
      );

      if (userIds.length === 0) {
        return NextResponse.json({
          success: true,
          message: "Nenhum participante novo.",
        });
      }

      if (conversation.participants.length + userIds.length > 10) {
        return NextResponse.json(
          {
            success: false,
            message: "O grupo pode ter no máximo 10 participantes.",
          },
          { status: 400 },
        );
      }

      const friendships = await db.relationship.findMany({
        where: {
          type: "FRIEND",
          OR: [
            {
              userOneId: currentUser.id,
              userTwoId: { in: userIds },
            },
            {
              userTwoId: currentUser.id,
              userOneId: { in: userIds },
            },
          ],
        },
      });

      const friendIds = new Set(
        friendships.map((relationship) =>
          relationship.userOneId === currentUser.id
            ? relationship.userTwoId
            : relationship.userOneId,
        ),
      );

      if (!userIds.every((id) => friendIds.has(id))) {
        return NextResponse.json(
          {
            success: false,
            message: "Você só pode adicionar amigos ao grupo.",
          },
          { status: 403 },
        );
      }

      await db.directConversationParticipant.createMany({
        data: userIds.map((userId) => ({
          conversationId: conversation.id,
          userId,
        })),
        skipDuplicates: true,
      });

      await db.directConversation.update({
        where: {
          id: conversation.id,
        },
        data: {
          updatedAt: new Date(),
        },
      });

      const full = await getConversationForUser(
        conversation.id,
        currentUser.id,
      );

      return NextResponse.json({
        success: true,
        conversation: full
          ? serializeConversation(full, currentUser.id)
          : null,
      });
    }

    if (body.action === "remove_member") {
      if (!isOwner) {
        return NextResponse.json(
          {
            success: false,
            message: "Apenas o dono pode remover participantes.",
          },
          { status: 403 },
        );
      }

      if (!body.userId || body.userId === currentUser.id) {
        return NextResponse.json(
          {
            success: false,
            message: "Use a opção de sair do grupo para remover a si mesmo.",
          },
          { status: 400 },
        );
      }

      await db.directConversationParticipant.deleteMany({
        where: {
          conversationId: conversation.id,
          userId: body.userId,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Participante removido.",
      });
    }

    if (body.action === "leave") {
      if (isOwner) {
        return NextResponse.json(
          {
            success: false,
            message:
              "O dono não pode sair do grupo. Exclua o grupo ou transfira a propriedade em uma futura implementação.",
          },
          { status: 400 },
        );
      }

      await db.directConversationParticipant.delete({
        where: {
          conversationId_userId: {
            conversationId: conversation.id,
            userId: currentUser.id,
          },
        },
      });

      return NextResponse.json({
        success: true,
        left: true,
      });
    }

    return NextResponse.json(
      { success: false, message: "Ação inválida." },
      { status: 400 },
    );
  } catch (error) {
    console.error("[DIRECT_CONVERSATION_PATCH]", error);

    return NextResponse.json(
      { success: false, message: "Não foi possível atualizar a conversa." },
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

    const { conversationId } = await context.params;
    await assertConversationMember(conversationId, currentUser.id);

    const conversation = await db.directConversation.findUnique({
      where: {
        id: conversationId,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, message: "Conversa não encontrada." },
        { status: 404 },
      );
    }

    if (conversation.type === "DM") {
      await db.directConversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId,
            userId: currentUser.id,
          },
        },
        data: {
          isHidden: true,
        },
      });

      return NextResponse.json({
        success: true,
        hidden: true,
      });
    }

    if (conversation.ownerId !== currentUser.id) {
      return NextResponse.json(
        {
          success: false,
          message: "Apenas o dono pode excluir o grupo.",
        },
        { status: 403 },
      );
    }

    await db.directConversation.delete({
      where: {
        id: conversation.id,
      },
    });

    return NextResponse.json({
      success: true,
      deleted: true,
    });
  } catch (error) {
    console.error("[DIRECT_CONVERSATION_DELETE]", error);

    return NextResponse.json(
      { success: false, message: "Não foi possível remover a conversa." },
      { status: 500 },
    );
  }
}
