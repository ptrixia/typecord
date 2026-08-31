import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { requirePermission } from "@/lib/permissions.server";
import { Permissions } from "@/lib/permissions";
import { apiError, apiOk, apiUnexpectedError } from "@/lib/api-response";

export async function GET(_request: NextRequest, context: { params: Promise<{ guildId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Não autorizado.", 401, "AUTH_REQUIRED");
    const { guildId } = await context.params;
    await requirePermission(guildId, Permissions.VIEW_GUILD_INSIGHTS);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [members, channels, messages, activeMembers] = await Promise.all([
      db.member.count({ where: { guildId } }),
      db.channel.count({ where: { guildId } }),
      db.message.count({ where: { channel: { guildId }, deleted: false, createdAt: { gte: since } } }),
      db.member.count({ where: { guildId, user: { status: { not: "OFFLINE" } } } }),
    ]);
    return apiOk({ metrics: { periodDays: 30, members, channels, messages, activeMembers } });
  } catch (error) {
    return apiUnexpectedError(error, "guild.metrics");
  }
}
