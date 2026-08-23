import { NextResponse } from "next/server";

import {
  extractBotToken,
} from "@/lib/bots/token";

import {
  authenticateBot,
} from "@/lib/gateway/authenticate";

import {
  createGatewaySession,
} from "@/lib/gateway/session";

import {
  gatewayService,
} from "@/lib/gateway/GatewayService";

import { db as prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  request: Request,
) {
  try {
    // --------------------------------------------------
    // 1. Extrair token
    // --------------------------------------------------

    const token =
      extractBotToken(request);

    if (!token) {
      return NextResponse.json(
        {
          code: "INVALID_TOKEN",
          message:
            "Bot token ausente.",
        },
        {
          status: 401,
        },
      );
    }

    // --------------------------------------------------
    // 2. Autenticar bot
    // --------------------------------------------------

    const bot =
      await authenticateBot(token);

    if (!bot) {
      return NextResponse.json(
        {
          code: "INVALID_TOKEN",
          message:
            "Token de bot inválido.",
        },
        {
          status: 401,
        },
      );
    }

    // --------------------------------------------------
    // 3. Verificar se o bot está desativado
    // --------------------------------------------------

    if (bot.disabled) {
      return NextResponse.json(
        {
          code: "BOT_DISABLED",
          message:
            "Este bot está desativado.",
        },
        {
          status: 403,
        },
      );
    }

    // --------------------------------------------------
    // 4. Criar sessão do Gateway
    // --------------------------------------------------

    const session =
      await createGatewaySession(
        bot.id,
      );

    // --------------------------------------------------
    // 5. Descobrir guilds onde o USUÁRIO DO BOT
    // está presente
    //
    // IMPORTANTE:
    //
    // bot.ownerId = humano que criou o bot
    // bot.userId  = usuário que representa o bot
    //
    // Para guilds precisamos usar bot.userId.
    // --------------------------------------------------

    const memberships =
      await prisma.member.findMany({
        where: {
          userId: bot.userId,
        },

        select: {
          guild: {
            select: {
              id: true,
              name: true,
              iconUrl: true,
            },
          },
        },
      });

    const guilds =
      memberships.map(
        (membership) =>
          membership.guild,
      );

    // --------------------------------------------------
    // 6. Resposta do Gateway
    // --------------------------------------------------

    return NextResponse.json(
      {
        url:
          process.env.NEXT_PUBLIC_APP_URL ??
          "http://localhost:3000",

        session: {
          id: session.id,

          token: session.token,

          expiresAt:
            session.expiresAt.toISOString(),
        },

        bot: {
          id: bot.id,

          ownerId: bot.ownerId,

          user: {
            id: bot.user.id,

            username:
              bot.user.username,

            globalName:
              bot.user.globalName,

            avatarUrl:
              bot.user.avatarUrl,

            bannerUrl:
              bot.user.bannerUrl,
          },
        },

        guilds,

        pusher: {
          key:
            process.env
              .NEXT_PUBLIC_PUSHER_KEY ?? "",

          cluster:
            process.env.PUSHER_CLUSTER ??
            "sa1",

          authEndpoint:
            "/api/gateway/auth",

          channel:
            gatewayService.getBotChannel(
              bot.id,
            ),
        },
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "[GATEWAY]",
      error,
    );

    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",

        message:
          "Erro interno do Gateway.",
      },
      {
        status: 500,
      },
    );
  }
}