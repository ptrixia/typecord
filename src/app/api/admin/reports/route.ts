import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, apiUnexpectedError } from "@/lib/api-response";
import { requirePlatformAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

const updateSchema = z.object({ id: z.string().min(1), status: z.enum(["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"]), resolution: z.string().trim().max(2000).optional().nullable() });

export async function GET(request: NextRequest) {
  try {
    const actor = await requirePlatformAdmin();
    const status = request.nextUrl.searchParams.get("status");
    const reports = await db.messageReport.findMany({ where: status && ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"].includes(status) ? { status: status as never } : undefined, orderBy: { createdAt: "desc" }, take: 200, include: { reporter: { select: { id: true, username: true, globalName: true } }, reviewer: { select: { id: true, username: true } }, message: { select: { id: true, content: true, deleted: true, channelId: true, createdAt: true, member: { select: { user: { select: { id: true, username: true, globalName: true } } } } } } } });
    return apiOk({ reports, actorId: actor.id });
  } catch (error) { return adminError(error, "admin.reports.list"); }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requirePlatformAdmin();
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError("Atualização de denúncia inválida.", 400, "INVALID_REPORT_UPDATE");
    const report = await db.messageReport.update({ where: { id: parsed.data.id }, data: { status: parsed.data.status, resolution: parsed.data.resolution || null, reviewerId: actor.id }, select: { id: true, status: true, resolution: true } });
    await db.platformLog.create({ data: { level: "audit", event: "message.report.update", userId: actor.id, metadata: { reportId: report.id, status: report.status } } });
    return apiOk({ report });
  } catch (error) { return adminError(error, "admin.reports.update"); }
}

function adminError(error: unknown, context: string) {
  if (error instanceof Error && error.message.includes("Acesso restrito")) return apiError(error.message, 403, "PLATFORM_ADMIN_REQUIRED");
  if (error instanceof Error && error.message === "Não autorizado.") return apiError(error.message, 401, "AUTH_REQUIRED");
  return apiUnexpectedError(error, context);
}
