"use client";

import { useEffect, useRef, useState } from "react";
import { Hash, Plus, Volume2 } from "lucide-react";
import { useRouter } from "next/navigation";
import UserProfileSideBar from "../UserProfileSideBar";
import Modal from "../Modal"; // Importe o seu componente Modal
import { createChannel } from "@/actions/channels";

interface ChannelsSidebarProps {
  guild: any;
  activeChannel: any;
  onSelectChannel: (channel: any) => void;
}

export default function ChannelsSidebar({ guild, activeChannel, onSelectChannel }: ChannelsSidebarProps) {
  const router = useRouter();
  
  // Estados do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [channelType, setChannelType] = useState<"GUILD_TEXT" | "GUILD_VOICE">("GUILD_TEXT");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateChannel = async () => {
    if (!channelName.trim()) return;
    try {
      setIsLoading(true);
      await createChannel(guild.id, channelName, channelType);
      setIsModalOpen(false);
      setChannelName("");
      router.refresh();
    } catch (error) {
      console.error("Erro ao criar canal:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="relative flex w-60 shrink-0 flex-col bg-stone-300/50 dark:bg-[#111214]">
        <div className="flex h-12 shrink-0 items-center border-b border-stone-300 px-4 font-bold shadow-sm dark:border-zinc-800/60 dark:text-white">
          {guild.name}
        </div>

        <div className="flex-1 overflow-y-auto p-2">

          <div className="flex items-center justify-between px-2 pb-1 pt-4 group">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
              Canais
            </span>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="text-stone-500 transition-colors hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-4 space-y-0.5 mt-1">
            {guild.channels?.map((channel: any) => {
              const isActive = activeChannel?.id === channel.id;
              const isVoice = channel.type === "GUILD_VOICE";

              return (
                <div
                  key={channel.id}
                  onClick={() => onSelectChannel(channel)}
                  className={`
                    flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors
                    ${isActive 
                      ? "bg-stone-300 text-stone-900 dark:bg-zinc-800 dark:text-zinc-100" 
                      : "text-stone-600 hover:bg-stone-200 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200"
                    }
                  `}
                >
                  {isVoice ? (
                    <Volume2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <Hash className="h-4 w-4 shrink-0" />
                  )}
                  <span className="truncate text-sm font-medium">{channel.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        <UserProfileSideBar name="Você" username="@seunick" status="Online" avatar="V" />
      </div>


      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Criar Canal">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">Tipo de Canal</label>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-md bg-zinc-100 p-3 dark:bg-zinc-900">
                <input 
                  type="radio" 
                  name="channelType" 
                  checked={channelType === "GUILD_TEXT"}
                  onChange={() => setChannelType("GUILD_TEXT")}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500" 
                />
                <Hash className="h-5 w-5 text-zinc-500" />
                <div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-white">Texto</div>
                  <div className="text-xs text-zinc-500">Envie mensagens, imagens e opiniões.</div>
                </div>
              </label>
              
              <label className="flex cursor-pointer items-center gap-3 rounded-md bg-zinc-100 p-3 dark:bg-zinc-900">
                <input 
                  type="radio" 
                  name="channelType" 
                  checked={channelType === "GUILD_VOICE"}
                  onChange={() => setChannelType("GUILD_VOICE")}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500" 
                />
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
            <input
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="novo-canal"
              className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-100"
            />
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleCreateChannel}
              disabled={!channelName.trim() || isLoading}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Criando..." : "Criar Canal"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}