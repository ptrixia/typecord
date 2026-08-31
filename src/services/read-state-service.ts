import { db } from "@/lib/db";

export async function markChannelRead(userId: string, channelId: string, messageId?: string) {
  return db.channelReadState.upsert({
    where: { userId_channelId: { userId, channelId } },
    create: { userId, channelId, lastReadMessageId: messageId ?? null, unreadCount: 0 },
    update: { lastReadMessageId: messageId ?? undefined, unreadCount: 0 },
  });
}

export async function incrementChannelUnread(channelId: string, excludedUserId?: string) {
  const states = await db.channelReadState.findMany({ where: { channelId, ...(excludedUserId ? { userId: { not: excludedUserId } } : {}) }, select: { id: true } });
  if (!states.length) return;
  await db.channelReadState.updateMany({ where: { id: { in: states.map((state) => state.id) } }, data: { unreadCount: { increment: 1 } } });
}
