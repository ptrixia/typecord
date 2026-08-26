

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Gift,
  Hash,
  Loader2,
  Pin,
  Plus,
  Reply,
  Smile,
  Users,
  X,
} from "lucide-react";
import EmojiPicker, { Theme } from "emoji-picker-react";

import type { MessageEmbedData } from "../Message/MessageEmbed";
import MessageItem, { MessageData } from "../Message/MessageItem";
import Avatar from "../Image/Avatar";
import SearchCommand from "../SearchCommand";
import GifPicker from "./GifPicker";

import { sendMessageAction } from "@/actions/messages";
import { pusherClient } from "@/lib/pusher";
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
  mode: TextChatMode;
  onOpenDetails?: () => void;
  onDirectConversationChanged?: () => Promise<void> | void;
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
    isPending: Boolean(parsed.isPending),
    isBot,
    isBotVerified,
    isWebhook: isWebhookMessage,
    ...(parsed.deleted ? { deleted: true } : {}),
  } as MessageData;
}

function mergeMessages(current: MessageData[], incoming: MessageData[]) {
  const map = new Map<string, MessageData>();

  for (const message of current) {
    map.set(message.id, message);
  }

  for (const message of incoming) {
    map.set(message.id, message);
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(a.createdAt ?? 0).getTime() -
      new Date(b.createdAt ?? 0).getTime(),
  );
}

export default function TextChatArea({
  channel,
  currentUser,
  users,
  channels,
  mode,
  onOpenDetails,
  onDirectConversationChanged,
}: TextChatAreaProps) {
  const isDirect = mode === "direct";

  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isGifOpen, setIsGifOpen] = useState(false);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MessageData | null>(null);
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
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [channel?.id, isDirect],
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
    setMentionSuggestions([]);
    setActiveMenuMessageId(null);
    setIsGifOpen(false);
    setIsEmojiOpen(false);

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

      setMessages((current) =>
        current.map((message) =>
          message.id === updatedMessage.id
            ? {
                ...message,
                ...updatedMessage,
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
        current.map((message) =>
          message.id === messageId
            ? ({
                ...message,
                content: "",
                deleted: true,
              } as MessageData)
            : message,
        ),
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
      const pusherChannelName = `direct-conversation-${channel.id}`;
      const pusherChannel = pusherClient.subscribe(pusherChannelName);

      const handleMessagesChanged = () => {
        fetch(
          `/api/direct-messages/conversations/${channel.id}/messages?limit=50`,
          { cache: "no-store" },
        )
          .then((response) => response.json())
          .then((data) => {
            if (!data?.success || !Array.isArray(data.messages)) {
              return;
            }

            const latest = data.messages.map(normalizeMessage);
            setMessages((current) => mergeMessages(current, latest));
          })
          .catch(() => {});
      };

      pusherChannel.bind("new-message", appendMessage);
      pusherChannel.bind("typing", showTyping);
      pusherChannel.bind("messages-changed", handleMessagesChanged);

      return () => {
        disposed = true;
        pusherChannel.unbind("new-message", appendMessage);
        pusherChannel.unbind("typing", showTyping);
        pusherChannel.unbind("messages-changed", handleMessagesChanged);
        pusherClient.unsubscribe(pusherChannelName);
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
  ) => {
    if (!channel?.id) {
      return;
    }

    if (!text && attachments.length === 0) {
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

      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a mensagem.",
      );
    }
  };

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
      alert(`Não foi possível enviar ${file.name}`);
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
        alert(`${file.name} é maior que 25 MB.`);
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

  const handleSendMedia = (url: string) => {
    void sendMessage(`![GIF](${url})`);
    setIsGifOpen(false);
  };

  const handleSelectEmoji = (emojiData: any) => {
    setInputValue((current) => current + emojiData.emoji);
    textareaRef.current?.focus();
  };

  const toggleGif = () => {
    setIsGifOpen((current) => !current);
    setIsEmojiOpen(false);
  };

  const toggleEmoji = () => {
    setIsEmojiOpen((current) => !current);
    setIsGifOpen(false);
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
              <Pin className="h-5 w-5 cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200" />
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

          <SearchCommand />
        </div>
      </div>

      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="custom-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4"
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

            {messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                users={usersList}
                channels={channelsList}
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
                onReact={() => {}}
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

        {isGifOpen && (
          <div className="absolute bottom-[80px] right-24 z-50">
            <GifPicker onSendGif={handleSendMedia} />
          </div>
        )}

        {isEmojiOpen && (
          <div className="absolute bottom-[80px] right-4 z-50 shadow-xl">
            <EmojiPicker
              onEmojiClick={handleSelectEmoji}
              theme={Theme.AUTO}
              lazyLoadEmojis
            />
          </div>
        )}

        <div className="flex flex-col rounded-lg bg-stone-300/50 px-3 py-2 dark:bg-[#383a40]">
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
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 text-zinc-500 hover:text-zinc-800 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-200"
              title="Enviar arquivo"
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

            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              maxLength={8000}
              rows={1}
              placeholder={
                replyingTo
                  ? `Responder a ${replyingTo.author}...`
                  : isDirect
                    ? `Mensagem para ${channel.name}`
                    : `Conversar em #${channel.name}`
              }
              className="custom-scrollbar min-w-0 flex-1 resize-none self-center bg-transparent text-sm leading-5 text-zinc-900 outline-none placeholder:text-zinc-500 dark:text-zinc-100 dark:placeholder:text-zinc-400"
            />

            <div className="flex shrink-0 items-center gap-3 text-zinc-500 dark:text-zinc-400">
              <Gift className="h-5 w-5 cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200" />

              <button
                type="button"
                onClick={toggleGif}
                className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                  isGifOpen
                    ? "bg-zinc-300 text-zinc-900 dark:bg-zinc-600 dark:text-zinc-100"
                    : "hover:bg-zinc-300 hover:text-zinc-800 dark:hover:bg-zinc-600 dark:hover:text-zinc-200"
                }`}
              >
                GIF
              </button>

              <Smile
                onClick={toggleEmoji}
                className={`h-5 w-5 cursor-pointer ${
                  isEmojiOpen
                    ? "text-zinc-900 dark:text-zinc-100"
                    : "hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
