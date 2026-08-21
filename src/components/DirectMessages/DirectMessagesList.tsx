"use client";

import { Search, Users } from "lucide-react";
import type { DirectMessage } from "./DirectMessagesLayout";
import UserProfileSideBar from "../UserProfileSideBar";

type Props = {
  conversations: DirectMessage[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export default function DirectMessagesList({
  conversations,
  selectedId,
  onSelect,
}: Props) {
  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Pesquisa */}
      <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
        <div className="flex h-8 items-center rounded-md border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-800">
          <input
            type="text"
            placeholder="Encontre ou comece uma conversa"
            className="min-w-0 flex-1 bg-transparent text-xs text-zinc-700 outline-none placeholder:text-zinc-500 dark:text-zinc-200"
          />

          <Search
            size={15}
            className="shrink-0 text-zinc-500"
          />
        </div>
      </div>

      {/* Amigos */}
      <button className="mx-2 mt-2 flex h-10 items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-200 dark:text-zinc-200 dark:hover:bg-zinc-800">
        <Users size={18} />
        <span>Amigos</span>
      </button>

      {/* Título */}
      <div className="px-4 pb-1 pt-4">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Mensagens diretas
        </span>
      </div>

      {/* Conversas */}
      <div className="flex-1 overflow-y-auto px-2">
        {conversations.map((conversation) => {
          const selected = conversation.id === selectedId;

          return (
            <button
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
              className={`group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition ${
                selected
                  ? "bg-zinc-200 dark:bg-zinc-800"
                  : "hover:bg-zinc-200 dark:hover:bg-zinc-800"
              }`}
            >
              {/* Avatar */}
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: conversation.color }}
              >
                {conversation.name.charAt(0).toUpperCase()}
              </div>

              {/* Informações */}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                  {conversation.name}
                </div>

                <div className="truncate text-[11px] text-zinc-500">
                  {conversation.lastMessage}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Usuário */}
      <UserProfileSideBar
            name="Nome"
              username="@username"
              status="Status personalizado"
              avatar="N"
               ></UserProfileSideBar>
    </aside>
  );
}