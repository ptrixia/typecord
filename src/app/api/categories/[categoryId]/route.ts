import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permissions.server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ categoryId: string }>;
};

const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    position: z.number().int().nonnegative().optional(),
  })
  .refine((value) => value.name !== undefined || value.position !== undefined, {
    message: "Informe ao menos um campo para atualizar.",
  });

function handleError(error: unknown, operation: "PATCH" | "DELETE") {
  if (error instanceof Error) {
    if (error.message === "Não autorizado.") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error.message.includes("permissão")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
  }

  console.error(`[CATEGORY_${operation}]`, error);
  return NextResponse.json(
    { error: "Erro interno do servidor." },
    { status: 500 },
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { categoryId } = await context.params;
    const category = await db.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Categoria não encontrada." },
        { status: 404 },
      );
    }

    const actor = await requirePermission(
      category.guildId,
      Permissions.MANAGE_CHANNELS,
    );
    const rawBody = await request.json().catch(() => null);
    const parsedBody = updateCategorySchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    if (parsedBody.data.position !== undefined) {
      const categoryCount = await db.category.count({
        where: { guildId: category.guildId },
      });

      if (parsedBody.data.position >= categoryCount) {
        return NextResponse.json(
          { error: "Posição de categoria inválida." },
          { status: 400 },
        );
      }
    }

    const updateData: { name?: string; position?: number } = {};

    if (parsedBody.data.name !== undefined) {
      updateData.name = parsedBody.data.name.trim().replace(/\s+/g, " ");
    }

    if (parsedBody.data.position !== undefined) {
      updateData.position = parsedBody.data.position;
    }

    const updatedCategory = await db.$transaction(async (transaction) => {
      const updated = await transaction.category.update({
        where: { id: category.id },
        data: updateData,
      });

      await transaction.auditLog.create({
        data: {
          guildId: category.guildId,
          actorId: actor.id,
          action: "CATEGORY_UPDATE",
          targetId: category.id,
          metadata: {
            before: { name: category.name, position: category.position },
            after: { name: updated.name, position: updated.position },
          },
        },
      });

      return updated;
    });

    revalidatePath(`/channels/${category.guildId}`);
    return NextResponse.json({ category: updatedCategory });
  } catch (error) {
    return handleError(error, "PATCH");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { categoryId } = await context.params;
    const category = await db.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return NextResponse.json(
        { error: "Categoria não encontrada." },
        { status: 404 },
      );
    }

    const actor = await requirePermission(
      category.guildId,
      Permissions.MANAGE_CHANNELS,
    );

    await db.$transaction(async (transaction) => {
      await transaction.category.delete({ where: { id: category.id } });
      await transaction.category.updateMany({
        where: {
          guildId: category.guildId,
          position: { gt: category.position },
        },
        data: { position: { decrement: 1 } },
      });
      await transaction.auditLog.create({
        data: {
          guildId: category.guildId,
          actorId: actor.id,
          action: "CATEGORY_DELETE",
          targetId: category.id,
          metadata: { name: category.name, position: category.position },
        },
      });
    });

    revalidatePath(`/channels/${category.guildId}`);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleError(error, "DELETE");
  }
}
