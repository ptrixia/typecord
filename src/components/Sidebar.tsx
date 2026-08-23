import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { getCurrentUser } from "@/lib/current-user";
import Sidebar from "./SidebarClient"; 

export default async function SidebarServer() {
  const user = await getCurrentUser();

  if (!user) return null;

  const cacheKey = `user:${user.id}:guilds`;
  let guilds = [];

  const cachedGuilds = await redis.get(cacheKey);

  if (cachedGuilds) {
    guilds = JSON.parse(cachedGuilds);
  } else {
    const dbGuilds = await db.guild.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          {
            members: {
              some: {
                userId: user.id,
              },
            },
          },
        ],
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
    });

    guilds = dbGuilds.map((guild) => ({
      id: guild.id,
      name: guild.name,
      iconUrl: guild.iconUrl,
      bannerUrl: guild.bannerUrl,
      memberCount: guild._count.members,
    }));

    await redis.set(cacheKey, JSON.stringify(guilds), "EX", 3600);
  }

  return <Sidebar initialGuilds={guilds} />;
}