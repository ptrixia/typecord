// ROTA: /api/users/search?q=termo
// MÉTODOS: GET
// GET: Pesquisa usuários por username ou nome global e retorna o relacionamento atual.

import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import {
  directUserSelect,
  serializeRelationship,
} from "@/lib/direct-messages.server";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "Não autorizado." },
        { status: 401 },
      );
    }

    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (query.length < 2) {
      return NextResponse.json({ success: true, users: [] });
    }

    const users = await db.user.findMany({
      where: {
        id: {
          not: currentUser.id,
        },
        bot: null,
        OR: [
          {
            username: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            globalName: {
              contains: query,
              mode: "insensitive",
            },
          },
        ],
      },
      select: directUserSelect,
      orderBy: {
        username: "asc",
      },
      take: 20,
    });

    const ids = users.map((user) => user.id);

    const relationships =
      ids.length === 0
        ? []
        : await db.relationship.findMany({
            where: {
              OR: [
                {
                  userOneId: currentUser.id,
                  userTwoId: { in: ids },
                },
                {
                  userTwoId: currentUser.id,
                  userOneId: { in: ids },
                },
              ],
            },
            include: {
              userOne: { select: directUserSelect },
              userTwo: { select: directUserSelect },
            },
          });

    const relationshipByUserId = new Map(
      relationships.map((relationship) => {
        const otherId =
          relationship.userOneId === currentUser.id
            ? relationship.userTwoId
            : relationship.userOneId;

        return [
          otherId,
          serializeRelationship(relationship, currentUser.id),
        ];
      }),
    );

    return NextResponse.json({
      success: true,
      users: users.map((user) => ({
        ...user,
        relationship: relationshipByUserId.get(user.id) ?? null,
      })),
    });
  } catch (error) {
    console.error("[USER_SEARCH]", error);

    return NextResponse.json(
      {
        success: false,
        message: "Não foi possível pesquisar usuários.",
      },
      { status: 500 },
    );
  }
}
