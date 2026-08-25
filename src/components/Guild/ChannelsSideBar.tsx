"use client";

import { useEffect, useRef, useState } from "react";
import { Hash, Plus, Volume2, ChevronDown, Settings, LogOut, Check, BadgeCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import UserProfileSideBar from "../UserProfileSideBar";
import Modal from "../Modal";
import { createChannel } from "@/actions/channels";
import GuildSettingsModal from "./GuildSettingsModal";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface ChannelsSidebarProps {
  guild: any;
  activeChannel: any;
  onSelectChannel: (channel: any) => void;
  activeVoiceChannel?: any;
  onJoinVoice?: (channel: any, token: string) => void;
  currentMember: any;
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

export default function ChannelsSidebar({
  guild,
  activeChannel,
  onSelectChannel,
  activeVoiceChannel,
  onJoinVoice,
  currentMember,
}: ChannelsSidebarProps) {
  const router = useRouter();

  console.log('VERIFIED GUILD', guild)
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isCreateChannelModalOpen, setIsCreateChannelModalOpen] = useState(false);
  
  const [channelName, setChannelName] = useState("");
  const [channelType, setChannelType] = useState<"GUILD_TEXT" | "GUILD_VOICE">("GUILD_TEXT");
  const [isLoading, setIsLoading] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const resolvedBannerUrl = resolveFileUrl(guild?.bannerUrl);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isOwner = guild.ownerId === currentMember?.userId;
  const hasAdminRole = currentMember?.roles?.some((r: any) => 
    r.permissions.includes("8") || r.permissions.includes("ADMIN") || r.permissions.includes("MANAGE_CHANNELS")
  );
  const canManageChannels = isOwner || hasAdminRole;

  const handleCreateChannel = async () => {
    if (!channelName.trim()) return;
    try {
      setIsLoading(true);
      await createChannel(guild.id, channelName, channelType);
      setIsCreateChannelModalOpen(false);
      setChannelName("");
      router.refresh();
    } catch (error) {
      console.error("Erro ao criar canal:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChannelClick = async (channel: any) => {
    if (channel.type === "GUILD_VOICE") {
      try {
        const response = await fetch(`/api/livekit?roomName=${channel.id}`);
        const data = await response.json();

        if (data.token && onJoinVoice) {
          onJoinVoice(channel, data.token);
        } else {
          alert("Não foi possível conectar ao canal de voz.");
        }
      } catch (error) {
        console.error("Erro ao conectar na voz:", error);
      }
    } else {
      onSelectChannel(channel);
    }
  };

  return (
    <>
      <div className="relative flex w-60 shrink-0 flex-col bg-stone-300/50 dark:bg-[#111214]">
        <div ref={dropdownRef} className="relative w-full z-30">
  {resolvedBannerUrl ? (
    <div
      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      className="group relative flex h-32 w-full cursor-pointer items-start justify-between overflow-hidden bg-stone-400 transition-all dark:bg-zinc-800"
    >
      <img
        src={resolvedBannerUrl}
        alt="Banner"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/20 to-transparent transition-opacity group-hover:bg-black/40" />
      <div className="relative z-10 flex w-full items-center justify-between p-4 pt-3 font-bold text-white text-shadow-sm">
        
        {/* GRUPO: BADGE + NOME JUNTOS */}
        <div className="flex items-center gap-2 overflow-hidden">
          {guild.verified && (
            <Tooltip delayDuration={200}>
              <TooltipTrigger className="flex shrink-0 cursor-default items-center focus:outline-none">
                <BadgeCheck
                  className="h-5 w-5 fill-[#2FFA73] text-white dark:text-[#111214]"
                  aria-label="Servidor Verificado"
                />
              </TooltipTrigger>

              <TooltipContent
                side="top"
                sideOffset={8}
                className="z-[100] rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 shadow-md dark:border-zinc-800 dark:bg-[#111214] dark:text-zinc-100"
              >
                Servidor Verificado
              </TooltipContent>
            </Tooltip>
          )}
          <span className="truncate">{guild.name}</span>
        </div>

        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
            isDropdownOpen ? "rotate-180" : ""
          }`}
        />
      </div>
    </div>
  ) : (
    <div
      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      className="flex h-12 shrink-0 cursor-pointer items-center justify-between border-b border-stone-300 px-4 font-bold shadow-sm transition-colors hover:bg-stone-300/80 dark:border-zinc-800/60 dark:text-white dark:hover:bg-zinc-800/50"
    >
        
      {/* GRUPO: BADGE + NOME JUNTOS (Versão sem banner) */}
      <div className="flex items-center gap-2 overflow-hidden">
        {guild.verified && (
          <Tooltip >
            <TooltipTrigger className="flex shrink-0 cursor-default items-center focus:outline-none">
              <BadgeCheck
                className="h-5 w-5 fill-[#2FFA73] text-white dark:text-[#111214]"
                aria-label="Servidor Verificado"
              />
            </TooltipTrigger>

            <TooltipContent
              side="bottom"
              sideOffset={8}
              className="z-[100] rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 shadow-md dark:border-zinc-800 dark:bg-[#111214] dark:text-zinc-100"
            >
              Servidor Verificado
            </TooltipContent>
          </Tooltip>
        )}
        <span className="truncate">{guild.name}</span>
      </div>

      <ChevronDown
        className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
          isDropdownOpen ? "rotate-180" : ""
        }`}
      />
    </div>
  )}

  {isDropdownOpen && (
    <div className="absolute left-2 right-2 top-full z-[9999] mt-2 rounded-md border border-stone-200 bg-white p-2 shadow-2xl dark:border-zinc-800 dark:bg-[#111214]">
      {canManageChannels && (
        <button
          onClick={() => {
            setIsSettingsModalOpen(true);
            setIsDropdownOpen(false);
          }}
          className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-indigo-500 hover:text-white dark:text-zinc-200"
        >
          Configurações do Servidor
          <Settings className="h-4 w-4" />
        </button>
      )}
      {canManageChannels && (
        <button
          onClick={() => {
            setIsCreateChannelModalOpen(true);
            setIsDropdownOpen(false);
          }}
          className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-indigo-500 hover:text-white dark:text-zinc-200"
        >
          Criar Canal
          <Plus className="h-4 w-4" />
        </button>
      )}

      {canManageChannels && (
        <div className="my-1 h-px bg-stone-200 dark:bg-zinc-800" />
      )}

      <button className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-500 hover:text-white">
        Sair do Servidor
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  )}
</div>

        <div className="flex-1 overflow-y-auto p-2">
          <div className="flex items-center justify-between px-2 pb-1 pt-4 group">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
              Canais
            </span>
            
            {canManageChannels && (
              <button 
                onClick={() => setIsCreateChannelModalOpen(true)}
                title="Criar canal"
                className="text-stone-500 transition-colors hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mb-4 space-y-0.5 mt-1">
            {guild.channels?.map((channel: any) => {
              const isVoice = channel.type === "GUILD_VOICE";
              const isActive = isVoice 
                ? activeVoiceChannel?.id === channel.id 
                : activeChannel?.id === channel.id;

              return (
                <div
                  key={channel.id}
                  onClick={() => handleChannelClick(channel)}
                  className={`
                    flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors
                    ${isActive 
                      ? "bg-stone-300 text-stone-900 dark:bg-zinc-800 dark:text-zinc-100" 
                      : "text-stone-600 hover:bg-stone-200 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200"
                    }
                  `}
                >
                  {isVoice ? <Volume2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <Hash className="h-4 w-4 shrink-0" />}
                  <span className="truncate text-sm font-medium">{channel.name}</span>
                </div>
              );
            })}
          </div>
        </div>

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
      </div>

      <Modal isOpen={isCreateChannelModalOpen} onClose={() => setIsCreateChannelModalOpen(false)} title="Criar Canal">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">Tipo de Canal</label>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-md bg-zinc-100 p-3 dark:bg-zinc-900">
                <input type="radio" name="channelType" checked={channelType === "GUILD_TEXT"} onChange={() => setChannelType("GUILD_TEXT")} className="h-4 w-4 text-indigo-600" />
                <Hash className="h-5 w-5 text-zinc-500" />
                <div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-white">Texto</div>
                  <div className="text-xs text-zinc-500">Envie mensagens, imagens e opiniões.</div>
                </div>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-md bg-zinc-100 p-3 dark:bg-zinc-900">
                <input type="radio" name="channelType" checked={channelType === "GUILD_VOICE"} onChange={() => setChannelType("GUILD_VOICE")} className="h-4 w-4 text-indigo-600" />
                <Volume2 className="h-5 w-5 text-zinc-500" />
                <div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-white">Voz</div>
                  <div className="text-xs text-zinc-500">Reúna-se por voz e vídeo.</div>
                </div>
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">Nome do Canal</label>
            <input type="text" value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="novo-canal" className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-100" />
          </div>
          <div className="flex justify-end pt-4">
            <button onClick={handleCreateChannel} disabled={!channelName.trim() || isLoading} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50">
              {isLoading ? "Criando..." : "Criar Canal"}
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