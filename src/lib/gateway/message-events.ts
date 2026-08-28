import { db as prisma } from "@/lib/db";
import { getBotIdsWithChannelAccess } from "@/lib/channel-permissions";
import { gatewayService } from "./GatewayService";

export async function dispatchMessageCreate(messageId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      content: true,
      replyToId: true,
      createdAt: true,
      member: {
        select: {
          user: {
            select: {
              id: true,
              username: true,
              globalName: true,
              avatarUrl: true,
            },
          },
        },
      },
      channel: {
        select: {
          id: true,
          guildId: true,
        },
      },
      attachments: {
        select: {
          id: true,
          url: true,
          filename: true,
          fileSize: true,
          fileType: true,
        },
      },
    },
  });

  if (!message) {
    return;
  }

  const botIds = await getBotIdsWithChannelAccess(
    message.channel.guildId,
    message.channel.id,
  );

  if (!botIds.length) {
    return;
  }

  await gatewayService.broadcast(botIds, "MESSAGE_CREATE", {
    id: message.id,
    content: message.content,
    channelId: message.channel.id,
    guildId: message.channel.guildId,
    author: {
      id: message.member.user.id,
      username: message.member.user.username,
      globalName: message.member.user.globalName,
      avatarUrl: message.member.user.avatarUrl,
    },
    attachments: message.attachments.map((attachment) => ({
      id: attachment.id,
      url: attachment.url,
      filename: attachment.filename,
      fileSize: attachment.fileSize,
      fileType: attachment.fileType,
    })),
    createdAt: message.createdAt.toISOString(),
    replyToId: message.replyToId,
  });
}
