"use server";

import { db } from "@/lib/db";
import { redis } from "@/lib/redis";
import { getCurrentUser } from "@/lib/current-user";
import { revalidatePath } from "next/cache";

interface UpdateProfileParams {
  globalName?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  bio?: string;
}

export async function updateUserProfile(values: UpdateProfileParams) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      throw new Error("Não autorizado.");
    }

    const updatedUser = await db.user.update({
      where: {
        id: user.id,
      },
      data: {
        globalName: values.globalName || null,
        avatarUrl: values.avatarUrl || null,
        bannerUrl: values.bannerUrl || null,
        bio: values.bio || null,
      },
    });


    await redis.del(`user:${user.id}:guilds`);

    revalidatePath("/", "layout");

    return { success: true, user: updatedUser };
  } catch (error) {
    console.error("[USER_PROFILE_UPDATE]", error);
    throw new Error("Não foi possível atualizar o perfil.");
  }
}