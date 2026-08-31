"use server";

import { getBotIdsWithChannelAccess, getEffectiveChannelPermissions } from "@/lib/channel-permissions";
import { evaluateGuildMessageAutoMod } from "@/lib/automod";
import { db } from "@/lib/db";
import { gatewayService } from "@/lib/gateway/GatewayService";
import { getCurrentUser } from "@/lib/current-user";
import { Permissions, hasPermission } from "@/lib/permissions";
import {
  decodeMessageCursor,
  encodeMessageCursor,
} from "@/services/message-service";
import { incrementChannelUnread } from "@/services/read-state-service";
import { getFileUrl } from "@/lib/validations";
import { emitToChannel } from "@/lib/realtime/emitter";
import { isOwnedUploadKey } from "@/lib/storage-access";
import { storageObjectExists } from "@/lib/storage";
import { executePluginCommand } from "@/lib/plugins";
import { createMessageNotifications } from "@/lib/notifications";

type MessagePayload = {
  content: string;
  expiresAt?: string | null;
  reply?: {
    messageId: string;
    author: string;
    content: string;
    avatarUrl?: string | null;
  } | null;
  attachments?: Array<{
    id?: string;
    key?: string;
    url?: string | null;
    name?: string;
    filename?: string;
    size?: number;
    fileSize?: number;
    contentType?: string;
    fileType?: string;
  }>;
  embeds?: Array<Record<string, unknown>>;
  poll?: {
    question?: string;
    options?: string[];
    allowMultiple?: boolean;
    expiresAt?: string | null;
  } | null;
  voiceMessage?: {
    url?: string | null;
    key?: string | null;
    durationSeconds?: number;
    waveform?: unknown;
  } | null;
};

const userSelect = {
  id: true,
  username: true,
  globalName: true,
  avatarUrl: true,
  bot: {
    select: {
      id: true,
      verified: true,
    },
  },
} as const;

function parseMessagePayload(rawContent: string): MessagePayload {
  try {
    const parsed = JSON.parse(rawContent) as unknown;

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const value = parsed as Record<string, unknown>;
      return {
        content: typeof value.content === "string" ? value.content : "",
        expiresAt: typeof value.expiresAt === "string" ? value.expiresAt : null,
        reply:
          value.reply && typeof value.reply === "object" && !Array.isArray(value.reply)
            ? (value.reply as MessagePayload["reply"])
            : null,
        attachments: Array.isArray(value.attachments)
          ? (value.attachments as MessagePayload["attachments"])
          : [],
        embeds: Array.isArray(value.embeds)
          ? (value.embeds as Array<Record<string, unknown>>)
          : [],
        poll:
          value.poll && typeof value.poll === "object" && !Array.isArray(value.poll)
            ? (value.poll as MessagePayload["poll"])
            : null,
        voiceMessage:
          value.voiceMessage && typeof value.voiceMessage === "object" && !Array.isArray(value.voiceMessage)
            ? (value.voiceMessage as MessagePayload["voiceMessage"])
            : null,
      };
    }
  } catch {
    // Conteúdo legado em texto puro.
  }

  return {
    content: rawContent,
    expiresAt: null,
    reply: null,
    attachments: [],
    embeds: [],
    poll: null,
    voiceMessage: null,
  };
}

function normalizeDatabaseEmbed(embed: any) {
  let color: string | undefined;

  if (typeof embed.color === "string") {
    color = embed.color;
  } else if (typeof embed.color === "number") {
    color = `#${embed.color.toString(16).padStart(6, "0")}`;
  }

  return {
    url: embed.url ?? undefined,
    title: embed.title ?? undefined,
    description: embed.description ?? undefined,
    siteName: embed.siteName ?? embed.authorName ?? undefined,
    color: color ?? "#5865F2",
    image: embed.image ?? embed.imageUrl ?? undefined,
    thumbnail: embed.thumbnail ?? embed.thumbnailUrl ?? undefined,
    author: embed.authorName
      ? {
          name: embed.authorName,
          url: embed.authorUrl ?? undefined,
          iconUrl: embed.authorIcon ?? undefined,
        }
      : undefined,
    footer: embed.footerText
      ? {
          text: embed.footerText,
          iconUrl: embed.footerIcon ?? undefined,
        }
      : undefined,
    timestamp: embed.timestamp ?? undefined,
    fields: Array.isArray(embed.fields) ? embed.fields : undefined,
  };
}

