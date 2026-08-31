import { NextRequest } from "next/server";
import { apiError, apiOk, apiUnexpectedError } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { enforceRateLimit, isSameOriginRequest, sameOriginError } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Não autorizado.", 401, "AUTH_REQUIRED");
    const limited = await enforceRateLimit(request, "notifications-read", 120, 60, user.id);
    if (limited) return limited;
    return apiOk({ notifications: await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 }) });
  } catch (error) { return apiUnexpectedError(error, "notifications.list"); }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Não autorizado.", 401, "AUTH_REQUIRED");
    if (!isSameOriginRequest(request)) return sameOriginError();
    const limited = await enforceRateLimit(request, "notifications-write", 60, 60, user.id);
    if (limited) return limited;
    const body = await request.json().catch(() => ({}));
    if (body.all === true) await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
    else if (typeof body.id === "string") await db.notification.updateMany({ where: { id: body.id, userId: user.id }, data: { read: true } });
    else return apiError("Informe id ou all.");
    return apiOk({ updated: true });
  } catch (error) { return apiUnexpectedError(error, "notifications.read"); }
}
