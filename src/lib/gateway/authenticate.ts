import { db as prisma  } from "@/lib/db";
import { hashToken } from "@/lib/bots/token";

export async function authenticateBot(
  token: string,
) {
  const tokenHash = hashToken(token);

  const bot = await prisma.bot.findUnique({
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
          bannerUrl: true,
          status: true,
        },
      },
    },
  });

  if (!bot) {
    return null;
  }

  if (bot.disabled) {
    return null;
  }

  return bot;
}