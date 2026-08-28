"use client";

import { useMemo, useState } from "react";
import {
  MessageSquarePlus,
  Search,
  UserPlus,
  Users,
  UsersRound,
  X,
} from "lucide-react";

import type {
  DirectConversationSummary,
  DirectUser,
} from "@/types/direct-messages";
import { UnreadBadge } from "@/components/app/ActivityProvider";
import DirectAvatar from "./DirectAvatar";
import UserProfileSideBar from "../UserProfileSideBar";

type Props = {
  conversations: DirectConversationSummary[];
  currentUser: DirectUser;
  selectedId: string | null;
  friendsSelected: boolean;
  pendingCount: number;
  onSelect: (id: string) => void;
  onFriends: () => void;
  onNewMessage: () => void;
  onCreateGroup: () => void;
  onAddFriend: () => void;
  onCloseConversation: (conversation: DirectConversationSummary) => void;
};

function formatTime(value: string) {
  const date = new Date(value);
  const today = new Date();

  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

export default function DirectMessagesList({
  conversations,
  currentUser,
  selectedId,
  friendsSelected,
  pendingCount,
  onSelect,
  onFriends,
  onNewMessage,
  onCreateGroup,
  onAddFriend,
  onCloseConversation,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) return conversations;

    return conversations.filter((conversation) =>
      conversation.displayName.toLowerCase().includes(normalized),
    );
  }, [conversations, query]);

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-zinc-200 bg-zinc-100 text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white">
      <div className="border-b border-zinc-200 p-2.5 dark:border-zinc-800 mt-4 ">
        <button
          type="button"
          onClick={onNewMessage}
          className="flex h-8 w-full items-center justify-between rounded-md bg-white px-2.5 text-left text-xs text-zinc-500 shadow-sm ring-1 ring-zinc-300 transition hover:ring-indigo-400 dark:bg-zinc-800 dark:ring-zinc-700"
        >
          <span>Encontre ou comece uma conversa</span>
          <Search className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-1 p-2">
        <button
          type="button"
          onClick={onFriends}
          className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium transition ${
            friendsSelected
              ? "bg-zinc-200 text-zinc-950 dark:bg-zinc-800 dark:text-white"
              : "text-zinc-600 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800/70"
          }`}
        >
          <Users className="h-5 w-5" />
          <span className="min-w-0 flex-1">Amigos</span>
          {pendingCount > 0 && (
            <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onAddFriend}
          className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-zinc-600 transition hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-800/70"
        >
          <UserPlus className="h-5 w-5" />
          <span>Adicionar amigo</span>
        </button>
      </div>

      <div className="flex items-center justify-between px-4 pb-1 pt-3">
        <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
          Mensagens diretas
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            title="Nova mensagem"
            onClick={onNewMessage}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Criar grupo"
            onClick={onCreateGroup}
            className="rounded p-1 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <UsersRound className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-2 pb-2">
        {conversations.length > 6 && (
          <div className="mb-2 flex h-8 items-center rounded-md bg-white px-2 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
            <Search className="mr-2 h-3.5 w-3.5 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filtrar conversas"
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
            />
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {filtered.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-zinc-500">
            {conversations.length === 0
              ? "Suas conversas aparecerão aqui."
              : "Nenhuma conversa encontrada."}
          </div>
        ) : (
          filtered.map((conversation) => {
            const selected = conversation.id === selectedId;
            const last = conversation.lastMessage;
            const subtitle = last
              ? `${last.authorId === currentUser.id ? "Você: " : ""}${
                  last.content ||
                  (last.hasAttachments ? "📎 Arquivo" : "Mensagem")
                }`
              : conversation.type === "GROUP"
                ? `${conversation.members.length} membros`
                : "Comece uma conversa";

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => onSelect(conversation.id)}
                className={`group relative mb-0.5 flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition ${
                  selected
                    ? "bg-zinc-200 dark:bg-zinc-800"
                    : "hover:bg-zinc-200/70 dark:hover:bg-zinc-800/70"
                }`}
              >
                <DirectAvatar
                  name={conversation.displayName}
                  avatarUrl={conversation.displayAvatarUrl}
                  status={
                    conversation.type === "DM"
                      ? conversation.members.find(
                          (member) => member.id !== currentUser.id,
                        )?.status
                      : undefined
                  }
                  showStatus={conversation.type === "DM"}
                  size="md"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                      {conversation.displayName}
                    </span>
                    <UnreadBadge scopeId={conversation.id} />
                    {last && (
                      <span className="ml-auto shrink-0 text-[9px] text-zinc-400 group-hover:hidden">
                        {formatTime(last.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[11px] text-zinc-500">
                    {subtitle}
                  </div>
                </div>

                {conversation.type === "DM" && (
                  <span
                    role="button"
                    tabIndex={0}
                    title="Fechar conversa"
                    onClick={(event) => {
                      event.stopPropagation();
                      onCloseConversation(conversation);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        onCloseConversation(conversation);
                      }
                    }}
                    className="absolute right-2 top-2 hidden rounded p-1 text-zinc-500 hover:bg-zinc-300 hover:text-zinc-900 group-hover:flex dark:hover:bg-zinc-700 dark:hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      <UserProfileSideBar user={currentUser}/>
    </aside>
  );
}
