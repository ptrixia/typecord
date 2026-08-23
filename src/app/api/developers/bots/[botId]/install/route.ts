import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/current-user";
import { db as prisma } from "@/lib/db";

import {
  Permissions,
  hasPermission,
} from "@/lib/permissions";

export async function POST(
  request: Request,
  context: {
    params: Promise<{
      botId: string;
    }>;
  },
) {
  try {
    // --------------------------------------------------
    // 1. Usuário autenticado
    // --------------------------------------------------

    const currentUser =
      await getCurrentUser();

    const currentUserId =
      currentUser?.id;

    if (!currentUserId) {
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
    // 2. Parâmetros
    // --------------------------------------------------

    const { botId } =
      await context.params;

    const body =
      await request.json();

    const guildId =
      body?.guildId;

    if (
      typeof guildId !== "string" ||
      !guildId
    ) {
      return NextResponse.json(
        {
          message:
            "guildId é obrigatório.",
        },
        {
          status: 400,
        },
      );
    }

    // --------------------------------------------------
    // 3. Procurar o BOT
    // --------------------------------------------------
    //
    // IMPORTANTE:
    //
    // userId  = usuário especial do bot
    // ownerId = usuário humano dono do bot
    //
    // --------------------------------------------------

    const bot =
      await prisma.bot.findUnique({
        where: {
          id: botId,
        },

        select: {
          id: true,

          userId: true,

          ownerId: true,

          disabled: true,

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

    if (!bot) {
      return NextResponse.json(
        {
          message:
            "Bot não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    // --------------------------------------------------
    // 4. Verificar proprietário do bot
    // --------------------------------------------------
    //
    // NÃO comparar:
    //
    // bot.userId === currentUserId
    //
    // porque bot.userId é o usuário especial.
    //
    // O correto é:
    //
    // bot.ownerId === currentUserId
    //
    // --------------------------------------------------

    if (
      bot.ownerId !== currentUserId
    ) {
      console.log(
        "[BOT_INSTALL] Dono inválido",
        {
          currentUserId,
          botOwnerId: bot.ownerId,
          botUserId: bot.userId,
          botId: bot.id,
        },
      );

      return NextResponse.json(
        {
          message:
            "Você não pode instalar este bot.",
        },
        {
          status: 403,
        },
      );
    }

    // --------------------------------------------------
    // 5. Verificar se o bot está desativado
    // --------------------------------------------------

    if (bot.disabled) {
      return NextResponse.json(
        {
          message:
            "Este bot está desativado.",
        },
        {
          status: 403,
        },
      );
    }

    // --------------------------------------------------
    // 6. Procurar a guild
    // --------------------------------------------------

    const guild =
      await prisma.guild.findUnique({
        where: {
          id: guildId,
        },

        select: {
          id: true,
          name: true,
          iconUrl: true,
          ownerId: true,
        },
      });

    if (!guild) {
      return NextResponse.json(
        {
          message:
            "Servidor não encontrado.",
        },
        {
          status: 404,
        },
      );
    }

    // --------------------------------------------------
    // 7. Verificar se o usuário é membro
    // --------------------------------------------------

    const member =
      await prisma.member.findUnique({
        where: {
          userId_guildId: {
            userId: currentUserId,
            guildId: guild.id,
          },
        },

        include: {
          roles: {
            select: {
              permissions: true,
            },
          },
        },
      });

    if (!member) {
      return NextResponse.json(
        {
          message:
            "Você não é membro deste servidor.",
        },
        {
          status: 403,
        },
      );
    }

    // --------------------------------------------------
    // 8. Verificar permissões
    // --------------------------------------------------

    const isGuildOwner =
      guild.ownerId ===
      currentUserId;

    let permissions = 0n;

    for (const role of member.roles) {
      try {
        permissions |= BigInt(
          role.permissions ?? "0",
        );
      } catch {
        // Ignora bitfield inválido.
      }
    }

    const isAdministrator =
      hasPermission(
        permissions,
        Permissions.ADMINISTRATOR,
      );

    const canManageGuild =
      hasPermission(
        permissions,
        Permissions.MANAGE_GUILD,
      );

    const canInstall =
      isGuildOwner ||
      isAdministrator ||
      canManageGuild;

    if (!canInstall) {
      return NextResponse.json(
        {
          message:
            "Você não possui permissão para adicionar bots neste servidor.",
        },
        {
          status: 403,
        },
      );
    }

    // --------------------------------------------------
    // 9. Verificar se o bot já está na guild
    // --------------------------------------------------

    const existingMember =
      await prisma.member.findUnique({
        where: {
          userId_guildId: {
            userId: bot.userId,
            guildId: guild.id,
          },
        },

        select: {
          id: true,
        },
      });

    if (existingMember) {
      return NextResponse.json(
        {
          message:
            "Este bot já está neste servidor.",
        },
        {
          status: 409,
        },
      );
    }

    // --------------------------------------------------
    // 10. Adicionar o bot à guild
    // --------------------------------------------------

    const botMember =
      await prisma.member.create({
        data: {
          userId: bot.userId,
          guildId: guild.id,
        },
      });

    // --------------------------------------------------
    // 11. Resposta
    // --------------------------------------------------

    return NextResponse.json(
      {
        success: true,

        bot: {
          id: bot.id,

          userId: bot.userId,

          ownerId: bot.ownerId,

          username:
            bot.user.username,

          globalName:
            bot.user.globalName,

          avatarUrl:
            bot.user.avatarUrl,

          bannerUrl:
            bot.user.bannerUrl,
        },

        guild: {
          id: guild.id,
          name: guild.name,
          iconUrl: guild.iconUrl,
        },

        member: {
          id: botMember.id,
          userId: botMember.userId,
          guildId: botMember.guildId,
        },
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error(
      "[BOT_INSTALL]",
      error,
    );

    return NextResponse.json(
      {
        message:
          "Erro interno ao adicionar o bot.",
      },
      {
        status: 500,
      },
    );
  }
}