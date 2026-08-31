import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { canUserAccessChannel } from "@/lib/channel-permissions";
import { apiError, apiOk, apiUnexpectedError } from "@/lib/api-response";
import { decodeMessageCursor, encodeMessageCursor } from "@/services/message-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Não autorizado.", 401, "AUTH_REQUIRED");
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 25), 1), 50);
    const cursor = decodeMessageCursor(request.nextUrl.searchParams.get("cursor") ?? undefined);
    if (query.length < 2) return apiError("A busca precisa de pelo menos 2 caracteres.");
    if (request.nextUrl.searchParams.has("cursor") && !cursor) return apiError("Cursor inválido.", 400, "INVALID_CURSOR");
    const terms = [...new Set(query.split(/\s+/).map((term) => term.trim()).filter(Boolean))].slice(0, 8);

    const candidates = await db.message.findMany({
      where: {
        deleted: false,
        AND: terms.map((term) => ({ content: { contains: term, mode: "insensitive" as const } })),
        channel: { guild: { members: { some: { userId: user.id } } } },
        ...(cursor ? { OR: [{ createdAt: { lt: new Date(cursor.createdAt) } }, { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } }] } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit * 4 + 1, 200),
      select: {
        id: true,
        content: true,
        createdAt: true,
        channelId: true,
        channel: { select: { guildId: true, name: true } },
        member: { select: { user: { select: { username: true, globalName: true } } } },
      },
    });

    const visible: Array<{
      id: string;
      content: string;
      createdAt: string;
      channelId: string;
      channel: { guildId: string; name: string };
      author: string;
    }> = [];
    for (const message of candidates) {
      if (await canUserAccessChannel(user.id, message.channelId)) {
        visible.push({
          ...message,
          createdAt: message.createdAt.toISOString(),
          author: message.member.user.globalName ?? message.member.user.username,
        });
      }
      if (visible.length >= limit) break;
    }
    const hasMore = visible.length === limit && candidates.length > limit;
    return apiOk({ results: visible, nextCursor: hasMore && visible.length ? encodeMessageCursor({ createdAt: new Date(visible[visible.length - 1].createdAt), id: visible[visible.length - 1].id }) : null });
  } catch (error) {
    return apiUnexpectedError(error, "messages.search");
  }
}
