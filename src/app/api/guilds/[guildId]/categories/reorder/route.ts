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
  categoryIds: z.array(z.string().min(1)).min(1).max(500),
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { guildId } = await context.params;
    const actor = await requirePermission(guildId, Permissions.MANAGE_CHANNELS);
    const rawBody = await request.json().catch(() => null);
    const parsedBody = reorderSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Ordem de categorias inválida." },
        { status: 400 },
      );
    }

    const { categoryIds } = parsedBody.data;

    if (new Set(categoryIds).size !== categoryIds.length) {
      return NextResponse.json(
        { error: "A lista contém categorias duplicadas." },
        { status: 400 },
      );
    }

    const existingCategories = await db.category.findMany({
      where: { guildId },
      select: { id: true },
    });
    const existingIds = new Set(existingCategories.map(({ id }) => id));

    if (
      existingIds.size !== categoryIds.length ||
      categoryIds.some((id) => !existingIds.has(id))
    ) {
      return NextResponse.json(
        { error: "A lista de categorias está desatualizada." },
        { status: 409 },
      );
    }

    await db.$transaction(async (transaction) => {
      for (const [position, id] of categoryIds.entries()) {
        await transaction.category.update({
          where: { id },
          data: { position },
        });
      }

      await transaction.auditLog.create({
        data: {
          guildId,
          actorId: actor.id,
          action: "CATEGORY_REORDER",
          metadata: { categoryIds },
        },
      });
    });

    const categories = await db.category.findMany({
      where: { guildId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });

    revalidatePath(`/channels/${guildId}`);
    return NextResponse.json({ categories });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Não autorizado.") {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      if (error.message.includes("permissão")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }

    console.error("[CATEGORY_REORDER]", error);
    return NextResponse.json(
      { error: "Erro interno do servidor." },
      { status: 500 },
    );
  }
}
