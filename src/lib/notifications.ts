import { db } from "@/lib/db";
import { emitToUser } from "@/lib/realtime/emitter";

export async function createMessageNotifications(input: {
  messageId: string;
  guildId: string;
  channelId: string;
  authorId: string;
  content: string;
  replyToUserId?: string | null;
}) {
  const mentionedIds = [...input.content.matchAll(/<@!?([A-Za-z0-9_-]+)>/g)].map((match) => match[1]);
  const everyone = /@(everyone|here)\b/i.test(input.content);
  const memberRows = mentionedIds.length
    ? await db.member.findMany({ where: { guildId: input.guildId, userId: { in: mentionedIds.filter((id) => id !== input.authorId) } }, select: { userId: true } })
    : [];
  const targets = new Map<string, { type: "MENTION" | "EVERYONE_MENTION" | "REPLY"; title: string }>();
  for (const member of memberRows) targets.set(member.userId, { type: "MENTION", title: "Você foi mencionado" });
  if (input.replyToUserId && input.replyToUserId !== input.authorId) targets.set(input.replyToUserId, { type: "REPLY", title: "Você recebeu uma resposta" });
  if (everyone) {
    const all = await db.member.findMany({ where: { guildId: input.guildId, userId: { not: input.authorId } }, select: { userId: true } });
    for (const member of all) targets.set(member.userId, { type: "EVERYONE_MENTION", title: "Você foi mencionado" });
  }
  if (!targets.size) return;
  await Promise.all([...targets].map(async ([userId, value]) => {
    const notification = await db.notification.create({ data: { userId, guildId: input.guildId, channelId: input.channelId, messageId: input.messageId, type: value.type, title: value.title, content: input.content.slice(0, 500), href: `/channels/${input.guildId}/${input.channelId}` } });
    await emitToUser(userId, "NOTIFICATION_CREATE", { notification });
  }));
}
