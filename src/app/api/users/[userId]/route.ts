// ROTA: /api/users/[userId]
// MÉTODOS: GET
// GET: Retorna o perfil público de um usuário e seu relacionamento com o usuário atual.

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import {
  directUserSelect,
  relationshipBetween,
  serializeRelationship,
} from "@/lib/direct-messages.server";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function GET(
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

    const { userId } = await context.params;

    const user = await db.user.findUnique({
      where: {
        id: userId,
      },
      select: directUserSelect,
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Usuário não encontrado." },
        { status: 404 },
      );
    }

    const relationship =
      user.id === currentUser.id
        ? null
        : await relationshipBetween(currentUser.id, user.id);

    return NextResponse.json({
      success: true,
      user,
      relationship: relationship
        ? serializeRelationship(relationship, currentUser.id)
        : null,
    });
  } catch (error) {
    console.error("[USER_PROFILE]", error);

    return NextResponse.json(
      { success: false, message: "Não foi possível carregar o perfil." },
      { status: 500 },
    );
  }
}
