import crypto from "node:crypto";
import { db as prisma } from "@/lib/db";
import { hashToken } from "@/lib/bots/token";

const SESSION_TTL = 1000 * 60 * 60;

export async function createGatewaySession(
  botId: string,
) {
  const rawToken =
    `tc_gateway_${crypto.randomBytes(48).toString("base64url")}`;

  const sessionTokenHash =
    hashToken(rawToken);

  const expiresAt = new Date(
    Date.now() + SESSION_TTL,
  );

  const session =
    await prisma.gatewaySession.create({
      data: {
        botId,
        sessionTokenHash,
        expiresAt,
      },
    });

  return {
    id: session.id,
    token: rawToken,
    expiresAt,
  };
}

export async function authenticateGatewaySession(
  token: string,
) {
  const session =
    await prisma.gatewaySession.findUnique({
      where: {
        sessionTokenHash: hashToken(token),
      },

      include: {
        bot: {
          include: {
            user: true,
          },
        },
      },
    });

  if (!session) {
    return null;
  }

  if (session.revokedAt) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    return null;
  }

  if (session.bot.disabled) {
    return null;
  }

  return session;
}