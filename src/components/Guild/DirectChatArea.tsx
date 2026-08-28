"use client";

import type { ChatAreaProps } from "./ChatArea";
import TextChatArea from "./TextChatArea";

export default function DirectChatArea({
  channel,
  currentUser,
  users,
  channels,
  onOpenDetails,
  onDirectConversationChanged,
  commandItems,
}: ChatAreaProps) {
  return (
    <TextChatArea
      channel={channel}
      currentUser={currentUser}
      users={users}
      channels={channels}
      mode="direct"
      onOpenDetails={onOpenDetails}
      onDirectConversationChanged={onDirectConversationChanged}
      commandItems={commandItems}
    />
  );
}
