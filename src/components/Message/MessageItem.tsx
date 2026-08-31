"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import EmojiPicker from "emoji-picker-react";
import { Theme } from "emoji-picker-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Check,
  Copy,
  Flag,
  Hash,
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
  editedAt?: string | null;
  time?: string;

  content: string;

  reply?: MessageReplyData | null;

  attachments?: MessageAttachmentData[];
  embeds?: MessageEmbedData[];
  reactions?: Array<{
    emoji: string;
    count: number;
    reactedByMe?: boolean;
    users?: Array<{ id: string; name: string }>;
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
  threads?: Array<{ id: string; name: string; type?: string; parentId?: string | null }>;
}

interface MessageItemProps {
  message: MessageData;
  compact?: boolean;

  users?: any[];
  channels?: any[];

  currentUserId?: string;
  canManageMessages?: boolean;
  customEmojis?: any[];
  guildId?: string;

  isMenuOpen: boolean;

  onReply: (message: MessageData) => void;
  onMenu: (messageId: string) => void;
  onCopy: (text: string) => void;
  onReact: (message: MessageData) => void;
  onQuickReact?: (message: MessageData, emoji: string) => void;
  onPollVote?: (message: MessageData, optionId: string) => void;
  onTogglePin?: (message: MessageData) => void;
  onEdit?: (message: MessageData) => void;
  onCreateThread?: (message: MessageData) => void;
  onJumpToMessage?: (messageId: string) => void;

  onDeleted?: (messageId: string) => void;
  getDeleteUrl?: (message: MessageData) => string;
}

