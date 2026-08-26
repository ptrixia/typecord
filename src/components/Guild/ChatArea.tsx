"use client";

import {
  Hash,
  LockKeyhole,
  Megaphone,
  MessagesSquare,
  Video,
} from "lucide-react";

import DirectChatArea from "./DirectChatArea";
import GuildTextChatArea from "./GuildTextChatArea";
import GuildVoiceChatArea from "./GuildVoiceChatArea";

export type ChatAreaMode = "guild" | "direct";

export interface ChatAreaProps {
  channel: any;
  currentUser?: any;
  users?: any[];
  channels?: any[];
  mode?: ChatAreaMode;
  onOpenDetails?: () => void;
  onDirectConversationChanged?: () => Promise<void> | void;
  activeVoiceChannel?: any;
  onLeaveVoice?: () => void;
}

export function isDirectChannel(
  channel: any,
  mode?: ChatAreaMode,
) {
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
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col bg-transparent">
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

function GuildChannelContent(props: ChatAreaProps) {
  const { channel } = props;

  switch (channel.type) {
    case "GUILD_TEXT":
      return <GuildTextChatArea {...props} />;

    case "GUILD_VIDEO":
      return (
        <UnsupportedChannel
          channel={channel}
          icon={<Video className="h-6 w-6" />}
          title="Canal de vídeo"
          description="Conecte aqui o componente responsável por câmera e compartilhamento de tela."
        />
      );

    case "GUILD_ANNOUNCEMENT":
      return (
        <UnsupportedChannel
          channel={channel}
          icon={<Megaphone className="h-6 w-6" />}
          title="Canal de anúncios"
          description="Conecte aqui o componente de anúncios quando ele estiver pronto."
        />
      );

    case "PUBLIC_THREAD":
      return (
        <UnsupportedChannel
          channel={channel}
          icon={<MessagesSquare className="h-6 w-6" />}
          title="Thread pública"
          description="Conecte aqui o componente de thread pública quando ele estiver pronto."
        />
      );

    case "PRIVATE_THREAD":
      return (
        <UnsupportedChannel
          channel={channel}
          icon={<LockKeyhole className="h-6 w-6" />}
          title="Thread privada"
          description="Conecte aqui o componente de thread privada quando ele estiver pronto."
        />
      );

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

export default function ChatArea(props: ChatAreaProps) {
  const {
    channel,
    mode = "guild",
    activeVoiceChannel,
    onLeaveVoice,
  } = props;

  if (!channel) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 items-center justify-center">
        <span className="text-zinc-500">
          Nenhum canal selecionado
        </span>
      </div>
    );
  }

  if (isDirectChannel(channel, mode)) {
    return <DirectChatArea {...props} />;
  }

  const viewingVoice = channel.type === "GUILD_VOICE";
  const viewingConnectedVoice =
    viewingVoice &&
    activeVoiceChannel &&
    String(activeVoiceChannel.id) === String(channel.id);

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
      {activeVoiceChannel && (
        <div
          className={
            viewingConnectedVoice
              ? "absolute inset-0 z-10 flex min-h-0 min-w-0"
              : "hidden"
          }
        >
          <GuildVoiceChatArea
            channel={activeVoiceChannel}
            currentUser={props.currentUser}
            users={props.users}
            channels={props.channels}
            mode="guild"
            onLeaveVoice={onLeaveVoice}
          />
        </div>
      )}

      {!viewingConnectedVoice && (
        <div className="flex h-full min-h-0 min-w-0 flex-1">
          {viewingVoice ? (
            <GuildVoiceChatArea
              channel={channel}
              currentUser={props.currentUser}
              users={props.users}
              channels={props.channels}
              mode="guild"
              onLeaveVoice={onLeaveVoice}
            />
          ) : (
            <GuildChannelContent {...props} />
          )}
        </div>
      )}
    </div>
  );
}
