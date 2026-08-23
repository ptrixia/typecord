"use server";

import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { getCurrentUser } from "@/lib/current-user";
import { revalidatePath } from "next/cache";

export type PartialGuild = {
  id: string;
  name: string;
  iconUrl: string | null;
};

export async function getUserGuilds(): Promise<PartialGuild[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const cacheKey = `user:${user.id}:guilds`;

  const cachedGuilds = await redis.get(cacheKey);
  if (cachedGuilds) {
    return JSON.parse(cachedGuilds);
  }

  const memberships = await db.member.findMany({
    where: { userId: user.id },
    include: {
      guild: {
        select: {
          id: true,
          name: true,
          iconUrl: true,
        },
      },
    },
  });

  const guilds = memberships.map((m) => m.guild);


  await redis.set(cacheKey, JSON.stringify(guilds), "EX", 3600);

  return guilds;
}



export async function getGuildById(guildId: string) {
  const user = await getCurrentUser();
  if (!user) return null;

  const isMember = await db.member.findUnique({
    where: {
      userId_guildId: {
        userId: user.id,
        guildId: guildId,
      },
    },
  });

  if (!isMember) return null; 

  const guild = await db.guild.findUnique({
    where: { id: guildId },
    include: {
      channels: {
        orderBy: { position: "asc" }, 
      },
      members: {
        include: {
          user: true,
          roles: true, 
        },
      },
    },
  });

  return guild;
}

export async function createGuild(name: string): Promise<PartialGuild> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Não autorizado");


  const guild = await db.guild.create({
    data: {
      name,
      ownerId: user.id,
      members: {
        create: [{ userId: user.id }],
      },
      channels: {
        create: [{ name: "geral", type: "GUILD_TEXT", position: 1 }],
      },
    },
    select: {
      id: true,
      name: true,
      iconUrl: true,
    },
  });


  await redis.del(`user:${user.id}:guilds`);
  

  revalidatePath("/");

  return guild;
}