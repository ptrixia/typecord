import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permissions.server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ guildId: string }>;
};

const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
});

function normalizeCategoryName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 100);
}

function handleError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Não autorizado.") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error.message.includes("permissão")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
  }

  console.error("[GUILD_CATEGORIES]", error);
  return NextResponse.json(
    { error: "Erro interno do servidor." },
    { status: 500 },
  );
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { guildId } = await context.params;
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const guild = await db.guild.findFirst({
      where: {
        id: guildId,
        OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
      },
      select: { id: true },
    });

    if (!guild) {
      return NextResponse.json(
        { error: "Servidor não encontrado." },
        { status: 404 },
      );
    }

    const categories = await db.category.findMany({
      where: { guildId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ categories });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { guildId } = await context.params;
    const actor = await requirePermission(guildId, Permissions.MANAGE_CHANNELS);
    const rawBody = await request.json().catch(() => null);
    const parsedBody = createCategorySchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Nome de categoria inválido." },
        { status: 400 },
      );
    }

    const name = normalizeCategoryName(parsedBody.data.name);
    const category = await db.$transaction(async (transaction) => {
      const maximumPosition = await transaction.category.aggregate({
        where: { guildId },
        _max: { position: true },
      });
      const created = await transaction.category.create({
        data: {
          guildId,
          name,
          position: (maximumPosition._max.position ?? -1) + 1,
        },
      });

      await transaction.auditLog.create({
        data: {
          guildId,
          actorId: actor.id,
          action: "CATEGORY_CREATE",
          targetId: created.id,
          metadata: { name },
        },
      });

      return created;
    });

    revalidatePath(`/channels/${guildId}`);
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