function serializeAttachment(attachment: any) {
  const key = String(attachment.key ?? attachment.url ?? "");
  const url = key ? getFileUrl(key) : attachment.url ?? null;

  return {
    ...attachment,
    key,
    url,
    name: attachment.name ?? attachment.filename ?? "arquivo",
    filename: attachment.filename ?? attachment.name ?? "arquivo",
    size: Number(attachment.size ?? attachment.fileSize ?? 0),
    fileSize: Number(attachment.fileSize ?? attachment.size ?? 0),
    contentType:
      attachment.contentType ?? attachment.fileType ?? "application/octet-stream",
    fileType:
      attachment.fileType ?? attachment.contentType ?? "application/octet-stream",
  };
}

function groupReactions(reactions: any[], currentUserId?: string) {
  const grouped = new Map<string, { emoji: string; count: number; reactedByMe: boolean; users: Array<{ id: string; name: string }> }>();

  for (const reaction of reactions) {
    const emoji = reaction.unicode || reaction.emoji?.name || "";
    if (!emoji) continue;

    const current: { emoji: string; count: number; reactedByMe: boolean; users: Array<{ id: string; name: string }> } = grouped.get(emoji) ?? {
      emoji,
      count: 0,
      reactedByMe: false,
      users: [],
    };

    current.count += 1;
    current.reactedByMe ||= Boolean(currentUserId) && reaction.member?.userId === currentUserId;
    if (reaction.member?.user) current.users.push({ id: String(reaction.member.user.id), name: reaction.member.user.globalName || reaction.member.user.username });
    grouped.set(emoji, current);
  }

  return Array.from(grouped.values());
}

function serializePoll(poll: any, currentUserId?: string) {
  return {
    id: poll.id,
    question: poll.question,
    allowMultiple: poll.allowMultiple,
    expiresAt: poll.expiresAt?.toISOString?.() ?? poll.expiresAt ?? null,
    options: [...(poll.options ?? [])]
      .sort((left: any, right: any) => Number(left.position) - Number(right.position))
      .map((option: any) => ({
        id: option.id,
        label: option.label,
        count: option.votes?.length ?? 0,
        votedByMe: Boolean(currentUserId) && option.votes?.some((vote: any) => vote.userId === currentUserId),
      })),
  };
}

function normalizePoll(poll: MessagePayload["poll"]) {
  if (!poll) return null;

  const question = String(poll.question ?? "").trim().slice(0, 300);
  const options = (Array.isArray(poll.options) ? poll.options : [])
    .map((option) => String(option).trim().replace(/\s+/g, " ").slice(0, 120))
    .filter(Boolean)
    .slice(0, 10);

  if (!question || options.length < 2) {
    throw new Error("A enquete precisa de uma pergunta e pelo menos duas opções.");
  }

  const expiresAt = poll.expiresAt ? new Date(poll.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new Error("Data de encerramento da enquete inválida.");
  }

  return {
    question,
    options,
    allowMultiple: Boolean(poll.allowMultiple),
    expiresAt,
  };
}

async function normalizeVoiceMessage(userId: string, voiceMessage: MessagePayload["voiceMessage"]) {
  if (!voiceMessage) return null;

  const key = String(voiceMessage.key ?? voiceMessage.url ?? "").trim();
  const durationSeconds = Math.max(1, Math.min(600, Math.trunc(Number(voiceMessage.durationSeconds ?? 0))));

  if (!key || !isOwnedUploadKey(userId, key)) {
    throw new Error("Mensagem de voz inválida ou pertencente a outro usuário.");
  }

  if (!(await storageObjectExists(key))) {
    throw new Error("O áudio da mensagem de voz não existe mais.");
  }

  return {
    url: key,
    durationSeconds,
    waveform: Array.isArray(voiceMessage.waveform) ? voiceMessage.waveform.slice(0, 128) : undefined,
  };
}

