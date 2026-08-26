"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Hash,
  HeadphoneOff,
  Loader2,
  LogOut,
  MicOff,
  Monitor,
  MoreHorizontal,
  Pencil,
  PhoneOff,
  Plus,
  Search,
  Settings,
  Signal,
  Trash2,
  Users,
  Video,
  Volume2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { createChannel } from "@/actions/channels";
import {
  Permissions,
  hasPermission,
  normalizePermissions,
} from "@/lib/permissions";
import { onGatewayEvent } from "@/lib/realtime/gateway-client";

import Avatar from "../Image/Avatar";
import Modal from "../Modal";
import UserProfileSideBar from "../UserProfileSideBar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import GuildSettingsModal from "./GuildSettingsModal";

type ChannelType = "GUILD_TEXT" | "GUILD_VOICE";
type DropPosition = "before" | "after";

interface ChannelsSidebarProps {
  guild: any;
  activeChannel: any;
  onSelectChannel: (channel: any) => void;
  activeVoiceChannel?: any;
  onJoinVoice?: (channel: any) => void;
  onLeaveVoice?: () => void;
  currentMember: any;
}

interface VoicePresence {
  userId: string;
  connected: boolean;
  muted: boolean;
  deafened: boolean;
  camera: boolean;
  streaming: boolean;
  speaking: boolean;
  ping: number | null;
  connectionQuality: string | null;
}

type VoicePresenceMap = Record<string, VoicePresence[]>;

interface FeedbackState {
  type: "success" | "error";
  message: string;
}

function resolveFileUrl(urlOrKey?: string | null) {
  if (!urlOrKey) return "";
  if (
    urlOrKey.startsWith("http://") ||
    urlOrKey.startsWith("https://") ||
    urlOrKey.startsWith("blob:") ||
    urlOrKey.startsWith("/")
  ) {
    return urlOrKey;
  }
  return `/api/files?key=${encodeURIComponent(urlOrKey)}`;
}

function sortChannels(channels: any[]) {
  return channels
    .map((channel, originalIndex) => ({ channel, originalIndex }))
    .sort((left, right) => {
      const leftPosition = Number(left.channel?.position);
      const rightPosition = Number(right.channel?.position);
      const normalizedLeftPosition = Number.isFinite(leftPosition)
        ? leftPosition
        : left.originalIndex;
      const normalizedRightPosition = Number.isFinite(rightPosition)
        ? rightPosition
        : right.originalIndex;

      return (
        normalizedLeftPosition - normalizedRightPosition ||
        left.originalIndex - right.originalIndex
      );
    })
    .map(({ channel }) => channel);
}

function toBoolean(...values: unknown[]) {
  return values.some((value) => value === true);
}

function toPing(value: unknown) {
  const ping = Number(value);
  return Number.isFinite(ping) && ping >= 0 ? Math.round(ping) : null;
}

function normalizeVoicePresence(value: unknown): VoicePresence | null {
  if (typeof value === "string" || typeof value === "number") {
    return {
      userId: String(value),
      connected: true,
      muted: false,
      deafened: false,
      camera: false,
      streaming: false,
      speaking: false,
      ping: null,
      connectionQuality: null,
    };
  }

  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, any>;
  const state = (raw.voiceState ?? raw.state ?? raw) as Record<string, any>;
  const userId = String(
    state.userId ??
      state.user?.id ??
      state.member?.userId ??
      state.member?.user?.id ??
      state.id ??
      "",
  );

  if (!userId) return null;

  return {
    userId,
    connected: state.connected !== false,
    muted: toBoolean(
      state.muted,
      state.selfMuted,
      state.selfMute,
      state.serverMuted,
    ),
    deafened: toBoolean(
      state.deafened,
      state.selfDeafened,
      state.selfDeaf,
      state.serverDeafened,
    ),
    camera: toBoolean(state.camera, state.video, state.videoEnabled),
    streaming: toBoolean(
      state.streaming,
      state.stream,
      state.screenShare,
      state.screenSharing,
    ),
    speaking: toBoolean(state.speaking, state.isSpeaking),
    ping: toPing(state.ping ?? state.latency ?? state.rtt),
    connectionQuality:
      typeof state.connectionQuality === "string"
        ? state.connectionQuality
        : typeof state.quality === "string"
          ? state.quality
          : null,
  };
}

function normalizeVoiceChannels(value: unknown): VoicePresenceMap {
  if (!value || typeof value !== "object") return {};

  return Object.entries(value as Record<string, unknown>).reduce(
    (channels, [channelId, entries]) => {
      if (!Array.isArray(entries)) return channels;
      channels[channelId] = entries
        .map(normalizeVoicePresence)
        .filter((presence): presence is VoicePresence => Boolean(presence));
      return channels;
    },
    {} as VoicePresenceMap,
  );
}

