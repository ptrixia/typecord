"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Ban,
  Check,
  Copy,
  Loader2,
  MessageCircle,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";

import Avatar, { resolveFileUrl } from "@/components/Image/Avatar";
import Modal from "@/components/Modal";
import type { RelationshipSummary, UserStatus } from "@/types/direct-messages";
import RichPresenceBadge from "./RichPresenceBadge";
import { usePreferences } from "@/components/app/PreferencesProvider";

export type ProfileUser = {
  id?: string | null;
  username?: string | null;
  globalName?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  avatar?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  status?: UserStatus | string | null;
  customStatus?: string | null;
  richPresence?: { type?: string | null; name?: string | null; details?: string | null; state?: string | null; expiresAt?: string | Date | null } | null;
};

type ConfirmAction = "remove" | "block" | null;

type ProfileSurfaceProps = {
  user?: ProfileUser | null;
  fallbackName?: string;
  currentUserId?: string;
  relationship?: RelationshipSummary | null;
  onStartDm?: (userId: string) => Promise<void> | void;
  onRelationshipsChanged?: () => Promise<void> | void;
  onClose?: () => void;
  variant?: "modal" | "preview";
};

const statusLabels: Record<UserStatus, string> = {
  ONLINE: "Online",
  IDLE: "Ausente",
  DND: "Não perturbe",
  OFFLINE: "Offline",
};

const statusColors: Record<UserStatus, string> = {
  ONLINE: "bg-emerald-500",
  IDLE: "bg-amber-400",
  DND: "bg-rose-500",
  OFFLINE: "bg-zinc-500",
};

function normalizeStatus(status?: string | null): UserStatus {
  if (status === "ONLINE" || status === "IDLE" || status === "DND") {
    return status;
  }

  return "OFFLINE";
}

function getRelationshipLabel(relationship?: RelationshipSummary | null) {
  if (!relationship) return null;
  if (relationship.type === "FRIEND") return "Amigos";
  if (relationship.type === "PENDING" && relationship.direction === "incoming") {
    return "Solicitação recebida";
  }
  if (relationship.type === "PENDING" && relationship.direction === "outgoing") {
    return "Solicitação enviada";
  }
  if (relationship.type === "BLOCKED" && relationship.direction === "blocked_by_me") {
    return "Usuário bloqueado";
  }
  if (relationship.direction === "blocked_me") return "Indisponível";
  return null;
}

