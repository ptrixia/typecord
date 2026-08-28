import { db } from "@/lib/db";
import { Permissions, hasAllPermissions } from "@/lib/permissions";
import { getEffectivePermissions } from "@/lib/permissions.server";

function payloadContainsKey(content: string, key: string) {
  try {
    const payload = JSON.parse(content) as {
      attachments?: Array<{ key?: unknown; url?: unknown }>;
    };

    return (
      Array.isArray(payload.attachments) &&
      payload.attachments.some(
        (attachment) =>
          attachment?.key === key || attachment?.url === key,
      )
    );
  } catch {
    return false;
  }
}

export async function canUserReadStoredFile(userId: string, key: string) {
  const [publicReference, directAttachment, channelAttachments] =
    await Promise.all([
      Promise.all([
        db.user.count({
          where: { OR: [{ avatarUrl: key }, { bannerUrl: key }] },
        }),
        db.guild.count({
          where: { OR: [{ iconUrl: key }, { bannerUrl: key }] },
        }),
        db.emoji.count({ where: { url: key } }),
        db.directConversation.count({
          where: {
            iconUrl: key,
            participants: { some: { userId } },
          },
        }),
      ]).then((counts) => counts.some((count) => count > 0)),
      db.directMessageAttachment.findFirst({
        where: {
          url: key,
          message: {
            deleted: false,
            conversation: { participants: { some: { userId } } },
          },
        },
        select: { id: true },
      }),
      db.attachment.findMany({
        where: { url: key, message: { deleted: false } },
        select: {
          message: {
            select: {
              channelId: true,
              channel: { select: { guildId: true } },
            },
          },
        },
        take: 20,
      }),
    ]);

  if (publicReference || directAttachment) {
    return true;
  }

  for (const attachment of channelAttachments) {
    const permissions = await getEffectivePermissions(
      attachment.message.channel.guildId,
      userId,
      attachment.message.channelId,
    );

    if (
      hasAllPermissions(permissions, [
        Permissions.VIEW_CHANNEL,
        Permissions.READ_MESSAGE_HISTORY,
      ])
    ) {
      return true;
    }
  }

  const legacyMessages = await db.message.findMany({
    where: { deleted: false, content: { contains: key } },
    select: {
      content: true,
      channelId: true,
      channel: { select: { guildId: true } },
    },
    take: 20,
  });

  for (const message of legacyMessages) {
    if (!payloadContainsKey(message.content, key)) {
      continue;
    }

    const permissions = await getEffectivePermissions(
      message.channel.guildId,
      userId,
      message.channelId,
    );

    if (
      hasAllPermissions(permissions, [
        Permissions.VIEW_CHANNEL,
        Permissions.READ_MESSAGE_HISTORY,
      ])
    ) {
      return true;
    }
  }

  return false;
}
