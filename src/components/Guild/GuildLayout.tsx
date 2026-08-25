"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import ChannelsSidebar from "./ChannelsSideBar";
import ChatArea from "./ChatArea";
import MembersSidebar from "./MembersSidebar";
import VoiceChannelRoom from "../VoiceRoom";

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

  const [activeChannelId, setActiveChannelId] =
    useState<string | null>(null);

  const [activeVoiceChannelId, setActiveVoiceChannelId] =
    useState<string | null>(null);

  const [showVoiceView, setShowVoiceView] =
    useState(false);

  const refreshTimerRef =
    useRef<number | null>(null);

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
          String(channel.id) ===
          String(activeChannelId),
      ) ?? null,
    [channels, activeChannelId],
  );

  const activeVoiceChannel = useMemo(
    () =>
      channels.find(
        (channel: any) =>
          String(channel.id) ===
          String(activeVoiceChannelId),
      ) ?? null,
    [channels, activeVoiceChannelId],
  );

  useEffect(() => {
    if (channels.length === 0) {
      setActiveChannelId(null);
      return;
    }

    const currentStillExists =
      activeChannelId &&
      channels.some(
        (channel: any) =>
          String(channel.id) ===
            String(activeChannelId) &&
          channel.type === "GUILD_TEXT",
      );

    if (currentStillExists) {
      return;
    }

    const firstTextChannel =
      channels.find(
        (channel: any) =>
          channel.type === "GUILD_TEXT",
      );

    if (firstTextChannel) {
      setActiveChannelId(
        String(firstTextChannel.id),
      );
    }
  }, [channels, activeChannelId]);

  useEffect(() => {
    if (!activeVoiceChannelId) {
      return;
    }

    const voiceStillExists =
      channels.some(
        (channel: any) =>
          String(channel.id) ===
            String(activeVoiceChannelId) &&
          channel.type === "GUILD_VOICE",
      );

    if (!voiceStillExists) {
      setActiveVoiceChannelId(null);
      setShowVoiceView(false);
    }
  }, [channels, activeVoiceChannelId]);

  useEffect(() => {
    if (!guild?.id) return;

    const scheduleRefresh = () => {
      if (
        refreshTimerRef.current !== null
      ) {
        window.clearTimeout(
          refreshTimerRef.current,
        );
      }

      refreshTimerRef.current =
        window.setTimeout(() => {
          refreshTimerRef.current = null;
          router.refresh();
        }, 150);
    };

    const removers = [
      onGatewayEvent<any>(
        "GUILD_UPDATE",
        ({ data }) => {
          if (
            String(data?.id ?? data?.guildId ?? "") ===
            String(guild.id)
          ) {
            scheduleRefresh();
          }
        },
      ),

      onGatewayEvent<any>(
        "CHANNEL_CREATE",
        ({ data }) => {
          if (
            String(data?.guildId ?? "") ===
            String(guild.id)
          ) {
            scheduleRefresh();
          }
        },
      ),

      onGatewayEvent<any>(
        "CHANNEL_UPDATE",
        ({ data }) => {
          if (
            String(data?.guildId ?? "") ===
            String(guild.id)
          ) {
            scheduleRefresh();
          }
        },
      ),

      onGatewayEvent<any>(
        "CHANNEL_DELETE",
        ({ data }) => {
          if (
            String(data?.guildId ?? "") ===
            String(guild.id)
          ) {
            scheduleRefresh();
          }
        },
      ),

      onGatewayEvent<any>(
        "GUILD_MEMBER_ADD",
        ({ data }) => {
          if (
            String(data?.guildId ?? "") ===
            String(guild.id)
          ) {
            scheduleRefresh();
          }
        },
      ),

      onGatewayEvent<any>(
        "GUILD_MEMBER_REMOVE",
        ({ data }) => {
          if (
            String(data?.guildId ?? "") ===
            String(guild.id)
          ) {
            scheduleRefresh();
          }
        },
      ),
    ];

    return () => {
      for (const remove of removers) {
        remove();
      }

      if (
        refreshTimerRef.current !== null
      ) {
        window.clearTimeout(
          refreshTimerRef.current,
        );
      }
    };
  }, [guild?.id, router]);

  const handleSelectTextChannel = (
    channel: any,
  ) => {
    setActiveChannelId(
      String(channel.id),
    );

    setShowVoiceView(false);
  };

  const handleJoinVoice = (
    channel: any,
  ) => {
    setActiveVoiceChannelId(
      String(channel.id),
    );

    setShowVoiceView(true);
  };

  const handleLeaveVoice = () => {
    setActiveVoiceChannelId(null);
    setShowVoiceView(false);
  };

  return (
    <div className="m-1 flex w-full flex-row overflow-hidden rounded-t-3xl bg-stone-200 dark:bg-zinc-950/80">
      <ChannelsSidebar
        guild={guild}
        activeChannel={activeChannel}
        onSelectChannel={
          handleSelectTextChannel
        }
        activeVoiceChannel={
          activeVoiceChannel
        }
        onJoinVoice={
          handleJoinVoice
        }
        onLeaveVoice={
          handleLeaveVoice
        }
        currentMember={currentMember}
      />

      <main className="relative flex min-w-0 flex-1 overflow-hidden">
        <div
          className={
            showVoiceView &&
            activeVoiceChannel
              ? "flex h-full min-w-0 flex-1"
              : "hidden"
          }
        >
          {activeVoiceChannel && (
            <VoiceChannelRoom
              channelId={
                activeVoiceChannel.id
              }
              channelName={
                activeVoiceChannel.name
              }
              onLeave={
                handleLeaveVoice
              }
            />
          )}
        </div>

        <div
          className={
            !showVoiceView
              ? "flex h-full min-w-0 flex-1"
              : "hidden"
          }
        >
          {activeChannel ? (
            <ChatArea
              channel={activeChannel}
              currentUser={
                currentMember?.user
              }
              users={members.map(
                (member: any) =>
                  member?.user ??
                  member,
              )}
              channels={channels}
              mode="guild"
            />
          ) : (
            <div className="flex flex-1 items-center justify-center bg-white text-sm text-zinc-500 dark:bg-[#111214]">
              Nenhum canal de texto disponível.
            </div>
          )}
        </div>
      </main>

      <MembersSidebar
        members={members}
        guildId={String(guild.id)}
      />
    </div>
  );
}