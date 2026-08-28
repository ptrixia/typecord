import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getEffectiveChannelPermissions } from "@/lib/channel-permissions";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { Permissions, hasPermission } from "@/lib/permissions";
import { enforceRateLimit, isSameOriginRequest, sameOriginError } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const optionalUrl = z
  .union([z.string().trim().url().max(2048), z.literal(""), z.null()])
  .optional()
  .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null))
  .refine((value) => {
    if (!value) return true;
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  }, "A URL precisa usar HTTP ou HTTPS.");

const createBotSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "O nome precisa ter pelo menos 2 caracteres.")
    .max(32, "O nome pode ter no máximo 32 caracteres.")
    .regex(/^[\p{L}\p{N}_. -]+$/u, "O nome contém caracteres inválidos."),
  avatarUrl: optionalUrl,
  bannerUrl: optionalUrl,
});

function generateToken() {
  return `tc_bot_${crypto.randomBytes(48).toString("base64url")}`;
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }

    const limited = await enforceRateLimit(request, "developers-bots-read", 120, 60, user.id);
    if (limited) return limited;

    const bots = await db.bot.findMany({
      where: { ownerId: user.id },
      select: {
        id: true,
        userId: true,
        ownerId: true,
        disabled: true,
        createdAt: true,
        user: {
          select: {
            username: true,
            globalName: true,
            avatarUrl: true,
            bannerUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const memberships = await db.member.findMany({
      where: { userId: user.id },
      select: {
        guildId: true,
        guild: {
          select: {
            id: true,
            name: true,
            iconUrl: true,
            ownerId: true,
          },
        },
      },
    });

    const permissionResults = await Promise.all(
      memberships.map(async (membership) => {
        if (membership.guild.ownerId === user.id) return membership.guild;

        const permissions = await getEffectiveChannelPermissions(
          membership.guildId,
          user.id,
        );

        if (
          hasPermission(permissions, Permissions.ADMINISTRATOR) ||
          hasPermission(permissions, Permissions.MANAGE_GUILD)
        ) {
          return membership.guild;
        }

        return null;
      }),
    );

    const allowedGuilds = permissionResults.flatMap((guild) =>
      guild ? [{ id: guild.id, name: guild.name, iconUrl: guild.iconUrl }] : [],
    );

    const botUserIds = bots.map((bot) => bot.userId);
    const botMemberships = botUserIds.length
      ? await db.member.findMany({
          where: { userId: { in: botUserIds } },
          select: {
            userId: true,
            guild: {
              select: { id: true, name: true, iconUrl: true },
            },
          },
        })
      : [];

    return NextResponse.json(
      {
        bots: bots.map((bot) => ({
          id: bot.id,
          userId: bot.userId,
          ownerId: bot.ownerId,
          username: bot.user.username,
          globalName: bot.user.globalName,
          avatarUrl: bot.user.avatarUrl,
          bannerUrl: bot.user.bannerUrl,
          disabled: bot.disabled,
          createdAt: bot.createdAt.toISOString(),
          guilds: botMemberships
            .filter((membership) => membership.userId === bot.userId)
            .map((membership) => membership.guild),
        })),
        guilds: allowedGuilds,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[DEVELOPERS_BOTS_GET]", error);
    return NextResponse.json(
      { message: "Erro interno ao carregar os bots." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return sameOriginError();

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }

    const limited = await enforceRateLimit(request, "developers-bots-create", 10, 3600, user.id);
    if (limited) return limited;

    const parsed = createBotSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const total = await db.bot.count({ where: { ownerId: user.id } });
    if (total >= 25) {
      return NextResponse.json(
        { message: "Limite de 25 aplicações por conta atingido." },
        { status: 409 },
      );
    }

    const existing = await db.user.findUnique({
      where: { username: parsed.data.username },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { message: "Este nome de usuário já está sendo usado." },
        { status: 409 },
      );
    }

    const token = generateToken();
    const tokenHash = hashToken(token);

    const bot = await db.$transaction(async (tx) => {
      const botUser = await tx.user.create({
        data: {
          email: `bot_${crypto.randomUUID()}@bots.typecord.internal`,
          username: parsed.data.username,
          globalName: parsed.data.username,
          passwordHash: null,
          status: "OFFLINE",
          avatarUrl: parsed.data.avatarUrl,
          bannerUrl: parsed.data.bannerUrl,
        },
      });

      return tx.bot.create({
        data: {
          userId: botUser.id,
          ownerId: user.id,
          tokenHash,
          disabled: false,
        },
        select: {
          id: true,
          ownerId: true,
          disabled: true,
          createdAt: true,
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
    });

    return NextResponse.json(
      {
        bot: {
          id: bot.id,
          userId: bot.user.id,
          ownerId: bot.ownerId,
          username: bot.user.username,
          globalName: bot.user.globalName,
          avatarUrl: bot.user.avatarUrl,
          bannerUrl: bot.user.bannerUrl,
          disabled: bot.disabled,
          createdAt: bot.createdAt.toISOString(),
          guilds: [],
        },
        token,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[DEVELOPERS_BOTS_POST]", error);
    return NextResponse.json({ message: "Erro ao criar bot." }, { status: 500 });
  }
}
