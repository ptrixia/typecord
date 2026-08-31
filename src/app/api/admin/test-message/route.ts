import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, apiUnexpectedError } from "@/lib/api-response";
import { requirePlatformAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { emitToChannel } from "@/lib/realtime/emitter";

const schema = z.object({ channelId: z.string().min(1), content: z.string().trim().min(1).max(8000) });

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePlatformAdmin();
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError("Canal e conteúdo são obrigatórios.", 400, "INVALID_TEST_MESSAGE");
    const channel = await db.channel.findUnique({ where: { id: parsed.data.channelId }, select: { id: true, guildId: true } });
    if (!channel) return apiError("Canal não encontrado.", 404, "CHANNEL_NOT_FOUND");
    const member = await db.member.findUnique({ where: { userId_guildId: { userId: actor.id, guildId: channel.guildId } }, select: { id: true } });
    if (!member) return apiError("O administrador não é membro desta guild.", 400, "ADMIN_NOT_MEMBER");
    const message = await db.message.create({ data: { content: parsed.data.content, channelId: channel.id, memberId: member.id }, select: { id: true, content: true, channelId: true, createdAt: true } });
    await emitToChannel(channel.id, "MESSAGE_CREATE", { guildId: channel.guildId, channelId: channel.id, message });
    await db.platformLog.create({ data: { level: "audit", event: "admin.test_message", userId: actor.id, metadata: { channelId: channel.id, messageId: message.id } } });
    return apiOk({ message }, 201);
  } catch (error) { return apiUnexpectedError(error, "admin.test_message"); }
}
