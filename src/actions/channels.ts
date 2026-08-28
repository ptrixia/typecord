"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { dispatchGuildEvent } from "@/lib/gateway/guild-events";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permissions.server";

type CreatableChannelType = "GUILD_TEXT" | "GUILD_VOICE" | "GUILD_VIDEO" | "GUILD_ANNOUNCEMENT";

function normalizeChannelName(name: string, type: CreatableChannelType) {
  const normalized = name.trim().replace(/\s+/g, " ").slice(0, 100);

  if (type === "GUILD_VOICE" || type === "GUILD_VIDEO") {
    return normalized;
  }

  return normalized
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "");
}

export async function createChannel(
  guildId: string,
  name: string,
  type: CreatableChannelType,
  categoryId?: string | null,
) {
  const actor = await requirePermission(guildId, Permissions.MANAGE_CHANNELS);
  const normalizedName = normalizeChannelName(name, type);

  if (!normalizedName) {
    throw new Error("Nome de canal inválido.");
  }

  if (categoryId) {
    const category = await db.category.findFirst({
      where: { id: categoryId, guildId },
      select: { id: true },
    });

    if (!category) {
      throw new Error("Categoria inválida.");
    }
  }

  const channel = await db.$transaction(async (transaction) => {
    const maximumPosition = await transaction.channel.aggregate({
      where: {
        guildId,
        categoryId: categoryId ?? null,
      },
      _max: { position: true },
    });

    const created = await transaction.channel.create({
      data: {
        guildId,
        name: normalizedName,
        type,
        categoryId: categoryId ?? null,
        position: (maximumPosition._max.position ?? -1) + 1,
      },
    });

    await transaction.auditLog.create({
      data: {
        guildId,
        actorId: actor.id,
        action: "CHANNEL_CREATE",
        targetId: created.id,
        metadata: {
          name: normalizedName,
          type,
          categoryId: categoryId ?? null,
        },
      },
    });

    return created;
  });

  revalidatePath(`/channels/${guildId}`);
  await dispatchGuildEvent(guildId, "CHANNEL_CREATE", {
    channel,
  });

  return channel;
}