function serializeMessage(message: any, currentUserId?: string) {
  const payload = parseMessagePayload(String(message.content ?? ""));
  const user = message.member?.user;
  const isBot = Boolean(user?.bot);
  const isBotVerified = Boolean(user?.bot?.verified);
  const storedEmbeds = Array.isArray(message.embeds)
    ? message.embeds.map(normalizeDatabaseEmbed)
    : [];

  const storedReply = message.replyTo
    ? {
        messageId: String(message.replyTo.id),
        author:
          message.replyTo.member?.nickname ||
          message.replyTo.member?.user?.globalName ||
          message.replyTo.member?.user?.username ||
          "Usuário",
        content: message.replyTo.deleted
          ? "Mensagem apagada"
          : parseMessagePayload(String(message.replyTo.content ?? "")).content,
        avatarUrl: message.replyTo.member?.user?.avatarUrl ?? null,
      }
    : null;

  return {
    id: String(message.id),
    author:
      message.member?.nickname || user?.globalName || user?.username || "Usuário",
    authorId: user?.id ? String(user.id) : undefined,
    authorColor: "text-indigo-400",
    avatarColor: "bg-indigo-600",
    avatarUrl: user?.avatarUrl ?? null,
    createdAt:
      message.createdAt instanceof Date
        ? message.createdAt.toISOString()
        : new Date(message.createdAt).toISOString(),
    expiresAt: message.expiresAt instanceof Date
      ? message.expiresAt.toISOString()
      : message.expiresAt
        ? new Date(message.expiresAt).toISOString()
        : null,
    editedAt: message.editedAt instanceof Date
      ? message.editedAt.toISOString()
      : message.editedAt
        ? new Date(message.editedAt).toISOString()
        : null,
    content: payload.content,
    reply: payload.reply ?? storedReply,
    attachments: payload.attachments?.length
      ? payload.attachments.map(serializeAttachment)
      : Array.isArray(message.attachments)
        ? message.attachments.map(serializeAttachment)
        : [],
    embeds: payload.embeds?.length ? payload.embeds : storedEmbeds,
    reactions: groupReactions(message.reactions ?? [], currentUserId),
    poll: message.poll ? serializePoll(message.poll, currentUserId) : payload.poll ?? null,
    voiceMessage: message.voiceMessage ?? payload.voiceMessage ?? null,
    isPending: false,
    isWebhook: false,
    isBot,
    isBotVerified,
    threads: Array.isArray(message.createdThreads)
      ? message.createdThreads.map((thread: any) => ({
          id: String(thread.id),
          name: String(thread.name),
          type: thread.type,
          parentId: thread.parentId ?? null,
        }))
      : [],
  };
}

function createBotGatewayMessage(
  message: any,
  guildId: string,
  channelId: string,
  formattedMessage: ReturnType<typeof serializeMessage>,
) {
  return {
    id: formattedMessage.id,
    content: formattedMessage.content,
    guildId,
    channelId,
    author: {
      id: message.member.user.id,
      username: message.member.user.username,
      globalName: message.member.user.globalName,
      avatarUrl: message.member.user.avatarUrl,
    },
    isBot: formattedMessage.isBot,
    isBotVerified: formattedMessage.isBotVerified,
    isWebhook: false,
    attachments: formattedMessage.attachments,
    embeds: formattedMessage.embeds,
    createdAt: formattedMessage.createdAt,
    replyToId: formattedMessage.reply?.messageId ?? null,
    reply: formattedMessage.reply,
  };
}

