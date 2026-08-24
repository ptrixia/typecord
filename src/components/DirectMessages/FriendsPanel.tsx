"use client";

import { useMemo, useState } from "react";
import {
  Ban,
  Check,
  MessageCircle,
  MoreHorizontal,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import Modal from "@/components/Modal";
import type {
  DirectUser,
  RelationshipSummary,
} from "@/types/direct-messages";
import DirectAvatar from "./DirectAvatar";

type Tab = "online" | "all" | "pending" | "blocked";

type Props = {
  relationships: RelationshipSummary[];
  onOpenProfile: (user: DirectUser) => void;
  onStartDm: (userId: string) => Promise<void> | void;
  onChanged: () => Promise<void> | void;
  onAddFriend: () => void;
};

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "online", label: "Online" },
  { id: "all", label: "Todos" },
  { id: "pending", label: "Pendente" },
  { id: "blocked", label: "Bloqueados" },
];

export default function FriendsPanel({
  relationships,
  onOpenProfile,
  onStartDm,
  onChanged,
  onAddFriend,
}: Props) {
  const [tab, setTab] = useState<Tab>("online");
  const [query, setQuery] = useState("");
  const [actionRelationship, setActionRelationship] =
    useState<RelationshipSummary | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const pendingCount = relationships.filter(
    (relationship) =>
      relationship.type === "PENDING" &&
      relationship.direction === "incoming",
  ).length;

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return relationships.filter((relationship) => {
      if (
        relationship.type === "BLOCKED" &&
        relationship.direction === "blocked_me"
      ) {
        return false;
      }

      const matchesTab =
        tab === "online"
          ? relationship.type === "FRIEND" &&
            relationship.otherUser.status !== "OFFLINE"
          : tab === "all"
            ? relationship.type === "FRIEND"
            : tab === "pending"
              ? relationship.type === "PENDING"
              : relationship.type === "BLOCKED" &&
                relationship.direction === "blocked_by_me";

      if (!matchesTab) return false;
      if (!normalized) return true;

      const { otherUser } = relationship;
      return `${otherUser.globalName ?? ""} ${otherUser.username}`
        .toLowerCase()
        .includes(normalized);
    });
  }, [relationships, query, tab]);

  async function relationAction(
    relationship: RelationshipSummary,
    action: "accept" | "reject" | "unblock",
  ) {
    try {
      setLoadingId(relationship.id);
      setError("");

      const response = await fetch(`/api/friends/${relationship.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Não foi possível concluir a ação.");
      }

      await onChanged();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a ação.",
      );
    } finally {
      setLoadingId(null);
    }
  }

  async function removeFriend() {
    if (!actionRelationship) return;

    try {
      setLoadingId(actionRelationship.id);
      setError("");

      const response = await fetch(
        `/api/friends/${actionRelationship.id}`,
        {
          method: "DELETE",
        },
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Não foi possível remover o amigo.");
      }

      setActionRelationship(null);
      await onChanged();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível remover o amigo.",
      );
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <>
      <main className="flex min-w-0 flex-1 flex-col bg-white text-zinc-950 dark:bg-zinc-950 dark:text-white">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-zinc-200 px-4 shadow-sm dark:border-zinc-800">
          <Users className="h-5 w-5 text-zinc-500" />
          <span className="mr-2 text-sm font-bold">Amigos</span>
          <span className="h-5 w-px bg-zinc-200 dark:bg-zinc-800" />

          <div className="flex items-center gap-1">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                  tab === item.id
                    ? "bg-zinc-200 text-zinc-950 dark:bg-zinc-800 dark:text-white"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                {item.label}
                {item.id === "pending" && pendingCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] text-white">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}

            <button
              type="button"
              onClick={onAddFriend}
              className="ml-1 rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              Adicionar amigo
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mx-auto max-w-5xl">
            <div className="mb-5 flex h-10 items-center gap-2 rounded-md bg-zinc-100 px-3 ring-1 ring-zinc-200 focus-within:ring-indigo-500 dark:bg-zinc-900 dark:ring-zinc-800">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Pesquisar"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-500"
              />
              <Search className="h-4 w-4 text-zinc-500" />
            </div>

            <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
              {tab === "online"
                ? `Online — ${filtered.length}`
                : tab === "all"
                  ? `Todos os amigos — ${filtered.length}`
                  : tab === "pending"
                    ? `Pendentes — ${filtered.length}`
                    : `Bloqueados — ${filtered.length}`}
            </h2>

            <div className="border-t border-zinc-200 dark:border-zinc-800">
              {filtered.length === 0 ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900">
                    {tab === "blocked" ? (
                      <Ban className="h-7 w-7 text-zinc-400" />
                    ) : tab === "pending" ? (
                      <UserPlus className="h-7 w-7 text-zinc-400" />
                    ) : (
                      <Users className="h-7 w-7 text-zinc-400" />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Nada por aqui.
                  </p>
                  <p className="mt-1 max-w-sm text-xs text-zinc-500">
                    {tab === "online"
                      ? "Quando seus amigos estiverem online, eles aparecerão aqui."
                      : tab === "pending"
                        ? "Suas solicitações de amizade aparecerão aqui."
                        : tab === "blocked"
                          ? "Usuários que você bloquear aparecerão aqui."
                          : "Adicione pessoas para começar a conversar."}
                  </p>
                </div>
              ) : (
                filtered.map((relationship) => {
                  const user = relationship.otherUser;
                  const name = user.globalName || user.username;
                  const busy = loadingId === relationship.id;

                  return (
                    <div
                      key={relationship.id}
                      className="group flex items-center gap-3 border-b border-zinc-200 py-3 dark:border-zinc-800"
                    >
                      <button
                        type="button"
                        onClick={() => onOpenProfile(user)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        <DirectAvatar
                          name={name}
                          avatarUrl={user.avatarUrl}
                          status={user.status}
                          showStatus
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-sm font-semibold">
                              {name}
                            </span>
                            <span className="truncate text-xs text-zinc-500 opacity-0 transition group-hover:opacity-100">
                              @{user.username}
                            </span>
                          </div>

                          <div className="mt-0.5 truncate text-xs text-zinc-500">
                            {relationship.type === "FRIEND"
                              ? user.status === "ONLINE"
                                ? "Online"
                                : user.status === "IDLE"
                                  ? "Ausente"
                                  : user.status === "DND"
                                    ? "Não perturbe"
                                    : "Offline"
                              : relationship.type === "PENDING"
                                ? relationship.direction === "incoming"
                                  ? "Solicitação de amizade recebida"
                                  : "Solicitação de amizade enviada"
                                : "Bloqueado"}
                          </div>
                        </div>
                      </button>

                      {relationship.type === "FRIEND" && (
                        <>
                          <button
                            type="button"
                            title="Mensagem"
                            onClick={() => onStartDm(user.id)}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 hover:text-indigo-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-indigo-400"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            title="Mais"
                            onClick={() => setActionRelationship(relationship)}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </>
                      )}

                      {relationship.type === "PENDING" &&
                        relationship.direction === "incoming" && (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              title="Aceitar"
                              onClick={() =>
                                relationAction(relationship, "accept")
                              }
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-50 dark:bg-zinc-900"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              title="Recusar"
                              onClick={() =>
                                relationAction(relationship, "reject")
                              }
                              className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-rose-500 hover:bg-rose-500/10 disabled:opacity-50 dark:bg-zinc-900"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        )}

                      {relationship.type === "PENDING" &&
                        relationship.direction === "outgoing" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              relationAction(relationship, "reject")
                            }
                            className="rounded-md bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            Cancelar
                          </button>
                        )}

                      {relationship.type === "BLOCKED" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            relationAction(relationship, "unblock")
                          }
                          className="rounded-md bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-200 disabled:opacity-50 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          Desbloquear
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {error && (
              <p className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
                {error}
              </p>
            )}
          </div>
        </div>
      </main>

      <Modal
        isOpen={Boolean(actionRelationship)}
        onClose={() => setActionRelationship(null)}
        title="Opções de amizade"
      >
        {actionRelationship && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                onOpenProfile(actionRelationship.otherUser);
                setActionRelationship(null);
              }}
              className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Ver perfil
            </button>
            <button
              type="button"
              disabled={loadingId === actionRelationship.id}
              onClick={removeFriend}
              className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
            >
              Remover amizade
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}