import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, apiUnexpectedError } from "@/lib/api-response";
import { getEffectiveChannelPermissions } from "@/lib/channel-permissions";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { Permissions, hasPermission } from "@/lib/permissions";
import { enforceRateLimit, isSameOriginRequest, sameOriginError } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  reason: z.enum(["SPAM", "HARASSMENT", "HATE_SPEECH", "THREATS", "SEXUAL_CONTENT", "ILLEGAL_CONTENT", "PERSONAL_DATA", "OTHER"]),
  details: z.string().trim().max(2000).optional().nullable(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ messageId: string }> }) {
  try {
    if (!isSameOriginRequest(request)) return sameOriginError();
    const user = await getCurrentUser();
    if (!user) return apiError("Não autorizado.", 401, "AUTH_REQUIRED");
    const limited = await enforceRateLimit(request, "message-report", 20, 60, user.id);
    if (limited) return limited;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError("Dados da denúncia inválidos.", 400, "INVALID_REPORT");
    const { messageId } = await context.params;
    const message = await db.message.findUnique({ where: { id: messageId }, select: { id: true, channelId: true, member: { select: { userId: true } }, channel: { select: { guildId: true } } } });
    if (!message) return apiError("Mensagem não encontrada.", 404, "MESSAGE_NOT_FOUND");
    const permissions = await getEffectiveChannelPermissions(message.channel.guildId, user.id, message.channelId);
    if (!hasPermission(permissions, Permissions.VIEW_CHANNEL)) return apiError("Sem acesso a este canal.", 403, "CHANNEL_ACCESS_DENIED");
    const report = await db.messageReport.create({ data: { messageId, reporterId: user.id, guildId: message.channel.guildId, reason: parsed.data.reason, details: parsed.data.details || null }, select: { id: true, status: true, createdAt: true } });
    await db.platformLog.create({ data: { level: "audit", event: "message.report.create", userId: user.id, metadata: { reportId: report.id, messageId, guildId: message.channel.guildId, reason: parsed.data.reason } } });
    return apiOk({ report }, 201);
  } catch (error) {
    if (error instanceof Error && (error.message.includes("Unique constraint") || error.message.includes("unique constraint"))) return apiError("Você já denunciou esta mensagem.", 409, "REPORT_ALREADY_EXISTS");
    return apiUnexpectedError(error, "messages.report.create");
  }
}