function getPingColor(ping: number | null) {
  if (ping === null) return "text-zinc-500";
  if (ping <= 80) return "text-emerald-500";
  if (ping <= 160) return "text-amber-500";
  return "text-red-500";
}

async function channelRequest(
  channelId: string,
  method: "PATCH" | "DELETE",
  body?: Record<string, unknown>,
) {
  const response = await fetch(
    `/api/channels/${encodeURIComponent(channelId)}`,
    {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    },
  );

  const data = response.status === 204
    ? null
    : await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.message ?? data?.error ?? "Não foi possível atualizar o canal.",
    );
  }

  return data?.channel ?? data;
}

export default function ChannelsSidebar({
  guild,
  activeChannel,
  onSelectChannel,
  activeVoiceChannel,
  onJoinVoice,
  onLeaveVoice,
  currentMember,
}: ChannelsSidebarProps) {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isCreateChannelModalOpen, setIsCreateChannelModalOpen] = useState(false);
  const [isChannelListCollapsed, setIsChannelListCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [channelName, setChannelName] = useState("");
  const [channelType, setChannelType] = useState<ChannelType>("GUILD_TEXT");
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [voiceUsers, setVoiceUsers] = useState<VoicePresenceMap>({});
  const [orderedChannels, setOrderedChannels] = useState<any[]>(() =>
    sortChannels(guild?.channels ?? []),
  );
  const [openChannelMenuId, setOpenChannelMenuId] = useState<string | null>(
    null,
  );
  const [editingChannel, setEditingChannel] = useState<any | null>(null);
  const [editedChannelName, setEditedChannelName] = useState("");
  const [deletingChannel, setDeletingChannel] = useState<any | null>(null);
  const [channelActionId, setChannelActionId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [draggingChannelId, setDraggingChannelId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    channelId: string;
    position: DropPosition;
  } | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const resolvedBannerUrl = resolveFileUrl(guild?.bannerUrl);
  const currentUserId = String(
    currentMember?.user?.id ?? currentMember?.userId ?? "",
  );

  const showFeedback = useCallback((nextFeedback: FeedbackState) => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    setFeedback(nextFeedback);
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
      feedbackTimerRef.current = null;
    }, 4200);
  }, []);

  useEffect(() => {
    setOrderedChannels(sortChannels(guild?.channels ?? []));
  }, [guild?.channels]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsDropdownOpen(false);
      }
      if (!target.closest("[data-channel-actions]")) {
        setOpenChannelMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const isOwner =
    Boolean(currentUserId) &&
    String(guild?.ownerId ?? "") === currentUserId;

  const memberPermissions = useMemo(
    () =>
      (currentMember?.roles ?? []).reduce(
        (permissions: bigint, role: any) =>
          permissions | normalizePermissions(role?.permissions),
        0n,
      ),
    [currentMember?.roles],
  );

  const canManageChannels =
    isOwner ||
    hasPermission(memberPermissions, Permissions.MANAGE_CHANNELS);
  const canManageGuild =
    isOwner || hasPermission(memberPermissions, Permissions.MANAGE_GUILD);

  const visibleChannels = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("pt-BR");
    if (!normalizedQuery) return orderedChannels;
    return orderedChannels.filter((channel) =>
      String(channel?.name ?? "")
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedQuery),
    );
  }, [orderedChannels, searchQuery]);

  const getVoiceMember = useCallback(
    (userId: string) =>
      guild?.members?.find(
        (member: any) =>
          String(member?.user?.id ?? member?.userId ?? "") ===
          String(userId),
      ),
    [guild?.members],
  );

  useEffect(() => {
    if (!guild?.id) return;

    let cancelled = false;

    fetch(
      `/api/realtime/voice-state?guildId=${encodeURIComponent(String(guild.id))}`,
      { cache: "no-store" },
    )
      .then(async (response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data?.success || !data?.channels) return;
        setVoiceUsers(normalizeVoiceChannels(data.channels));
      })
      .catch((voiceStateError) => {
        console.error("[VOICE_STATE_INITIAL_LOAD]", voiceStateError);
      });

    const removeVoiceListener = onGatewayEvent<any>(
      "VOICE_STATE_UPDATE",
      ({ data }) => {
        if (String(data?.guildId ?? "") !== String(guild.id)) return;

        const rawState = data?.voiceState ?? data?.state ?? data;
        const presence = normalizeVoicePresence(rawState);
        const userId = String(
          presence?.userId ?? data?.userId ?? data?.user?.id ?? "",
        );
        const channelId = String(
          data?.channelId ?? rawState?.channelId ?? "",
        );
        const connected = Boolean(
          data?.connected ?? rawState?.connected ?? channelId,
        );

        if (!userId) return;

        setVoiceUsers((current) => {
          const next = Object.fromEntries(
            Object.entries(current).map(([id, entries]) => [
              id,
              entries.filter((entry) => entry.userId !== userId),
            ]),
          ) as VoicePresenceMap;

          const previousPresence = Object.values(current)
            .flat()
            .find((entry) => entry.userId === userId);

          if (connected && channelId) {
            next[channelId] = [
              ...(next[channelId] ?? []),
              {
                ...(previousPresence ?? {
                  userId,
                  connected: true,
                  muted: false,
                  deafened: false,
                  camera: false,
                  streaming: false,
                  speaking: false,
                  ping: null,
                  connectionQuality: null,
                }),
                ...(presence ?? {}),
                userId,
                connected: true,
              },
            ];
          }

          return next;
        });
      },
    );

    return () => {
      cancelled = true;
      removeVoiceListener();
    };
  }, [guild?.id]);

  const inferredVoiceChannel =
    orderedChannels.find((channel: any) => {
      if (channel?.type !== "GUILD_VOICE") return false;
      return (voiceUsers[String(channel.id)] ?? []).some(
        (presence) => presence.userId === currentUserId,
      );
    }) ?? null;

  const displayedVoiceChannel = activeVoiceChannel ?? inferredVoiceChannel;
  const displayedVoicePresence = displayedVoiceChannel
    ? (voiceUsers[String(displayedVoiceChannel.id)] ?? []).find(
        (presence) => presence.userId === currentUserId,
      )
    : null;

  const handleCreateChannel = async () => {
    const normalizedName = channelName.trim();
    if (!normalizedName || isCreatingChannel) return;

    setIsCreatingChannel(true);
    try {
      await createChannel(guild.id, normalizedName, channelType);
      setIsCreateChannelModalOpen(false);
      setChannelName("");
      showFeedback({ type: "success", message: "Canal criado com sucesso." });
      router.refresh();
    } catch (createError) {
      console.error("[CHANNEL_CREATE]", createError);
      showFeedback({
        type: "error",
        message:
          createError instanceof Error
            ? createError.message
            : "Não foi possível criar o canal.",
      });
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const handleChannelClick = (channel: any) => {
    onSelectChannel(channel);
    if (channel?.type === "GUILD_VOICE") onJoinVoice?.(channel);
  };

  const openEditChannel = (channel: any) => {
    setEditingChannel(channel);
    setEditedChannelName(String(channel?.name ?? ""));
    setOpenChannelMenuId(null);
  };

  const handleEditChannel = async () => {
    const name = editedChannelName.trim();
    const channelId = String(editingChannel?.id ?? "");
    if (!name || !channelId || channelActionId) return;

    setChannelActionId(channelId);
    try {
      const updatedChannel = await channelRequest(channelId, "PATCH", {
        guildId: guild.id,
        name,
      });

      setOrderedChannels((current) =>
        current.map((channel) =>
          String(channel.id) === channelId
            ? { ...channel, ...(updatedChannel ?? {}), name }
            : channel,
        ),
      );
      setEditingChannel(null);
      showFeedback({ type: "success", message: "Canal atualizado." });
      router.refresh();
    } catch (editError) {
      console.error("[CHANNEL_UPDATE]", editError);
      showFeedback({
        type: "error",
        message:
          editError instanceof Error
            ? editError.message
            : "Não foi possível editar o canal.",
      });
    } finally {
      setChannelActionId(null);
    }
  };

  const handleDeleteChannel = async () => {
    const channelId = String(deletingChannel?.id ?? "");
    if (!channelId || channelActionId) return;

    setChannelActionId(channelId);
    try {
      await channelRequest(channelId, "DELETE");
      const nextChannels = orderedChannels.filter(
        (channel) => String(channel.id) !== channelId,
      );
      setOrderedChannels(nextChannels);

      if (String(displayedVoiceChannel?.id ?? "") === channelId) {
        onLeaveVoice?.();
      }

      if (String(activeChannel?.id ?? "") === channelId) {
        const fallback =
          nextChannels.find((channel) => channel.type === "GUILD_TEXT") ??
          nextChannels[0];
        if (fallback) onSelectChannel(fallback);
      }

      setDeletingChannel(null);
      showFeedback({ type: "success", message: "Canal excluído." });
      router.refresh();
    } catch (deleteError) {
      console.error("[CHANNEL_DELETE]", deleteError);
      showFeedback({
        type: "error",
        message:
          deleteError instanceof Error
            ? deleteError.message
            : "Não foi possível excluir o canal.",
      });
    } finally {
      setChannelActionId(null);
    }
  };

  const persistChannelOrder = async (
    previousChannels: any[],
    nextChannels: any[],
  ) => {
    if (isReordering) return;

    const positionedChannels = nextChannels.map((channel, position) => ({
      ...channel,
      position,
    }));
    const previousPositions = new Map(
      previousChannels.map((channel, index) => [
        String(channel.id),
        Number.isFinite(Number(channel.position))
          ? Number(channel.position)
          : index,
      ]),
    );
    const changedChannels = positionedChannels.filter(
      (channel) =>
        previousPositions.get(String(channel.id)) !== channel.position,
    );

    setOrderedChannels(positionedChannels);
    setIsReordering(true);
    setOpenChannelMenuId(null);

    try {
      await Promise.all(
        changedChannels.map((channel) =>
          channelRequest(String(channel.id), "PATCH", {
            guildId: guild.id,
            position: channel.position,
          }),
        ),
      );
      showFeedback({ type: "success", message: "Ordem dos canais atualizada." });
      router.refresh();
    } catch (reorderError) {
      console.error("[CHANNEL_REORDER]", reorderError);
      setOrderedChannels(previousChannels);
      showFeedback({
        type: "error",
        message:
          reorderError instanceof Error
            ? reorderError.message
            : "Não foi possível mover o canal.",
      });
    } finally {
      setIsReordering(false);
      setDraggingChannelId(null);
      setDropTarget(null);
    }
  };

  const moveChannelByOffset = (channelId: string, offset: -1 | 1) => {
    const previousChannels = [...orderedChannels];
    const currentIndex = previousChannels.findIndex(
      (channel) => String(channel.id) === channelId,
    );
    const targetIndex = currentIndex + offset;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= previousChannels.length) {
      return;
    }

    const nextChannels = [...previousChannels];
    const [movedChannel] = nextChannels.splice(currentIndex, 1);
    nextChannels.splice(targetIndex, 0, movedChannel);
    void persistChannelOrder(previousChannels, nextChannels);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, channelId: string) => {
    if (!draggingChannelId || draggingChannelId === channelId) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const position: DropPosition =
      event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";
    setDropTarget({ channelId, position });
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!draggingChannelId || !dropTarget) return;

    const previousChannels = [...orderedChannels];
    const nextChannels = [...previousChannels];
    const sourceIndex = nextChannels.findIndex(
      (channel) => String(channel.id) === draggingChannelId,
    );
    if (sourceIndex < 0) return;

    const [movedChannel] = nextChannels.splice(sourceIndex, 1);
    const targetIndex = nextChannels.findIndex(
      (channel) => String(channel.id) === dropTarget.channelId,
    );
    if (targetIndex < 0) return;

    nextChannels.splice(
      dropTarget.position === "after" ? targetIndex + 1 : targetIndex,
      0,
      movedChannel,
    );

    if (
      nextChannels.every(
        (channel, index) =>
          String(channel.id) === String(previousChannels[index]?.id),
      )
    ) {
      setDraggingChannelId(null);
      setDropTarget(null);
      return;
    }

    void persistChannelOrder(previousChannels, nextChannels);
  };

  return (
    <>
      <aside className="relative flex w-64 shrink-0 flex-col overflow-hidden border-r border-stone-300/70 bg-stone-100/95 text-stone-700 dark:border-white/[0.05] dark:bg-[#111214] dark:text-zinc-300">
        <div ref={dropdownRef} className="relative z-40 w-full shrink-0">
          <button
            type="button"
            onClick={() => setIsDropdownOpen((current) => !current)}
            className={`group relative flex w-full items-start justify-between overflow-hidden text-left transition ${
              resolvedBannerUrl
                ? "h-28 bg-zinc-800"
                : "h-14 items-center border-b border-stone-300/70 px-4 shadow-sm hover:bg-stone-200/80 dark:border-white/[0.06] dark:hover:bg-white/[0.04]"
            }`}
          >
            {resolvedBannerUrl && (
              <>
                <img
                  src={resolvedBannerUrl}
                  alt={`Banner de ${guild?.name ?? "servidor"}`}
                  className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <span className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/25 to-black/80" />
              </>
            )}

            <span
              className={`relative z-10 flex min-w-0 flex-1 items-center gap-2 font-bold ${
                resolvedBannerUrl ? "p-4 text-white" : "text-stone-900 dark:text-white"
              }`}
            >
              {guild?.verified && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex shrink-0 items-center">
                      <BadgeCheck className="h-5 w-5 fill-emerald-400 text-white dark:text-[#111214]" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Servidor verificado</TooltipContent>
                </Tooltip>
              )}
              <span className="truncate text-sm">{guild?.name}</span>
            </span>

            <ChevronDown
              className={`relative z-10 h-4 w-4 shrink-0 transition duration-200 ${
                resolvedBannerUrl ? "m-4 text-white" : "text-stone-500"
              } ${isDropdownOpen ? "rotate-180" : ""}`}
            />
          </button>

          {isDropdownOpen && (
            <div className="absolute left-2 right-2 top-full z-[80] mt-2 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-2xl shadow-black/20 dark:border-white/10 dark:bg-[#18191e]">
              {canManageGuild && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsModalOpen(true);
                    setIsDropdownOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition hover:bg-indigo-500 hover:text-white"
                >
                  Configurações do servidor
                  <Settings className="h-4 w-4" />
                </button>
              )}
              {canManageChannels && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateChannelModalOpen(true);
                    setIsDropdownOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition hover:bg-indigo-500 hover:text-white"
                >
                  Criar canal
                  <Plus className="h-4 w-4" />
                </button>
              )}
              <div className="my-1 h-px bg-stone-200 dark:bg-white/[0.07]" />
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-500 hover:text-white"
              >
                Sair do servidor
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-2 px-2.5 pb-2 pt-3">
          <label className="group flex h-9 items-center gap-2 rounded-xl border border-stone-300/70 bg-white/70 px-3 transition focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-400/10 dark:border-white/[0.06] dark:bg-black/20">
            <Search className="h-3.5 w-3.5 shrink-0 text-stone-400 dark:text-zinc-500" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar canal"
              className="min-w-0 flex-1 bg-transparent text-xs font-medium text-stone-800 outline-none placeholder:text-stone-400 dark:text-zinc-200 dark:placeholder:text-zinc-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-stone-400 hover:text-stone-700 dark:text-zinc-600 dark:hover:text-zinc-300"
                aria-label="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>

          {feedback && (
            <div
              className={`flex items-start gap-2 rounded-xl border px-2.5 py-2 text-[10px] font-semibold leading-4 ${
                feedback.type === "success"
                  ? "border-emerald-400/15 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                  : "border-red-400/15 bg-red-500/10 text-red-600 dark:text-red-300"
              }`}
            >
              {feedback.type === "success" ? (
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              ) : (
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              )}
              <span className="min-w-0 flex-1">{feedback.message}</span>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 [scrollbar-width:thin] dark:[scrollbar-color:#27272a_transparent]">
          <div className="sticky top-0 z-20 flex items-center gap-1 bg-stone-100/95 px-1 pb-1 pt-2 backdrop-blur dark:bg-[#111214]/95">
            <button
              type="button"
              onClick={() => setIsChannelListCollapsed((current) => !current)}
              className="flex min-w-0 flex-1 items-center gap-1 rounded-lg px-1 py-1 text-left text-[10px] font-bold uppercase tracking-[0.14em] text-stone-500 transition hover:text-stone-800 dark:text-zinc-500 dark:hover:text-zinc-300"
            >
              {isChannelListCollapsed ? (
                <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              <span className="truncate">Canais</span>
              <span className="ml-1 rounded-full bg-stone-200 px-1.5 py-0.5 text-[8px] tabular-nums dark:bg-white/[0.06]">
                {orderedChannels.length}
              </span>
            </button>

            {isReordering && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />}
            {canManageChannels && (
              <button
                type="button"
                onClick={() => setIsCreateChannelModalOpen(true)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-200 hover:text-stone-900 dark:text-zinc-500 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200"
                title="Criar canal"
                aria-label="Criar canal"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>

          {!isChannelListCollapsed && (
            <div className="mt-1 space-y-0.5">
              {visibleChannels.map((channel: any) => {
                const channelId = String(channel.id);
                const channelIndex = orderedChannels.findIndex(
                  (item) => String(item.id) === channelId,
                );
                const isVoice = channel.type === "GUILD_VOICE";
                const isActive = String(activeChannel?.id ?? "") === channelId;
                const connectedUsers = voiceUsers[channelId] ?? [];
                const isConnectedVoice =
                  isVoice &&
                  String(displayedVoiceChannel?.id ?? "") === channelId;
                const userLimit = Number(channel?.userLimit ?? 0);
                const isFull = userLimit > 0 && connectedUsers.length >= userLimit;
                const sortedConnectedUsers = [...connectedUsers].sort(
                  (left, right) => {
                    if (left.userId === currentUserId) return -1;
                    if (right.userId === currentUserId) return 1;
                    const leftMember = getVoiceMember(left.userId);
                    const rightMember = getVoiceMember(right.userId);
                    const leftUser = leftMember?.user ?? leftMember;
                    const rightUser = rightMember?.user ?? rightMember;
                    return String(
                      leftUser?.globalName ?? leftUser?.username ?? "",
                    ).localeCompare(
                      String(
                        rightUser?.globalName ?? rightUser?.username ?? "",
                      ),
                      "pt-BR",
                    );
                  },
                );

                return (
                  <div
                    key={channelId}
                    onDragOver={(event) => handleDragOver(event, channelId)}
                    onDrop={handleDrop}
                    className="relative"
                  >
                    {dropTarget?.channelId === channelId && (
                      <span
                        className={`pointer-events-none absolute inset-x-1 z-30 h-0.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.7)] ${
                          dropTarget.position === "before" ? "top-0" : "bottom-0"
                        }`}
                      />
                    )}

                    <div
                      className={`group/channel flex min-h-9 items-center rounded-xl transition ${
                        isActive
                          ? "bg-stone-200 text-stone-900 dark:bg-white/[0.08] dark:text-white"
                          : "text-stone-600 hover:bg-stone-200/70 hover:text-stone-900 dark:text-zinc-500 dark:hover:bg-white/[0.045] dark:hover:text-zinc-200"
                      } ${draggingChannelId === channelId ? "opacity-40" : ""}`}
                    >
                      {canManageChannels && !searchQuery && (
                        <button
                          type="button"
                          draggable={!isReordering}
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", channelId);
                            setDraggingChannelId(channelId);
                          }}
                          onDragEnd={() => {
                            setDraggingChannelId(null);
                            setDropTarget(null);
                          }}
                          className="hidden h-8 w-5 shrink-0 cursor-grab items-center justify-center text-stone-400 active:cursor-grabbing group-hover/channel:flex dark:text-zinc-600"
                          title="Arrastar canal"
                          aria-label={`Mover ${channel.name}`}
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleChannelClick(channel)}
                        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left"
                      >
                        {isVoice ? (
                          <Volume2
                            className={`h-4 w-4 shrink-0 ${
                              isConnectedVoice ? "text-emerald-500" : ""
                            }`}
                          />
                        ) : (
                          <Hash className="h-4 w-4 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                          {channel.name}
                        </span>
                        {isVoice && connectedUsers.length > 0 && (
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums ${
                              isFull
                                ? "bg-red-500/10 text-red-500"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {connectedUsers.length}{userLimit > 0 ? `/${userLimit}` : ""}
                          </span>
                        )}
                      </button>

                      {canManageChannels && (
                        <div className="relative shrink-0 pr-1" data-channel-actions>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setOpenChannelMenuId((current) =>
                                current === channelId ? null : channelId,
                              );
                            }}
                            className={`flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/[0.06] ${
                              openChannelMenuId === channelId
                                ? "opacity-100"
                                : "opacity-0 group-hover/channel:opacity-100"
                            }`}
                            aria-label={`Ações de ${channel.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>

                          {openChannelMenuId === channelId && (
                            <div className="absolute right-0 top-8 z-[70] w-44 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-2xl shadow-black/20 dark:border-white/10 dark:bg-[#1a1b20]">
                              <button
                                type="button"
                                onClick={() => openEditChannel(channel)}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition hover:bg-indigo-500 hover:text-white"
                              >
                                Editar canal
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveChannelByOffset(channelId, -1)}
                                disabled={channelIndex <= 0 || isReordering}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition hover:bg-stone-100 disabled:opacity-40 dark:hover:bg-white/[0.06]"
                              >
                                Mover para cima
                                <ArrowUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveChannelByOffset(channelId, 1)}
                                disabled={
                                  channelIndex >= orderedChannels.length - 1 ||
                                  isReordering
                                }
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition hover:bg-stone-100 disabled:opacity-40 dark:hover:bg-white/[0.06]"
                              >
                                Mover para baixo
                                <ArrowDown className="h-3.5 w-3.5" />
                              </button>
                              <div className="my-1 h-px bg-stone-200 dark:bg-white/[0.07]" />
                              <button
                                type="button"
                                onClick={() => {
                                  setDeletingChannel(channel);
                                  setOpenChannelMenuId(null);
                                }}
                                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-500 hover:text-white"
                              >
                                Excluir canal
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {isVoice && sortedConnectedUsers.length > 0 && (
                      <div className="ml-7 mt-0.5 space-y-0.5 pb-1">
                        {sortedConnectedUsers.map((presence) => {
                          const member = getVoiceMember(presence.userId);
                          const user = member?.user ?? member;
                          const isCurrentUser = presence.userId === currentUserId;

                          return (
                            <button
                              key={`${channelId}:${presence.userId}`}
                              type="button"
                              onClick={() => handleChannelClick(channel)}
                              className="group/member flex w-full min-w-0 items-center gap-2 rounded-xl px-1.5 py-1.5 text-left text-[11px] text-stone-500 transition hover:bg-stone-200/70 hover:text-stone-800 dark:text-zinc-500 dark:hover:bg-white/[0.045] dark:hover:text-zinc-200"
                            >
                              <div className="relative shrink-0">
                                <Avatar
                                  avatarUrl={user?.avatarUrl}
                                  username={user?.username}
                                  globalName={user?.globalName}
                                  className={`h-6 w-6 ${
                                    presence.speaking
                                      ? "ring-2 ring-emerald-400 ring-offset-1 ring-offset-stone-100 dark:ring-offset-[#111214]"
                                      : ""
                                  }`}
                                />
                                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-stone-100 bg-emerald-500 dark:border-[#111214]" />
                              </div>

                              <span className="min-w-0 flex-1 truncate font-medium">
                                {user?.globalName || user?.username || "Usuário"}
                                {isCurrentUser && (
                                  <span className="ml-1 text-[8px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                                    você
                                  </span>
                                )}
                              </span>

                              <span className="flex shrink-0 items-center gap-1">
                                {presence.streaming && (
                                  <Monitor className="h-3 w-3 text-emerald-500" aria-label="Transmitindo tela" />
                                )}
                                {presence.camera && (
                                  <Video className="h-3 w-3 text-sky-500" aria-label="Câmera ligada" />
                                )}
                                {presence.deafened && (
                                  <HeadphoneOff className="h-3 w-3 text-red-500" aria-label="Surdo" />
                                )}
                                {presence.muted && (
                                  <MicOff className="h-3 w-3 text-red-500" aria-label="Microfone silenciado" />
                                )}
                                {presence.ping !== null && (
                                  <span
                                    className={`ml-0.5 flex items-center gap-0.5 text-[8px] font-bold tabular-nums ${getPingColor(presence.ping)}`}
                                    title={`${presence.ping} ms`}
                                  >
                                    <Signal className="h-2.5 w-2.5" />
                                    {presence.ping}
                                  </span>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {visibleChannels.length === 0 && (
                <div className="mx-1 mt-4 rounded-2xl border border-dashed border-stone-300 px-3 py-5 text-center dark:border-white/[0.08]">
                  <Search className="mx-auto h-5 w-5 text-stone-400 dark:text-zinc-600" />
                  <p className="mt-2 text-[10px] font-semibold text-stone-500 dark:text-zinc-500">
                    Nenhum canal encontrado
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {displayedVoiceChannel && (
          <div className="mx-2 mb-2 shrink-0 overflow-hidden rounded-2xl border border-emerald-400/15 bg-gradient-to-br from-emerald-500/10 to-sky-500/[0.05] shadow-lg shadow-emerald-500/5">
            <button
              type="button"
              onClick={() => handleChannelClick(displayedVoiceChannel)}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-white/[0.03]"
            >
              <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
                <Volume2 className="h-4 w-4" />
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-stone-100 bg-emerald-400 dark:border-[#111214]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  {displayedVoicePresence ? "Voz conectada" : "Conectando à voz"}
                  {displayedVoicePresence?.ping !== null &&
                    displayedVoicePresence?.ping !== undefined && (
                      <span className={`tabular-nums ${getPingColor(displayedVoicePresence.ping)}`}>
                        {displayedVoicePresence.ping} ms
                      </span>
                    )}
                </div>
                <div className="mt-0.5 truncate text-[10px] font-medium text-stone-600 dark:text-zinc-400">
                  {displayedVoiceChannel.name}
                </div>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-[9px] font-bold text-stone-500 dark:text-zinc-500">
                <Users className="h-3 w-3" />
                {(voiceUsers[String(displayedVoiceChannel.id)] ?? []).length}
              </span>
            </button>

            {onLeaveVoice && (
              <div className="border-t border-emerald-400/10 p-1.5">
                <button
                  type="button"
                  onClick={onLeaveVoice}
                  className="flex h-8 w-full items-center justify-center gap-2 rounded-xl text-[10px] font-bold text-red-500 transition hover:bg-red-500/10"
                >
                  <PhoneOff className="h-3.5 w-3.5" />
                  Desconectar
                </button>
              </div>
            )}
          </div>
        )}

        <UserProfileSideBar
          user={
            currentMember?.user
              ? {
                  id: currentMember.user.id,
                  email: currentMember.user.email ?? null,
                  username: currentMember.user.username ?? null,
                  globalName: currentMember.user.globalName ?? null,
                  avatarUrl: currentMember.user.avatarUrl ?? null,
                  bannerUrl: currentMember.user.bannerUrl ?? null,
                  bio: currentMember.user.bio ?? null,
                  status: currentMember.user.status ?? "OFFLINE",
                  customStatus: currentMember.user.customStatus ?? null,
                }
              : null
          }
        />
      </aside>

      <Modal
        isOpen={isCreateChannelModalOpen}
        onClose={() => {
          if (!isCreatingChannel) setIsCreateChannelModalOpen(false);
        }}
        title="Criar canal"
      >
        <div className="space-y-5">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              Tipo de canal
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(
                [
                  {
                    type: "GUILD_TEXT" as const,
                    label: "Texto",
                    description: "Mensagens, arquivos e conversas.",
                    icon: Hash,
                  },
                  {
                    type: "GUILD_VOICE" as const,
                    label: "Voz",
                    description: "Voz, vídeo e transmissão de tela.",
                    icon: Volume2,
                  },
                ]
              ).map((option) => {
                const Icon = option.icon;
                const selected = channelType === option.type;
                return (
                  <button
                    key={option.type}
                    type="button"
                    onClick={() => setChannelType(option.type)}
                    className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition ${
                      selected
                        ? "border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/10"
                        : "border-zinc-200 bg-zinc-50 hover:border-zinc-300 dark:border-white/[0.07] dark:bg-white/[0.03] dark:hover:border-white/15"
                    }`}
                  >
                    <span className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl ${selected ? "bg-indigo-500 text-white" : "bg-zinc-200 text-zinc-500 dark:bg-white/[0.06]"}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-zinc-900 dark:text-white">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] leading-4 text-zinc-500">
                        {option.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              Nome do canal
            </span>
            <div className="flex h-11 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 dark:border-white/10 dark:bg-black/30">
              {channelType === "GUILD_TEXT" ? (
                <Hash className="h-4 w-4 text-zinc-500" />
              ) : (
                <Volume2 className="h-4 w-4 text-zinc-500" />
              )}
              <input
                value={channelName}
                onChange={(event) => setChannelName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleCreateChannel();
                }}
                placeholder={channelType === "GUILD_TEXT" ? "novo-canal" : "Sala de voz"}
                maxLength={100}
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
              />
            </div>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsCreateChannelModalOpen(false)}
              disabled={isCreatingChannel}
              className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-white/[0.06]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleCreateChannel()}
              disabled={!channelName.trim() || isCreatingChannel}
              className="flex min-w-28 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-400 disabled:opacity-50"
            >
              {isCreatingChannel && <Loader2 className="h-4 w-4 animate-spin" />}
              {isCreatingChannel ? "Criando..." : "Criar canal"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(editingChannel)}
        onClose={() => {
          if (!channelActionId) setEditingChannel(null);
        }}
        title="Editar canal"
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3 rounded-2xl bg-zinc-100 p-3 dark:bg-white/[0.04]">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
              {editingChannel?.type === "GUILD_VOICE" ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <Hash className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                {editingChannel?.type === "GUILD_VOICE" ? "Canal de voz" : "Canal de texto"}
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-500">
                Posição {Math.max(1, orderedChannels.findIndex((channel) => String(channel.id) === String(editingChannel?.id)) + 1)} de {orderedChannels.length}
              </p>
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              Nome do canal
            </span>
            <input
              value={editedChannelName}
              onChange={(event) => setEditedChannelName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleEditChannel();
              }}
              maxLength={100}
              autoFocus
              className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-black/30 dark:text-zinc-100"
            />
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditingChannel(null)}
              disabled={Boolean(channelActionId)}
              className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-white/[0.06]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleEditChannel()}
              disabled={!editedChannelName.trim() || Boolean(channelActionId)}
              className="flex min-w-28 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-400 disabled:opacity-50"
            >
              {channelActionId && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(deletingChannel)}
        onClose={() => {
          if (!channelActionId) setDeletingChannel(null);
        }}
        title="Excluir canal"
      >
        <div className="space-y-5">
          <div className="flex gap-3 rounded-2xl border border-red-400/15 bg-red-500/[0.07] p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Excluir {deletingChannel?.name}?
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Esta ação é permanente. Mensagens e configurações associadas ao canal também podem ser removidas pelo servidor.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeletingChannel(null)}
              disabled={Boolean(channelActionId)}
              className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-white/[0.06]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteChannel()}
              disabled={Boolean(channelActionId)}
              className="flex min-w-32 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-400 disabled:opacity-50"
            >
              {channelActionId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Excluir canal
            </button>
          </div>
        </div>
      </Modal>

      <GuildSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        guild={guild}
      />
    </>
  );
}
