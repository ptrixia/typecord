"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Search, UsersRound } from "lucide-react";

import Modal from "@/components/Modal";
import type {
  DirectConversationSummary,
  RelationshipSummary,
} from "@/types/direct-messages";
import DirectAvatar from "./DirectAvatar";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  relationships: RelationshipSummary[];
  onCreated: (conversation: DirectConversationSummary) => Promise<void> | void;
};

export default function CreateGroupModal({
  isOpen,
  onClose,
  relationships,
  onCreated,
}: Props) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const friends = useMemo(
    () =>
      relationships.filter(
        (relationship) =>
          relationship.type === "FRIEND" &&
          relationship.direction === "friend",
      ),
    [relationships],
  );

  const filteredFriends = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) return friends;

    return friends.filter(({ otherUser }) =>
      `${otherUser.globalName ?? ""} ${otherUser.username}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [friends, query]);

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setQuery("");
      setSelected([]);
      setLoading(false);
      setError("");
    }
  }, [isOpen]);

  function toggle(userId: string) {
    setSelected((current) => {
      if (current.includes(userId)) {
        return current.filter((id) => id !== userId);
      }

      if (current.length >= 9) {
        setError("O grupo pode ter no máximo 10 pessoas contando com você.");
        return current;
      }

      setError("");
      return [...current, userId];
    });
  }

  async function createGroup() {
    if (selected.length === 0) {
      setError("Selecione pelo menos um amigo.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/direct-messages/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "GROUP",
          name: name.trim() || undefined,
          memberIds: selected,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.conversation) {
        throw new Error(data.message || "Não foi possível criar o grupo.");
      }

      await onCreated(data.conversation);
      onClose();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível criar o grupo.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Criar grupo"
    >
      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
            Nome do grupo
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            placeholder="Meu grupo"
            className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-sm text-zinc-950 outline-none transition focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
        </label>

        <div className="flex h-10 items-center gap-2 rounded-md border border-zinc-300 bg-zinc-50 px-3 dark:border-zinc-700 dark:bg-zinc-900">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar amigos"
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-950 outline-none dark:text-white"
          />
        </div>

        <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {filteredFriends.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center dark:border-zinc-700">
              <UsersRound className="mx-auto mb-2 h-7 w-7 text-zinc-400" />
              <p className="text-xs text-zinc-500">
                Nenhum amigo encontrado.
              </p>
            </div>
          ) : (
            filteredFriends.map(({ otherUser }) => {
              const active = selected.includes(otherUser.id);
              const userName = otherUser.globalName || otherUser.username;

              return (
                <button
                  key={otherUser.id}
                  type="button"
                  onClick={() => toggle(otherUser.id)}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
                >
                  <DirectAvatar
                    name={userName}
                    avatarUrl={otherUser.avatarUrl}
                    status={otherUser.status}
                    showStatus
                    size="sm"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                      {userName}
                    </div>
                    <div className="truncate text-xs text-zinc-500">
                      @{otherUser.username}
                    </div>
                  </div>

                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded border ${
                      active
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-zinc-300 dark:border-zinc-700"
                    }`}
                  >
                    {active && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <span className="text-xs text-zinc-500">
            {selected.length}/9 amigos selecionados
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={createGroup}
              disabled={loading || selected.length === 0}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? "Criando..." : "Criar grupo"}
            </button>
          </div>
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