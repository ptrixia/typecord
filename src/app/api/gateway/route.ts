import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_TTL_MS = 15 * 60 * 1000;

function json(
  body: Record<string, unknown>,
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function sha256(value: string) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bot ")) {
      return json(
        {
          success: false,
          message: "Authorization inválido.",
        },
        401,
      );
    }

    const botToken = authorization.slice(4).trim();

    if (!botToken) {
      return json(
        {
          success: false,
          message: "Token do bot ausente.",
        },
        401,
      );
    }

    const tokenHash = sha256(botToken);

    const bot = await db.bot.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            globalName: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!bot) {
      return json(
        {
          success: false,
          message: "Token do bot inválido.",
        },
        401,
      );
    }

    if (bot.disabled) {
      return json(
        {
          success: false,
          message: "Este bot está desativado.",
        },
        403,
      );
    }

    const memberships = await db.member.findMany({
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

    const sessionToken = crypto.randomBytes(48).toString("base64url");
    const sessionTokenHash = sha256(sessionToken);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    const session = await db.$transaction(async (tx) => {
      await tx.gatewaySession.deleteMany({
        where: {
          botId: bot.id,
          OR: [
            {
              expiresAt: {
                lt: new Date(),
              },
            },
            {
              revokedAt: {
                not: null,
              },
            },
          ],
        },
      });

      return tx.gatewaySession.create({
        data: {
          botId: bot.id,
          sessionTokenHash,
          expiresAt,
          lastHeartbeatAt: new Date(),
        },
        select: {
          id: true,
          expiresAt: true,
        },
      });
    });

    return json({
      success: true,
      url:
        process.env.TYPECORD_GATEWAY_PUBLIC_URL ||
        "https://gateway.tysaiw.com",
      session: {
        id: session.id,
        token: sessionToken,
        expiresAt: session.expiresAt.toISOString(),
      },
      bot: {
        id: bot.id,
        user: bot.user,
      },
      guilds: memberships.map((membership) => membership.guild),
    });
  } catch (error) {
    console.error("[BOT_GATEWAY_SESSION_ERROR]", error);

    return json(
      {
        success: false,
        message: "Não foi possível criar a sessão do Gateway.",
      },
      500,
    );
  }
}