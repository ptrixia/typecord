import { NextRequest } from "next/server";
import { apiError, apiOk, apiUnexpectedError } from "@/lib/api-response";
import { requirePlatformAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    await requirePlatformAdmin();
    const startedAt = Date.now();
    const checks = await Promise.allSettled([
      db.$queryRaw`SELECT 1`,
      redis.ping(),
    ]);
    const database = checks[0].status === "fulfilled" ? "ok" : "error";
    const redisStatus = checks[1].status === "fulfilled" ? "ok" : "error";
    return apiOk({
      status: database === "ok" && redisStatus === "ok" ? "ok" : "degraded",
      responseMs: Date.now() - startedAt,
      database,
      redis: redisStatus,
      websocketConnections: Number(await redis.get("typecord:metrics:websocket:active") ?? 0),
      uptime: process.uptime(),
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Acesso restrito")) return apiError(error.message, 403, "PLATFORM_ADMIN_REQUIRED");
    if (error instanceof Error && error.message === "Não autorizado.") return apiError(error.message, 401, "AUTH_REQUIRED");
    return apiUnexpectedError(error, "admin.health");
  }
}
