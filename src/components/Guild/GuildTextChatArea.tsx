"use client";

import type { ChatAreaProps } from "./ChatArea";
import TextChatArea from "./TextChatArea";

export default function GuildTextChatArea({
  channel,
  currentUser,
  users,
  channels,
}: ChatAreaProps) {
  return (
    <TextChatArea
      channel={channel}
      currentUser={currentUser}
      users={users}
      channels={channels}
      mode="guild"
    />
  );
}
