"use server";

import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { getCurrentUser } from "@/lib/current-user";
import { revalidatePath } from "next/cache";
import { Permissions } from "@/lib/permissions";
import { dispatchGuildEvent } from "@/lib/gateway/guild-events";
import { requirePermission } from "@/lib/permissions.server";
import { emitToUser } from "@/lib/realtime/emitter";

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
              customStatus: true,
              richPresence: true,

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

      onboarding: true,
      scheduledEvents: {
        where: {
          status: { in: ["SCHEDULED", "ACTIVE"] },
        },
        orderBy: {
          scheduledStartAt: "asc",
        },
        take: 5,
      },
      stickers: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      soundboardSounds: {
        orderBy: { createdAt: "desc" },
        take: 30,
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
  await dispatchGuildEvent(guildId, "GUILD_UPDATE", { guild: g });
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
  await emitToUser(u.id, "GUILD_CREATE", { guild: g });
  return g;
}

export async function createGuildFromTemplate(code: string, fallbackName?: string): Promise<PartialGuild> {
  const u = await getCurrentUser();
  if (!u) throw new Error("Não autorizado");

  const template = await db.serverTemplate.findUnique({
    where: { code: code.trim() },
  });

  if (!template || (!template.public && template.creatorId !== u.id)) {
    throw new Error("Template não encontrado.");
  }

  const snapshot = template.snapshot as any;
  const name = (fallbackName?.trim() || snapshot?.name || template.name || "Novo servidor").slice(0, 100);

  const guild = await db.$transaction(async (tx) => {
    const createdGuild = await tx.guild.create({
      data: {
        name,
        ownerId: u.id,
      },
    });

    const roleIdMap = new Map<string, string>();
    const rawRoles = Array.isArray(snapshot?.roles) ? snapshot.roles : [];
    const defaultRoleSnapshot = rawRoles.find((role: any) => role.isDefault) ?? null;

    const everyone = await tx.role.create({
      data: {
        guildId: createdGuild.id,
        name: "@everyone",
        color: defaultRoleSnapshot?.color ?? "#99aab5",
        position: 0,
        permissions:
          defaultRoleSnapshot?.permissions ??
          (
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

    if (defaultRoleSnapshot?.id) roleIdMap.set(defaultRoleSnapshot.id, everyone.id);

    for (const role of rawRoles.filter((item: any) => !item.isDefault && !item.managed)) {
      const createdRole = await tx.role.create({
        data: {
          guildId: createdGuild.id,
          name: String(role.name ?? "Cargo").slice(0, 100),
          color: role.color ?? "#99aab5",
          hoist: Boolean(role.hoist),
          mentionable: Boolean(role.mentionable),
          position: Number(role.position ?? 1),
          permissions: String(role.permissions ?? "0"),
        },
      });
      if (role.id) roleIdMap.set(role.id, createdRole.id);
    }

    const categoryIdMap = new Map<string, string>();
    for (const category of Array.isArray(snapshot?.categories) ? snapshot.categories : []) {
      const createdCategory = await tx.category.create({
        data: {
          guildId: createdGuild.id,
          name: String(category.name ?? "Categoria").slice(0, 100),
          position: Number(category.position ?? 0),
        },
      });
      if (category.id) categoryIdMap.set(category.id, createdCategory.id);
    }

    for (const channel of Array.isArray(snapshot?.channels) ? snapshot.channels : []) {
      if (channel.parentId) continue;
      await tx.channel.create({
        data: {
          guildId: createdGuild.id,
          name: String(channel.name ?? "geral").slice(0, 100),
          type: channel.type ?? "GUILD_TEXT",
          topic: channel.topic ?? null,
          position: Number(channel.position ?? 0),
          nsfw: Boolean(channel.nsfw),
          userLimit: channel.userLimit ?? null,
          bitrate: channel.bitrate ?? null,
          categoryId: channel.categoryId ? categoryIdMap.get(channel.categoryId) ?? null : null,
        },
      });
    }

    const hasChannel = await tx.channel.findFirst({
      where: { guildId: createdGuild.id },
      select: { id: true },
    });
    if (!hasChannel) {
      await tx.channel.create({
        data: {
          guildId: createdGuild.id,
          name: "geral",
          type: "GUILD_TEXT",
          position: 0,
        },
      });
    }

    await tx.member.create({
      data: {
        userId: u.id,
        guildId: createdGuild.id,
        roles: { connect: { id: everyone.id } },
      },
    });

    await tx.serverTemplate.update({
      where: { id: template.id },
      data: { uses: { increment: 1 } },
    });

    return createdGuild;
  });

  await redis.del(`user:${u.id}:guilds`);
  revalidatePath("/");
  await emitToUser(u.id, "GUILD_CREATE", { guild });
  return guild;
}