async function broadcastMessageToBots(
  guildId: string,
  message: any,
  channelId: string,
  formattedMessage: ReturnType<typeof serializeMessage>,
) {
  try {
    const botIds = await getBotIdsWithChannelAccess(guildId, channelId);

    if (!botIds.length) {
      return;
    }

    await gatewayService.broadcast(
      botIds,
      "MESSAGE_CREATE",
      createBotGatewayMessage(message, guildId, channelId, formattedMessage),
    );
  } catch (error) {
    console.error("[BOT_GATEWAY_BROADCAST_ERROR]", error);
  }
}

async function validateAttachments(
  userId: string,
  attachments: NonNullable<MessagePayload["attachments"]>,
) {
  if (attachments.length > 10) {
    throw new Error("Uma mensagem pode possuir no máximo 10 anexos.");
  }

  const normalized = [] as NonNullable<MessagePayload["attachments"]>;

  for (const attachment of attachments) {
    const key = String(attachment.key ?? attachment.url ?? "").trim();

    if (!key || !isOwnedUploadKey(userId, key)) {
      throw new Error("Anexo inválido ou pertencente a outro usuário.");
    }

    if (!(await storageObjectExists(key))) {
      throw new Error("Um dos anexos enviados não existe mais.");
    }

    normalized.push({
      id: typeof attachment.id === "string" ? attachment.id : undefined,
      key,
      url: key,
      name: String(attachment.name ?? attachment.filename ?? "arquivo").slice(0, 255),
      filename: String(attachment.filename ?? attachment.name ?? "arquivo").slice(0, 255),
      size: Math.max(0, Number(attachment.size ?? attachment.fileSize ?? 0)),
      fileSize: Math.max(0, Number(attachment.fileSize ?? attachment.size ?? 0)),
      contentType: String(
        attachment.contentType ?? attachment.fileType ?? "application/octet-stream",
      ).slice(0, 150),
      fileType: String(
        attachment.fileType ?? attachment.contentType ?? "application/octet-stream",
      ).slice(0, 150),
    });
  }

  return normalized;
}

export async function getMessages(channelId: string, rawCursor?: string) {
  if (!channelId) {
    return [];
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error("Não autorizado.");
    }

    const channel = await db.channel.findUnique({
      where: { id: channelId },
      select: { guildId: true },
    });

    if (!channel) {
      return [];
    }

    const permissions = await getEffectiveChannelPermissions(
      channel.guildId,
      user.id,
      channelId,
    );

    if (
      !hasPermission(permissions, Permissions.VIEW_CHANNEL) ||
      !hasPermission(permissions, Permissions.READ_MESSAGE_HISTORY)
    ) {
      throw new Error("Sem acesso ao canal.");
    }

    const cursor = decodeMessageCursor(rawCursor);
    if (rawCursor && !cursor) throw new Error("Cursor inválido.");

    const messages = await db.message.findMany({
      where: {
        channelId,
        deleted: false,
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          ...(cursor ? [{ OR: [
            { createdAt: { lt: new Date(cursor.createdAt) } },
            { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } },
          ] }] : []),
        ],
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        editedAt: true,
        expiresAt: true,
        member: {
          select: {
            nickname: true,
            user: { select: userSelect },
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            deleted: true,
            member: {
              select: {
                nickname: true,
                user: { select: { username: true, globalName: true, avatarUrl: true } },
              },
            },
          },
        },
        attachments: true,
        embeds: true,
        reactions: {
          include: {
            emoji: true,
            member: { select: { userId: true, user: { select: { id: true, username: true, globalName: true } } } },
          },
        },
        poll: {
          include: {
            options: {
              include: {
                votes: true,
              },
            },
          },
        },
        voiceMessage: true,
        createdThreads: {
          select: { id: true, name: true, type: true, parentId: true },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 51,
    });

    const hasMore = messages.length > 50;
    const page = messages.slice(0, 50);
    return {
      items: page.reverse().map((message) => serializeMessage(message, user.id)),
      nextCursor: hasMore ? encodeMessageCursor(page[page.length - 1]!) : null,
    };
  } catch (error) {
    console.error("[GET_MESSAGES_ERROR]", error);
    return { items: [], nextCursor: null };
  }
}

