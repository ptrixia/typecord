"use client";

import {
  Hash,
} from "lucide-react";
import DirectChatArea from "./DirectChatArea";
import GuildTextChatArea from "./GuildTextChatArea";
import GuildVoiceChatArea from "./GuildVoiceChatArea";
import type { CommandItem } from "../SearchCommand";

export type ChatAreaMode = "guild" | "direct";

export interface ChatAreaProps {
  channel: any;
  currentUser?: any;
  users?: any[];
  channels?: any[];
  stickers?: any[];
  mode?: ChatAreaMode;
  activeVoiceChannel?: any;
  onOpenDetails?: () => void;
  onDirectConversationChanged?: () => Promise<void> | void;
  onLeaveVoice?: () => void;
  commandItems?: CommandItem[];
}

export function isDirectChannel(channel: any, mode?: ChatAreaMode) {
  return (
    mode === "direct" ||
    channel?.type === "DIRECT_MESSAGE" ||
    channel?.type === "DIRECT_GROUP" ||
    channel?.directType === "DM" ||
    channel?.directType === "GROUP"
  );
}

function UnsupportedChannel({
  channel,
  icon,
  title,
  description,
}: {
  channel: any;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="relative flex min-w-0 flex-1 flex-col bg-transparent">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-stone-300 px-4 shadow-sm dark:border-zinc-800/50">
        <span className="text-zinc-500">{icon}</span>
        <span className="min-w-0 truncate font-semibold text-zinc-800 dark:text-zinc-100">
          {channel?.name || title}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {icon}
          </div>

          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {title}
          </h2>

          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ChatArea(props: ChatAreaProps) {
  const { channel, mode = "guild" } = props;

  if (!channel) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center">
        <span className="text-zinc-500">Nenhum canal selecionado</span>
      </div>
    );
  }

  if (isDirectChannel(channel, mode)) {
    return <DirectChatArea {...props} />;
  }

  switch (channel.type) {
    case "GUILD_TEXT":
    case "GUILD_ANNOUNCEMENT":
    case "PUBLIC_THREAD":
    case "PRIVATE_THREAD":
      return <GuildTextChatArea {...props} />;

    case "GUILD_VOICE":
    case "GUILD_VIDEO":
      return <GuildVoiceChatArea {...props} />;

    default:
      return (
        <UnsupportedChannel
          channel={channel}
          icon={<Hash className="h-6 w-6" />}
          title="Tipo de canal não suportado"
          description={`O tipo ${String(
            channel.type ?? "desconhecido",
          )} ainda não possui um componente associado.`}
        />
      );
  }
}
