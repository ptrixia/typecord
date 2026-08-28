"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Pencil,
  Pin,
  Loader2,
  MoreVertical,
  Reply,
  SmilePlus,
  Trash2,
} from "lucide-react";

import MessageContent from "./MessageContent";
import MessageReply, {
  MessageReplyData,
} from "./MessageReply";
import { MessageAttachmentData } from "./MessageAttachment";
import { MessageEmbedData } from "./MessageEmbed";
import Avatar from "../Image/Avatar";
import ClientTime from "../ClientTime";
import UserMiniProfile from "../UserMiniProfile";
import ConfirmModal from "../ConfirmModal";
import { useToast } from "../app/ToastProvider";

export interface MessageData {
  id: string;

  author: string;
  authorId?: string;

  authorColor?: string;
  avatarColor?: string;
  avatarUrl?: string | null;

  createdAt?: string;
  time?: string;

  content: string;

  reply?: MessageReplyData | null;

  attachments?: MessageAttachmentData[];
  embeds?: MessageEmbedData[];
  reactions?: Array<{
    emoji: string;
    count: number;
    reactedByMe?: boolean;
  }>;
  poll?: {
    id: string;
    question: string;
    allowMultiple?: boolean;
    expiresAt?: string | null;
    options: Array<{
      id: string;
      label: string;
      count: number;
      votedByMe?: boolean;
    }>;
  } | null;
  voiceMessage?: {
    url?: string | null;
    key?: string | null;
    durationSeconds?: number;
  } | null;
  isPinned?: boolean;
  deleted?: boolean;

  isPending?: boolean;

  isBot?: boolean;
  isBotVerified?: boolean;
  isWebhook?: boolean;
}

interface MessageItemProps {
  message: MessageData;

  users?: any[];
  channels?: any[];

  currentUserId?: string;
  canManageMessages?: boolean;

  isMenuOpen: boolean;

  onReply: (message: MessageData) => void;
  onMenu: (messageId: string) => void;
  onCopy: (text: string) => void;
  onReact: (message: MessageData) => void;
  onQuickReact?: (message: MessageData, emoji: string) => void;
  onPollVote?: (message: MessageData, optionId: string) => void;
  onTogglePin?: (message: MessageData) => void;
  onEdit?: (message: MessageData) => void;

  onDeleted?: (messageId: string) => void;
  getDeleteUrl?: (message: MessageData) => string;
}