export async function sendMessageAction(channelId: string, rawContent: string) {
  if (!channelId) {
    throw new Error("Canal inválido.");
  }

  if (typeof rawContent !== "string" || rawContent.length > 40_000) {
    throw new Error("Payload de mensagem inválido.");
  }

  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Não autorizado.");
  }

  const channel = await db.channel.findUnique({
    where: { id: channelId },
    select: { id: true, guildId: true, locked: true, slowmodeSeconds: true },
  });

  if (!channel) {
    throw new Error("Canal não encontrado.");
  }

  const permissions = await getEffectiveChannelPermissions(
    channel.guildId,
    user.id,
    channelId,
  );

  if (
    !hasPermission(permissions, Permissions.VIEW_CHANNEL) ||
    !hasPermission(permissions, Permissions.SEND_MESSAGES)
  ) {
    throw new Error("Você não possui permissão para enviar mensagens neste canal.");
  }

  const payload = parseMessagePayload(rawContent);
  payload.content = payload.content.trim();
  const messageExpiresAt = payload.expiresAt ? new Date(payload.expiresAt) : null;
  if (messageExpiresAt && (Number.isNaN(messageExpiresAt.getTime()) || messageExpiresAt <= new Date())) {
    throw new Error("O prazo da mensagem temporária é inválido.");
  }

  const isPluginCommand = /^\/[a-z0-9-]{1,32}(?:\s|$)/i.test(payload.content);
  if (channel.locked && !isPluginCommand) {
    throw new Error("Este canal está bloqueado para novas mensagens.");
  }
  if (channel.slowmodeSeconds > 0 && !isPluginCommand) {
    const lastMessage = await db.message.findFirst({ where: { channelId, memberId: (await db.member.findUnique({ where: { userId_guildId: { userId: user.id, guildId: channel.guildId } }, select: { id: true } }))?.id, deleted: false }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    if (lastMessage) {
      const remaining = channel.slowmodeSeconds - Math.floor((Date.now() - lastMessage.createdAt.getTime()) / 1000);
      if (remaining > 0) throw new Error(`Aguarde ${remaining}s para enviar outra mensagem.`);
    }
  }

  if (payload.content.length > 8000) {
    throw new Error("A mensagem não pode passar de 8.000 caracteres.");
  }

  const attachments = await validateAttachments(user.id, payload.attachments ?? []);

  if (attachments.length && !hasPermission(permissions, Permissions.ATTACH_FILES)) {
    throw new Error("Você não possui permissão para anexar arquivos neste canal.");
  }

  if ((payload.embeds?.length ?? 0) > 10) {
    throw new Error("A mensagem pode possuir no máximo 10 embeds.");
  }

  if ((payload.embeds?.length ?? 0) > 0 && !hasPermission(permissions, Permissions.EMBED_LINKS)) {
    payload.embeds = [];
  }

  const poll = normalizePoll(payload.poll);
  const voiceMessage = await normalizeVoiceMessage(user.id, payload.voiceMessage);

  if (poll && !hasPermission(permissions, Permissions.SEND_POLLS)) {
    throw new Error("Você não possui permissão para enviar enquetes neste canal.");
  }

  if (voiceMessage && !hasPermission(permissions, Permissions.SEND_VOICE_MESSAGES)) {
    throw new Error("Você não possui permissão para enviar mensagens de voz neste canal.");
  }

  if (!payload.content && !attachments.length && !(payload.embeds?.length ?? 0) && !poll && !voiceMessage) {
    throw new Error("A mensagem não pode estar vazia.");
  }

  payload.attachments = attachments;

  const member = await db.member.findUnique({
    where: {
      userId_guildId: {
        userId: user.id,
        guildId: channel.guildId,
      },
    },
    select: { id: true },
  });

  if (!member) {
    throw new Error("Você não é membro deste servidor.");
  }

  let replyToUserId: string | null = null;
  if (payload.reply?.messageId) {
    const repliedMessage = await db.message.findFirst({
      where: { id: payload.reply.messageId, channelId, deleted: false },
      select: { id: true, member: { select: { userId: true } } },
    });
    if (!repliedMessage) throw new Error("Mensagem respondida inválida.");
    replyToUserId = repliedMessage.member.userId;
  }

  const pluginResponse = await executePluginCommand({
    guildId: channel.guildId,
    channelId,
    userId: user.id,
    content: payload.content,
  });
  if (pluginResponse) payload.content = pluginResponse;

  const activeTimeout = await db.moderationAction.findFirst({
    where: {
      guildId: channel.guildId,
      targetUserId: user.id,
      type: "TIMEOUT",
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: "desc" },
    select: { expiresAt: true },
  });

  if (activeTimeout) {
    throw new Error(
      `Você está em timeout até ${activeTimeout.expiresAt?.toLocaleString("pt-BR")}.`,
    );
  }

  const moderation = await evaluateGuildMessageAutoMod({
    guildId: channel.guildId,
    channelId,
    userId: user.id,
    memberId: member.id,
    content: payload.content,
  });

  if (!moderation.allowed) {
    throw new Error(moderation.message);
  }

  const persistedContent = JSON.stringify(payload);

  const newMessage = await db.message.create({
    data: {
      content: persistedContent,
      channelId,
      memberId: member.id,
      expiresAt: messageExpiresAt,
      ...(payload.reply?.messageId ? { replyToId: payload.reply.messageId } : {}),
      attachments: {
        create: attachments.map((attachment) => ({
          url: String(attachment.key ?? attachment.url ?? ""),
          filename: String(attachment.filename ?? attachment.name ?? "arquivo"),
          fileSize: Number(attachment.fileSize ?? attachment.size ?? 0),
          fileType: String(attachment.fileType ?? attachment.contentType ?? "application/octet-stream"),
        })),
      },
      ...(poll
        ? {
            poll: {
              create: {
                question: poll.question,
                allowMultiple: poll.allowMultiple,
                expiresAt: poll.expiresAt,
                options: {
                  create: poll.options.map((label, position) => ({
                    label,
                    position,
                  })),
                },
              },
            },
          }
        : {}),
      ...(voiceMessage
        ? {
            voiceMessage: {
              create: voiceMessage,
            },
          }
        : {}),
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      editedAt: true,
      expiresAt: true,
      member: {
        select: {
          nickname: true,
          user: { select: userSelect },
        },
      },
      replyTo: {
        select: {
          id: true,
          content: true,
          deleted: true,
          member: {
            select: {
              nickname: true,
              user: { select: { username: true, globalName: true, avatarUrl: true } },
            },
          },
        },
      },
      attachments: true,
      embeds: true,
      reactions: {
        include: {
          emoji: true,
          member: { select: { userId: true, user: { select: { id: true, username: true, globalName: true } } } },
        },
      },
      poll: {
        include: {
          options: {
            include: {
              votes: true,
            },
          },
        },
      },
      voiceMessage: true,
      createdThreads: {
        select: { id: true, name: true, type: true, parentId: true },
      },
    },
  });

  const formattedMessage = serializeMessage(newMessage, user.id);

  void createMessageNotifications({
    messageId: formattedMessage.id,
    guildId: channel.guildId,
    channelId,
    authorId: user.id,
    content: payload.content,
    replyToUserId,
  }).catch((error) => console.error("[MESSAGE_NOTIFICATION_CREATE]", error));

  try {
  await emitToChannel(channelId, "MESSAGE_CREATE", {
      guildId: channel.guildId,
      channelId,
      message: formattedMessage,
  });
  await incrementChannelUnread(channelId, user.id);
  } catch (error) {
    console.error("[MESSAGE_REALTIME_EMIT_ERROR]", error);
  }

  await broadcastMessageToBots(
    channel.guildId,
    newMessage,
    channelId,
    formattedMessage,
  );

  return formattedMessage;
}
