// ROTA: /api/friends/[relationshipId]
// MÉTODOS: PATCH, DELETE
// PATCH: Aceita, rejeita, bloqueia ou desbloqueia um relacionamento.
// DELETE: Remove uma amizade ou cancela/remove uma solicitação quando permitido.

import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

type RouteContext = {
  params: Promise<{
    relationshipId: string;
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

    const { relationshipId } = await context.params;
    const body = (await request.json()) as {
      action?: "accept" | "reject" | "block" | "unblock";
    };

    const relationship = await db.relationship.findUnique({
      where: {
        id: relationshipId,
      },
    });

    if (!relationship) {
      return NextResponse.json(
        { success: false, message: "Relacionamento não encontrado." },
        { status: 404 },
      );
    }

    const isParticipant =
      relationship.userOneId === currentUser.id ||
      relationship.userTwoId === currentUser.id;

    if (!isParticipant) {
      return NextResponse.json(
        { success: false, message: "Sem permissão." },
        { status: 403 },
      );
    }

    if (body.action === "accept") {
      if (
        relationship.type !== "PENDING" ||
        relationship.userTwoId !== currentUser.id
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Essa solicitação não pode ser aceita.",
          },
          { status: 400 },
        );
      }

      await db.relationship.update({
        where: {
          id: relationship.id,
        },
        data: {
          type: "FRIEND",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Solicitação aceita.",
      });
    }

    if (body.action === "reject") {
      if (relationship.type !== "PENDING") {
        return NextResponse.json(
          { success: false, message: "Solicitação inválida." },
          { status: 400 },
        );
      }

      await db.relationship.delete({
        where: {
          id: relationship.id,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Solicitação removida.",
      });
    }

    if (body.action === "unblock") {
      if (
        relationship.type !== "BLOCKED" ||
        relationship.userOneId !== currentUser.id
      ) {
        return NextResponse.json(
          { success: false, message: "Bloqueio inválido." },
          { status: 400 },
        );
      }

      await db.relationship.delete({
        where: {
          id: relationship.id,
        },
      });

      return NextResponse.json({
        success: true,
        message: "Usuário desbloqueado.",
      });
    }

    if (body.action === "block") {
      const otherUserId =
        relationship.userOneId === currentUser.id
          ? relationship.userTwoId
          : relationship.userOneId;

      await db.$transaction(async (tx) => {
        await tx.relationship.deleteMany({
          where: {
            OR: [
              {
                userOneId: currentUser.id,
                userTwoId: otherUserId,
              },
              {
                userOneId: otherUserId,
                userTwoId: currentUser.id,
              },
            ],
          },
        });

        await tx.relationship.create({
          data: {
            type: "BLOCKED",
            userOneId: currentUser.id,
            userTwoId: otherUserId,
          },
        });
      });

      return NextResponse.json({
        success: true,
        message: "Usuário bloqueado.",
      });
    }

    return NextResponse.json(
      { success: false, message: "Ação inválida." },
      { status: 400 },
    );
  } catch (error) {
    console.error("[FRIEND_RELATION_PATCH]", error);

    return NextResponse.json(
      { success: false, message: "Não foi possível concluir a ação." },
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

    const { relationshipId } = await context.params;

    const relationship = await db.relationship.findUnique({
      where: {
        id: relationshipId,
      },
    });

    if (!relationship) {
      return NextResponse.json(
        { success: false, message: "Relacionamento não encontrado." },
        { status: 404 },
      );
    }

    const isParticipant =
      relationship.userOneId === currentUser.id ||
      relationship.userTwoId === currentUser.id;

    if (!isParticipant) {
      return NextResponse.json(
        { success: false, message: "Sem permissão." },
        { status: 403 },
      );
    }

    if (
      relationship.type === "BLOCKED" &&
      relationship.userOneId !== currentUser.id
    ) {
      return NextResponse.json(
        { success: false, message: "Sem permissão." },
        { status: 403 },
      );
    }

    await db.relationship.delete({
      where: {
        id: relationship.id,
      },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("[FRIEND_RELATION_DELETE]", error);

    return NextResponse.json(
      { success: false, message: "Não foi possível remover." },
      { status: 500 },
    );
  }
}