export function ProfileSurface({
  user,
  fallbackName = "Usuário",
  currentUserId,
  relationship,
  onStartDm,
  onRelationshipsChanged,
  onClose,
  variant = "modal",
}: ProfileSurfaceProps) {
  const { preferences } = usePreferences();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  useEffect(() => {
    setLoading(false);
    setFeedback("");
    setConfirmAction(null);
  }, [user?.id]);

  const username = user?.username?.trim() || fallbackName;
  const name = user?.globalName?.trim() || user?.displayName?.trim() || username;
  const status = normalizeStatus(user?.status);
  const isSelf = Boolean(currentUserId && user?.id === currentUserId);
  const relationshipLabel = useMemo(
    () => getRelationshipLabel(relationship),
    [relationship],
  );
  const blockedByMe =
    relationship?.type === "BLOCKED" &&
    relationship.direction === "blocked_by_me";
  const blockedMe = relationship?.direction === "blocked_me";
  const avatarUrl = user?.avatarUrl ?? user?.avatar ?? null;
  const bannerUrl = resolveFileUrl(user?.bannerUrl);
  const canShowSocialActions = variant === "modal" && user?.id && !isSelf;

  async function api(url: string, options: RequestInit, fallbackMessage: string) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.success) {
      throw new Error(data?.message || fallbackMessage);
    }

    return data;
  }

  async function runAction(action: () => Promise<void>, fallbackMessage: string) {
    try {
      setLoading(true);
      setFeedback("");
      await action();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : fallbackMessage);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartDm() {
    if (!user?.id || !onStartDm) return;

    await runAction(async () => {
      await onStartDm(user.id!);
      onClose?.();
    }, "Não foi possível abrir a conversa.");
  }

  async function addFriend() {
    if (!user?.username) return;

    await runAction(async () => {
      await api(
        "/api/friends",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "request", username: user.username }),
        },
        "Não foi possível enviar a solicitação.",
      );
      await onRelationshipsChanged?.();
      setFeedback("Solicitação de amizade enviada.");
    }, "Erro inesperado.");
  }

  async function relationshipAction(action: "accept" | "reject" | "block" | "unblock") {
    if (!relationship) return;

    await runAction(async () => {
      await api(
        `/api/friends/${relationship.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
        "Não foi possível concluir a ação.",
      );
      setConfirmAction(null);
      await onRelationshipsChanged?.();
      setFeedback(
        action === "accept"
          ? "Solicitação aceita."
          : action === "reject"
            ? "Solicitação recusada."
            : action === "block"
              ? "Usuário bloqueado."
              : "Usuário desbloqueado.",
      );
    }, "Erro inesperado.");
  }

  async function removeRelationship() {
    if (!relationship) return;

    await runAction(async () => {
      const wasFriend = relationship.type === "FRIEND";
      await api(
        `/api/friends/${relationship.id}`,
        { method: "DELETE" },
        "Não foi possível remover.",
      );
      setConfirmAction(null);
      await onRelationshipsChanged?.();
      setFeedback(wasFriend ? "Amizade removida." : "Solicitação cancelada.");
    }, "Erro inesperado.");
  }

  async function blockWithoutRelationship() {
    if (!user?.id) return;

    await runAction(async () => {
      await api(
        "/api/friends",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "block", userId: user.id }),
        },
        "Não foi possível bloquear.",
      );
      setConfirmAction(null);
      await onRelationshipsChanged?.();
      setFeedback("Usuário bloqueado.");
    }, "Erro inesperado.");
  }

  async function copyUserId() {
    if (!user?.id) return;

    try {
      await navigator.clipboard.writeText(user.id);
      setFeedback("ID copiado para a área de transferência.");
    } catch {
      setFeedback("Não foi possível copiar o ID.");
    }
  }

  if (!user) return null;

  if (confirmAction) {
    const isRemove = confirmAction === "remove";

    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-bold text-zinc-950 dark:text-white">
            {isRemove ? "Remover amigo?" : `Bloquear ${name}?`}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {isRemove
              ? `Voce deixara de ser amigo de ${name}. O historico das mensagens diretas nao sera apagado.`
              : "A amizade ou solicitacao existente sera removida. Esse usuario tambem nao podera iniciar novas mensagens diretas com voce."}
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => setConfirmAction(null)}
            className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={
              isRemove
                ? removeRelationship
                : () =>
                    relationship
                      ? relationshipAction("block")
                      : blockWithoutRelationship()
            }
            className="flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Ban className="h-4 w-4" />
            )}
            {isRemove ? "Remover" : "Bloquear"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden border border-zinc-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#111214] dark:text-white ${
        variant === "preview" ? "w-[320px] rounded-xl" : "-m-6 rounded-lg"
      }`}
    >
      <div
        className={`relative overflow-hidden bg-indigo-600 ${
          variant === "preview" ? "h-20" : "h-32"
        }`}
      >
        {bannerUrl ? (
          <img
            src={bannerUrl}
            alt={`Banner de ${name}`}
            draggable={false}
            className="h-full w-full select-none object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      <div className={variant === "preview" ? "px-4 pb-4" : "px-5 pb-5"}>
        <div
          className={`${
            variant === "preview" ? "-mt-7" : "-mt-10"
          } flex items-end justify-between gap-3`}
        >
          <div className="flex min-w-0 items-end gap-3">
            <div className="relative rounded-full border-4 border-white dark:border-[#111214]">
              <Avatar
                avatarUrl={avatarUrl}
                username={username}
                globalName={user.globalName ?? null}
                className={variant === "preview" ? "h-14 w-14" : "h-20 w-20"}
              />
              {preferences.showOnlineStatus && <span
                className={`absolute bottom-0 right-0 rounded-full border-[3px] border-white dark:border-[#111214] ${
                  variant === "preview" ? "h-4 w-4" : "h-5 w-5"
                } ${statusColors[status]}`}
              />}
            </div>

            <div className="min-w-0 pb-1">
              <div
                className={`${
                  variant === "preview" ? "text-sm" : "text-xl"
                } truncate font-black`}
              >
                {name}
              </div>
              <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                @{username}
              </div>
            </div>
          </div>

          {variant === "modal" && preferences.showOnlineStatus && (
            <div className="mb-1 flex shrink-0 items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <span className={`h-2.5 w-2.5 rounded-full ${statusColors[status]}`} />
              {statusLabels[status]}
            </div>
          )}
        </div>

        {relationshipLabel && !isSelf && (
          <span className="mt-3 inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
            {relationshipLabel}
          </span>
        )}

        {(user.customStatus || user.bio || variant === "modal") && (
          <div className="mt-4">
            {variant === "modal" && (
              <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Sobre mim
              </h3>
            )}
            {user.customStatus || user.bio ? (
              <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-zinc-100 px-3 py-2 text-sm leading-relaxed text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-300">
                {user.customStatus || user.bio}
              </p>
            ) : (
              <p className="mt-2 text-sm italic text-zinc-400 dark:text-zinc-600">
                Nenhuma descrição adicionada.
              </p>
            )}
          </div>
        )}

        {preferences.showActivity && <div className="mt-3"><RichPresenceBadge presence={user.richPresence} /></div>}

        <div className="mt-4 flex flex-wrap gap-2">
          {onStartDm && user.id && !isSelf && !blockedMe && (
            <button
              type="button"
              disabled={loading}
              onClick={handleStartDm}
              className="flex h-9 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
              Mensagem
            </button>
          )}

          {canShowSocialActions && relationship?.type === "FRIEND" && (
            <button
              type="button"
              disabled={loading}
              onClick={() => setConfirmAction("remove")}
              className="flex h-9 items-center gap-2 rounded-lg bg-zinc-100 px-3 text-xs font-bold text-zinc-700 transition hover:bg-zinc-200 disabled:opacity-50 dark:bg-white/[0.06] dark:text-zinc-200 dark:hover:bg-white/10"
            >
              <UserMinus className="h-4 w-4" />
              Remover
            </button>
          )}

          {canShowSocialActions &&
            relationship?.type === "PENDING" &&
            relationship.direction === "incoming" && (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => relationshipAction("accept")}
                  className="flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  Aceitar
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => relationshipAction("reject")}
                  className="flex h-9 items-center gap-2 rounded-lg bg-zinc-100 px-3 text-xs font-bold text-zinc-700 transition hover:bg-zinc-200 disabled:opacity-50 dark:bg-white/[0.06] dark:text-zinc-200 dark:hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                  Recusar
                </button>
              </>
            )}

          {canShowSocialActions &&
            relationship?.type === "PENDING" &&
            relationship.direction === "outgoing" && (
              <button
                type="button"
                disabled={loading}
                onClick={removeRelationship}
                className="flex h-9 items-center gap-2 rounded-lg bg-zinc-100 px-3 text-xs font-bold text-zinc-700 transition hover:bg-zinc-200 disabled:opacity-50 dark:bg-white/[0.06] dark:text-zinc-200 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
                Cancelar solicitação
              </button>
            )}

          {canShowSocialActions && !relationship && (
            <button
              type="button"
              disabled={loading}
              onClick={addFriend}
              className="flex h-9 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              Adicionar amigo
            </button>
          )}

          {canShowSocialActions &&
            (blockedByMe ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => relationshipAction("unblock")}
                className="h-9 rounded-lg bg-zinc-100 px-3 text-xs font-bold text-zinc-700 transition hover:bg-zinc-200 disabled:opacity-50 dark:bg-white/[0.06] dark:text-zinc-200 dark:hover:bg-white/10"
              >
                Desbloquear
              </button>
            ) : !blockedMe ? (
              <button
                type="button"
                disabled={loading}
                onClick={() => setConfirmAction("block")}
                className="flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold text-rose-600 transition hover:bg-rose-500/10 disabled:opacity-50 dark:text-rose-400"
              >
                <Ban className="h-4 w-4" />
                Bloquear
              </button>
            ) : null)}

          {user.id && (
            <button
              type="button"
              onClick={copyUserId}
              className="ml-auto flex h-9 items-center justify-center gap-2 rounded-lg bg-zinc-100 px-3 text-xs font-bold text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900 dark:bg-white/[0.06] dark:hover:bg-white/10 dark:hover:text-white"
              title="Copiar ID"
              aria-label="Copiar ID"
            >
              <Copy className="h-4 w-4" />
              {variant === "modal" ? "Copiar ID" : ""}
            </button>
          )}
        </div>

        {feedback && (
          <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            {feedback}
          </div>
        )}
      </div>
    </div>
  );
}

export function ProfileModal({
  isOpen,
  onClose,
  ...props
}: ProfileSurfaceProps & {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ProfileSurface {...props} onClose={onClose} variant="modal" />
    </Modal>
  );
}
