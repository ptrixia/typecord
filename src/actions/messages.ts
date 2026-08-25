"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { gatewayService } from "@/lib/gateway/GatewayService";
import { emitToChannel } from "@/lib/realtime/emitter";

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
    url: embed.url ?? undefined,
    title: embed.title ?? undefined,
    description: embed.description ?? undefined,
    siteName:
      embed.siteName ??
      embed.authorName ??
      undefined,
    color: color ?? "#5865F2",
    image:
      embed.image ??
      embed.imageUrl ??
      undefined,
    thumbnail:
      embed.thumbnail ??
      embed.thumbnailUrl ??
      undefined,
    author:
      embed.authorName
        ? {
            name: embed.authorName,
            url: embed.authorUrl ?? undefined,
            iconUrl:
              embed.authorIcon ??
              undefined,
          }
        : undefined,
    footer:
      embed.footerText
        ? {
            text: embed.footerText,
            iconUrl:
              embed.footerIcon ??
              undefined,
          }
        : undefined,
    timestamp:
      embed.timestamp ??
      undefined,
    fields:
      Array.isArray(embed.fields)
        ? embed.fields
        : undefined,
  };
}

function serializeMessage(message: any) {
  const payload =
    parseMessagePayload(
      String(message.content ?? ""),
    );

  const isWebhook =
    message.member?.user?.email ===
    "webhook@typecord.bot";

  const isBot =
    Boolean(
      message.member?.user?.bot,
    );

  const isBotVerified =
    Boolean(
      message.member?.user?.bot
        ?.verified,
    );

  const storedEmbeds =
    Array.isArray(message.embeds)
      ? message.embeds.map(
          normalizeDatabaseEmbed,
        )
      : [];

  return {
    id: String(message.id),

    author:
      message.member?.nickname ||
      message.member?.user
        ?.globalName ||
      message.member?.user
        ?.username ||
      "Usuário",

    authorId:
      message.member?.user?.id
        ? String(
            message.member.user.id,
          )
        : undefined,

    authorColor:
      isWebhook
        ? "text-rose-500"
        : "text-indigo-400",

    avatarColor:
      isWebhook
        ? "bg-rose-600"
        : "bg-indigo-600",

    avatarUrl:
      message.member?.user
        ?.avatarUrl ??
      null,

    createdAt:
      message.createdAt instanceof Date
        ? message.createdAt.toISOString()
        : new Date(
            message.createdAt,
          ).toISOString(),

    content:
      payload.content,

    reply:
      payload.reply ??
      null,

    attachments:
      payload.attachments?.length
        ? payload.attachments
        : Array.isArray(
              message.attachments,
            )
          ? message.attachments
          : [],

    embeds:
      payload.embeds?.length
        ? payload.embeds
        : storedEmbeds,

    isPending: false,

    isWebhook,

    isBot,

    isBotVerified,
  };
}

function createBotGatewayMessage(
  message: any,
  guildId: string,
  channelId: string,
  formattedMessage: ReturnType<
    typeof serializeMessage
  >,
) {
  return {
    id: formattedMessage.id,

    content:
      formattedMessage.content,

    guildId,

    channelId,

    author: {
      id:
        message.member.user.id,

      username:
        message.member.user
          .username,

      globalName:
        message.member.user
          .globalName,

      avatarUrl:
        message.member.user
          .avatarUrl,
    },

    isBot:
      formattedMessage.isBot,

    isBotVerified:
      formattedMessage
        .isBotVerified,

    isWebhook:
      formattedMessage.isWebhook,

    attachments:
      formattedMessage.attachments,

    embeds:
      formattedMessage.embeds,

    createdAt:
      formattedMessage.createdAt,

    replyToId:
      formattedMessage.reply
        ?.messageId ??
      null,

    reply:
      formattedMessage.reply,
  };
}

async function emitMessageToChannel(
  guildId: string,
  channelId: string,
  message: ReturnType<
    typeof serializeMessage
  >,
) {
  try {
    await emitToChannel(
      channelId,
      "MESSAGE_CREATE",
      {
        guildId,
        channelId,
        message,
      },
    );
  } catch (error) {
    console.error(
      "[MESSAGE_REALTIME_EMIT_ERROR]",
      error,
    );
  }
}

async function broadcastMessageToBots(
  guildId: string,
  message: any,
  channelId: string,
  formattedMessage: ReturnType<
    typeof serializeMessage
  >,
) {
  try {
    const botMembers =
      await db.member.findMany({
        where: {
          guildId,
          user: {
            bot: {
              isNot: null,
            },
          },
        },
        select: {
          user: {
            select: {
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

    if (
      botIds.length === 0
    ) {
      return;
    }

    await gatewayService.broadcast(
      botIds,
      "MESSAGE_CREATE",
      createBotGatewayMessage(
        message,
        guildId,
        channelId,
        formattedMessage,
      ),
    );
  } catch (error) {
    console.error(
      "[BOT_GATEWAY_BROADCAST_ERROR]",
      error,
    );
  }
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

    const channel =
      await db.channel.findUnique({
        where: {
          id: channelId,
        },
        select: {
          guildId: true,
        },
      });

    if (!channel) {
      return [];
    }

    const membership =
      await db.member.findUnique({
        where: {
          userId_guildId: {
            userId: user.id,
            guildId:
              channel.guildId,
          },
        },
        select: {
          id: true,
        },
      });

    if (!membership) {
      throw new Error(
        "Sem acesso ao canal.",
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
      serializeMessage,
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

    const rawContent =
      content.trim();

    const newMessage =
      await db.message.create({
        data: {
          content:
            rawContent,
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

    const formattedMessage =
      serializeMessage(
        newMessage,
      );

    await emitMessageToChannel(
      channel.guildId,
      channelId,
      formattedMessage,
    );

    await broadcastMessageToBots(
      channel.guildId,
      newMessage,
      channelId,
      formattedMessage,
    );

    console.log(
      `[GATEWAY] MESSAGE_CREATE ${newMessage.id} -> canal ${channelId}`,
    );

    return formattedMessage;
  } catch (error) {
    console.error(
      "[SEND_MESSAGE_ERROR]",
      error,
    );

    throw new Error(
      error instanceof Error
        ? error.message
        : "Não foi possível enviar a mensagem.",
    );
  }
}