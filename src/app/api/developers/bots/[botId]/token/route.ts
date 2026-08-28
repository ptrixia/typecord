import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { enforceRateLimit, isSameOriginRequest, sameOriginError } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function generateToken() {
  return `tc_bot_${crypto.randomBytes(48).toString("base64url")}`;
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

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

    const limited = await enforceRateLimit(request, "bot-token-rotate", 10, 3600, user.id);
    if (limited) return limited;

    const { botId } = await context.params;
    const bot = await db.bot.findFirst({
      where: { id: botId, ownerId: user.id },
      select: { id: true },
    });

    if (!bot) {
      return NextResponse.json({ message: "Bot não encontrado." }, { status: 404 });
    }

    const token = generateToken();
    const tokenHash = hashToken(token);

    await db.$transaction([
      db.bot.update({
        where: { id: bot.id },
        data: { tokenHash },
      }),
      db.gatewaySession.updateMany({
        where: { botId: bot.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return NextResponse.json(
      { token },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[BOT_TOKEN_ROTATE]", error);
    return NextResponse.json({ message: "Erro ao gerar token." }, { status: 500 });
  }
}
