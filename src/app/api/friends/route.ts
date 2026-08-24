// ROTA: /api/friends
// MÉTODOS: POST
// POST: Envia solicitação de amizade ou bloqueia um usuário.

import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { relationshipBetween } from "@/lib/direct-messages.server";

type Body =
  | {
      action: "request";
      username: string;
    }
  | {
      action: "block";
      userId: string;
    };

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "Não autorizado." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as Body;

    if (body.action === "request") {
      const username = body.username?.trim().replace(/^@/, "");

      if (!username) {
        return NextResponse.json(
          { success: false, message: "Informe um nome de usuário." },
          { status: 400 },
        );
      }

      const target = await db.user.findFirst({
        where: {
          username: {
            equals: username,
            mode: "insensitive",
          },
          bot: null,
        },
        select: {
          id: true,
          username: true,
        },
      });

      if (!target) {
        return NextResponse.json(
          {
            success: false,
            message: "Não encontrei nenhum usuário com esse @username.",
          },
          { status: 404 },
        );
      }

      if (target.id === currentUser.id) {
        return NextResponse.json(
          {
            success: false,
            message: "Você não pode adicionar a si mesmo.",
          },
          { status: 400 },
        );
      }

      const existing = await relationshipBetween(
        currentUser.id,
        target.id,
      );

      if (existing?.type === "FRIEND") {
        return NextResponse.json(
          { success: false, message: "Vocês já são amigos." },
          { status: 409 },
        );
      }

      if (existing?.type === "BLOCKED") {
        const blockedByMe = existing.userOneId === currentUser.id;

        return NextResponse.json(
          {
            success: false,
            message: blockedByMe
              ? "Desbloqueie esse usuário antes de enviar uma solicitação."
              : "Não foi possível enviar a solicitação.",
          },
          { status: 409 },
        );
      }

      if (existing?.type === "PENDING") {
        if (existing.userTwoId === currentUser.id) {
          const accepted = await db.relationship.update({
            where: {
              id: existing.id,
            },
            data: {
              type: "FRIEND",
            },
          });

          return NextResponse.json({
            success: true,
            message: "Solicitação aceita. Agora vocês são amigos!",
            relationshipId: accepted.id,
          });
        }

        return NextResponse.json(
          {
            success: false,
            message: "Você já enviou uma solicitação para esse usuário.",
          },
          { status: 409 },
        );
      }

      const relationship = await db.relationship.create({
        data: {
          type: "PENDING",
          userOneId: currentUser.id,
          userTwoId: target.id,
        },
      });

      return NextResponse.json(
        {
          success: true,
          message: `Solicitação enviada para @${target.username}.`,
          relationshipId: relationship.id,
        },
        { status: 201 },
      );
    }

    if (body.action === "block") {
      const userId = body.userId?.trim();

      if (!userId || userId === currentUser.id) {
        return NextResponse.json(
          { success: false, message: "Usuário inválido." },
          { status: 400 },
        );
      }

      const target = await db.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          id: true,
        },
      });

      if (!target) {
        return NextResponse.json(
          { success: false, message: "Usuário não encontrado." },
          { status: 404 },
        );
      }

      const relationship = await db.$transaction(async (tx) => {
        await tx.relationship.deleteMany({
          where: {
            OR: [
              {
                userOneId: currentUser.id,
                userTwoId: userId,
              },
              {
                userOneId: userId,
                userTwoId: currentUser.id,
              },
            ],
          },
        });

        return tx.relationship.create({
          data: {
            type: "BLOCKED",
            userOneId: currentUser.id,
            userTwoId: userId,
          },
        });
      });

      return NextResponse.json({
        success: true,
        message: "Usuário bloqueado.",
        relationshipId: relationship.id,
      });
    }

    return NextResponse.json(
      { success: false, message: "Ação inválida." },
      { status: 400 },
    );
  } catch (error) {
    console.error("[FRIENDS_POST]", error);

    return NextResponse.json(
      {
        success: false,
        message: "Não foi possível atualizar a amizade.",
      },
      { status: 500 },
    );
  }
}
