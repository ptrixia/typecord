"use client";

import { useEffect, useState } from "react";
import {
  MessageCircle,
  Search,
  UserPlus,
  UsersRound,
} from "lucide-react";

import Modal from "@/components/Modal";
import type {
  DirectConversationSummary,
  DirectUser,
  UserSearchResult,
} from "@/types/direct-messages";
import DirectAvatar from "./DirectAvatar";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (conversation: DirectConversationSummary) => Promise<void> | void;
  onOpenProfile: (user: DirectUser) => void;
  onRelationshipsChanged: () => Promise<void> | void;
  onCreateGroup: () => void;
};

export default function NewConversationModal({
  isOpen,
  onClose,
  onCreated,
  onOpenProfile,
  onRelationshipsChanged,
  onCreateGroup,
}: Props) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingUserId, setWorkingUserId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setUsers([]);
      setError("");
      setLoading(false);
      setWorkingUserId(null);
      return;
    }

    const normalized = query.trim();

    if (normalized.length < 2) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/users/search?q=${encodeURIComponent(normalized)}`,
          {
            signal: controller.signal,
          },
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Não foi possível pesquisar.");
        }

        setUsers(data.users ?? []);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;

        setError(
          error instanceof Error
            ? error.message
            : "Não foi possível pesquisar.",
        );
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, query]);

  async function startDm(userId: string) {
    try {
      setWorkingUserId(userId);
      setError("");

      const response = await fetch("/api/direct-messages/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "DM",
          userId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.conversation) {
        throw new Error(data.message || "Não foi possível abrir a conversa.");
      }

      await onCreated(data.conversation);
      onClose();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível abrir a conversa.",
      );
    } finally {
      setWorkingUserId(null);
    }
  }

  async function sendFriendRequest(username: string, userId: string) {
    try {
      setWorkingUserId(userId);
      setError("");

      const response = await fetch("/api/friends", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "request",
          username,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Não foi possível enviar a solicitação.");
      }

      await onRelationshipsChanged();
      setQuery((current) => `${current} `);
      window.setTimeout(() => setQuery((current) => current.trim()), 0);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a solicitação.",
      );
    } finally {
      setWorkingUserId(null);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nova mensagem"
    >
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            onClose();
            onCreateGroup();
          }}
          className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left transition hover:border-indigo-400 hover:bg-indigo-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-500/60 dark:hover:bg-indigo-500/10"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white">
            <UsersRound className="h-5 w-5" />
          </span>
          <div>
            <div className="font-semibold text-zinc-900 dark:text-white">
              Criar grupo
            </div>
            <div className="text-xs text-zinc-500">
              Converse com vários amigos ao mesmo tempo.
            </div>
          </div>
        </button>

        <div className="flex h-11 items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 focus-within:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar por nome ou @username"
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-950 outline-none dark:text-white"
          />
        </div>

        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              Procurando pessoas...
            </div>
          ) : query.trim().length < 2 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              Digite pelo menos 2 caracteres.
            </div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              Nenhum usuário encontrado.
            </div>
          ) : (
            <div className="space-y-1">
              {users.map((user) => {
                const relationship = user.relationship;
                const name = user.globalName || user.username;
                const working = workingUserId === user.id;

                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900"
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
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                          {name}
                        </div>
                        <div className="truncate text-xs text-zinc-500">
                          @{user.username}
                        </div>
                      </div>
                    </button>

                    {relationship?.type === "FRIEND" ? (
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => startDm(user.id)}
                        className="flex h-9 items-center gap-2 rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Mensagem
                      </button>
                    ) : relationship?.type === "PENDING" ? (
                      <span className="rounded-md bg-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {relationship.direction === "incoming"
                          ? "Solicitação recebida"
                          : "Solicitação enviada"}
                      </span>
                    ) : relationship?.type === "BLOCKED" ? (
                      <span className="rounded-md bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-medium text-rose-500">
                        Indisponível
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={working}
                        onClick={() =>
                          sendFriendRequest(user.username, user.id)
                        }
                        className="flex h-9 items-center gap-2 rounded-md bg-zinc-200 px-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-300 disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                      >
                        <UserPlus className="h-4 w-4" />
                        Adicionar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {error && (
          <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}