import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { User } from "@prisma/client";

export async function getCurrentUser(): Promise<User | null> {
  try {

    const session = await getServerSession(authOptions);

    if (!session?.user || !(session.user as any).id) {
      return null;
    }

    const userId = (session.user as any).id;
    const redisKey = `user:${userId}`;

    const cachedUser = await redis.get(redisKey);
    
    if (cachedUser) {
      return JSON.parse(cachedUser) as User;
    }

    const user = await db.user.findUnique({
      where: { id: userId },
    });

    if (!user) return null;

    await redis.set(redisKey, JSON.stringify(user), "EX", 3600);

    return user;
  } catch (error) {
    console.error("[GET_CURRENT_USER_ERROR]", error);
    return null;
  }
}