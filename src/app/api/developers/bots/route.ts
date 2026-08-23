import { NextResponse } from "next/server";
import crypto from "node:crypto";

import { getCurrentUser } from "@/lib/current-user";
import { db as prisma } from "@/lib/db";
import {
  Permissions,
  hasPermission,
} from "@/lib/permissions";

function generateToken() {
  return `tc_bot_${crypto.randomBytes(48).toString("base64url")}`;
}

function hashToken(token: string) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function normalizeUrl(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  const url = value.trim();

  if (url.length > 2048) {
    return null;
  }

  try {
    const parsed = new URL(url);

    if (
      parsed.protocol !== "http:" &&
      parsed.protocol !== "https:"
    ) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

/**
 * GET
 *
 * Retorna:
 * - Bots pertencentes ao usuário autenticado
 * - Guilds onde o usuário pode instalar bots
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    const ownerId = user?.id;

    if (!ownerId) {
      return NextResponse.json(
        {
          message: "Não autenticado.",
        },
        {
          status: 401,
        },
      );
    }

    // --------------------------------------------------
    // Bots criados pelo usuário
    // --------------------------------------------------
    //
    // IMPORTANTE:
    //
    // userId = usuário especial que representa o bot
    // ownerId = usuário humano que criou o bot
    //
    // Portanto, a busca precisa ser por ownerId.
    //
    const bots = await prisma.bot.findMany({
      where: {
        ownerId,
      },

      include: {
        user: {
          select: {
            id: true,
            username: true,
            globalName: true,
            avatarUrl: true,
            bannerUrl: true,
          },
        },

        gatewaySessions: {
          where: {
            revokedAt: null,
            expiresAt: {
              gt: new Date(),
            },
          },

          select: {
            id: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    // --------------------------------------------------
    // Guilds onde o usuário pode instalar bots
    // --------------------------------------------------

    const memberships =
      await prisma.member.findMany({
        where: {
          userId: ownerId,
        },

        include: {
          guild: {
            select: {
              id: true,
              name: true,
              iconUrl: true,
              ownerId: true,
            },
          },

          roles: {
            select: {
              id: true,
              permissions: true,
            },
          },
        },
      });

    const allowedGuilds = memberships
      .filter((membership) => {
        // Dono do servidor sempre pode instalar bots.
        if (
          membership.guild.ownerId ===
          ownerId
        ) {
          return true;
        }

        let permissions = 0n;

        for (const role of membership.roles) {
          try {
            permissions |= BigInt(
              role.permissions ?? "0",
            );
          } catch {
            // Ignora permissões inválidas.
          }
        }

        // Pode instalar se tiver:
        // ADMINISTRATOR
        // ou MANAGE_GUILD
        return (
          hasPermission(
            permissions,
            Permissions.ADMINISTRATOR,
          ) ||
          hasPermission(
            permissions,
            Permissions.MANAGE_GUILD,
          )
        );
      })
      .map((membership) => ({
        id: membership.guild.id,
        name: membership.guild.name,
        iconUrl: membership.guild.iconUrl,
      }));

    // --------------------------------------------------
    // Descobrir em quais guilds os bots estão
    // --------------------------------------------------

    const botUserIds = bots.map(
      (bot) => bot.userId,
    );

    const botMemberships =
      botUserIds.length > 0
        ? await prisma.member.findMany({
            where: {
              userId: {
                in: botUserIds,
              },
            },

            select: {
              userId: true,

              guild: {
                select: {
                  id: true,
                  name: true,
                  iconUrl: true,
                },
              },
            },
          })
        : [];

    // --------------------------------------------------
    // Montar resposta
    // --------------------------------------------------

    const formattedBots = bots.map(
      (bot) => {
        const guilds =
          botMemberships
            .filter(
              (membership) =>
                membership.userId ===
                bot.userId,
            )
            .map((membership) => ({
              id: membership.guild.id,
              name: membership.guild.name,
              iconUrl:
                membership.guild.iconUrl,
            }));

        return {
          id: bot.id,

          // ID do usuário especial do bot
          userId: bot.userId,

          // ID do usuário humano dono do bot
          ownerId: bot.ownerId,

          username:
            bot.user.username,

          globalName:
            bot.user.globalName,

          avatarUrl:
            bot.user.avatarUrl,

          bannerUrl:
            bot.user.bannerUrl,

          disabled:
            bot.disabled,

          createdAt:
            bot.createdAt.toISOString(),

          guilds,
        };
      },
    );

    return NextResponse.json({
      bots: formattedBots,
      guilds: allowedGuilds,
    });
  } catch (error) {
    console.error(
      "[DEVELOPERS_BOTS_GET]",
      error,
    );

    return NextResponse.json(
      {
        message:
          "Erro interno ao carregar os bots.",
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * POST
 *
 * Cria um novo bot.
 */
export async function POST(
  request: Request,
) {
  try {
    const user = await getCurrentUser();
    const ownerId = user?.id;

    if (!ownerId) {
      return NextResponse.json(
        {
          message: "Não autenticado.",
        },
        {
          status: 401,
        },
      );
    }

    const body =
      await request.json();

    // --------------------------------------------------
    // Dados enviados pelo formulário
    // --------------------------------------------------

    const username =
      String(
        body.username ?? "",
      ).trim();

    const avatarUrl =
      normalizeUrl(
        body.avatarUrl,
      );

    const bannerUrl =
      normalizeUrl(
        body.bannerUrl,
      );

    // --------------------------------------------------
    // Validação do username
    // --------------------------------------------------

    if (
      username.length < 2 ||
      username.length > 32
    ) {
      return NextResponse.json(
        {
          message:
            "O nome precisa ter entre 2 e 32 caracteres.",
        },
        {
          status: 400,
        },
      );
    }

    // --------------------------------------------------
    // Verificar username existente
    // --------------------------------------------------

    const existing =
      await prisma.user.findUnique({
        where: {
          username,
        },

        select: {
          id: true,
        },
      });

    if (existing) {
      return NextResponse.json(
        {
          message:
            "Este username já está sendo usado.",
        },
        {
          status: 409,
        },
      );
    }

    // --------------------------------------------------
    // Gerar token
    // --------------------------------------------------

    const token =
      generateToken();

    const tokenHash =
      hashToken(token);

    // --------------------------------------------------
    // Criar usuário do bot + registro Bot
    // --------------------------------------------------

    const bot =
      await prisma.$transaction(
        async (tx) => {
          /*
           * Este User NÃO é o usuário humano.
           *
           * Ele representa o bot dentro do Typecord.
           */
          const botUser =
            await tx.user.create({
              data: {
                email:
                  `bot_${crypto.randomUUID()}@bots.typecord.internal`,

                username,

                globalName:
                  username,

                passwordHash: null,

                status: "OFFLINE",

                avatarUrl,

                bannerUrl,
              },
            });

          /*
           * Registro do bot.
           *
           * userId:
           *   ID do usuário especial do bot.
           *
           * ownerId:
           *   ID do usuário humano que criou o bot.
           */
          return tx.bot.create({
            data: {
              userId:
                botUser.id,

              ownerId,

              tokenHash,

              disabled: false,
            },

            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  globalName: true,
                  avatarUrl: true,
                  bannerUrl: true,
                },
              },
            },
          });
        },
      );

    // --------------------------------------------------
    // Resposta
    // --------------------------------------------------

    return NextResponse.json(
      {
        bot: {
          id: bot.id,

          // ID do usuário especial do bot
          userId: bot.user.id,

          // ID do usuário humano dono do bot
          ownerId: bot.ownerId,

          username:
            bot.user.username,

          globalName:
            bot.user.globalName,

          avatarUrl:
            bot.user.avatarUrl,

          bannerUrl:
            bot.user.bannerUrl,

          disabled:
            bot.disabled,

          createdAt:
            bot.createdAt.toISOString(),

          guilds: [],
        },

        /*
         * O token bruto só é enviado
         * na criação.
         */
        token,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "[DEVELOPERS_BOTS_POST]",
      error,
    );

    return NextResponse.json(
      {
        message:
          "Erro ao criar bot.",
      },
      {
        status: 500,
      },
    );
  }
}