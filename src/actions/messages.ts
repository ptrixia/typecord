"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { pusherServer } from "@/lib/pusher";
import { gatewayService } from "@/lib/gateway/GatewayService";

type MessagePayload = {
  content: string;

  reply?: {
    messageId: string;
    author: string;
    content: string;
    avatarUrl?: string | null;
  } | null;

  attachments?: any[];
  embeds?: any[];
};

function parseMessagePayload(rawContent: string): MessagePayload {
  try {
    const parsed = JSON.parse(rawContent);

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
    ) {
      return {
        content:
          typeof parsed.content === "string"
            ? parsed.content
            : "",

        reply:
          parsed.reply &&
          typeof parsed.reply === "object"
            ? parsed.reply
            : null,

        attachments: Array.isArray(parsed.attachments)
          ? parsed.attachments
          : [],

        embeds: Array.isArray(parsed.embeds)
          ? parsed.embeds
          : [],
      };
    }
  } catch {}

  return {
    content: rawContent,
    reply: null,
    attachments: [],
    embeds: [],
  };
}

function normalizeDatabaseEmbed(embed: any) {
  let color: string | undefined;

  if (typeof embed.color === "string") {
    color = embed.color;
  } else if (typeof embed.color === "number") {
    color = `#${embed.color
      .toString(16)
      .padStart(6, "0")}`;
  }

  return {
    url:
      embed.url ??
      undefined,

    title:
      embed.title ??
      undefined,

    description:
      embed.description ??
      undefined,

    siteName:
      embed.siteName ??
      embed.authorName ??
      undefined,

    color:
      color ??
      "#5865F2",

    image:
      embed.image ??
      embed.imageUrl ??
      undefined,

    thumbnail:
      embed.thumbnail ??
      embed.thumbnailUrl ??
      undefined,
  };
}

export async function getMessages(
  channelId: string,
) {
  if (!channelId) {
    return [];
  }

  try {
    const user =
      await getCurrentUser();

    if (!user) {
      throw new Error(
        "Não autorizado.",
      );
    }

    const messages =
      await db.message.findMany({
        where: {
          channelId,
          deleted: false,
        },

        include: {
          member: {
            include: {
              user: {
                include: {
                  bot: {
                    select: {
                      id: true,
                      verified: true,
                    },
                  },
                },
              },
            },
          },

          attachments: true,
          embeds: true,
        },

        orderBy: {
          createdAt: "asc",
        },

        take: 50,
      });

    return messages.map(
      (message) => {
        const payload =
          parseMessagePayload(
            message.content,
          );

        const isWebhook =
          message.member.user.email ===
          "webhook@typecord.bot";

        const isBot =
          Boolean(
            message.member.user.bot,
          );

        const isBotVerified =
          Boolean(
            message.member.user.bot
              ?.verified,
          );

        const storedEmbeds =
          message.embeds.map(
            normalizeDatabaseEmbed,
          );

        return {
          id: message.id,

          author:
            message.member.nickname ||
            message.member.user
              .globalName ||
            message.member.user
              .username,

          authorId:
            message.member.user.id,

          authorColor:
            isWebhook
              ? "text-rose-500"
              : "text-indigo-400",

          avatarColor:
            isWebhook
              ? "bg-rose-600"
              : "bg-indigo-600",

          avatarUrl:
            message.member.user
              .avatarUrl,

          createdAt:
            message.createdAt.toISOString(),

          content:
            payload.content,

          reply:
            payload.reply ??
            null,

          attachments:
            payload.attachments?.length
              ? payload.attachments
              : message.attachments,

          embeds:
            payload.embeds?.length
              ? payload.embeds
              : storedEmbeds,

          isPending: false,

          isWebhook,

          isBot,

          isBotVerified,
        };
      },
    );
  } catch (error) {
    console.error(
      "[GET_MESSAGES_ERROR]",
      error,
    );

    return [];
  }
}