export default function MessageItem({
  message,
  compact = false,
  users = [],
  channels = [],
  currentUserId,
  canManageMessages = false,
  customEmojis = [],
  guildId,
  isMenuOpen,
  onReply,
  onMenu,
  onCopy,
  onReact,
  onQuickReact,
  onPollVote,
  onTogglePin,
  onEdit,
  onCreateThread,
  onJumpToMessage,
  onDeleted,
  getDeleteUrl,
}: MessageItemProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] =
    useState(false);
  const [profileOpen, setProfileOpen] =
    useState(false);
  const [reactionPickerOpen, setReactionPickerOpen] =
    useState(false);
  const reactionButtonRef = useRef<HTMLButtonElement>(null);
  const [reactionPickerPosition, setReactionPickerPosition] = useState({ top: 0, left: 0 });
  const { resolvedTheme } = useTheme();
  const [deleteConfirmOpen, setDeleteConfirmOpen] =
    useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("SPAM");
  const [reportDetails, setReportDetails] = useState("");
  const [isReporting, setIsReporting] = useState(false);
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

  async function handleReport() {
    if (isReporting) return;
    setIsReporting(true);
    try {
      const response = await fetch(`/api/messages/${encodeURIComponent(message.id)}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: reportReason, details: reportDetails || null }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || data?.message || "Não foi possível enviar a denúncia.");
      setReportOpen(false);
      onMenu("");
      pushToast({ type: "success", title: "Denúncia enviada", description: "Nossa equipe vai analisar esta mensagem." });
    } catch (error) {
      pushToast({ type: "error", title: "Denúncia não enviada", description: error instanceof Error ? error.message : "Tente novamente." });
    } finally { setIsReporting(false); }
  }

  return (
    <>
      <div
        data-message-id={message.id}
        data-compact={compact ? "true" : "false"}
        ref={itemRef}
        className={`typecord-message-item group relative -mx-2 flex w-full flex-col gap-1 rounded-md p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${
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
          ref={reactionButtonRef}
          onClick={() => {
            if (onQuickReact) {
              const rect = reactionButtonRef.current?.getBoundingClientRect();
              if (rect) setReactionPickerPosition({ top: Math.max(8, rect.bottom + 8), left: Math.min(window.innerWidth - 336, Math.max(8, rect.right - 320)) });
              setReactionPickerOpen((current) => !current);
            }
            else onReact(message);
          }}
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

        {onCreateThread && (
          <button
            type="button"
            onClick={() => onCreateThread(message)}
            className="p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
            title="Criar thread a partir desta mensagem"
          >
            <Hash className="h-4 w-4" />
          </button>
        )}

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

              <button
                type="button"
                onClick={() => { setReportOpen(true); onMenu(""); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-zinc-700 transition-colors hover:bg-indigo-600 hover:text-white dark:text-zinc-200"
              >
                <Flag className="h-3.5 w-3.5" />
                Denunciar mensagem
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

        {reactionPickerOpen && typeof document !== "undefined" && createPortal(
          <div className="fixed z-[9999]" style={{ top: reactionPickerPosition.top, left: reactionPickerPosition.left }} onClick={(event) => event.stopPropagation()}>
            <EmojiPicker
              onEmojiClick={(emojiData) => { onQuickReact?.(message, emojiData.emoji); setReactionPickerOpen(false); }}
              theme={resolvedTheme === "dark" ? Theme.DARK : Theme.LIGHT}
              width={320}
              height={390}
              skinTonesDisabled
              previewConfig={{ showPreview: false }}
            />
            {customEmojis.length > 0 && <div className="mt-1 grid max-h-24 grid-cols-8 gap-1 rounded-lg bg-white p-2 shadow dark:bg-[#2b2d31]">{customEmojis.slice(0, 24).map((emoji: any) => <button key={emoji.id} type="button" title={`:${emoji.name}:`} onClick={() => { onQuickReact?.(message, emoji.name); setReactionPickerOpen(false); }} className="rounded p-1 text-lg hover:bg-zinc-100 dark:hover:bg-zinc-700"><img src={emoji.url} alt={emoji.name} className="h-6 w-6 object-contain" /></button>)}</div>}
          </div>,
          document.body,
        )}
      </div>

      {message.reply && (
        <div className="ml-12 max-w-[min(680px,calc(100%-3rem))]">
          <MessageReply
            reply={message.reply}
            onClick={() => onJumpToMessage?.(message.reply!.messageId)}
          />
        </div>
      )}

      <div className="flex w-full min-w-0 gap-3">

      <div data-message-avatar-slot>
        {message.avatarUrl ? <Avatar avatarUrl={message.avatarUrl} /> : <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${message.avatarColor || "bg-indigo-600"} text-sm font-bold text-white`}>{message.author ? message.author.charAt(0).toUpperCase() : "?"}</div>}
      </div>

      <div className="min-w-0 flex-1">
        <div data-message-header className="flex items-center gap-2">
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
          {message.editedAt && <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">(editado)</span>}
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

          {message.threads && message.threads.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {message.threads.map((thread) => (
                <a
                  key={thread.id}
                  href={guildId ? `/channels/${guildId}/${thread.id}` : `/channels/${thread.id}`}
                  onClick={(event) => {
                    event.preventDefault();
                    router.push(guildId ? `/channels/${guildId}/${thread.id}` : `/channels/${thread.id}`);
                  }}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-indigo-300/60 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-500/20 dark:border-indigo-400/30 dark:text-indigo-300"
                  title={`Abrir thread ${thread.name}`}
                >
                  <Hash className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{thread.name}</span>
                </a>
              ))}
            </div>
          )}

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
                  title={reaction.users?.length ? reaction.users.map((user) => user.name).join(", ") : undefined}
                >
                  {reaction.emoji} {reaction.count}
                </button>
              ))}
            </div>
          )}
      </div>
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

      {reportOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !isReporting) setReportOpen(false); }}>
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#1e1f22]">
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold">Denunciar mensagem</h2><p className="mt-1 text-sm text-zinc-500">Selecione o motivo para ajudar a equipe de moderação.</p></div><button type="button" className="text-zinc-500" onClick={() => setReportOpen(false)} disabled={isReporting}>×</button></div>
            <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-zinc-500">Motivo<select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="mt-2 w-full rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-white/10"><option value="SPAM">Spam</option><option value="HARASSMENT">Assédio</option><option value="HATE_SPEECH">Discurso de ódio</option><option value="THREATS">Ameaças</option><option value="SEXUAL_CONTENT">Conteúdo sexual</option><option value="ILLEGAL_CONTENT">Conteúdo ilegal</option><option value="PERSONAL_DATA">Dados pessoais</option><option value="OTHER">Outro</option></select></label>
            <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-zinc-500">Detalhes opcionais<textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} maxLength={2000} rows={4} placeholder="Contexto adicional para a moderação" className="mt-2 w-full resize-none rounded-lg border border-zinc-200 bg-transparent px-3 py-2 text-sm dark:border-white/10" /></label>
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setReportOpen(false)} disabled={isReporting} className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-500">Cancelar</button><button type="button" onClick={() => void handleReport()} disabled={isReporting} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{isReporting ? "Enviando…" : "Enviar denúncia"}</button></div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
