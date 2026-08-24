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

import Modal from "@/components/Modal";
import { resolveFileUrl } from "@/components/Image/Avatar";
import type {
  DirectUser,
  RelationshipSummary,
  UserStatus,
} from "@/types/direct-messages";

import DirectAvatar from "./DirectAvatar";

type ConfirmAction = "remove" | "block" | null;

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: DirectUser | null;
  currentUserId: string;
  relationship: RelationshipSummary | null;
  onStartDm: (userId: string) => Promise<void> | void;
  onRelationshipsChanged: () => Promise<void> | void;
}

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

export default function UserProfileModal({
  isOpen,
  onClose,
  user,
  currentUserId,
  relationship,
  onStartDm,
  onRelationshipsChanged,
}: UserProfileModalProps) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [confirmAction, setConfirmAction] =
    useState<ConfirmAction>(null);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(false);
    setFeedback("");
    setConfirmAction(null);
  }, [isOpen, user?.id]);

  const isSelf = user?.id === currentUserId;

  const actionLabel = useMemo(() => {
    if (!relationship) return null;

    if (relationship.type === "FRIEND") {
      return "Amigos";
    }

    if (
      relationship.type === "PENDING" &&
      relationship.direction === "incoming"
    ) {
      return "Solicitação de amizade recebida";
    }

    if (
      relationship.type === "PENDING" &&
      relationship.direction === "outgoing"
    ) {
      return "Solicitação de amizade enviada";
    }

    if (
      relationship.type === "BLOCKED" &&
      relationship.direction === "blocked_by_me"
    ) {
      return "Usuário bloqueado";
    }

    if (relationship.direction === "blocked_me") {
      return "Indisponível";
    }

    return null;
  }, [relationship]);

  if (!user) {
    return null;
  }

  const name =
    user.globalName?.trim() ||
    user.username;

  const status: UserStatus =
    user.status || "OFFLINE";

  const bannerUrl =
    resolveFileUrl(user.bannerUrl);

  const blockedByMe =
    relationship?.type === "BLOCKED" &&
    relationship.direction === "blocked_by_me";

  const blockedMe =
    relationship?.direction === "blocked_me";

  async function api(
    url: string,
    options: RequestInit,
    fallbackMessage: string,
  ) {
    const response = await fetch(url, options);

    const data = await response
      .json()
      .catch(() => null);

    if (
      !response.ok ||
      !data ||
      !data.success
    ) {
      throw new Error(
        data?.message ||
          fallbackMessage,
      );
    }

    return data;
  }

  async function handleStartDm() {
    try {
      setLoading(true);
      setFeedback("");

      await onStartDm(user.id);

      onClose();
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Não foi possível abrir a conversa.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function addFriend() {
    try {
      setLoading(true);
      setFeedback("");

      await api(
        "/api/friends",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action: "request",
            username: user.username,
          }),
        },
        "Não foi possível enviar a solicitação.",
      );

      await onRelationshipsChanged();

      setFeedback(
        "Solicitação de amizade enviada.",
      );
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Erro inesperado.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function relationshipAction(
    action:
      | "accept"
      | "reject"
      | "block"
      | "unblock",
  ) {
    if (!relationship) return;

    try {
      setLoading(true);
      setFeedback("");

      await api(
        `/api/friends/${relationship.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action,
          }),
        },
        "Não foi possível concluir a ação.",
      );

      setConfirmAction(null);

      await onRelationshipsChanged();

      if (action === "accept") {
        setFeedback(
          "Solicitação aceita.",
        );
      }

      if (action === "reject") {
        setFeedback(
          "Solicitação recusada.",
        );
      }

      if (action === "block") {
        setFeedback(
          "Usuário bloqueado.",
        );
      }

      if (action === "unblock") {
        setFeedback(
          "Usuário desbloqueado.",
        );
      }
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Erro inesperado.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function removeRelationship() {
    if (!relationship) return;

    try {
      setLoading(true);
      setFeedback("");

      const wasFriend =
        relationship.type === "FRIEND";

      await api(
        `/api/friends/${relationship.id}`,
        {
          method: "DELETE",
        },
        "Não foi possível remover.",
      );

      setConfirmAction(null);

      await onRelationshipsChanged();

      setFeedback(
        wasFriend
          ? "Amizade removida."
          : "Solicitação cancelada.",
      );
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Erro inesperado.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function blockWithoutRelationship() {
    try {
      setLoading(true);
      setFeedback("");

      await api(
        "/api/friends",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action: "block",
            userId: user.id,
          }),
        },
        "Não foi possível bloquear.",
      );

      setConfirmAction(null);

      await onRelationshipsChanged();

      setFeedback(
        "Usuário bloqueado.",
      );
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : "Erro inesperado.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmBlock() {
    if (relationship) {
      await relationshipAction(
        "block",
      );

      return;
    }

    await blockWithoutRelationship();
  }

  async function copyUserId() {
    try {
      await navigator.clipboard.writeText(
        user.id,
      );

      setFeedback(
        "ID copiado para a área de transferência.",
      );
    } catch {
      setFeedback(
        "Não foi possível copiar o ID.",
      );
    }
  }

  function closeModal() {
    if (loading) return;

    setFeedback("");
    setConfirmAction(null);

    onClose();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
    >
      {confirmAction === "remove" ? (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-zinc-950 dark:text-white">
              Remover amigo?
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Você deixará de ser
              amigo de{" "}
              <strong className="text-zinc-900 dark:text-white">
                {name}
              </strong>
              . O histórico das
              mensagens diretas não
              será apagado.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                setConfirmAction(null)
              }
              className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={
                removeRelationship
              }
              className="flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}

              Remover
            </button>
          </div>
        </div>
      ) : confirmAction === "block" ? (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-zinc-950 dark:text-white">
              Bloquear {name}?
            </h2>

            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              A amizade ou solicitação
              existente será removida.
              Esse usuário também não
              poderá iniciar novas
              mensagens diretas com você.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() =>
                setConfirmAction(null)
              }
              className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={confirmBlock}
              className="flex items-center gap-2 rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4" />
              )}

              Bloquear
            </button>
          </div>
        </div>
      ) : (
        <div className="-m-6 overflow-hidden rounded-lg">
          <div
            className={`relative h-32 ${
              bannerUrl
                ? "bg-zinc-800"
                : "bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600"
            }`}
          >
            {bannerUrl && (
              <img
                src={bannerUrl}
                alt={`Banner de ${name}`}
                draggable={false}
                className="h-full w-full select-none object-cover"
              />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>

          <div className="relative bg-white px-5 pb-5 dark:bg-zinc-950">
            <div className="flex items-end justify-between">
              <DirectAvatar
                name={name}
                avatarUrl={
                  user.avatarUrl
                }
                status={status}
                showStatus
                size="xl"
                className="-mt-10"
              />

              <div className="mb-1 flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${statusColors[status]}`}
                />

                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {
                    statusLabels[
                      status
                    ]
                  }
                </span>
              </div>
            </div>

            <div className="mt-3">
              <h2 className="break-words text-xl font-bold leading-tight text-zinc-950 dark:text-white">
                {name}
              </h2>

              <p className="mt-0.5 break-all text-sm text-zinc-500 dark:text-zinc-400">
                @{user.username}
              </p>
            </div>

            {actionLabel && !isSelf && (
              <div className="mt-3">
                <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                  {actionLabel}
                </span>
              </div>
            )}

            <div className="my-4 h-px bg-zinc-200 dark:bg-zinc-800" />

            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Sobre mim
              </h3>

              {user.bio?.trim() ? (
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {user.bio}
                </p>
              ) : (
                <p className="mt-2 text-sm italic text-zinc-400 dark:text-zinc-600">
                  Nenhuma descrição
                  adicionada.
                </p>
              )}
            </div>

            {!isSelf && (
              <>
                <div className="my-4 h-px bg-zinc-200 dark:bg-zinc-800" />

                <div className="flex flex-wrap gap-2">
                  {relationship?.type ===
                    "FRIEND" && (
                    <>
                      <button
                        type="button"
                        disabled={
                          loading
                        }
                        onClick={
                          handleStartDm
                        }
                        className="flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Mensagem
                      </button>

                      <button
                        type="button"
                        disabled={
                          loading
                        }
                        onClick={() =>
                          setConfirmAction(
                            "remove",
                          )
                        }
                        className="flex items-center gap-2 rounded-md bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        <UserMinus className="h-4 w-4" />
                        Remover amigo
                      </button>
                    </>
                  )}

                  {relationship?.type ===
                    "PENDING" &&
                    relationship.direction ===
                      "incoming" && (
                      <>
                        <button
                          type="button"
                          disabled={
                            loading
                          }
                          onClick={() =>
                            relationshipAction(
                              "accept",
                            )
                          }
                          className="flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" />
                          Aceitar
                        </button>

                        <button
                          type="button"
                          disabled={
                            loading
                          }
                          onClick={() =>
                            relationshipAction(
                              "reject",
                            )
                          }
                          className="flex items-center gap-2 rounded-md bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          <X className="h-4 w-4" />
                          Recusar
                        </button>
                      </>
                    )}

                  {relationship?.type ===
                    "PENDING" &&
                    relationship.direction ===
                      "outgoing" && (
                      <button
                        type="button"
                        disabled={
                          loading
                        }
                        onClick={
                          removeRelationship
                        }
                        className="flex items-center gap-2 rounded-md bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        <X className="h-4 w-4" />
                        Cancelar
                        solicitação
                      </button>
                    )}

                  {!relationship && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={addFriend}
                      className="flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                    >
                      <UserPlus className="h-4 w-4" />
                      Adicionar amigo
                    </button>
                  )}

                  {blockedByMe ? (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        relationshipAction(
                          "unblock",
                        )
                      }
                      className="rounded-md bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      Desbloquear
                    </button>
                  ) : !blockedMe ? (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        setConfirmAction(
                          "block",
                        )
                      }
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-500/10 disabled:opacity-50 dark:text-rose-400"
                    >
                      <Ban className="h-4 w-4" />
                      Bloquear
                    </button>
                  ) : null}
                </div>
              </>
            )}

            <div className="mt-4 flex items-center">
              <button
                type="button"
                onClick={copyUserId}
                className="ml-auto flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar ID
              </button>
            </div>

            {feedback && (
              <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                {feedback}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}