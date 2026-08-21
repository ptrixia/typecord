"use client";

import { Search, Users } from "lucide-react";
import type { DirectMessage } from "./DirectMessagesLayout";
import ChatArea from "../Guild/ChatArea";

type Props = {
  conversation: DirectMessage;
};

const messages = [
  {
    id: 1,
    user: "member1",
    color: "#36a85f",
    time: "14:02",
    message: "oi1",
  },
  {
    id: 2,
    user: "member2",
    color: "#f6a019",
    time: "14:05",
    message: "oi2",
  },
  {
    id: 3,
    user: "member3",
    color: "#e83d91",
    time: "14:07",
    message: "oi3",
  },
];

export default function DirectMessageChat({ conversation }: Props) {
  return (
    <main className="flex min-w-0 flex-1 flex-col bg-white dark:bg-zinc-950">
        <ChatArea></ChatArea>
    </main>
  );
}