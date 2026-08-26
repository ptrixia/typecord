import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permissions.server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ guildId: string }>;
};

const reorderSchema = z.object({
  channels: z
    .array(
      z.object({
        id: z.string().min(1),
        position: z.number().int().nonnegative(),
        categoryId: z.string().min(1).nullable(),
      }),
    )
    .min(1)
    .max(1000),
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { guildId } = await context.params;
    const actor = await requirePermission(guildId, Permissions.MANAGE_CHANNELS);
    const rawBody = await request.json().catch(() => null);
    const parsedBody = reorderSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Ordem de canais inválida." },
        { status: 400 },
      );
    }

    const updates = parsedBody.data.channels;
    const channelIds = updates.map(({ id }) => id);

    if (new Set(channelIds).size !== channelIds.length) {
      return NextResponse.json(
        { error: "A lista contém canais duplicados." },
        { status: 400 },
      );
    }

    const existingChannels = await db.channel.findMany({
      where: { id: { in: channelIds }, guildId },
      select: { id: true },
    });

    if (existingChannels.length !== channelIds.length) {
      return NextResponse.json(
        { error: "Um ou mais canais são inválidos." },
        { status: 400 },
      );
    }

    const categoryIds = [
      ...new Set(
        updates
          .map(({ categoryId }) => categoryId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    if (categoryIds.length > 0) {
      const validCategoryCount = await db.category.count({
        where: { id: { in: categoryIds }, guildId },
      });

      if (validCategoryCount !== categoryIds.length) {
        return NextResponse.json(
          { error: "Uma ou mais categorias são inválidas." },
          { status: 400 },
        );
      }
    }

    await db.$transaction(async (transaction) => {
      for (const update of updates) {
        await transaction.channel.update({
          where: { id: update.id },
          data: {
            position: update.position,
            categoryId: update.categoryId,
          },
        });
      }

      await transaction.auditLog.create({
        data: {
          guildId,
          actorId: actor.id,
          action: "CHANNEL_REORDER",
          metadata: { channels: updates },
        },
      });
    });

    const channels = await db.channel.findMany({
      where: { id: { in: channelIds }, guildId },
      orderBy: [{ categoryId: "asc" }, { position: "asc" }],
    });

    revalidatePath(`/channels/${guildId}`);
    return NextResponse.json({ channels });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Não autorizado.") {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      if (error.message.includes("permissão")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }

    console.error("[CHANNEL_REORDER]", error);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}
