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

import { updateUserProfile } from "@/actions/user";
import { useActivity } from "@/components/app/ActivityProvider";
import { useToast } from "@/components/app/ToastProvider";
import { onGatewayEvent } from "@/lib/realtime/gateway-client";
import type { CommandItem } from "../SearchCommand";

interface GuildLayoutProps {
  guild: any;
  currentMember: any;
  initialChannelId?: string | null;
}

export default function GuildLayout({
  guild,
  currentMember,
  initialChannelId,
}: GuildLayoutProps) {
  const router = useRouter();
  const { registerGuildScopes, setActiveLocation, setCurrentUserId } = useActivity();
  const { pushToast } = useToast();

  const [activeChannelId, setActiveChannelId] = useState<string | null>(
    initialChannelId ? String(initialChannelId) : null,
  );
  const [activeVoiceChannelId, setActiveVoiceChannelId] = useState<string | null>(null);
  const [lastTextChannelId, setLastTextChannelId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  const refreshTimerRef = useRef<number | null>(null);

  const channels = useMemo(
    () => guild?.channels ?? [],
    [guild],
  );

  const members = useMemo(
    () => guild?.members ?? [],
    [guild],
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
          (channel.type === "GUILD_VOICE" || channel.type === "GUILD_VIDEO"),
      ) ?? null,
    [channels, activeVoiceChannelId],
  );

  const textChannelFallback = useMemo(
    () =>
      channels.find((channel: any) => channel.type === "GUILD_TEXT") ??
      channels.find((channel: any) => channel.type === "GUILD_ANNOUNCEMENT") ??
      channels[0] ??
      null,
    [channels],
  );

  useEffect(() => {
    if (currentMember?.user?.id) {
      setCurrentUserId(String(currentMember.user.id));
    }
  }, [currentMember?.user?.id, setCurrentUserId]);

  useEffect(() => {
    if (!guild?.id) return;
    registerGuildScopes(
      String(guild.id),
      channels.map((channel: any) => String(channel.id)),
    );
  }, [channels, guild?.id, registerGuildScopes]);

  useEffect(() => {
    setActiveLocation({
      type: "guild",
      guildId: String(guild?.id ?? ""),
      channelId: activeChannelId,
    });
  }, [activeChannelId, guild?.id, setActiveLocation]);

  useEffect(() => {
    if (!guild?.id || !activeChannelId) return;
    window.localStorage.setItem(
      `typecord:last-channel:${guild.id}`,
      activeChannelId,
    );
  }, [activeChannelId, guild?.id]);

  useEffect(() => {
    if (channels.length === 0) {
      setActiveChannelId(null);
      setLastTextChannelId(null);
      return;
    }

    const preferredId =
      initialChannelId ??
      (guild?.id
        ? window.localStorage.getItem(`typecord:last-channel:${guild.id}`)
        : null);

    const preferredStillExists =
      preferredId !== null &&
      channels.some(
        (channel: any) => String(channel.id) === String(preferredId),
      );

    if (!activeChannelId && preferredStillExists) {
      setActiveChannelId(String(preferredId));
      router.replace(`/channels/${guild.id}/${preferredId}`);
      const preferredChannel = channels.find(
        (channel: any) => String(channel.id) === String(preferredId),
      );
      if (
        preferredChannel?.type === "GUILD_TEXT" ||
        preferredChannel?.type === "GUILD_ANNOUNCEMENT"
      ) {
        setLastTextChannelId(String(preferredId));
      }
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

    const fallbackChannel = textChannelFallback;

    if (fallbackChannel?.id) {
      const id = String(fallbackChannel.id);
      setActiveChannelId(id);
      router.replace(`/channels/${guild.id}/${id}`);

      if (fallbackChannel.type === "GUILD_TEXT") {
        setLastTextChannelId(id);
      }
    }
  }, [channels, activeChannelId, guild?.id, initialChannelId, router, textChannelFallback]);

  useEffect(() => {
    if (!activeVoiceChannelId) {
      return;
    }

    const stillExists = channels.some(
      (channel: any) =>
        String(channel.id) === String(activeVoiceChannelId) &&
        (channel.type === "GUILD_VOICE" || channel.type === "GUILD_VIDEO"),
    );

    if (!stillExists) {
      setActiveVoiceChannelId(null);
    }
  }, [channels, activeVoiceChannelId]);

  useEffect(() => {
    if (!guild?.id) {
      return;
    }

    if (guild?.onboarding?.enabled) {
      const key = `typecord:onboarding:${guild.id}`;
      setShowOnboarding(window.localStorage.getItem(key) !== "accepted");
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
      onGatewayEvent<any>("GUILD_MEMBER_UPDATE", ({ data }) => {
        if (String(data?.guildId ?? data?.member?.guildId ?? "") === String(guild.id)) {
          scheduleRefresh();
        }
      }),
      onGatewayEvent<any>("GUILD_ROLE_CREATE", ({ data }) => {
        if (String(data?.guildId ?? data?.role?.guildId ?? "") === String(guild.id)) {
          scheduleRefresh();
        }
      }),
      onGatewayEvent<any>("GUILD_ROLE_UPDATE", ({ data }) => {
        if (String(data?.guildId ?? data?.role?.guildId ?? "") === String(guild.id)) {
          scheduleRefresh();
        }
      }),
      onGatewayEvent<any>("GUILD_ROLE_DELETE", ({ data }) => {
        if (String(data?.guildId ?? "") === String(guild.id)) {
          scheduleRefresh();
        }
      }),
      onGatewayEvent<any>("GUILD_BAN_ADD", ({ data }) => {
        if (String(data?.guildId ?? "") === String(guild.id)) {
          scheduleRefresh();
        }
      }),
      onGatewayEvent<any>("GUILD_BAN_REMOVE", ({ data }) => {
        if (String(data?.guildId ?? "") === String(guild.id)) {
          scheduleRefresh();
        }
      }),
      onGatewayEvent<any>("INVITE_CREATE", ({ data }) => {
        if (String(data?.guildId ?? data?.invite?.guildId ?? "") === String(guild.id)) {
          scheduleRefresh();
        }
      }),
      onGatewayEvent<any>("INVITE_DELETE", ({ data }) => {
        if (String(data?.guildId ?? "") === String(guild.id)) {
          scheduleRefresh();
        }
      }),
      onGatewayEvent<any>("USER_UPDATE", ({ data }) => {
        const userId = String(data?.user?.id ?? data?.id ?? "");
        const hasMember = members.some((member: any) => String(member?.userId ?? member?.user?.id ?? "") === userId);

        if (userId && hasMember) {
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
  }, [guild, members, router]);

  const handleSelectChannel = (channel: any) => {
    const channelId = String(channel?.id ?? "");

    if (!channelId) {
      return;
    }

    setActiveChannelId(channelId);
    if (guild?.id) {
      router.push(`/channels/${guild.id}/${channelId}`);
    }

    if (channel?.type === "GUILD_TEXT" || channel?.type === "GUILD_ANNOUNCEMENT") {
      setLastTextChannelId(channelId);
      return;
    }

    if (channel?.type === "GUILD_VOICE" || channel?.type === "GUILD_VIDEO") {
      setActiveVoiceChannelId(channelId);
    }
  };

  const handleLeaveVoice = () => {
    const voiceId = activeVoiceChannelId;
    setActiveVoiceChannelId(null);

    if (
      (activeChannel?.type === "GUILD_VOICE" || activeChannel?.type === "GUILD_VIDEO") &&
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

  const acceptOnboarding = () => {
    if (!guild?.id) return;
    window.localStorage.setItem(`typecord:onboarding:${guild.id}`, "accepted");
    setShowOnboarding(false);
    const firstSuggestedId = guild.onboarding?.suggestedChannels?.[0]?.id;
    const nextChannel =
      channels.find((channel: any) => String(channel.id) === String(firstSuggestedId)) ??
      textChannelFallback;
    if (nextChannel) {
      handleSelectChannel(nextChannel);
    }
  };

  const onboardingStepKeys = ["rules"];
  if (
    Array.isArray(guild?.onboarding?.suggestedChannels) &&
    guild.onboarding.suggestedChannels.length > 0
  ) {
    onboardingStepKeys.push("channels");
  }
  if (
    Array.isArray(guild?.onboarding?.questions) &&
    guild.onboarding.questions.length > 0
  ) {
    onboardingStepKeys.push("questions");
  }

  const currentOnboardingStep =
    onboardingStepKeys[Math.min(onboardingStep, onboardingStepKeys.length - 1)] ?? "rules";

  const commandItems = useMemo<CommandItem[]>(() => {
    const channelItems = channels.map((channel: any) => ({
      id: `channel:${channel.id}`,
      label: `# ${channel.name}`,
      description:
        channel.type === "GUILD_VOICE" || channel.type === "GUILD_VIDEO"
          ? "Entrar em canal de voz"
          : "Ir para canal de texto",
      href: `/channels/${guild.id}/${channel.id}`,
      keywords: [guild.name, channel.type],
    }));

    const statusItems: CommandItem[] = [
      ["ONLINE", "Online"],
      ["IDLE", "Ausente"],
      ["DND", "Não perturbe"],
      ["OFFLINE", "Invisível"],
    ].map(([status, label]) => ({
      id: `status:${status}`,
      label: `Trocar status: ${label}`,
      description: "Atualiza sua presença",
      keywords: ["status", "presença"],
      action: async () => {
        try {
          await updateUserProfile({ status: status as any });
          pushToast({ type: "success", title: `Status alterado para ${label}.` });
          router.refresh();
        } catch (error) {
          pushToast({
            type: "error",
            title: "Não foi possível trocar o status",
            description: error instanceof Error ? error.message : "Tente novamente.",
          });
        }
      },
    }));

    return [
      ...channelItems,
      {
        id: "settings:guild",
        label: "Abrir configurações do servidor",
        description: guild.name,
        keywords: ["configurações", "servidor"],
        action: () => window.dispatchEvent(new CustomEvent("typecord:open-guild-settings")),
      },
      {
        id: "settings:invites",
        label: "Criar convite",
        description: "Abre as configurações de convites",
        keywords: ["convite", "invite"],
        action: () => window.dispatchEvent(new CustomEvent("typecord:open-guild-settings", { detail: { tab: "invites" } })),
      },
      ...statusItems,
    ];
  }, [channels, guild.id, guild.name, pushToast, router]);

  return (
    <div className="m-1 flex h-full min-h-0 w-full flex-1 flex-row overflow-hidden rounded-t-3xl bg-stone-200 dark:bg-zinc-950/80">
      {showOnboarding && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-[#1e1f22]">
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-500">
              Bem-vindo ao servidor
            </div>
            <h2 className="mt-2 text-2xl font-black text-zinc-950 dark:text-white">
              {guild.name}
            </h2>

            <div className="mt-4 flex items-center gap-2">
              {onboardingStepKeys.map((step, index) => (
                <span
                  key={step}
                  className={`h-1.5 flex-1 rounded-full ${
                    index <= onboardingStep
                      ? "bg-indigo-500"
                      : "bg-zinc-200 dark:bg-zinc-800"
                  }`}
                />
              ))}
            </div>

            {currentOnboardingStep === "rules" && (
              <div className="mt-5 max-h-[45vh] overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-700 dark:border-zinc-700 dark:bg-[#111214] dark:text-zinc-300">
                {guild.onboarding?.rules ? (
                  <p className="whitespace-pre-wrap">{guild.onboarding.rules}</p>
                ) : (
                  <p>Respeite os membros, mantenha conversas nos canais corretos e evite spam.</p>
                )}
              </div>
            )}

            {currentOnboardingStep === "channels" && (
              <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-[#111214]">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
                  Canais recomendados
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                {guild.onboarding.suggestedChannels.map((channel: any) => (
                  <button
                    key={channel.id ?? channel.name}
                    type="button"
                    onClick={() => {
                      const target = channels.find(
                        (item: any) => String(item.id) === String(channel.id),
                      );
                      if (target) handleSelectChannel(target);
                    }}
                    className="rounded-md bg-indigo-500/10 px-2 py-1 text-xs font-bold text-indigo-600 transition hover:bg-indigo-500 hover:text-white dark:text-indigo-300"
                  >
                    #{channel.name}
                  </button>
                ))}
                </div>
              </div>
            )}

            {currentOnboardingStep === "questions" && (
              <div className="mt-5 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
                  Perguntas de entrada
                </div>
                <div className="mt-3 space-y-2">
                  {guild.onboarding.questions.map((question: string, index: number) => (
                    <label key={`${question}-${index}`} className="block">
                      <span className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                        {question}
                      </span>
                      <input
                        className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-[#111214]"
                        placeholder="Sua resposta"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-6 flex justify-between gap-2">
              <button
                type="button"
                onClick={() => setOnboardingStep((current) => Math.max(0, current - 1))}
                disabled={onboardingStep === 0}
                className="rounded-xl px-4 py-2.5 text-sm font-bold text-zinc-500 transition hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-white/[0.06]"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onboardingStep < onboardingStepKeys.length - 1) {
                    setOnboardingStep((current) => current + 1);
                    return;
                  }
                  acceptOnboarding();
                }}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500"
              >
                {onboardingStep < onboardingStepKeys.length - 1
                  ? "Continuar"
                  : "Aceitar e entrar"}
              </button>
            </div>
          </div>
        </div>
      )}

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
            stickers={guild?.stickers ?? []}
            mode="guild"
            activeVoiceChannel={activeVoiceChannel}
            onLeaveVoice={handleLeaveVoice}
            commandItems={commandItems}
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
        roles={guild?.roles ?? []}
        currentMember={currentMember}
      />
    </div>
  );
}
