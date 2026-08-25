"use server";

import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { getCurrentUser } from "@/lib/current-user";
import { revalidatePath } from "next/cache";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permissions.server";

export type PartialGuild = {
  id: string;
  name: string;
  iconUrl: string | null;
};

export async function getUserGuilds(): Promise<PartialGuild[]> {
  const u = await getCurrentUser();
  if (!u) return [];

  const key = `user:${u.id}:guilds`;
  const c = await redis.get(key);
  if (c) return JSON.parse(c);

  const rows = await db.member.findMany({
    where: { userId: u.id },
    select: {
      guild: {
        select: { id: true, name: true, iconUrl: true },
      },
    },
  });

  const g = rows.map((x) => x.guild);
  await redis.set(key, JSON.stringify(g), "EX", 3600);
  return g;
}

export async function getGuildById(guildId: string) {
  const u = await getCurrentUser();

  if (!u) {
    return null;
  }

  const member = await db.member.findUnique({
    where: {
      userId_guildId: {
        userId: u.id,
        guildId,
      },
    },
  });

  if (!member) {
    return null;
  }

  return db.guild.findUnique({
    where: {
      id: guildId,
    },
    include: {
      channels: {
        orderBy: {
          position: "asc",
        },
      },

      categories: {
        orderBy: {
          position: "asc",
        },
        include: {
          channels: {
            orderBy: {
              position: "asc",
            },
          },
        },
      },

      roles: {
        orderBy: {
          position: "desc",
        },
      },

      members: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              globalName: true,
              avatarUrl: true,
              status: true,
              bannerUrl: true,
              createdAt: true,
              bio: true,

              bot: {
                select: {
                  verified: true,
                },
              },
            },
          },

          roles: {
            orderBy: {
              position: "desc",
            },
          },
        },
      },
    },
  });
}

export async function updateGuildSettings(
  guildId: string,
  values: { name?: string; iconUrl?: string; bannerUrl?: string | null }
) {
  const u = await requirePermission(guildId, Permissions.MANAGE_GUILD);
  const data: any = {};

  if (values.name !== undefined) {
    const n = values.name.trim();
    if (!n || n.length > 100) throw new Error("Nome inválido.");
    data.name = n;
  }

  if (values.iconUrl !== undefined) {
    data.iconUrl = values.iconUrl || null;
  }

  if (values.bannerUrl !== undefined) {
    data.bannerUrl = values.bannerUrl || null;
  }

  const g = await db.guild.update({
    where: { id: guildId },
    data,
  });

  await db.auditLog.create({
    data: {
      guildId,
      actorId: u.id,
      action: "GUILD_UPDATE",
      metadata: { changes: data },
    },
  });

  await redis.del(`user:${u.id}:guilds`);
  revalidatePath(`/channels/${guildId}`);
  return g;
}

export async function createGuild(name: string): Promise<PartialGuild> {
  const u = await getCurrentUser();
  if (!u) throw new Error("Não autorizado");

  const n = name.trim();
  if (!n || n.length > 100) throw new Error("Nome inválido.");

  const g = await db.$transaction(async (tx) => {
    const guild = await tx.guild.create({
      data: { name: n, ownerId: u.id },
    });

    const everyone = await tx.role.create({
      data: {
        guildId: guild.id,
        name: "@everyone",
        color: "#99aab5",
        position: 0,
        permissions: (
          Permissions.VIEW_CHANNEL |
          Permissions.SEND_MESSAGES |
          Permissions.READ_MESSAGE_HISTORY |
          Permissions.ADD_REACTIONS |
          Permissions.CONNECT |
          Permissions.SPEAK
        ).toString(),
        isDefault: true,
      },
    });

    await tx.member.create({
      data: {
        userId: u.id,
        guildId: guild.id,
        roles: { connect: { id: everyone.id } },
      },
    });

    await tx.channel.create({
      data: {
        guildId: guild.id,
        name: "geral",
        type: "GUILD_TEXT",
        position: 0,
      },
    });

    return guild;
  });

  await redis.del(`user:${u.id}:guilds`);
  revalidatePath("/");
  return g;
}