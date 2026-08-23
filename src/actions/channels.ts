"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { revalidatePath } from "next/cache";

export async function createChannel(guildId: string, name: string, type: "GUILD_TEXT" | "GUILD_VOICE") {
  const user = await getCurrentUser();
  if (!user) throw new Error("Não autorizado");

  const channel = await db.channel.create({
    data: {
      name: name.toLowerCase().replace(/\s+/g, "-"),
      type,
      guildId,
      position: 99, 
    },
  });

  revalidatePath(`/channels/${guildId}`);

  return channel;
}