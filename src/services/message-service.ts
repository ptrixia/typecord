import { db } from "@/lib/db";
import { getEffectiveChannelPermissions } from "@/lib/channel-permissions";
import { hasPermission, Permissions } from "@/lib/permissions";

export type MessageCursor = { createdAt: string; id: string };

export function encodeMessageCursor(message: { createdAt: Date; id: string }) {
  return Buffer.from(
    JSON.stringify({ createdAt: message.createdAt.toISOString(), id: message.id }),
  ).toString("base64url");
}

export function decodeMessageCursor(raw?: string): MessageCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<MessageCursor>;
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") return null;
    const createdAt = new Date(parsed.createdAt);
    return Number.isNaN(createdAt.getTime()) ? null : { createdAt: createdAt.toISOString(), id: parsed.id };
  } catch {
    return null;
  }
}

export async function assertCanReadChannel(channelId: string, userId: string) {
  const channel = await db.channel.findUnique({ where: { id: channelId }, select: { guildId: true } });
  if (!channel) return null;
  const permissions = await getEffectiveChannelPermissions(channel.guildId, userId, channelId);
  if (!hasPermission(permissions, Permissions.VIEW_CHANNEL) || !hasPermission(permissions, Permissions.READ_MESSAGE_HISTORY)) {
    throw new Error("Sem acesso ao canal.");
  }
  return channel;
}