export default function MessageItem({
  message,
  users = [],
  channels = [],
  currentUserId,
  canManageMessages = false,
  isMenuOpen,
  onReply,
  onMenu,
  onCopy,
  onReact,
  onQuickReact,
  onPollVote,
  onTogglePin,
  onEdit,
  onDeleted,
  getDeleteUrl,
}: MessageItemProps) {
  const [isDeleting, setIsDeleting] =
    useState(false);
  const [profileOpen, setProfileOpen] =
    useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] =
    useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const { pushToast } = useToast();

  const authorUser = useMemo(
    () =>
      users.find((user: any) => {
        const id = String(user?.id ?? user?.userId ?? user?.user?.id ?? "");
        return id && message.authorId && id === String(message.authorId);
      }) ??
      {
        id: message.authorId,
        username: message.author,
        globalName: message.author,
        avatarUrl: message.avatarUrl,
        status: "OFFLINE",
      },
    [message.author, message.authorId, message.avatarUrl, users],
  );

  useEffect(() => {
    if (!profileOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        itemRef.current &&
        event.target instanceof Node &&
        !itemRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [profileOpen]);

  if (message.deleted) {
    return null;
  }

  const isOwnMessage =
    Boolean(currentUserId) &&
    Boolean(message.authorId) &&
    String(message.authorId) ===
      String(currentUserId);

  const canDelete =
    !message.isPending &&
    (isOwnMessage ||
      canManageMessages);

  async function handleDelete() {
    if (
      !canDelete ||
      isDeleting
    ) {
      return;
    }

    setIsDeleting(true);

    try {
      const response =
        await fetch(
          getDeleteUrl?.(message) ??
            `/api/messages/${encodeURIComponent(
              message.id,
            )}`,
          {
            method: "DELETE",
          },
        );

      const data =
        await response
          .json()
          .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Não foi possível excluir a mensagem.",
        );
      }

      onMenu("");

      onDeleted?.(
        message.id,
      );

      setDeleteConfirmOpen(false);
    } catch (error) {
      console.error(
        "[MESSAGE_DELETE_CLIENT]",
        error,
      );

      pushToast({
        type: "error",
        title: "Mensagem não excluída",
        description:
          error instanceof Error
            ? error.message
            : "Não foi possível excluir a mensagem.",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <div
        ref={itemRef}
        className={`typecord-message-item group relative -mx-2 flex w-full gap-3 rounded-md p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${
          message.isPending
            ? "opacity-50"
            : "opacity-100"
        }`}
      >
      <div
        className={`absolute right-4 -top-3 items-center rounded-md border border-zinc-200 bg-white shadow-md dark:border-zinc-700 dark:bg-[#313338] ${
          isMenuOpen
            ? "z-50 flex"
            : "hidden group-hover:flex"
        }`}
      >
        <button
          type="button"
          onClick={() =>
            onReact(message)
          }
          className="rounded-l-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
          title="Adicionar reação"
        >
          <SmilePlus className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() =>
            onReply(message)
          }
          className="p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
          title="Responder"
        >
          <Reply className="h-4 w-4" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();

              onMenu(
                isMenuOpen
                  ? ""
                  : message.id,
              );
            }}
            className="rounded-r-md p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
            title="Mais opções"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {isMenuOpen && (
            <div
              onClick={(event) =>
                event.stopPropagation()
              }
              className="absolute right-0 top-8 z-50 w-48 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 text-xs shadow-xl dark:border-zinc-700 dark:bg-[#2b2d31]"
            >
              <button
                type="button"
                onClick={() => {
                  onCopy(
                    message.content,
                  );

                  onMenu("");
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-zinc-700 transition-colors hover:bg-indigo-600 hover:text-white dark:text-zinc-200"
              >
                <Copy className="h-3.5 w-3.5" />

                Copiar conteúdo
              </button>

              {onTogglePin && (
                <button
                  type="button"
                  onClick={() => {
                    onTogglePin(message);
                    onMenu("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-zinc-700 transition-colors hover:bg-indigo-600 hover:text-white dark:text-zinc-200"
                >
                  <Pin className="h-3.5 w-3.5" />

                  {message.isPinned ? "Desafixar" : "Fixar mensagem"}
                </button>
              )}

              {onEdit && isOwnMessage && !message.deleted && (
                <button
                  type="button"
                  onClick={() => {
                    onEdit(message);
                    onMenu("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-zinc-700 transition-colors hover:bg-indigo-600 hover:text-white dark:text-zinc-200"
                >
                  <Pencil className="h-3.5 w-3.5" />

                  Editar mensagem
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onCopy(
                    message.id,
                  );

                  onMenu("");
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-zinc-700 transition-colors hover:bg-indigo-600 hover:text-white dark:text-zinc-200"
              >
                <Copy className="h-3.5 w-3.5" />

                Copiar ID
              </button>

              {canDelete && (
                <>
                  <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />

                  <button
                    type="button"
                    disabled={
                      isDeleting
                    }
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-red-500 transition-colors hover:bg-red-500 hover:text-white disabled:pointer-events-none disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}

                    {isDeleting
                      ? "Excluindo..."
                      : "Excluir mensagem"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {message.avatarUrl ? (
        <Avatar
          avatarUrl={
            message.avatarUrl
          }
        />
      ) : (
        <div
          className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            message.avatarColor ||
            "bg-indigo-600"
          } text-sm font-bold text-white`}
        >
          {message.author
            ? message.author
                .charAt(0)
                .toUpperCase()
            : "?"}
        </div>
      )}

      <div className="min-w-0 flex-1">
        {message.reply && (
          <MessageReply
            reply={
              message.reply
            }
          />
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setProfileOpen((current) => !current)}
            className={`relative cursor-pointer rounded-sm text-left font-semibold hover:underline ${
              message.authorColor ||
              "text-indigo-500"
            }`}
          >
            {message.author}
          </button>

          {profileOpen && (
            <div className="absolute left-12 top-11 z-[80]">
              <UserMiniProfile user={authorUser} fallbackName={message.author} />
            </div>
          )}

          {message.isBot && (
            <span className="inline-flex items-center gap-1 rounded-[3px] bg-indigo-500 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide text-white">
              BOT

              {message.isBotVerified && (
                <Check
                  strokeWidth={3}
                  className="h-3 w-3 shrink-0 text-white"
                />
              )}
            </span>
          )}

          {!message.isBot &&
            message.isWebhook && (
              <span className="rounded bg-indigo-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                WEBHOOK
              </span>
            )}

          <span className="text-xs text-zinc-500">
            <ClientTime
              timestamp={
                message.createdAt ||
                message.time
              }
            />
          </span>
        </div>

          <MessageContent
            content={
              message.content
            }
          attachments={
            message.attachments
          }
            embeds={
              message.embeds
            }
            voiceMessage={message.voiceMessage}
            poll={message.poll}
            users={users}
            channels={channels}
            onPollVote={(optionId) => onPollVote?.(message, optionId)}
          />

          {message.reactions && message.reactions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {message.reactions.map((reaction) => (
                <button
                  key={reaction.emoji}
                  type="button"
                  onClick={() => onQuickReact?.(message, reaction.emoji)}
                  className={`rounded-md border px-2 py-1 text-xs font-semibold transition ${
                    reaction.reactedByMe
                      ? "border-indigo-400 bg-indigo-500/15 text-indigo-700 dark:text-indigo-200"
                      : "border-zinc-200 bg-zinc-100 text-zinc-600 hover:border-indigo-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {reaction.emoji} {reaction.count}
                </button>
              ))}
            </div>
          )}
      </div>
      </div>

      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Excluir mensagem?"
        description="Essa mensagem será removida do chat para todos. Essa ação não usa confirmação do navegador."
        confirmLabel="Excluir"
        danger
        loading={isDeleting}
        onClose={() => {
          if (!isDeleting) setDeleteConfirmOpen(false);
        }}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
