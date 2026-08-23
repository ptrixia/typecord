import { db as prisma } from "@/lib/db";
import { gatewayService } from "./GatewayService";

export async function dispatchReady(
  botId: string,
  userId: string,
) {
  const memberships =
    await prisma.member.findMany({
      where: {
        userId,
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

  await gatewayService.dispatch(
    botId,
    "READY",
    {
      user: {
        id: userId,
        bot: true,
      },

      guilds:
        memberships.map(
          ({ guild }) => ({
            id: guild.id,
            name: guild.name,
            iconUrl:
              guild.iconUrl,
          }),
        ),
    },
  );
}