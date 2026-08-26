"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import ChannelsSidebar from "./ChannelsSideBar";
import ChatArea from "./ChatArea";
import MembersSidebar from "./MembersSidebar";

import { onGatewayEvent } from "@/lib/realtime/gateway-client";

interface GuildLayoutProps {
  guild: any;
  currentMember: any;
}

export default function GuildLayout({
  guild,
  currentMember,
}: GuildLayoutProps) {
  const router = useRouter();

  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [activeVoiceChannelId, setActiveVoiceChannelId] = useState<string | null>(null);
  const [lastTextChannelId, setLastTextChannelId] = useState<string | null>(null);

  const refreshTimerRef = useRef<number | null>(null);

  const channels = useMemo(
    () => guild?.channels ?? [],
    [guild?.channels],
  );

  const members = useMemo(
    () => guild?.members ?? [],
    [guild?.members],
  );

  const activeChannel = useMemo(
    () =>
      channels.find(
        (channel: any) =>
          String(channel.id) === String(activeChannelId),
      ) ?? null,
    [channels, activeChannelId],
  );

  const activeVoiceChannel = useMemo(
    () =>
      channels.find(
        (channel: any) =>
          String(channel.id) === String(activeVoiceChannelId) &&
          channel.type === "GUILD_VOICE",
      ) ?? null,
    [channels, activeVoiceChannelId],
  );

  useEffect(() => {
    if (channels.length === 0) {
      setActiveChannelId(null);
      setLastTextChannelId(null);
      return;
    }

    const currentStillExists =
      activeChannelId !== null &&
      channels.some(
        (channel: any) =>
          String(channel.id) === String(activeChannelId),
      );

    if (currentStillExists) {
      return;
    }

    const firstTextChannel = channels.find(
      (channel: any) => channel.type === "GUILD_TEXT",
    );

    const fallbackChannel = firstTextChannel ?? channels[0];

    if (fallbackChannel?.id) {
      const id = String(fallbackChannel.id);
      setActiveChannelId(id);

      if (fallbackChannel.type === "GUILD_TEXT") {
        setLastTextChannelId(id);
      }
    }
  }, [channels, activeChannelId]);

  useEffect(() => {
    if (!activeVoiceChannelId) {
      return;
    }

    const stillExists = channels.some(
      (channel: any) =>
        String(channel.id) === String(activeVoiceChannelId) &&
        channel.type === "GUILD_VOICE",
    );

    if (!stillExists) {
      setActiveVoiceChannelId(null);
    }
  }, [channels, activeVoiceChannelId]);

  useEffect(() => {
    if (!guild?.id) {
      return;
    }

    const scheduleRefresh = () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        router.refresh();
      }, 150);
    };

    const removers = [
      onGatewayEvent<any>("GUILD_UPDATE", ({ data }) => {
        if (
          String(data?.id ?? data?.guildId ?? "") ===
          String(guild.id)
        ) {
          scheduleRefresh();
        }
      }),
      onGatewayEvent<any>("CHANNEL_CREATE", ({ data }) => {
        if (String(data?.guildId ?? "") === String(guild.id)) {
          scheduleRefresh();
        }
      }),
      onGatewayEvent<any>("CHANNEL_UPDATE", ({ data }) => {
        if (String(data?.guildId ?? "") === String(guild.id)) {
          scheduleRefresh();
        }
      }),
      onGatewayEvent<any>("CHANNEL_DELETE", ({ data }) => {
        if (String(data?.guildId ?? "") === String(guild.id)) {
          scheduleRefresh();
        }
      }),
      onGatewayEvent<any>("GUILD_MEMBER_ADD", ({ data }) => {
        if (String(data?.guildId ?? "") === String(guild.id)) {
          scheduleRefresh();
        }
      }),
      onGatewayEvent<any>("GUILD_MEMBER_REMOVE", ({ data }) => {
        if (String(data?.guildId ?? "") === String(guild.id)) {
          scheduleRefresh();
        }
      }),
    ];

    return () => {
      for (const remove of removers) {
        remove();
      }

      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, [guild?.id, router]);

  const handleSelectChannel = (channel: any) => {
    const channelId = String(channel?.id ?? "");

    if (!channelId) {
      return;
    }

    setActiveChannelId(channelId);

    if (channel?.type === "GUILD_TEXT") {
      setLastTextChannelId(channelId);
      return;
    }

    if (channel?.type === "GUILD_VOICE") {
      setActiveVoiceChannelId(channelId);
    }
  };

  const handleLeaveVoice = () => {
    const voiceId = activeVoiceChannelId;
    setActiveVoiceChannelId(null);

    if (
      activeChannel?.type === "GUILD_VOICE" &&
      String(activeChannel?.id ?? "") === String(voiceId ?? "")
    ) {
      const fallbackTextChannel =
        channels.find(
          (channel: any) =>
            channel.type === "GUILD_TEXT" &&
            String(channel.id) === String(lastTextChannelId),
        ) ??
        channels.find(
          (channel: any) => channel.type === "GUILD_TEXT",
        );

      if (fallbackTextChannel?.id) {
        setActiveChannelId(String(fallbackTextChannel.id));
        setLastTextChannelId(String(fallbackTextChannel.id));
      }
    }
  };

  return (
    <div className="m-1 flex h-full min-h-0 w-full flex-1 flex-row overflow-hidden rounded-t-3xl bg-stone-200 dark:bg-zinc-950/80">
      <ChannelsSidebar
        guild={guild}
        activeChannel={activeChannel}
        activeVoiceChannel={activeVoiceChannel}
        onSelectChannel={handleSelectChannel}
        onLeaveVoice={handleLeaveVoice}
        currentMember={currentMember}
      />

      <main className="relative flex h-full min-h-0 min-w-0 flex-1 overflow-hidden">
        {activeChannel ? (
          <ChatArea
            channel={activeChannel}
            currentUser={currentMember?.user}
            users={members.map(
              (member: any) => member?.user ?? member,
            )}
            channels={channels}
            mode="guild"
            activeVoiceChannel={activeVoiceChannel}
            onLeaveVoice={handleLeaveVoice}
          />
        ) : (
          <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-white text-sm text-zinc-500 dark:bg-[#111214]">
            Nenhum canal disponível.
          </div>
        )}
      </main>

      <MembersSidebar
        members={members}
        guildId={String(guild.id)}
      />
    </div>
  );
}
