import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { apiError, apiOk, apiUnexpectedError } from "@/lib/api-response";
import { markChannelRead } from "@/services/read-state-service";
import { idSchema } from "@/lib/schemas";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Não autorizado.", 401, "AUTH_REQUIRED");
    const channelId = idSchema.safeParse(request.nextUrl.searchParams.get("channelId")).data;
    if (!channelId) return apiError("channelId é obrigatório.");
    const state = await db.channelReadState.findUnique({ where: { userId_channelId: { userId: user.id, channelId } } });
    return apiOk({ state });
  } catch (error) {
    return apiUnexpectedError(error, "read-state.get");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Não autorizado.", 401, "AUTH_REQUIRED");
    const body = await request.json().catch(() => null) as { channelId?: unknown; messageId?: unknown } | null;
    const channelId = idSchema.safeParse(body?.channelId).data;
    const messageId = body?.messageId === undefined ? undefined : idSchema.safeParse(body.messageId).data;
    if (!channelId || (body?.messageId !== undefined && !messageId)) return apiError("Dados de leitura inválidos.");
    if (messageId) {
      const message = await db.message.findFirst({ where: { id: messageId, channelId }, select: { id: true } });
      if (!message) return apiError("Mensagem inválida.", 404, "NOT_FOUND");
    }
    const state = await markChannelRead(user.id, channelId, messageId);
    return apiOk({ state });
  } catch (error) {
    return apiUnexpectedError(error, "read-state.post");
  }
}
