"use client";

import { useMemo, useState } from "react";

import ChatArea from "@/components/Guild/ChatArea";
import type { CommandItem } from "@/components/SearchCommand";
import type {
  DirectConversationSummary,
  DirectUser,
  RelationshipSummary,
} from "@/types/direct-messages";

import GroupSettingsModal from "./GroupSettingsModal";

type Props = {
  conversation: DirectConversationSummary;
  currentUser: DirectUser;
  relationships: RelationshipSummary[];
  onOpenProfile: (user: DirectUser) => void;
  onChanged: () => Promise<void> | void;
  onConversationRemoved: () => Promise<void> | void;
  commandItems?: CommandItem[];
};

export default function DirectMessageChat({
  conversation,
  currentUser,
  relationships,
  onOpenProfile,
  onChanged,
  onConversationRemoved,
  commandItems = [],
}: Props) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const otherUser = useMemo(() => {
    if (conversation.type !== "DM") return null;

    return (
      conversation.members.find(
        (member) => member.id !== currentUser.id,
      ) ??
      conversation.members[0] ??
      null
    );
  }, [conversation, currentUser.id]);

  const channel = useMemo(
    () => ({
      id: conversation.id,
      name: conversation.displayName,
      avatarUrl: conversation.displayAvatarUrl,
      directType: conversation.type,
      type:
        conversation.type === "GROUP"
          ? "DIRECT_GROUP"
          : "DIRECT_MESSAGE",
      members: conversation.members,
    }),
    [conversation],
  );

  function handleOpenDetails() {
    if (conversation.type === "GROUP") {
      setSettingsOpen(true);
      return;
    }

    if (otherUser) {
      onOpenProfile(otherUser);
    }
  }

  return (
    <>
      <main className="flex min-w-0 flex-1 bg-white dark:bg-zinc-950">
        <ChatArea
          channel={channel}
          currentUser={currentUser}
          users={conversation.members}
          channels={[]}
          mode="direct"
          onOpenDetails={handleOpenDetails}
          onDirectConversationChanged={onChanged}
          commandItems={commandItems}
        />
      </main>

      {conversation.type === "GROUP" && (
        <GroupSettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          conversation={conversation}
          currentUserId={currentUser.id}
          relationships={relationships}
          onChanged={onChanged}
          onConversationRemoved={onConversationRemoved}
        />
      )}
    </>
  );
}
