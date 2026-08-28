

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  FilePlus2,
  Gift,
  Hash,
  Loader2,
  Mic,
  Pin,
  Plus,
  Reply,
  Smile,
  Sticker,
  Users,
  X,
} from "lucide-react";
import EmojiPicker, { Theme } from "emoji-picker-react";

import type { MessageEmbedData } from "../Message/MessageEmbed";
import MessageItem, { MessageData } from "../Message/MessageItem";
import Avatar from "../Image/Avatar";
import SearchCommand from "../SearchCommand";
import type { CommandItem } from "../SearchCommand";
import GifPicker from "./GifPicker";

import { sendMessageAction } from "@/actions/messages";
import { useGatewayStatus } from "@/components/app/GatewayStatusProvider";
import { useToast } from "@/components/app/ToastProvider";
import {
  onGatewayEvent,
  sendTyping,
  subscribeChannel,
  unsubscribeChannel,
} from "@/lib/realtime/gateway-client";

export type TextChatMode = "guild" | "direct";

interface TextChatAreaProps {
  channel: any;
  currentUser?: any;
  users?: any[];
  channels?: any[];
  stickers?: any[];
  mode: TextChatMode;
  onOpenDetails?: () => void;
  onDirectConversationChanged?: () => Promise<void> | void;
  commandItems?: CommandItem[];
}

interface MentionSuggestion {
  id: string;
  name: string;
  type: "user" | "channel";
  avatarUrl?: string | null;
}

interface UploadingFile {
  id: string;
  name: string;
  progress: number;
}

