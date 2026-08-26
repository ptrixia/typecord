import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { Permissions } from "@/lib/permissions";
import { requirePermission } from "@/lib/permissions.server";
import { channelSchema } from "@/lib/validations";

export const runtime = "nodejs";

function normalizeChannelName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .slice(0, 100);
}

function handleRouteError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Não autorizado.") {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error.message === "Você não tem permissão para realizar esta ação.") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
  }

  console.error("[CHANNELS_POST]", error);
  return NextResponse.json(
    { error: "Erro interno do servidor." },
    { status: 500 },
  );
}

export async function POST(request: Request) {
  try {
    const guildId = new URL(request.url).searchParams.get("guildId")?.trim();

    if (!guildId) {
      return NextResponse.json(
        { error: "ID do servidor ausente." },
        { status: 400 },
      );
    }

    const actor = await requirePermission(
      guildId,
      Permissions.MANAGE_CHANNELS,
    );

    const rawBody = await request.json().catch(() => null);
    const parsedBody = channelSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: "Dados do canal inválidos.",
          fields: parsedBody.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { type } = parsedBody.data;
    const name = normalizeChannelName(parsedBody.data.name);

    if (!name) {
      return NextResponse.json(
        { error: "Nome de canal inválido." },
        { status: 400 },
      );
    }

    const channel = await db.$transaction(async (transaction) => {
      const maximumPosition = await transaction.channel.aggregate({
        where: { guildId },
        _max: { position: true },
      });

      const createdChannel = await transaction.channel.create({
        data: {
          guildId,
          name,
          type,
          position: (maximumPosition._max.position ?? -1) + 1,
        },
      });

      await transaction.auditLog.create({
        data: {
          guildId,
          actorId: actor.id,
          action: "CHANNEL_CREATE",
          targetId: createdChannel.id,
          metadata: { name, type },
        },
      });

      return createdChannel;
    });

    revalidatePath(`/channels/${guildId}`);

    return NextResponse.json({ channel }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
