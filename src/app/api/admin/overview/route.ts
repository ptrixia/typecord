import { NextRequest } from "next/server";
import { apiError, apiOk, apiUnexpectedError } from "@/lib/api-response";
import { requirePlatformAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  try {
    await requirePlatformAdmin();
    const hours = Math.min(168, Math.max(1, Number(request.nextUrl.searchParams.get("hours") ?? 24)));
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const [users, guilds, channels, messages, websocketConnections, errors, logs, auditLogs, routes] = await Promise.all([
      db.user.count(),
      db.guild.count(),
      db.channel.count(),
      db.message.count({ where: { createdAt: { gte: since } } }),
      redis.get("typecord:metrics:websocket:active"),
      db.platformLog.count({ where: { level: "error", createdAt: { gte: since } } }),
      db.platformLog.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 200 }),
      db.auditLog.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "desc" }, take: 200 }),
      db.platformLog.groupBy({ by: ["route"], where: { route: { not: null }, createdAt: { gte: since } }, _count: { _all: true }, _avg: { durationMs: true } }),
    ]);
    return apiOk({
      metrics: {
        users, guilds, channels, messages, hours,
        messagesPerSecond: messages / Math.max(1, hours * 3600),
        websocketConnections: Number(websocketConnections ?? 0),
        errors,
        uptime: process.uptime(),
        responseMs: Date.now() - startedAt,
        routes: routes.map((route) => ({ route: route.route, requests: route._count._all, averageMs: route._avg.durationMs ?? 0 })),
      },
      logs: [
        ...logs,
        ...auditLogs.map((entry) => ({ id: `audit:${entry.id}`, level: "audit", event: entry.action, message: null, route: null, status: null, durationMs: null, createdAt: entry.createdAt })),
      ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()).slice(0, 300),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Acesso restrito")) return apiError(error.message, 403, "PLATFORM_ADMIN_REQUIRED");
    if (error instanceof Error && error.message === "Não autorizado.") return apiError(error.message, 401, "AUTH_REQUIRED");
    return apiUnexpectedError(error, "admin.overview");
  }
}