async function generateLinkEmbeds(content: string): Promise<MessageEmbedData[]> {
  if (!content || !/https?:\/\//i.test(content)) {
    return [];
  }

  try {
    const response = await fetch("/api/link-preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json().catch(() => null);

    if (!data?.success || !Array.isArray(data.embeds)) {
      return [];
    }

    return data.embeds;
  } catch (error) {
    console.error("[LINK_PREVIEW_CLIENT]", error);
    return [];
  }
}

function normalizeMessage(message: any): MessageData {
  let parsed: any = message;

  if (typeof message?.content === "string") {
    try {
      const json = JSON.parse(message.content);

      if (
        json &&
        typeof json === "object" &&
        ("content" in json || "attachments" in json || "reply" in json || "embeds" in json)
      ) {
        parsed = {
          ...message,
          ...json,
        };
      }
    } catch {}
  }

  const structuredAuthor =
    parsed.author && typeof parsed.author === "object" && !Array.isArray(parsed.author)
      ? parsed.author
      : null;

  const memberUser = structuredAuthor || parsed.member?.user || {};
  const bot = memberUser?.bot ?? structuredAuthor?.bot ?? parsed.bot ?? null;

  const authorName =
    typeof parsed.author === "string"
      ? parsed.author
      : parsed.authorName ||
        memberUser.globalName ||
        memberUser.displayName ||
        memberUser.username ||
        "Usuário";

  const authorId =
    parsed.authorId || parsed.userId || structuredAuthor?.id || memberUser.id;

  const avatarUrl =
    parsed.avatarUrl ?? structuredAuthor?.avatarUrl ?? memberUser.avatarUrl ?? memberUser.avatar ?? null;

  const isBot =
    typeof parsed.isBot === "boolean" ? parsed.isBot : Boolean(bot);

  const isBotVerified =
    typeof parsed.isBotVerified === "boolean"
      ? parsed.isBotVerified
      : typeof parsed.isVerifiedBot === "boolean"
        ? parsed.isVerifiedBot
        : Boolean(bot?.verified);

  const isWebhookMessage =
    memberUser.email === "webhook@typecord.bot" || Boolean(parsed.isWebhook);

  const normalizedReply = parsed.reply
    ? {
        messageId: String(
          parsed.reply.messageId ?? parsed.reply.id ?? parsed.replyToId ?? "",
        ),
        author:
          typeof parsed.reply.author === "string"
            ? parsed.reply.author
            : parsed.reply.author?.globalName ||
              parsed.reply.author?.username ||
              "Usuário",
        content: parsed.reply.deleted
          ? "Mensagem apagada"
          : parsed.reply.content || "",
        avatarUrl:
          parsed.reply.avatarUrl ?? parsed.reply.author?.avatarUrl ?? null,
      }
    : null;

  const normalizedAttachments = Array.isArray(parsed.attachments)
    ? parsed.attachments.map((attachment: any) => ({
        ...attachment,
        id: String(attachment.id ?? crypto.randomUUID()),
        url: attachment.url ?? attachment.key ?? null,
        filename: attachment.filename ?? attachment.name ?? "arquivo",
        fileSize: attachment.fileSize ?? attachment.size ?? 0,
        fileType:
          attachment.fileType ?? attachment.contentType ?? "application/octet-stream",
        key: attachment.key ?? attachment.url ?? undefined,
        name: attachment.name ?? attachment.filename ?? "arquivo",
        size: attachment.size ?? attachment.fileSize ?? 0,
        contentType:
          attachment.contentType ?? attachment.fileType ?? "application/octet-stream",
      }))
    : [];

  const normalizedEmbeds = Array.isArray(parsed.embeds)
    ? parsed.embeds.map((embed: any) => ({
        url: embed.url ?? undefined,
        title: embed.title ?? undefined,
        description: embed.description ?? undefined,
        siteName: embed.siteName ?? embed.authorName ?? undefined,
        color: embed.color ?? "#5865F2",
        image: embed.image ?? embed.imageUrl ?? undefined,
        thumbnail: embed.thumbnail ?? embed.thumbnailUrl ?? undefined,
      }))
    : [];

  return {
    id: String(parsed.id),
    author: authorName,
    authorId: authorId ? String(authorId) : undefined,
    authorColor: isWebhookMessage
      ? "text-rose-500"
      : parsed.authorColor || "text-indigo-400",
    avatarColor: isWebhookMessage
      ? "bg-rose-600"
      : parsed.avatarColor || "bg-indigo-600",
    avatarUrl,
    createdAt:
      typeof parsed.createdAt === "string"
        ? parsed.createdAt
        : parsed.createdAt
          ? new Date(parsed.createdAt).toISOString()
          : new Date().toISOString(),
    time: parsed.time || undefined,
    content: parsed.deleted ? "" : parsed.content || "",
    reply: normalizedReply,
    attachments: normalizedAttachments,
    embeds: normalizedEmbeds,
    reactions: Array.isArray(parsed.reactions) ? parsed.reactions : [],
    poll: parsed.poll ?? null,
    voiceMessage: parsed.voiceMessage ?? null,
    isPinned: Boolean(parsed.isPinned),
    isPending: Boolean(parsed.isPending),
    isBot,
    isBotVerified,
    isWebhook: isWebhookMessage,
    ...(parsed.deleted ? { deleted: true } : {}),
  } as MessageData;
}

export default function TextChatArea({
  channel,
  currentUser,
  users,
  channels,
  stickers = [],
  mode,
  onOpenDetails,
  onDirectConversationChanged,
  commandItems = [],
}: TextChatAreaProps) {
  const isDirect = mode === "direct";
  const gatewayStatus = useGatewayStatus();
  const { pushToast } = useToast();

  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [hasMore, setHasMore] = useState(true);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isGifOpen, setIsGifOpen] = useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [isStickerOpen, setIsStickerOpen] = useState(false);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isPollOpen, setIsPollOpen] = useState(false);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MessageData | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageData | null>(null);
  const [isEditingMessage, setIsEditingMessage] = useState(false);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

  const lastTypedRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const voiceInputRef = useRef<HTMLInputElement>(null);
  const prevScrollHeightRef = useRef(0);

  const currentUserName =
    currentUser?.globalName ||
    currentUser?.displayName ||
    currentUser?.username ||
    currentUser?.name ||
    "Usuário";

  const currentUserId = String(currentUser?.id ?? "");

  const usersList = useMemo(() => {
    if (users) {
      return users;
    }

    const source =
      channel?.members ||
      channel?.server?.members ||
      channel?.guild?.members ||
      channel?.users ||
      [];

    const array = Array.isArray(source)
      ? source
      : source?.values
        ? Array.from(source.values())
        : [];

    return array.map((item: any) => item?.user || item?.profile || item);
  }, [users, channel]);

  const channelsList = useMemo(() => {
    if (channels) {
      return channels;
    }

    const source =
      channel?.server?.channels || channel?.guild?.channels || channel?.channels || [];

    return Array.isArray(source)
      ? source
      : source?.values
        ? Array.from(source.values())
        : [];
  }, [channels, channel]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    });
  }, []);

  const fetchMessages = useCallback(
    async (cursor?: string) => {
      if (!channel?.id) {
        return;
      }

      if (cursor) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      try {
        setLoadError("");
        const url = isDirect
          ? cursor
            ? `/api/direct-messages/conversations/${channel.id}/messages?limit=50&before=${encodeURIComponent(cursor)}`
            : `/api/direct-messages/conversations/${channel.id}/messages?limit=50`
          : cursor
            ? `/api/messages?channelId=${channel.id}&cursor=${encodeURIComponent(cursor)}`
            : `/api/messages?channelId=${channel.id}`;

        const response = await fetch(url, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Não foi possível carregar as mensagens.");
        }

        const data = await response.json();

        const rawItems = isDirect
          ? Array.isArray(data.messages)
            ? data.messages
            : []
          : Array.isArray(data.items)
            ? data.items
            : [];

        const normalizedItems = rawItems.map(normalizeMessage);
        const orderedItems = isDirect
          ? normalizedItems
          : normalizedItems.reverse();

        setHasMore(
          isDirect ? Boolean(data.hasMore) : Boolean(data.nextCursor),
        );

        setMessages((current) => {
          if (!cursor) {
            return orderedItems;
          }

          const existingIds = new Set(current.map((message) => message.id));
          const uniqueItems = orderedItems.filter(
            (message: MessageData) => !existingIds.has(message.id),
          );

          return [...uniqueItems, ...current];
        });
      } catch (error) {
        console.error("[CHAT_MESSAGES_GET]", error);
        setLoadError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar as mensagens.",
        );
        pushToast({
          type: "error",
          title: "Falha ao carregar mensagens",
          description:
            error instanceof Error
              ? error.message
              : "Tente novamente em alguns instantes.",
        });
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [channel, isDirect, pushToast],
  );

  useEffect(() => {
    if (!channel?.id) {
      return;
    }

    let disposed = false;

    setMessages([]);
    setHasMore(true);
    setTypingUsers([]);
    setReplyingTo(null);
    setEditingMessage(null);
    setMentionSuggestions([]);
    setActiveMenuMessageId(null);
    setIsGifOpen(false);
    setIsEmojiOpen(false);
    setIsStickerOpen(false);
    setIsPollOpen(false);

    void fetchMessages();

    const appendMessage = (incoming: any) => {
      const rawMessage =
        incoming?.message ?? incoming?.data?.message ?? incoming;

      if (!rawMessage?.id) {
        return;
      }

      const newMessage = normalizeMessage(rawMessage);

      setMessages((current) => {
        if (current.some((message) => message.id === newMessage.id)) {
          return current;
        }

        return [...current, newMessage];
      });

      scrollToBottom("smooth");
    };

    const applyMessageUpdate = (incoming: any) => {
      const rawMessage =
        incoming?.message ?? incoming?.data?.message ?? incoming;

      if (!rawMessage?.id) {
        return;
      }

      const updatedMessage = normalizeMessage(rawMessage);
      const hasIdentityPayload =
        Boolean(rawMessage.author) ||
        Boolean(rawMessage.authorId) ||
        Boolean(rawMessage.userId) ||
        Boolean(rawMessage.member);
      const hasContentPayload =
        typeof rawMessage.content === "string" ||
        Object.prototype.hasOwnProperty.call(rawMessage, "attachments") ||
        Object.prototype.hasOwnProperty.call(rawMessage, "embeds") ||
        Object.prototype.hasOwnProperty.call(rawMessage, "poll") ||
        Object.prototype.hasOwnProperty.call(rawMessage, "voiceMessage");

      setMessages((current) =>
        current.map((message) =>
          message.id === updatedMessage.id
            ? {
                ...message,
                ...updatedMessage,
                content: hasContentPayload ? updatedMessage.content : message.content,
                attachments: hasContentPayload ? updatedMessage.attachments : message.attachments,
                embeds: hasContentPayload ? updatedMessage.embeds : message.embeds,
                poll: hasContentPayload ? updatedMessage.poll : message.poll,
                voiceMessage: hasContentPayload ? updatedMessage.voiceMessage : message.voiceMessage,
                author: hasIdentityPayload ? updatedMessage.author : message.author,
                authorId: hasIdentityPayload ? updatedMessage.authorId : message.authorId,
                avatarUrl: hasIdentityPayload ? updatedMessage.avatarUrl : message.avatarUrl,
                authorColor: hasIdentityPayload ? updatedMessage.authorColor : message.authorColor,
                avatarColor: hasIdentityPayload ? updatedMessage.avatarColor : message.avatarColor,
              }
            : message,
        ),
      );
    };

    const applyMessageDelete = (incoming: any) => {
      const messageId = String(
        incoming?.messageId ??
          incoming?.id ??
          incoming?.data?.messageId ??
          "",
      );

      if (!messageId) {
        return;
      }

      setMessages((current) =>
        current.filter((message) => message.id !== messageId),
      );
    };

    const showTyping = (data: {
      userName?: string;
      username?: string;
      globalName?: string | null;
      userId?: string;
      expiresAt?: number;
    }) => {
      const userId = String(data.userId ?? "");
      const userName =
        data.globalName || data.userName || data.username || "Usuário";

      if (userId === currentUserId || userName === currentUserName) {
        return;
      }

      setTypingUsers((current) =>
        current.includes(userName) ? current : [...current, userName],
      );

      const timeout = Math.max(
        500,
        Math.min(
          10_000,
          Number(data.expiresAt ?? Date.now() + 3_000) - Date.now(),
        ),
      );

      window.setTimeout(() => {
        setTypingUsers((current) =>
          current.filter((name) => name !== userName),
        );
      }, timeout);
    };

    if (isDirect) {
      const matchesConversation = (data: any) =>
        String(data?.conversationId ?? data?.message?.conversationId ?? "") ===
        String(channel.id);

      const removeCreate = onGatewayEvent<any>("MESSAGE_CREATE", ({ data }) => {
        if (!matchesConversation(data)) {
          return;
        }

        appendMessage(data?.message ?? data);
      });

      const removeUpdate = onGatewayEvent<any>("MESSAGE_UPDATE", ({ data }) => {
        if (!matchesConversation(data)) {
          return;
        }

        applyMessageUpdate(data);
      });

      const removeDelete = onGatewayEvent<any>("MESSAGE_DELETE", ({ data }) => {
        if (!matchesConversation(data)) {
          return;
        }

        applyMessageDelete(data);
      });

      const removeTyping = onGatewayEvent<any>("TYPING_START", ({ data }) => {
        if (!matchesConversation(data)) {
          return;
        }

        showTyping(data);
      });

      return () => {
        disposed = true;
        removeCreate();
        removeUpdate();
        removeDelete();
        removeTyping();
      };
    }

    const removeCreate = onGatewayEvent<any>("MESSAGE_CREATE", ({ data }) => {
      const eventChannelId =
        data?.channelId ?? data?.message?.channelId ?? null;

      if (
        eventChannelId &&
        String(eventChannelId) !== String(channel.id)
      ) {
        return;
      }

      const incomingMessage = data?.message ?? data;

      if (!incomingMessage?.id) {
        console.warn("[CHAT_MESSAGE_CREATE_INVALID]", data);
        return;
      }

      appendMessage(incomingMessage);
    });

    const removeUpdate = onGatewayEvent<any>("MESSAGE_UPDATE", ({ data }) => {
      const eventChannelId =
        data?.channelId ?? data?.message?.channelId ?? null;

      if (
        eventChannelId &&
        String(eventChannelId) !== String(channel.id)
      ) {
        return;
      }

      applyMessageUpdate(data);
    });

    const removeDelete = onGatewayEvent<any>("MESSAGE_DELETE", ({ data }) => {
      if (
        data?.channelId &&
        String(data.channelId) !== String(channel.id)
      ) {
        return;
      }

      applyMessageDelete(data);
    });

    const removeTyping = onGatewayEvent<any>("TYPING_START", ({ data }) => {
      if (String(data?.channelId ?? "") !== String(channel.id)) {
        return;
      }

      showTyping(data);
    });

    void subscribeChannel(String(channel.id))
      .then(() => {
        if (!disposed) {
          console.log("[CHAT_GATEWAY_READY]", channel.id);
        }
      })
      .catch((error) => {
        if (!disposed) {
          console.error("[CHAT_GATEWAY_SUBSCRIBE]", error);
        }
      });

    return () => {
      disposed = true;
      removeCreate();
      removeUpdate();
      removeDelete();
      removeTyping();
      void unsubscribeChannel(String(channel.id));
    };
  }, [
    channel?.id,
    isDirect,
    currentUserId,
    currentUserName,
    fetchMessages,
    scrollToBottom,
  ]);

  useEffect(() => {
    if (!isLoading && !isLoadingMore && messages.length > 0) {
      scrollToBottom("auto");
    }
  }, [channel?.id]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;

    if (
      target.scrollTop !== 0 ||
      !hasMore ||
      isLoadingMore ||
      messages.length === 0
    ) {
      return;
    }

    prevScrollHeightRef.current = target.scrollHeight;

    const cursor = isDirect ? messages[0].createdAt : messages[0].id;

    void fetchMessages(cursor).then(() => {
      const container = chatContainerRef.current;

      if (!container) {
        return;
      }

      const newScrollHeight = container.scrollHeight;
      container.scrollTop = newScrollHeight - prevScrollHeightRef.current;
    });
  };

  const updateMentionSuggestions = (value: string, cursorPosition: number) => {
    const beforeCursor = value.slice(0, cursorPosition);
    const match = beforeCursor.match(/(?:^|\s)([@#])([^\s@#]*)$/);

    if (!match) {
      setMentionSuggestions([]);
      return;
    }

    const trigger = match[1];
    const query = match[2].toLowerCase();
    const suggestions: MentionSuggestion[] = [];

    if (trigger === "@") {
      usersList.forEach((user: any) => {
        const id = String(user?.id ?? user?.userId ?? "");
        const name =
          user?.globalName ||
          user?.displayName ||
          user?.username ||
          user?.name ||
          "";

        if (!id || !name) {
          return;
        }

        if (!query || name.toLowerCase().includes(query)) {
          suggestions.push({
            id,
            name,
            type: "user",
            avatarUrl:
              user?.avatarUrl ?? user?.avatar ?? user?.imageUrl ?? null,
          });
        }
      });
    }

    if (trigger === "#" && !isDirect) {
      channelsList.forEach((item: any) => {
        const id = String(item?.id ?? "");
        const name = item?.name || "";

        if (!id || !name) {
          return;
        }

        if (!query || name.toLowerCase().includes(query)) {
          suggestions.push({
            id,
            name,
            type: "channel",
          });
        }
      });
    }

    setMentionSuggestions(suggestions.slice(0, 8));
    setMentionIndex(0);
  };

  const selectMention = (suggestion: MentionSuggestion) => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    const cursor = textarea.selectionStart;
    const before = inputValue.slice(0, cursor);
    const after = inputValue.slice(cursor);
    const match = before.match(/(?:^|\s)([@#])([^\s@#]*)$/);

    if (!match) {
      return;
    }

    const start = before.length - match[0].length;
    const leadingWhitespace = match[0].match(/^\s/) ? match[0][0] : "";
    const prefix = before.slice(0, start) + leadingWhitespace;
    const token =
      suggestion.type === "user"
        ? `<@${suggestion.id}>`
        : `<#${suggestion.id}>`;
    const newValue = `${prefix}${token} ${after}`;

    setInputValue(newValue);
    setMentionSuggestions([]);
    textarea.focus();

    requestAnimationFrame(() => {
      const position = prefix.length + token.length + 1;
      textarea.setSelectionRange(position, position);
    });
  };

  const sendMessage = async (
    text = inputValue.trim(),
    attachments: any[] = [],
    extraPayload: Record<string, unknown> = {},
  ) => {
    if (!channel?.id) {
      return;
    }

    if (!text && attachments.length === 0 && Object.keys(extraPayload).length === 0) {
      return;
    }

    const currentReply = replyingTo;

    setInputValue("");
    setReplyingTo(null);
    setMentionSuggestions([]);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      if (isDirect) {
        const directAttachments = attachments.map((attachment: any) => ({
          url: attachment.url,
          filename: attachment.filename || attachment.name || "arquivo",
          fileSize: attachment.fileSize ?? attachment.size ?? 0,
          fileType:
            attachment.fileType ||
            attachment.contentType ||
            "application/octet-stream",
        }));

        const response = await fetch(
          `/api/direct-messages/conversations/${channel.id}/messages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
        body: JSON.stringify({
          content: text,
          replyToId: currentReply?.id ?? null,
          attachments: directAttachments,
          ...extraPayload,
        }),
          },
        );

        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.success || !data?.message) {
          throw new Error(
            data?.message || "Não foi possível enviar a mensagem.",
          );
        }

        const sentMessage = normalizeMessage(data.message);

        setMessages((current) => {
          if (current.some((message) => message.id === sentMessage.id)) {
            return current;
          }

          return [...current, sentMessage];
        });

        await onDirectConversationChanged?.();
        scrollToBottom("smooth");
        return;
      }

      const embeds = await generateLinkEmbeds(text);

      const payload = {
        content: text,
        reply: currentReply
          ? {
              messageId: currentReply.id,
              author: currentReply.author,
              content: currentReply.content,
              avatarUrl: currentReply.avatarUrl ?? null,
            }
          : null,
        attachments,
        embeds,
        ...extraPayload,
      };

      const sent = await sendMessageAction(
        channel.id,
        JSON.stringify(payload),
      );

      const normalizedSent = normalizeMessage(sent);

      setMessages((current) => {
        if (current.some((message) => message.id === normalizedSent.id)) {
          return current;
        }

        return [...current, normalizedSent];
      });

      scrollToBottom("smooth");
    } catch (error) {
      console.error("[CHAT_MESSAGE_SEND]", error);

      pushToast({
        type: "error",
        title: "Mensagem não enviada",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível enviar a mensagem.",
      });
    }
  };

  const sendPoll = async () => {
    const options = pollOptions.map((option) => option.trim()).filter(Boolean);
    if (!pollQuestion.trim() || options.length < 2) {
      pushToast({
        type: "error",
        title: "Enquete incompleta",
        description: "A enquete precisa de uma pergunta e pelo menos duas opções.",
      });
      return;
    }

    await sendMessage("", [], {
      poll: {
        question: pollQuestion.trim(),
        options,
        allowMultiple: pollAllowMultiple,
      },
    });

    setPollQuestion("");
    setPollOptions(["", ""]);
    setPollAllowMultiple(false);
    setIsPollOpen(false);
  };

  const reactToMessage = async (message: MessageData, emoji: string) => {
    const url = isDirect
      ? `/api/direct-messages/messages/${encodeURIComponent(message.id)}/reactions`
      : `/api/messages/${encodeURIComponent(message.id)}/reactions`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Não foi possível reagir.");
      }

      if (Array.isArray(data.reactions)) {
        setMessages((current) =>
          current.map((item) =>
            item.id === message.id ? { ...item, reactions: data.reactions } : item,
          ),
        );
      } else if (data.message) {
        const updated = normalizeMessage(data.message);
        setMessages((current) =>
          current.map((item) => (item.id === message.id ? { ...item, ...updated } : item)),
        );
      }
    } catch (error) {
      pushToast({
        type: "error",
        title: "Reação não enviada",
        description: error instanceof Error ? error.message : "Não foi possível reagir.",
      });
    }
  };

  const votePoll = async (message: MessageData, optionId: string) => {
    try {
      const response = await fetch(
        `/api/poll-options/${encodeURIComponent(optionId)}/votes`,
        { method: "POST" },
      );
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success || !data.poll) {
        throw new Error(data?.message || "Não foi possível votar.");
      }

      setMessages((current) =>
        current.map((item) =>
          item.id === message.id ? { ...item, poll: data.poll } : item,
        ),
      );
    } catch (error) {
      pushToast({
        type: "error",
        title: "Voto não registrado",
        description: error instanceof Error ? error.message : "Não foi possível votar.",
      });
    }
  };

  const togglePin = async (message: MessageData) => {
    try {
      const response = await fetch(
        `/api/messages/${encodeURIComponent(message.id)}/pin`,
        { method: message.isPinned ? "DELETE" : "POST" },
      );
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Não foi possível atualizar o pin.");
      }

      if (data.message) {
        const updated = normalizeMessage(data.message);
        setMessages((current) =>
          current.map((item) =>
            item.id === message.id
              ? {
                  ...item,
                  isPinned: updated.isPinned,
                }
              : item,
          ),
        );
      } else {
        setMessages((current) =>
          current.map((item) =>
            item.id === message.id ? { ...item, isPinned: !message.isPinned } : item,
          ),
        );
      }
      pushToast({
        type: "success",
        title: message.isPinned ? "Mensagem desafixada" : "Mensagem fixada",
      });
    } catch (error) {
      pushToast({
        type: "error",
        title: "Pin não atualizado",
        description: error instanceof Error ? error.message : "Não foi possível atualizar o pin.",
      });
    }
  };

  const beginEditMessage = (message: MessageData) => {
    if (isDirect) return;
    setEditingMessage(message);
    setReplyingTo(null);
    setInputValue(message.content);
    setMentionSuggestions([]);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(message.content.length, message.content.length);
    });
  };

  const cancelEditMessage = () => {
    setEditingMessage(null);
    setInputValue("");
    setMentionSuggestions([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const submitEditMessage = async () => {
    if (!editingMessage || isDirect || isEditingMessage) return;
    const nextContent = inputValue.trim();
    if (!nextContent) {
      pushToast({
        type: "error",
        title: "Mensagem vazia",
        description: "Digite algum conteúdo para salvar a edição.",
      });
      return;
    }

    try {
      setIsEditingMessage(true);
      const response = await fetch(`/api/messages/${encodeURIComponent(editingMessage.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: nextContent }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success || !data.message) {
        throw new Error(data?.message || "Não foi possível editar a mensagem.");
      }

      const updated = normalizeMessage(data.message);
      setMessages((current) =>
        current.map((item) =>
          item.id === editingMessage.id
            ? {
                ...item,
                ...updated,
                author: item.author,
                authorId: item.authorId,
                avatarUrl: item.avatarUrl,
              }
            : item,
        ),
      );
      setEditingMessage(null);
      setInputValue("");
      pushToast({ type: "success", title: "Mensagem editada" });
    } catch (error) {
      pushToast({
        type: "error",
        title: "Mensagem não editada",
        description: error instanceof Error ? error.message : "Não foi possível editar a mensagem.",
      });
    } finally {
      setIsEditingMessage(false);
    }
  };

  const visibleMessages = showPinnedOnly
    ? messages.filter((message) => message.isPinned && !message.deleted)
    : messages;

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    const cursorPosition = event.target.selectionStart;

    setInputValue(value);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        250,
      )}px`;
    }

    updateMentionSuggestions(value, cursorPosition);

    const now = Date.now();

    if (now - lastTypedRef.current <= 2000 || !channel?.id) {
      return;
    }

    lastTypedRef.current = now;

    if (isDirect) {
      fetch("/api/direct-messages/typing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: channel.id,
          userName: currentUserName,
        }),
      }).catch(() => {});

      return;
    }

    void sendTyping(String(channel.id)).catch(() => {});
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionSuggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionIndex((current) =>
          Math.min(current + 1, mentionSuggestions.length - 1),
        );
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === "Tab" || event.key === "Enter") {
        event.preventDefault();
        const suggestion = mentionSuggestions[mentionIndex];

        if (suggestion) {
          selectMention(suggestion);
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setMentionSuggestions([]);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();

      if (editingMessage) {
        void submitEditMessage();
        return;
      }

      if (inputValue.trim() !== "" || replyingTo) {
        void sendMessage();
      }
    }
  };

  const uploadFile = async (file: File) => {
    const uploadId = crypto.randomUUID();

    setIsUploading(true);
    setUploadingFiles((current) => [
      ...current,
      {
        id: uploadId,
        name: file.name,
        progress: 0,
      },
    ]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Falha no upload");
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Falha no upload");
      }

      const uploadUrl = data.url || data.publicUrl || null;

      if (isDirect && !uploadUrl) {
        throw new Error(
          "A API de upload não retornou a URL pública do arquivo.",
        );
      }

      const attachment = {
        id: crypto.randomUUID(),
        key: data.key,
        url: uploadUrl,
        name: data.name || file.name,
        filename: data.name || file.name,
        size: data.size ?? file.size,
        fileSize: data.size ?? file.size,
        contentType:
          data.contentType || file.type || "application/octet-stream",
        fileType:
          data.contentType || file.type || "application/octet-stream",
      };

      setUploadingFiles((current) =>
        current.map((item) =>
          item.id === uploadId
            ? {
                ...item,
                progress: 100,
              }
            : item,
        ),
      );

      await sendMessage(inputValue.trim(), [attachment]);
    } catch (error) {
      console.error("[CHAT_UPLOAD]", error);
      pushToast({
        type: "error",
        title: "Upload não iniciado",
        description: `Não foi possível enviar ${file.name}.`,
      });
    } finally {
      setIsUploading(false);

      window.setTimeout(() => {
        setUploadingFiles((current) =>
          current.filter((item) => item.id !== uploadId),
        );
      }, 500);
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const maxSize = 25 * 1024 * 1024;

    for (const file of list) {
      if (file.size > maxSize) {
        pushToast({
          type: "error",
          title: "Arquivo muito grande",
          description: `${file.name} é maior que 25 MB.`,
        });
        continue;
      }

      await uploadFile(file);
    }
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      void handleFiles(event.target.files);
    }

    event.target.value = "";
  };

  const handleVoiceInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      pushToast({
        type: "error",
        title: "Áudio inválido",
        description: "Selecione um arquivo de áudio.",
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      pushToast({
        type: "error",
        title: "Áudio muito grande",
        description: `${file.name} é maior que 10 MB.`,
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success || !data.key) {
        throw new Error(data?.message || "Falha no upload do áudio.");
      }

      await sendMessage("", [], {
        voiceMessage: {
          key: data.key,
          url: data.key,
          durationSeconds: 1,
        },
      });
    } catch (error) {
      pushToast({
        type: "error",
        title: "Áudio não enviado",
        description: error instanceof Error ? error.message : "Não foi possível enviar o áudio.",
      });
    }
  };

  const handleSendMedia = (url: string) => {
    void sendMessage(`![GIF](${url})`);
    setIsGifOpen(false);
  };

  const handleSelectEmoji = (emojiData: any) => {
    setInputValue((current) => current + emojiData.emoji);
    textareaRef.current?.focus();
  };

  const toggleGif = () => {
    const shouldOpen = !isGifOpen || isEmojiOpen || isStickerOpen;
    setIsGifOpen(shouldOpen);
    setIsEmojiOpen(false);
    setIsStickerOpen(false);
    setIsPollOpen(false);
    setIsAttachmentMenuOpen(false);
  };

  const toggleEmoji = () => {
    const shouldOpen = !isEmojiOpen || isGifOpen || isStickerOpen;
    setIsEmojiOpen(shouldOpen);
    setIsGifOpen(false);
    setIsStickerOpen(false);
    setIsPollOpen(false);
    setIsAttachmentMenuOpen(false);
  };

  const toggleSticker = () => {
    const shouldOpen = !isStickerOpen || isGifOpen || isEmojiOpen;
    setIsStickerOpen(shouldOpen);
    setIsGifOpen(false);
    setIsEmojiOpen(false);
    setIsPollOpen(false);
    setIsAttachmentMenuOpen(false);
  };

  const createThread = async () => {
    if (isDirect || !channel?.id) return;
    const name = `Thread de ${currentUserName}`;

    try {
      const response = await fetch(`/api/channels/${encodeURIComponent(channel.id)}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, private: false }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || "Não foi possível criar a thread.");
      }
    } catch (error) {
      pushToast({
        type: "error",
        title: "Thread não criada",
        description: error instanceof Error ? error.message : "Não foi possível criar a thread.",
      });
    }
  };

  if (!isMounted) {
    return null;
  }

  return (
    <div
      className="relative flex min-w-0 flex-1 flex-col bg-transparent"
      onClick={() => setActiveMenuMessageId(null)}
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-stone-300 px-4 shadow-sm dark:border-zinc-800/50">
        <button
          type="button"
          onClick={() => {
            if (isDirect) {
              onOpenDetails?.();
            }
          }}
          className={`flex min-w-0 items-center gap-2 font-semibold text-zinc-800 dark:text-zinc-100 ${
            isDirect && onOpenDetails ? "cursor-pointer" : "cursor-default"
          }`}
        >
          {isDirect ? (
            channel.avatarUrl ? (
              <img
                src={channel.avatarUrl}
                alt=""
                className="h-7 w-7 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white">
                {String(channel.name || "?").charAt(0).toUpperCase()}
              </div>
            )
          ) : (
            <Hash className="h-5 w-5 shrink-0 text-zinc-500" />
          )}

          <span className="truncate">{channel.name}</span>
        </button>

        <div className="flex shrink-0 items-center gap-4 text-zinc-500 dark:text-zinc-400">
          {!isDirect && (
            <>
              <Bell className="h-5 w-5 cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200" />
              <button
                type="button"
                onClick={() => setShowPinnedOnly((current) => !current)}
                className={showPinnedOnly ? "rounded-sm text-indigo-500" : "rounded-sm hover:text-zinc-800 dark:hover:text-zinc-200"}
                title={showPinnedOnly ? "Mostrar todas as mensagens" : "Mostrar mensagens fixadas"}
              >
                <Pin className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => void createThread()}
                className="rounded-sm hover:text-zinc-800 dark:hover:text-zinc-200"
                title="Criar thread"
              >
                <Hash className="h-5 w-5" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={isDirect ? onOpenDetails : undefined}
            className="rounded-sm hover:text-zinc-800 dark:hover:text-zinc-200"
            title={
              isDirect
                ? channel.directType === "GROUP"
                  ? "Configurações do grupo"
                  : "Ver perfil"
                : "Membros"
            }
          >
            <Users className="h-5 w-5" />
          </button>

          <SearchCommand items={commandItems} />
        </div>
      </div>

      {gatewayStatus.state !== "connected" && (
        <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-700 dark:text-amber-200">
          {gatewayStatus.state === "connecting"
            ? "Conectando ao realtime..."
            : gatewayStatus.state === "reconnecting"
              ? "Reconectando ao realtime..."
              : gatewayStatus.message || "Realtime indisponível no momento."}
        </div>
      )}

      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="custom-scrollbar typecord-chat-list min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4"
      >
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
          </div>
        ) : (
          <div className="flex flex-col gap-4 pt-2">
            {isLoadingMore && (
              <div className="flex justify-center py-2">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
              </div>
            )}

            {showPinnedOnly && visibleMessages.length === 0 && (
              <div className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500 dark:border-zinc-700">
                Nenhuma mensagem fixada neste canal.
              </div>
            )}

            {loadError && visibleMessages.length === 0 && (
              <div className="rounded-lg border border-red-400/20 bg-red-500/10 p-4 text-center text-sm text-red-600 dark:text-red-300">
                {loadError}
                <button
                  type="button"
                  onClick={() => void fetchMessages()}
                  className="ml-3 font-bold underline underline-offset-2"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {visibleMessages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                users={usersList}
                channels={channelsList}
                currentUserId={currentUserId}
                isMenuOpen={activeMenuMessageId === message.id}
                onReply={(messageToReply) => {
                  setReplyingTo(messageToReply);
                  textareaRef.current?.focus();
                }}
                onMenu={(id) => setActiveMenuMessageId(id || null)}
                onCopy={(text) => {
                  void navigator.clipboard.writeText(text);
                  setActiveMenuMessageId(null);
                }}
                onReact={(messageToReact) => void reactToMessage(messageToReact, "👍")}
                onQuickReact={(messageToReact, emoji) => void reactToMessage(messageToReact, emoji)}
                onPollVote={(messageWithPoll, optionId) => void votePoll(messageWithPoll, optionId)}
                onTogglePin={!isDirect ? (messageToPin) => void togglePin(messageToPin) : undefined}
                onEdit={!isDirect ? (messageToEdit) => beginEditMessage(messageToEdit) : undefined}
                getDeleteUrl={(messageToDelete) =>
                  isDirect
                    ? `/api/direct-messages/messages/${encodeURIComponent(messageToDelete.id)}`
                    : `/api/messages/${encodeURIComponent(messageToDelete.id)}`
                }
                onDeleted={(messageId) => {
                  setMessages((current) => current.filter((item) => item.id !== messageId));
                }}
              />
            ))}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="relative shrink-0 p-4 pt-1">
        <div className="mb-1 flex h-5 items-center gap-1.5 px-1 text-xs text-zinc-500 dark:text-zinc-400">
          {typingUsers.length > 0 && (
            <>
              <div className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" />
              </div>

              <span className="truncate font-semibold">
                {typingUsers.length === 1
                  ? `${typingUsers[0]} está digitando...`
                  : "Várias pessoas estão digitando..."}
              </span>
            </>
          )}
        </div>

        {mentionSuggestions.length > 0 && (
          <div className="absolute bottom-[82px] left-4 z-50 w-[320px] max-w-[calc(100%-2rem)] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-[#2b2d31]">
            <div className="border-b border-zinc-200 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:border-zinc-700">
              {mentionSuggestions[0].type === "user" ? "Membros" : "Canais"}
            </div>

            {mentionSuggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.type}-${suggestion.id}`}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectMention(suggestion);
                }}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left ${
                  index === mentionIndex
                    ? "bg-indigo-500 text-white"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {suggestion.type === "user" ? (
                  suggestion.avatarUrl ? (
                    <Avatar avatarUrl={suggestion.avatarUrl} />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white">
                      {suggestion.name.charAt(0).toUpperCase()}
                    </div>
                  )
                ) : (
                  <Hash className="h-5 w-5 shrink-0 opacity-70" />
                )}

                <span className="truncate text-sm font-medium">
                  {suggestion.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {isAttachmentMenuOpen && (
          <div className="absolute bottom-[80px] left-4 z-50 w-64 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-2xl dark:border-zinc-700 dark:bg-[#2b2d31]">
            <button
              type="button"
              onClick={() => {
                setIsAttachmentMenuOpen(false);
                fileInputRef.current?.click();
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <FilePlus2 className="h-4 w-4 text-zinc-500" />
              Enviar arquivo
            </button>
            {!isDirect && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsAttachmentMenuOpen(false);
                    voiceInputRef.current?.click();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  <Mic className="h-4 w-4 text-zinc-500" />
                  Mensagem de voz
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAttachmentMenuOpen(false);
                    setIsPollOpen((current) => !current);
                    setIsGifOpen(false);
                    setIsEmojiOpen(false);
                    setIsStickerOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  <Pin className="h-4 w-4 text-zinc-500" />
                  Criar enquete
                </button>
              </>
            )}
          </div>
        )}

        {(isGifOpen || isStickerOpen || isEmojiOpen) && (
          <div className="absolute bottom-[80px] right-4 z-50 w-[380px] max-w-[calc(100%-2rem)] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-[#2b2d31]">
            <div className="flex border-b border-zinc-200 p-1 dark:border-zinc-700">
              <button
                type="button"
                onClick={toggleGif}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${isGifOpen ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-white" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"}`}
              >
                GIFs
              </button>
              {!isDirect && (
                <button
                  type="button"
                  onClick={toggleSticker}
                  className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${isStickerOpen ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-white" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"}`}
                >
                  Stickers
                </button>
              )}
              <button
                type="button"
                onClick={toggleEmoji}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${isEmojiOpen ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-white" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"}`}
              >
                Emojis
              </button>
            </div>

            {isGifOpen && <GifPicker onSendGif={handleSendMedia} />}

            {isStickerOpen && !isDirect && (
              <div className="p-3">
                {stickers.length > 0 ? (
                  <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto">
                    {stickers.map((sticker: any) => {
                      const url = String(sticker.url ?? "");
                      const src = url.startsWith("/api/files") || url.startsWith("http")
                        ? url
                        : `/api/files?key=${encodeURIComponent(url)}`;

                      return (
                        <button
                          key={sticker.id}
                          type="button"
                          onClick={() => {
                            void sendMessage(`![${sticker.name}](${src})`);
                            setIsStickerOpen(false);
                          }}
                          className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 hover:border-indigo-300 dark:border-zinc-700 dark:bg-[#111214]"
                          title={sticker.name}
                        >
                          <img src={src} alt="" className="aspect-square w-full object-contain" />
                          <span className="mt-1 block truncate text-[10px] font-semibold text-zinc-500">
                            {sticker.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-zinc-300 p-5 text-center text-xs text-zinc-500 dark:border-zinc-700">
                    Nenhum sticker criado ainda.
                  </div>
                )}
              </div>
            )}

            {isEmojiOpen && (
              <div className="p-2">
                <EmojiPicker
                  onEmojiClick={handleSelectEmoji}
                  theme={Theme.AUTO}
                  lazyLoadEmojis
                />
              </div>
            )}
          </div>
        )}

        {isPollOpen && !isDirect && (
          <div className="absolute bottom-[80px] right-4 z-50 w-[360px] max-w-[calc(100%-2rem)] rounded-xl border border-zinc-200 bg-white p-4 shadow-2xl dark:border-zinc-700 dark:bg-[#2b2d31]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                Nova enquete
              </h3>
              <button
                type="button"
                onClick={() => setIsPollOpen(false)}
                className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                aria-label="Fechar enquete"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              value={pollQuestion}
              onChange={(event) => setPollQuestion(event.target.value)}
              maxLength={300}
              placeholder="Pergunta"
              className="mb-2 h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-[#111214] dark:text-white"
            />
            <div className="space-y-2">
              {pollOptions.map((option, index) => (
                <input
                  key={index}
                  value={option}
                  onChange={(event) =>
                    setPollOptions((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? event.target.value : item,
                      ),
                    )
                  }
                  maxLength={120}
                  placeholder={`Opção ${index + 1}`}
                  className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-[#111214] dark:text-white"
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setPollOptions((current) => [...current, ""])}
                disabled={pollOptions.length >= 10}
                className="text-xs font-semibold text-indigo-500 disabled:opacity-50"
              >
                Adicionar opção
              </button>
              <label className="flex items-center gap-2 text-xs text-zinc-500">
                <input
                  type="checkbox"
                  checked={pollAllowMultiple}
                  onChange={(event) => setPollAllowMultiple(event.target.checked)}
                />
                Múltipla escolha
              </label>
            </div>
            <button
              type="button"
              onClick={() => void sendPoll()}
              className="mt-4 flex h-10 w-full items-center justify-center rounded-lg bg-indigo-500 text-sm font-bold text-white hover:bg-indigo-400"
            >
              Enviar enquete
            </button>
          </div>
        )}

        <div className="typecord-composer flex flex-col rounded-lg bg-stone-300/50 px-3 py-2 dark:bg-[#383a40]">
          {replyingTo && (
            <div className="flex items-center gap-2 border-b border-stone-400/20 pb-2 text-xs dark:border-zinc-700/50">
              <Reply className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
              <span className="text-zinc-500">Respondendo a</span>
              <strong className="min-w-0 truncate text-zinc-700 dark:text-zinc-200">
                {replyingTo.author}
              </strong>

              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="ml-auto shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-300 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {editingMessage && (
            <div className="flex items-center gap-2 border-b border-stone-400/20 pb-2 text-xs dark:border-zinc-700/50">
              <Pin className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
              <span className="text-zinc-500">Editando mensagem</span>
              <strong className="min-w-0 truncate text-zinc-700 dark:text-zinc-200">
                Enter para salvar
              </strong>

              <button
                type="button"
                onClick={cancelEditMessage}
                disabled={isEditingMessage}
                className="ml-auto shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-300 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-700 dark:hover:text-white"
                title="Cancelar edição"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {uploadingFiles.length > 0 && (
            <div className="mb-2 border-b border-zinc-400/20 pb-2">
              {uploadingFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-2 text-xs text-zinc-500"
                >
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  <span className="min-w-0 flex-1 truncate">
                    Enviando {file.name}...
                  </span>
                  <span className="shrink-0">{file.progress}%</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex min-h-[44px] w-full items-center gap-3">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => {
                setIsAttachmentMenuOpen((current) => !current);
                setIsGifOpen(false);
                setIsEmojiOpen(false);
                setIsStickerOpen(false);
                setIsPollOpen(false);
              }}
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition disabled:opacity-50 ${
                isAttachmentMenuOpen
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-300 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-600 dark:hover:text-zinc-200"
              }`}
              title="Adicionar"
            >
              <Plus className="h-5 w-5" />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />

            <input
              ref={voiceInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleVoiceInput}
            />

            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              maxLength={8000}
              rows={1}
              placeholder={
                editingMessage
                  ? "Editar mensagem..."
                  : replyingTo
                  ? `Responder a ${replyingTo.author}...`
                  : isDirect
                    ? `Mensagem para ${channel.name}`
                    : `Conversar em #${channel.name}`
              }
              className="custom-scrollbar min-w-0 flex-1 resize-none self-center bg-transparent text-sm leading-5 text-zinc-900 outline-none placeholder:text-zinc-500 dark:text-zinc-100 dark:placeholder:text-zinc-400"
            />

            {editingMessage && (
              <button
                type="button"
                disabled={isEditingMessage || !inputValue.trim()}
                onClick={() => void submitEditMessage()}
                className="flex h-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isEditingMessage ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Salvar"
                )}
              </button>
            )}

            <div className="flex shrink-0 items-center gap-3 text-zinc-500 dark:text-zinc-400">
              <button
                type="button"
                onClick={toggleGif}
                className={`flex h-8 items-center gap-1.5 rounded px-2 text-xs font-bold ${
                  isGifOpen || isStickerOpen || isEmojiOpen
                    ? "bg-zinc-300 text-zinc-900 dark:bg-zinc-600 dark:text-zinc-100"
                    : "hover:bg-zinc-300 hover:text-zinc-800 dark:hover:bg-zinc-600 dark:hover:text-zinc-200"
                }`}
                title="GIFs, stickers e emojis"
              >
                <Gift className="h-4 w-4" />
                GIF
              </button>
              <button
                type="button"
                onClick={toggleSticker}
                className="rounded p-1 hover:bg-zinc-300 hover:text-zinc-800 dark:hover:bg-zinc-600 dark:hover:text-zinc-200"
                title="Stickers"
              >
                <Sticker className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={toggleEmoji}
                className="rounded p-1 hover:bg-zinc-300 hover:text-zinc-800 dark:hover:bg-zinc-600 dark:hover:text-zinc-200"
                title="Emojis"
              >
                <Smile className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
