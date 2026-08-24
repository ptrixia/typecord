"use client";

import type {
  DirectConversationSummary,
  DirectUser,
} from "@/types/direct-messages";
import DirectAvatar from "./DirectAvatar";

type Props = {
  conversation: DirectConversationSummary;
  onOpenProfile: (user: DirectUser) => void;
};

function statusLabel(status: DirectUser["status"]) {
  if (status === "ONLINE") return "Online";
  if (status === "IDLE") return "Ausente";
  if (status === "DND") return "Não perturbe";
  return "Offline";
}

export default function DirectMessageMembers({
  conversation,
  onOpenProfile,
}: Props) {
  if (conversation.type !== "GROUP") {
    return null;
  }

  const online = conversation.members.filter(
    (member) => member.status !== "OFFLINE",
  );
  const offline = conversation.members.filter(
    (member) => member.status === "OFFLINE",
  );

  function Member({ member }: { member: DirectUser }) {
    const name = member.globalName || member.username;

    return (
      <button
        type="button"
        onClick={() => onOpenProfile(member)}
        className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition hover:bg-zinc-200/70 dark:hover:bg-zinc-800/70"
      >
        <DirectAvatar
          name={name}
          avatarUrl={member.avatarUrl}
          status={member.status}
          showStatus
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {name}
          </div>
          <div className="truncate text-[10px] text-zinc-500">
            {conversation.ownerId === member.id
              ? `Dono • ${statusLabel(member.status)}`
              : statusLabel(member.status)}
          </div>
        </div>
      </button>
    );
  }

  return (
    <aside className="hidden h-full w-60 shrink-0 overflow-y-auto border-l border-zinc-200 bg-zinc-100 p-2 lg:block dark:border-zinc-800 dark:bg-zinc-900">
      <div className="px-2 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
        Online — {online.length}
      </div>
      <div className="space-y-0.5">
        {online.map((member) => (
          <Member key={member.id} member={member} />
        ))}
      </div>

      {offline.length > 0 && (
        <>
          <div className="px-2 pb-1 pt-5 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
            Offline — {offline.length}
          </div>
          <div className="space-y-0.5 opacity-70">
            {offline.map((member) => (
              <Member key={member.id} member={member} />
            ))}
          </div>
        </>
      )}
    </aside>
  );
}