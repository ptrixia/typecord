"use client";

import { useEffect, useState, useTransition } from "react";
import { Compass, Search, Users, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Modal from "../Modal";
import { getDiscoverableGuilds, joinPublicGuild } from "@/actions/discover";

interface DiscoverModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function resolveFileUrl(urlOrKey?: string | null) {
  if (!urlOrKey) return "";
  if (urlOrKey.startsWith("http://") || urlOrKey.startsWith("https://") || urlOrKey.startsWith("/") || urlOrKey.startsWith("blob:")) {
    return urlOrKey;
  }
  return `/api/files?key=${encodeURIComponent(urlOrKey)}`;
}

export default function DiscoverModal({ isOpen, onClose }: DiscoverModalProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [guilds, setGuilds] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();
  const [joiningId, setJoiningId] = useState<string | null>(null);

  // Limpa o estado quando o modal fecha
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setGuilds([]);
      setJoiningId(null);
    }
  }, [isOpen]);

  // Busca os servidores sempre que a pesquisa mudar
  useEffect(() => {
    if (!isOpen) return;

    startTransition(async () => {
      try {
        const data = await getDiscoverableGuilds(searchQuery);
        setGuilds(data);
      } catch (error) {
        console.error("Erro ao buscar servidores:", error);
      }
    });
  }, [isOpen, searchQuery]);

  const handleJoin = async (guildId: string) => {
    setJoiningId(guildId);
    try {
      const result = await joinPublicGuild(guildId);
      if (result?.success) {
        onClose();
        router.push(`/channels/${guildId}`);
        router.refresh();
      }
    } catch (error) {
      console.error("Erro ao entrar no servidor:", error);
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Descubra Servidores">
      <div className="flex w-full flex-col gap-6 md:min-w-[600px] lg:min-w-[700px]">
        {/* CABEÇALHO / PESQUISA */}
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            De jogos e música a aprendizado e programação, encontre o lugar perfeito para você no Typecord.
          </p>

          <div className="relative mt-2 w-full max-w-xl">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Explorar comunidades..."
              autoFocus
              className="h-12 w-full rounded-md border border-zinc-300 bg-white pl-10 pr-4 text-sm text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </div>
        </div>

        <div className="h-px w-full bg-zinc-200 dark:bg-zinc-800" />

        {/* LISTA DE SERVIDORES (SCROLL) */}
        <div className="flex max-h-[55vh] flex-col overflow-y-auto px-1 pb-2 [scrollbar-width:thin]">
          {isPending ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-zinc-500">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <span className="text-sm font-medium">Buscando comunidades...</span>
            </div>
          ) : guilds.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-3 text-zinc-500 dark:text-zinc-400">
              <Compass className="h-12 w-12 opacity-30" />
              <p className="text-sm font-medium">Nenhuma comunidade encontrada.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {guilds.map((guild) => {
                const icon = resolveFileUrl(guild.iconUrl);
                const banner = resolveFileUrl(guild.bannerUrl);

                return (
                  <div
                    key={guild.id}
                    className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all hover:border-indigo-500/50 hover:shadow-md dark:border-zinc-800 dark:bg-[#2b2d31]"
                  >
                    {/* Banner */}
                    <div className="relative h-24 w-full overflow-hidden bg-zinc-200 dark:bg-zinc-900">
                      {banner ? (
                        <img
                          src={banner}
                          alt="Banner"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/80 to-purple-500/80" />
                      )}
                    </div>

                    {/* Conteúdo do Card */}
                    <div className="relative flex flex-1 flex-col px-4 pb-4 pt-10">
                      {/* Avatar */}
                      <div className="absolute -top-6 left-4 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border-[3px] border-white bg-zinc-100 font-bold text-zinc-700 shadow-sm dark:border-[#2b2d31] dark:bg-zinc-800 dark:text-zinc-200">
                        {icon ? (
                          <img src={icon} alt={guild.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-lg">{guild.name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>

                      <h3 className="truncate text-base font-bold text-zinc-900 dark:text-zinc-100" title={guild.name}>
                        {guild.name}
                      </h3>

                      <p className="mt-1 line-clamp-2 min-h-[32px] flex-1 text-xs text-zinc-500 dark:text-zinc-400">
                        Comunidade focada em interações e diversão.
                      </p>

                      <div className="mt-4 flex items-center justify-between">
                        <div
                          className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400"
                          title={`${guild._count.members} Membros`}
                        >
                          <Users className="h-4 w-4" />
                          {guild._count.members}
                        </div>

                        <button
                          onClick={() => handleJoin(guild.id)}
                          disabled={joiningId === guild.id}
                          className="flex min-w-[80px] items-center justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
                        >
                          {joiningId === guild.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Participar"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}