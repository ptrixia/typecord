import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

const userSelect = {
  id: true,
  username: true,
  globalName: true,
  email: true,
  avatarUrl: true,
  bannerUrl: true,
  status: true,
} satisfies Prisma.UserSelect;

type CurrentUser = Prisma.UserGetPayload<{
  select: typeof userSelect;
}>;

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const session = await getServerSession(authOptions);

    const userId = (session?.user as { id?: string } | undefined)?.id;

    if (!userId) {
      return null;
    }

    const redisKey = `user:${userId}`;

    const cachedUser = await redis.get(redisKey);

    if (cachedUser) {
      return JSON.parse(cachedUser) as CurrentUser;
    }

    const user = await db.user.findUnique({
      where: {
        id: userId,
      },
      select: userSelect,
    });

    if (!user) {
      return null;
    }

    await redis.set(
      redisKey,
      JSON.stringify(user),
      "EX",
      3600,
    );

    return user;
  } catch (error) {
    console.error("[GET_CURRENT_USER_ERROR]", error);
    return null;
  }
}