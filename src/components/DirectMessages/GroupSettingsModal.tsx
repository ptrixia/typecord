"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  ImagePlus,
  LogOut,
  Search,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react";

import Modal from "@/components/Modal";
import type {
  DirectConversationSummary,
  RelationshipSummary,
} from "@/types/direct-messages";
import DirectAvatar from "./DirectAvatar";

type ConfirmMode =
  | { type: "remove"; userId: string; name: string }
  | { type: "leave" }
  | { type: "delete" }
  | null;

type Props = {
  isOpen: boolean;
  onClose: () => void;
  conversation: DirectConversationSummary;
  currentUserId: string;
  relationships: RelationshipSummary[];
  onChanged: () => Promise<void> | void;
  onConversationRemoved: () => Promise<void> | void;
};

export default function GroupSettingsModal({
  isOpen,
  onClose,
  conversation,
  currentUserId,
  relationships,
  onChanged,
  onConversationRemoved,
}: Props) {
  const [name, setName] = useState(conversation.name || "");
  const [iconUrl, setIconUrl] = useState(conversation.iconUrl || "");
  const [memberQuery, setMemberQuery] = useState("");
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(conversation.name || "");
    setIconUrl(conversation.iconUrl || "");
    setMemberQuery("");
    setSelectedToAdd([]);
    setError("");
    setConfirmMode(null);
  }, [conversation.id, isOpen]);

  const isOwner = conversation.ownerId === currentUserId;
  const existingIds = useMemo(
    () => new Set(conversation.members.map((member) => member.id)),
    [conversation.members],
  );

  const availableFriends = useMemo(() => {
    const normalized = memberQuery.trim().toLowerCase();

    return relationships
      .filter(
        (relationship) =>
          relationship.type === "FRIEND" &&
          relationship.direction === "friend" &&
          !existingIds.has(relationship.otherUser.id),
      )
      .filter((relationship) => {
        if (!normalized) return true;
        const user = relationship.otherUser;
        return `${user.globalName ?? ""} ${user.username}`
          .toLowerCase()
          .includes(normalized);
      });
  }, [existingIds, memberQuery, relationships]);

  async function patch(body: unknown) {
    const response = await fetch(
      `/api/direct-messages/conversations/${conversation.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Não foi possível atualizar o grupo.");
    }

    return data;
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setUploading(true);
      setError("");

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok || !data.success || !data.url) {
        throw new Error(data.message || data.error || "Falha no upload.");
      }

      setIconUrl(data.url);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Não foi possível enviar a imagem.",
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function saveOverview() {
    try {
      setLoading(true);
      setError("");

      await patch({
        action: "update",
        name,
        iconUrl: iconUrl || null,
      });

      await onChanged();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Não foi possível salvar.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function addMembers() {
    if (selectedToAdd.length === 0) return;

    try {
      setLoading(true);
      setError("");

      await patch({
        action: "add_members",
        userIds: selectedToAdd,
      });

      setSelectedToAdd([]);
      await onChanged();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível adicionar participantes.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function removeMember(userId: string) {
    try {
      setLoading(true);
      setError("");

      await patch({
        action: "remove_member",
        userId,
      });

      setConfirmMode(null);
      await onChanged();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível remover o participante.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function leaveGroup() {
    try {
      setLoading(true);
      setError("");

      await patch({
        action: "leave",
      });

      setConfirmMode(null);
      onClose();
      await onConversationRemoved();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Não foi possível sair do grupo.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function deleteGroup() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `/api/direct-messages/conversations/${conversation.id}`,
        {
          method: "DELETE",
        },
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Não foi possível excluir o grupo.");
      }

      setConfirmMode(null);
      onClose();
      await onConversationRemoved();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o grupo.",
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleAdd(userId: string) {
    setSelectedToAdd((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Configurações do grupo"
      >
        <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500">
              Visão geral
            </h3>

            <div className="flex items-center gap-4">
              <label className="relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-zinc-300 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900">
                {iconUrl ? (
                  <img
                    src={iconUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImagePlus className="h-6 w-6 text-zinc-500" />
                )}
                {isOwner && (
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                )}
              </label>

              <label className="min-w-0 flex-1 space-y-1.5">
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                  Nome do grupo
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={!isOwner}
                  maxLength={100}
                  className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 text-sm text-zinc-950 outline-none focus:border-indigo-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                />
              </label>
            </div>

            {isOwner && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={saveOverview}
                  disabled={loading || uploading}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {uploading
                    ? "Enviando imagem..."
                    : loading
                      ? "Salvando..."
                      : "Salvar alterações"}
                </button>
              </div>
            )}
          </section>

          <section className="space-y-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                Participantes — {conversation.members.length}
              </h3>
            </div>

            <div className="space-y-1">
              {conversation.members.map((member) => {
                const memberName = member.globalName || member.username;
                const owner = conversation.ownerId === member.id;

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  >
                    <DirectAvatar
                      name={memberName}
                      avatarUrl={member.avatarUrl}
                      status={member.status}
                      showStatus
                      size="sm"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                        {memberName}
                      </div>
                      <div className="truncate text-xs text-zinc-500">
                        @{member.username}
                        {owner ? " • Dono" : ""}
                      </div>
                    </div>

                    {isOwner && member.id !== currentUserId && (
                      <button
                        type="button"
                        title="Remover do grupo"
                        onClick={() =>
                          setConfirmMode({
                            type: "remove",
                            userId: member.id,
                            name: memberName,
                          })
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-rose-500/10 hover:text-rose-500"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {isOwner && (
            <section className="space-y-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
              <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                Adicionar amigos
              </h3>

              <div className="flex h-9 items-center gap-2 rounded-md border border-zinc-300 bg-zinc-50 px-3 dark:border-zinc-700 dark:bg-zinc-900">
                <Search className="h-4 w-4 text-zinc-500" />
                <input
                  value={memberQuery}
                  onChange={(event) => setMemberQuery(event.target.value)}
                  placeholder="Pesquisar amigos"
                  className="min-w-0 flex-1 bg-transparent text-sm text-zinc-950 outline-none dark:text-white"
                />
              </div>

              <div className="max-h-48 space-y-1 overflow-y-auto">
                {availableFriends.length === 0 ? (
                  <p className="py-5 text-center text-xs text-zinc-500">
                    Nenhum amigo disponível para adicionar.
                  </p>
                ) : (
                  availableFriends.map(({ otherUser }) => {
                    const userName =
                      otherUser.globalName || otherUser.username;
                    const selected = selectedToAdd.includes(otherUser.id);

                    return (
                      <button
                        key={otherUser.id}
                        type="button"
                        onClick={() => toggleAdd(otherUser.id)}
                        className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900"
                      >
                        <DirectAvatar
                          name={userName}
                          avatarUrl={otherUser.avatarUrl}
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
                          className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
                            selected
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-zinc-300 dark:border-zinc-700"
                          }`}
                        >
                          {selected ? "✓" : ""}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {selectedToAdd.length > 0 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={addMembers}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <UserPlus className="h-4 w-4" />
                    Adicionar {selectedToAdd.length}
                  </button>
                </div>
              )}
            </section>
          )}

          <section className="space-y-2 border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500">
              Zona de perigo
            </h3>

            {isOwner ? (
              <button
                type="button"
                onClick={() => setConfirmMode({ type: "delete" })}
                className="flex w-full items-center gap-3 rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2.5 text-left text-sm font-semibold text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
              >
                <Trash2 className="h-4 w-4" />
                Excluir grupo permanentemente
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmMode({ type: "leave" })}
                className="flex w-full items-center gap-3 rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2.5 text-left text-sm font-semibold text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
              >
                <LogOut className="h-4 w-4" />
                Sair do grupo
              </button>
            )}
          </section>

          {error && (
            <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={confirmMode?.type === "remove"}
        onClose={() => setConfirmMode(null)}
        title="Remover participante?"
      >
        {confirmMode?.type === "remove" && (
          <div className="space-y-4">
            <p className="text-zinc-600 dark:text-zinc-400">
              Remover <strong>{confirmMode.name}</strong> deste grupo?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmMode(null)}
                className="rounded-md px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => removeMember(confirmMode.userId)}
                className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                Remover
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={confirmMode?.type === "leave"}
        onClose={() => setConfirmMode(null)}
        title="Sair do grupo?"
      >
        <div className="space-y-4">
          <p className="text-zinc-600 dark:text-zinc-400">
            Você deixará de receber mensagens deste grupo.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmMode(null)}
              className="rounded-md px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={leaveGroup}
              className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
            >
              Sair
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={confirmMode?.type === "delete"}
        onClose={() => setConfirmMode(null)}
        title="Excluir grupo permanentemente?"
      >
        <div className="space-y-4">
          <p className="text-zinc-600 dark:text-zinc-400">
            Todas as mensagens e anexos registrados nessa conversa serão
            removidos do banco. Essa ação não pode ser desfeita.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmMode(null)}
              className="rounded-md px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={deleteGroup}
              className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
            >
              Excluir grupo
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}