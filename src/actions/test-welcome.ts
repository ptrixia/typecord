"use server";

import { getCurrentUser } from "@/lib/current-user";
import { gatewayService } from "@/lib/gateway/GatewayService";
import { db } from "@/lib/db";

export async function testGuildMemberAdd(guildId: string) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Não autorizado.");
  }

  const botMembers = await db.member.findMany({
    where: {
      guildId: guildId,
      user: {
        bot: {
          isNot: null,
        },
      },
    },
    select: {
      user: {
        select: {
          id: true,
          bot: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  const botIds = botMembers
    .map((member) => member.user.bot?.id)
    .filter((id): id is string => Boolean(id));

  console.log(`[TEST_BOT] Disparando evento de teste para a Guild: ${guildId}`);
  console.log(`[TEST_BOT] Bots notificados: ${botIds.length}`);

  if (botIds.length > 0) {

    await gatewayService.broadcast(
      botIds,
      "GUILD_MEMBER_ADD",
      {
        id: user.id,
        guildId: guildId,
        username: user.username,
        globalName: user.globalName,
        avatarUrl: user.avatarUrl,
      }
    );
  }

  return { success: true, notifiedBots: botIds.length };
}