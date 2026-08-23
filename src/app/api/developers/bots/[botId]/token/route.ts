import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getCurrentUser } from "@/lib/current-user";
import { db as prisma } from "@/lib/db";

function generateToken() {
  return `tc_bot_${crypto.randomBytes(48).toString("base64url")}`;
}

function hashToken(token: string) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}



export async function POST(
  request: Request,
  context: {
    params: Promise<{
      botId: string;
    }>;
  },
) {
  try {
    const user = await getCurrentUser();
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json(
        {
          message:
            "Não autenticado.",
        },
        { status: 401 },
      );
    }

    const { botId } =
      await context.params;

    const bot =
      await prisma.bot.findFirst({
        where: {
          id: botId,
          userId,
        },
      });

    if (!bot) {
      return NextResponse.json(
        {
          message:
            "Bot não encontrado.",
        },
        { status: 404 },
      );
    }

    const token =
      generateToken();

    const tokenHash =
      hashToken(token);

    await prisma.bot.update({
      where: {
        id: bot.id,
      },

      data: {
        tokenHash,
      },
    });

    /*
     * Revoga todas as sessões antigas.
     */
    await prisma.gatewaySession.updateMany(
      {
        where: {
          botId: bot.id,
          revokedAt: null,
        },

        data: {
          revokedAt: new Date(),
        },
      },
    );

    return NextResponse.json({
      token,
    });
  } catch (error) {
    console.error(
      "[BOT_TOKEN]",
      error,
    );

    return NextResponse.json(
      {
        message:
          "Erro ao gerar token.",
      },
      { status: 500 },
    );
  }
}