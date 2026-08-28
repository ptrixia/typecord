"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { gatewayService } from "@/lib/gateway/GatewayService";
import { attachUserToGuildRealtime } from "@/lib/realtime/emitter";

export async function getDiscoverableGuilds(query = "") {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Não autorizado.");
  }

  const normalizedQuery = query.trim().slice(0, 80);

  return db.guild.findMany({
    where: {
      discoverable: true,
      ...(normalizedQuery
        ? {
            name: {
              contains: normalizedQuery,
              mode: "insensitive",
            },
          }
        : {}),
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
      verified: true,
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
}

export async function joinPublicGuild(guildId: string) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("Não autorizado.");
  }

  const normalizedGuildId = guildId.trim();
  if (!normalizedGuildId || normalizedGuildId.length > 128) {
    throw new Error("Servidor inválido.");
  }

  const guild = await db.guild.findUnique({
    where: { id: normalizedGuildId },
    select: {
      id: true,
      discoverable: true,
    },
  });

  if (!guild || !guild.discoverable) {
    throw new Error("Este servidor não está disponível na descoberta pública.");
  }

  const result = await db.$transaction(async (tx) => {
    const existingMember = await tx.member.findUnique({
      where: {
        userId_guildId: {
          userId: user.id,
          guildId: guild.id,
        },
      },
      select: { id: true },
    });

    if (existingMember) {
      return {
        alreadyMember: true as const,
        member: null,
      };
    }

    let everyoneRole = await tx.role.findFirst({
      where: {
        guildId: guild.id,
        isDefault: true,
      },
      select: { id: true },
    });

    if (!everyoneRole) {
      everyoneRole = await tx.role.create({
        data: {
          name: "@everyone",
          position: 0,
          isDefault: true,
          permissions: "0",
          guildId: guild.id,
        },
        select: { id: true },
      });
    }

    const member = await tx.member.create({
      data: {
        userId: user.id,
        guildId: guild.id,
        roles: {
          connect: { id: everyoneRole.id },
        },
      },
      select: {
        id: true,
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
      alreadyMember: false as const,
      member,
    };
  });

  await attachUserToGuildRealtime(user.id, guild.id).catch((error) => {
    console.error("[DISCOVER_REALTIME_JOIN]", error);
  });

  if (!result.alreadyMember && result.member) {
    const botMembers = await db.member.findMany({
      where: {
        guildId: guild.id,
        user: {
          bot: {
            disabled: false,
          },
        },
      },
      select: {
        user: {
          select: {
            bot: {
              select: { id: true },
            },
          },
        },
      },
    });

    const botIds = botMembers
      .map((member) => member.user.bot?.id)
      .filter((id): id is string => Boolean(id));

    if (botIds.length) {
      await gatewayService.broadcast(botIds, "GUILD_MEMBER_ADD", {
        id: result.member.user.id,
        guildId: guild.id,
        username: result.member.user.username,
        globalName: result.member.user.globalName,
        avatarUrl: result.member.user.avatarUrl,
      });
    }
  }

  return {
    success: true,
    guildId: guild.id,
  };
}
