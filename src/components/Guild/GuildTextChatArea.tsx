"use client";

import type { ChatAreaProps } from "./ChatArea";
import TextChatArea from "./TextChatArea";

export default function GuildTextChatArea({
  channel,
  guildId,
  customEmojis,
  currentUser,
  users,
  channels,
  commandItems,
}: ChatAreaProps) {
  return (
    <TextChatArea
      channel={channel}
      guildId={guildId}
      customEmojis={customEmojis}
      currentUser={currentUser}
      users={users}
      channels={channels}
      mode="guild"
      commandItems={commandItems}
    />
  );
}
