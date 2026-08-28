import { NextResponse } from "next/server";
import { z } from "zod";

import { getEffectiveChannelPermissions } from "@/lib/channel-permissions";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { Permissions, hasPermission } from "@/lib/permissions";
import { enforceRateLimit, isSameOriginRequest, sameOriginError } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  guildId: z.string().trim().min(1).max(128),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ botId: string }> },
) {
  try {
    if (!isSameOriginRequest(request)) return sameOriginError();

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }

    const limited = await enforceRateLimit(request, "bot-install", 30, 60, user.id);
    if (limited) return limited;

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ message: "guildId é obrigatório." }, { status: 400 });
    }

    const { botId } = await context.params;
    const bot = await db.bot.findFirst({
      where: { id: botId, ownerId: user.id },
      select: {
        id: true,
        userId: true,
        ownerId: true,
        disabled: true,
        user: {
          select: {
            username: true,
            globalName: true,
            avatarUrl: true,
            bannerUrl: true,
          },
        },
      },
    });

    if (!bot) {
      return NextResponse.json({ message: "Bot não encontrado." }, { status: 404 });
    }

    if (bot.disabled) {
      return NextResponse.json({ message: "Este bot está desativado." }, { status: 403 });
    }

    const guild = await db.guild.findUnique({
      where: { id: parsed.data.guildId },
      select: { id: true, name: true, iconUrl: true, ownerId: true },
    });

    if (!guild) {
      return NextResponse.json({ message: "Servidor não encontrado." }, { status: 404 });
    }

    const membership = await db.member.findUnique({
      where: {
        userId_guildId: {
          userId: user.id,
          guildId: guild.id,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json({ message: "Você não é membro deste servidor." }, { status: 403 });
    }

    const permissions = await getEffectiveChannelPermissions(guild.id, user.id);
    const canInstall =
      guild.ownerId === user.id ||
      hasPermission(permissions, Permissions.ADMINISTRATOR) ||
      hasPermission(permissions, Permissions.MANAGE_GUILD);

    if (!canInstall) {
      return NextResponse.json(
        { message: "Você não possui permissão para adicionar bots neste servidor." },
        { status: 403 },
      );
    }

    const existing = await db.member.findUnique({
      where: {
        userId_guildId: {
          userId: bot.userId,
          guildId: guild.id,
        },
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ message: "Este bot já está neste servidor." }, { status: 409 });
    }

    const everyoneRole = await db.role.findFirst({
      where: { guildId: guild.id, isDefault: true },
      select: { id: true },
    });

    const botMember = await db.member.create({
      data: {
        userId: bot.userId,
        guildId: guild.id,
        ...(everyoneRole
          ? {
              roles: {
                connect: { id: everyoneRole.id },
              },
            }
          : {}),
      },
      select: { id: true, userId: true, guildId: true },
    });

    return NextResponse.json(
      {
        success: true,
        bot: {
          id: bot.id,
          userId: bot.userId,
          ownerId: bot.ownerId,
          username: bot.user.username,
          globalName: bot.user.globalName,
          avatarUrl: bot.user.avatarUrl,
          bannerUrl: bot.user.bannerUrl,
        },
        guild: {
          id: guild.id,
          name: guild.name,
          iconUrl: guild.iconUrl,
        },
        member: botMember,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[BOT_INSTALL]", error);
    return NextResponse.json(
      { message: "Erro interno ao adicionar o bot." },
      { status: 500 },
    );
  }
}
