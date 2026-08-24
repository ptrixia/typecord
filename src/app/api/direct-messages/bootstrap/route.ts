// ROTA: /api/direct-messages/bootstrap
// MÉTODOS: GET
// GET: Carrega o usuário atual, as conversas de DM/grupo e os relacionamentos de amizade.

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import {
  directUserSelect,
  listConversations,
  serializeRelationship,
} from "@/lib/direct-messages.server";

export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "Não autorizado." },
        { status: 401 },
      );
    }

    const [user, conversations, relationships] = await Promise.all([
      db.user.findUnique({
        where: { id: currentUser.id },
        select: directUserSelect,
      }),
      listConversations(currentUser.id),
      db.relationship.findMany({
        where: {
          OR: [
            { userOneId: currentUser.id },
            { userTwoId: currentUser.id },
          ],
        },
        include: {
          userOne: { select: directUserSelect },
          userTwo: { select: directUserSelect },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
    ]);

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Usuário não encontrado." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        currentUser: user,
        conversations,
        relationships: relationships.map((relationship) =>
          serializeRelationship(relationship, currentUser.id),
        ),
      },
    });
  } catch (error) {
    console.error("[DIRECT_MESSAGES_BOOTSTRAP]", error);

    return NextResponse.json(
      {
        success: false,
        message: "Não foi possível carregar as mensagens diretas.",
      },
      { status: 500 },
    );
  }
}
