"use client";

import { useState } from "react";
import DirectMessagesList from "./DirectMessagesList";
import DirectMessageChat from "./DirectMessageChat";
import DirectMessageMembers from "./DirectMessageMembers";

export type DirectMessage = {
  id: string;
  name: string;
  color: string;
  lastMessage: string;
  time?: string;
  members?: number;
};

const conversations: DirectMessage[] = [
  {
    id: "grupo",
    name: "grupo",
    color: "#9b59d0",
    lastMessage: "3 membros",
    members: 3,
  },
  {
    id: "member4",
    name: "member4",
    color: "#ef4444",
    lastMessage: "oi4",
    time: "",
  },
];

export default function DirectMessagesLayout() {
  const [selectedId, setSelectedId] = useState("grupo");

  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedId) ??
    conversations[0];

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden bg-white dark:bg-zinc-950">
      {/* Lista de mensagens diretas */}
      <DirectMessagesList
        conversations={conversations}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      {/* Conversa */}
      <DirectMessageChat conversation={selectedConversation} />

      {/* Membros */}
      <DirectMessageMembers conversation={selectedConversation} />
    </div>
  );
}