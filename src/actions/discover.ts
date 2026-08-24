"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { gatewayService } from "@/lib/gateway/GatewayService";

export async function getDiscoverableGuilds(
  query: string = ""
) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Não autorizado.");
  }

  const guilds = await db.guild.findMany({
    where: {
      name: {
        contains: query,
        mode: "insensitive",
      },

      members: {
        none: {
          userId: user.id,
        },
      },
    },

    select: {
      id: true,
      name: true,
      iconUrl: true,
      bannerUrl: true,

      _count: {
        select: {
          members: true,
        },
      },
    },

    take: 20,

    orderBy: {
      members: {
        _count: "desc",
      },
    },
  });

  return guilds;
}

export async function joinPublicGuild(
  guildId: string
) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Não autorizado.");
  }


  const result = await db.$transaction(
    async (tx) => {
      const existingMember =
        await tx.member.findUnique({
          where: {
            userId_guildId: {
              userId: user.id,
              guildId: guildId,
            },
          },
        });

      if (existingMember) {
        return {
          success: true,
          guildId,
          alreadyMember: true,
          memberId: existingMember.id,
        };
      }

      let everyoneRole =
        await tx.role.findFirst({
          where: {
            guildId: guildId,
            isDefault: true,
          },
        });

      /*
       * Caso não exista, cria.
       */
      if (!everyoneRole) {
        everyoneRole =
          await tx.role.create({
            data: {
              name: "@everyone",
              position: 0,
              isDefault: true,
              permissions: "0",
              guildId: guildId,
            },
          });
      }


      const newMember =
        await tx.member.create({
          data: {
            userId: user.id,

            guildId: guildId,

            roles: {
              connect: {
                id: everyoneRole.id,
              },
            },
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

      return {
        success: true,
        guildId,
        alreadyMember: false,
        memberId: newMember.id,
        member: newMember,
      };
    }
  );


  if (
    result.alreadyMember ||
    !result.member
  ) {
    return {
      success: true,
      guildId,
    };
  }

  const botMembers =
    await db.member.findMany({
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
    .map(
      (member) =>
        member.user.bot?.id
    )
    .filter(
      (
        id
      ): id is string =>
        Boolean(id)
    );

  console.log(
    `[GATEWAY] GUILD_MEMBER_ADD`
  );

  console.log(
    `[GATEWAY] Guild: ${guildId}`
  );

  console.log(
    `[GATEWAY] Membro: ${result.member.user.username}`
  );

  console.log(
    `[GATEWAY] Bots encontrados: ${botIds.length}`
  );


  if (botIds.length > 0) {
    await gatewayService.broadcast(
      botIds,

      "GUILD_MEMBER_ADD",

      {
        id:
          result.member.user.id,

        guildId:
          guildId,

        username:
          result.member.user.username,

        globalName:
          result.member.user.globalName,

        avatarUrl:
          result.member.user.avatarUrl,
      }
    );
  }


  return {
    success: true,
    guildId,
  };
}