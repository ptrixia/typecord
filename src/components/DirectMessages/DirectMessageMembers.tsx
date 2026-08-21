"use client";

import MembersSidebar from "../Guild/MembersSidebar";
import type { DirectMessage } from "./DirectMessagesLayout";

type Props = {
  conversation: DirectMessage;
};

const members = [
  {
    id: 1,
    name: "member1",
    color: "#36a85f",
  },
  {
    id: 2,
    name: "member2",
    color: "#f6a019",
  },
  {
    id: 3,
    name: "member3",
    color: "#e83d91",
  },
];

export default function DirectMessageMembers({
  conversation,
}: Props) {
  return (
    
<MembersSidebar></MembersSidebar>
  );
}