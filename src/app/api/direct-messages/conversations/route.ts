// ROTA: /api/direct-messages/conversations
// MÉTODOS: GET, POST
// GET: Lista as conversas do usuário autenticado.
// POST: Cria ou reabre uma DM, ou cria um grupo de mensagens diretas.

import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import {
  areFriends,
  getConversationForUser,
  isBlocked,
  listConversations,
  serializeConversation,
} from "@/lib/direct-messages.server";

type CreateConversationBody =
  | {
      type: "DM";
      userId: string;
    }
  | {
      type: "GROUP";
      name?: string;
      memberIds: string[];
    };

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "Não autorizado." },
        { status: 401 },
      );
    }

    return NextResponse.json({
      success: true,
      conversations: await listConversations(currentUser.id),
    });
  } catch (error) {
    console.error("[DIRECT_CONVERSATIONS_GET]", error);

    return NextResponse.json(
      { success: false, message: "Não foi possível carregar as conversas." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "Não autorizado." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as CreateConversationBody;

    if (body.type === "DM") {
      const targetId = body.userId?.trim();

      if (!targetId || targetId === currentUser.id) {
        return NextResponse.json(
          { success: false, message: "Usuário inválido." },
          { status: 400 },
        );
      }

      if (await isBlocked(currentUser.id, targetId)) {
        return NextResponse.json(
          {
            success: false,
            message: "Essa conversa não pode ser iniciada.",
          },
          { status: 403 },
        );
      }

      if (!(await areFriends(currentUser.id, targetId))) {
        return NextResponse.json(
          {
            success: false,
            message: "Você precisa ser amigo desse usuário para iniciar uma DM.",
          },
          { status: 403 },
        );
      }

      const dmKey = [currentUser.id, targetId].sort().join(":");

      let conversation = await db.directConversation.findUnique({
        where: {
          dmKey,
        },
      });

      if (!conversation) {
        try {
          conversation = await db.directConversation.create({
            data: {
              type: "DM",
              dmKey,
              participants: {
                create: [
                  {
                    userId: currentUser.id,
                  },
                  {
                    userId: targetId,
                  },
                ],
              },
            },
          });
        } catch {
          conversation = await db.directConversation.findUnique({
            where: {
              dmKey,
            },
          });
        }
      }

      if (!conversation) {
        throw new Error("Não foi possível criar a conversa.");
      }

      await db.directConversationParticipant.updateMany({
        where: {
          conversationId: conversation.id,
          userId: {
            in: [currentUser.id, targetId],
          },
        },
        data: {
          isHidden: false,
        },
      });

      const fullConversation = await getConversationForUser(
        conversation.id,
        currentUser.id,
      );

      if (!fullConversation) {
        throw new Error("Conversa não encontrada.");
      }

      return NextResponse.json(
        {
          success: true,
          conversation: serializeConversation(
            fullConversation,
            currentUser.id,
          ),
        },
        { status: 201 },
      );
    }

    if (body.type === "GROUP") {
      const uniqueMemberIds = Array.from(
        new Set(
          (body.memberIds ?? [])
            .map((id) => id?.trim())
            .filter(
              (id): id is string =>
                Boolean(id) && id !== currentUser.id,
            ),
        ),
      );

      if (uniqueMemberIds.length < 1) {
        return NextResponse.json(
          {
            success: false,
            message: "Selecione pelo menos uma pessoa para o grupo.",
          },
          { status: 400 },
        );
      }

      if (uniqueMemberIds.length > 9) {
        return NextResponse.json(
          {
            success: false,
            message: "Um grupo pode ter no máximo 10 participantes.",
          },
          { status: 400 },
        );
      }

      const relations = await db.relationship.findMany({
        where: {
          type: "FRIEND",
          OR: [
            {
              userOneId: currentUser.id,
              userTwoId: { in: uniqueMemberIds },
            },
            {
              userTwoId: currentUser.id,
              userOneId: { in: uniqueMemberIds },
            },
          ],
        },
      });

      const friendIds = new Set(
        relations.map((relationship) =>
          relationship.userOneId === currentUser.id
            ? relationship.userTwoId
            : relationship.userOneId,
        ),
      );

      const allAreFriends = uniqueMemberIds.every((id) =>
        friendIds.has(id),
      );

      if (!allAreFriends) {
        return NextResponse.json(
          {
            success: false,
            message: "Todos os integrantes precisam estar na sua lista de amigos.",
          },
          { status: 403 },
        );
      }

      const name = body.name?.trim().slice(0, 100) || null;

      const conversation = await db.directConversation.create({
        data: {
          type: "GROUP",
          name,
          ownerId: currentUser.id,
          participants: {
            create: [currentUser.id, ...uniqueMemberIds].map(
              (userId) => ({
                userId,
              }),
            ),
          },
        },
      });

      const fullConversation = await getConversationForUser(
        conversation.id,
        currentUser.id,
      );

      if (!fullConversation) {
        throw new Error("Conversa não encontrada.");
      }

      return NextResponse.json(
        {
          success: true,
          conversation: serializeConversation(
            fullConversation,
            currentUser.id,
          ),
        },
        { status: 201 },
      );
    }

    return NextResponse.json(
      { success: false, message: "Tipo de conversa inválido." },
      { status: 400 },
    );
  } catch (error) {
    console.error("[DIRECT_CONVERSATIONS_POST]", error);

    return NextResponse.json(
      {
        success: false,
        message: "Não foi possível criar a conversa.",
      },
      { status: 500 },
    );
  }
}