export async function sendMessageAction(
  channelId: string,
  content: string,
) {
  if (
    !content ||
    !content.trim()
  ) {
    throw new Error(
      "A mensagem não pode estar vazia.",
    );
  }

  if (!channelId) {
    throw new Error(
      "Canal inválido.",
    );
  }

  try {
    const user =
      await getCurrentUser();

    if (!user) {
      throw new Error(
        "Não autorizado.",
      );
    }

    const channel =
      await db.channel.findUnique({
        where: {
          id: channelId,
        },

        select: {
          id: true,
          guildId: true,
        },
      });

    if (!channel) {
      throw new Error(
        "Canal não encontrado.",
      );
    }

    const member =
      await db.member.findUnique({
        where: {
          userId_guildId: {
            userId:
              user.id,

            guildId:
              channel.guildId,
          },
        },
      });

    if (!member) {
      throw new Error(
        "Você não é membro deste servidor.",
      );
    }

    const payload =
      parseMessagePayload(
        content.trim(),
      );

    const newMessage =
      await db.message.create({
        data: {
          content:
            content.trim(),

          channelId,

          memberId:
            member.id,
        },

        include: {
          member: {
            include: {
              user: {
                include: {
                  bot: {
                    select: {
                      id: true,
                      verified: true,
                    },
                  },
                },
              },
            },
          },

          attachments: true,
          embeds: true,
        },
      });

    const isWebhook =
      newMessage.member.user
        .email ===
      "webhook@typecord.bot";

    const isBot =
      Boolean(
        newMessage.member.user.bot,
      );

    const isBotVerified =
      Boolean(
        newMessage.member.user.bot
          ?.verified,
      );

    const databaseEmbeds =
      newMessage.embeds.map(
        normalizeDatabaseEmbed,
      );

    const formattedMessage = {
      id:
        newMessage.id,

      author:
        newMessage.member.nickname ||
        newMessage.member.user
          .globalName ||
        newMessage.member.user
          .username,

      authorId:
        newMessage.member.user.id,

      authorColor:
        isWebhook
          ? "text-rose-500"
          : "text-indigo-400",

      avatarColor:
        isWebhook
          ? "bg-rose-600"
          : "bg-indigo-600",

      avatarUrl:
        newMessage.member.user
          .avatarUrl,

      createdAt:
        newMessage.createdAt.toISOString(),

      content:
        payload.content,

      reply:
        payload.reply ??
        null,

      attachments:
        payload.attachments?.length
          ? payload.attachments
          : newMessage.attachments,

      embeds:
        payload.embeds?.length
          ? payload.embeds
          : databaseEmbeds,

      isPending:
        false,

      isWebhook,

      isBot,

      isBotVerified,
    };

    await pusherServer.trigger(
      `channel-${channelId}`,
      "new-message",
      formattedMessage,
    );

    const botMembers =
      await db.member.findMany({
        where: {
          guildId:
            channel.guildId,

          user: {
            bot: {
              isNot: null,
            },
          },
        },

        select: {
          user: {
            select: {
              id: true,

              bot: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });

    const botIds =
      botMembers
        .map(
          (item) =>
            item.user.bot?.id,
        )
        .filter(
          (
            id,
          ): id is string =>
            Boolean(id),
        );

    console.log(
      `[GATEWAY] Mensagem ${newMessage.id}`,
    );

    console.log(
      `[GATEWAY] Guild: ${channel.guildId}`,
    );

    console.log(
      `[GATEWAY] Bots encontrados: ${botIds.length}`,
    );

    if (
      botIds.length > 0
    ) {
      await gatewayService.broadcast(
        botIds,
        "MESSAGE_CREATE",
        {
          id:
            newMessage.id,

          content:
            payload.content,

          guildId:
            channel.guildId,

          channelId,

          author: {
            id:
              newMessage.member.user
                .id,

            username:
              newMessage.member.user
                .username,

            globalName:
              newMessage.member.user
                .globalName,

            avatarUrl:
              newMessage.member.user
                .avatarUrl,
          },

          isBot,

          isBotVerified,

          isWebhook,

          attachments:
            payload.attachments ??
            [],

          embeds:
            payload.embeds ??
            [],

          createdAt:
            newMessage.createdAt.toISOString(),

          replyToId:
            payload.reply
              ?.messageId ??
            null,

          reply:
            payload.reply ??
            null,
        },
      );
    }

    return formattedMessage;
  } catch (error) {
    console.error(
      "[SEND_MESSAGE_ERROR]",
      error,
    );

    throw new Error(
      "Não foi possível enviar a mensagem.",
    );
  }
}