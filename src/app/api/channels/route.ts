import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permissions.server";

export const runtime = "nodejs";

const updateChannelSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    position: z.number().int().nonnegative().optional(),
    categoryId: z.string().min(1).nullable().optional(),
    topic: z.string().trim().max(1024).nullable().optional(),
    nsfw: z.boolean().optional(),
    userLimit: z.number().int().min(0).max(99).nullable().optional(),
    bitrate: z.number().int().min(8000).max(384000).nullable().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Informe ao menos um campo para atualizar.",
  });

function normalizeChannelName(value: string, type: string) {
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, 100);

  if (type === "GUILD_VOICE" || type === "GUILD_VIDEO") {
    return normalized;
  }

  return normalized
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "");
}

function handleRouteError(error: unknown, operation: "PATCH" | "DELETE") {
  if (error instanceof Error) {
    if (error.message === "Não autorizado.") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error.message.includes("permissão")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
  }

  console.error(`[CHANNEL_${operation}]`, error);
  return NextResponse.json(
    { error: "Erro interno do servidor." },
    { status: 500 },
  );
}

export async function PATCH(request: Request) {
  try {
    const channelId = new URL(request.url).searchParams.get("channelId")?.trim() ?? "";
    if (!channelId) return NextResponse.json({ error: "channelId é obrigatório." }, { status: 400 });
    const channel = await db.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      return NextResponse.json(
        { error: "Canal não encontrado." },
        { status: 404 },
      );
    }

    const actor = await requirePermission(
      channel.guildId,
      Permissions.MANAGE_CHANNELS,
      channel.id,
    );
    const rawBody = await request.json().catch(() => null);
    const parsedBody = updateChannelSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error:
            parsedBody.error.issues[0]?.message ??
            "Dados de atualização inválidos.",
          fields: parsedBody.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    if (parsedBody.data.categoryId) {
      const category = await db.category.findFirst({
        where: {
          id: parsedBody.data.categoryId,
          guildId: channel.guildId,
        },
        select: { id: true },
      });

      if (!category) {
        return NextResponse.json(
          { error: "Categoria inválida." },
          { status: 400 },
        );
      }
    }

    if (parsedBody.data.position !== undefined) {
      const channelCount = await db.channel.count({
        where: {
          guildId: channel.guildId,
          categoryId:
            parsedBody.data.categoryId !== undefined
              ? parsedBody.data.categoryId
              : channel.categoryId,
        },
      });

      if (parsedBody.data.position > channelCount) {
        return NextResponse.json(
          { error: "Posição de canal inválida." },
          { status: 400 },
        );
      }
    }

    const updateData: {
      name?: string;
      position?: number;
      categoryId?: string | null;
      topic?: string | null;
      nsfw?: boolean;
      userLimit?: number | null;
      bitrate?: number | null;
    } = {};

    if (parsedBody.data.name !== undefined) {
      const name = normalizeChannelName(parsedBody.data.name, channel.type);

      if (!name) {
        return NextResponse.json(
          { error: "Nome de canal inválido." },
          { status: 400 },
        );
      }

      updateData.name = name;
    }

    if (parsedBody.data.position !== undefined) {
      updateData.position = parsedBody.data.position;
    }

    if (parsedBody.data.categoryId !== undefined) {
      updateData.categoryId = parsedBody.data.categoryId;
    }

    if (parsedBody.data.topic !== undefined) {
      updateData.topic = parsedBody.data.topic || null;
    }

    if (parsedBody.data.nsfw !== undefined) {
      updateData.nsfw = parsedBody.data.nsfw;
    }

    if (parsedBody.data.userLimit !== undefined) {
      updateData.userLimit = parsedBody.data.userLimit || null;
    }

    if (parsedBody.data.bitrate !== undefined) {
      updateData.bitrate = parsedBody.data.bitrate;
    }

    const updatedChannel = await db.$transaction(async (transaction) => {
      const updated = await transaction.channel.update({
        where: { id: channel.id },
        data: updateData,
      });

      await transaction.auditLog.create({
        data: {
          guildId: channel.guildId,
          actorId: actor.id,
          action:
            updateData.position !== undefined &&
            Object.keys(updateData).length === 1
              ? "CHANNEL_REORDER"
              : "CHANNEL_UPDATE",
          targetId: channel.id,
          metadata: {
            before: {
              name: channel.name,
              position: channel.position,
              categoryId: channel.categoryId,
              topic: channel.topic,
              nsfw: channel.nsfw,
              userLimit: channel.userLimit,
              bitrate: channel.bitrate,
            },
            after: {
              name: updated.name,
              position: updated.position,
              categoryId: updated.categoryId,
              topic: updated.topic,
              nsfw: updated.nsfw,
              userLimit: updated.userLimit,
              bitrate: updated.bitrate,
            },
          },
        },
      });

      return updated;
    });

    revalidatePath(`/channels/${channel.guildId}`);
    return NextResponse.json({ channel: updatedChannel });
  } catch (error) {
    return handleRouteError(error, "PATCH");
  }
}

export async function DELETE(request: Request) {
  try {
    const channelId = new URL(request.url).searchParams.get("channelId")?.trim() ?? "";
    if (!channelId) return NextResponse.json({ error: "channelId é obrigatório." }, { status: 400 });
    const channel = await db.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      return NextResponse.json(
        { error: "Canal não encontrado." },
        { status: 404 },
      );
    }

    const actor = await requirePermission(
      channel.guildId,
      Permissions.MANAGE_CHANNELS,
      channel.id,
    );

    await db.$transaction(async (transaction) => {
      await transaction.channel.delete({ where: { id: channel.id } });
      await transaction.channel.updateMany({
        where: {
          guildId: channel.guildId,
          categoryId: channel.categoryId,
          position: { gt: channel.position },
        },
        data: { position: { decrement: 1 } },
      });
      await transaction.auditLog.create({
        data: {
          guildId: channel.guildId,
          actorId: actor.id,
          action: "CHANNEL_DELETE",
          targetId: channel.id,
          metadata: {
            name: channel.name,
            type: channel.type,
            position: channel.position,
            categoryId: channel.categoryId,
          },
        },
      });
    });

    revalidatePath(`/channels/${channel.guildId}`);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error, "DELETE");
  }
}
