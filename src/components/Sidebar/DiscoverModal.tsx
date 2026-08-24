"use client";

import { useEffect, useState, useTransition } from "react";
import { Compass, Search, Users, Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import Modal from "../Modal";
import { getDiscoverableGuilds, joinPublicGuild } from "@/actions/discover";

interface DiscoverModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Guild {
  id: string;
  name: string;
  description?: string | null;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  _count: {
    members: number;
  };
}

function resolveFileUrl(urlOrKey?: string | null): string {
  if (!urlOrKey) return "";
  
  try {
    if (/^(https?:\/\/|\/|blob:)/i.test(urlOrKey)) {
      return urlOrKey;
    }
    return `/api/files?key=${encodeURIComponent(urlOrKey)}`;
  } catch {
    return "";
  }
}

export default function DiscoverModal({ isOpen, onClose }: DiscoverModalProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [isPending, startTransition] = useTransition();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setDebouncedQuery("");
      setGuilds([]);
      setJoiningId(null);
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    startTransition(async () => {
      try {
        setError(null);
        const data = await getDiscoverableGuilds(debouncedQuery);
        setGuilds(Array.isArray(data) ? data : []);
      } catch {
        setError("Não foi possível carregar as comunidades. Tente novamente mais tarde.");
      }
    });
  }, [isOpen, debouncedQuery]);

  const handleJoin = async (guildId: string) => {
    if (joiningId) return;
    
    setJoiningId(guildId);
    setError(null);
    
    try {
      const result = await joinPublicGuild(guildId);
      
      if (result?.success) {
        onClose();
        router.push(`/channels/${guildId}`);
        router.refresh();
      } else {
        setError("Não foi possível entrar na comunidade.");
      }
    } catch {
      setError("Ocorreu um erro inesperado ao tentar entrar no servidor.");
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Descubra Servidores">
      <div className="flex w-full flex-col gap-6 sm:max-w-2xl md:max-w-3xl">
        <div className="flex flex-col items-center gap-3 text-center px-2">
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
              maxLength={100}
              className="h-12 w-full rounded-md border border-zinc-300 bg-white pl-10 pr-4 text-sm text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </div>
        </div>

        {error && (
          <div className=" mx-2 flex items-center gap-2 rounded-md bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="h-px w-full shrink-0 bg-zinc-200 dark:bg-zinc-800" />

        <div className="flex max-h-[55vh] w-full flex-col overflow-y-auto px-2 pb-2 [scrollbar-width:thin]">
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
                    className="group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all hover:border-indigo-500/50 hover:shadow-md dark:border-zinc-800 dark:bg-[#2b2d31]"
                  >
                    <div className="relative h-24 w-full shrink-0 overflow-hidden bg-zinc-200 dark:bg-zinc-900">
                      {banner ? (
                        <img
                          src={banner}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/80 to-purple-500/80" />
                      )}
                    </div>

                    <div className="relative flex flex-1 flex-col px-4 pb-4 pt-10">
                      <div className="absolute -top-6 left-4 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border-[3px] border-white bg-zinc-100 font-bold text-zinc-700 shadow-sm dark:border-[#2b2d31] dark:bg-zinc-800 dark:text-zinc-200">
                        {icon ? (
                          <img 
                            src={icon} 
                            alt="" 
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover" 
                          />
                        ) : (
                          <span className="text-lg">{guild.name.charAt(0).toUpperCase()}</span>
                        )}
                      </div>

                      <h3 className="truncate text-base font-bold text-zinc-900 dark:text-zinc-100" title={guild.name}>
                        {guild.name}
                      </h3>

                      <p className="mt-1 line-clamp-2 min-h-[32px] flex-1 text-xs text-zinc-500 dark:text-zinc-400" title={guild.description || ""}>
                        {guild.description || "Comunidade focada em interações e diversão."}
                      </p>

                      <div className="mt-4 flex items-center justify-between gap-2">
                        <div
                          className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400"
                          title={`${guild._count.members} Membros`}
                        >
                          <Users className="h-4 w-4 shrink-0" />
                          <span className="truncate">{guild._count.members}</span>
                        </div>

                        <button
                          onClick={() => handleJoin(guild.id)}
                          disabled={joiningId !== null}
                          aria-busy={joiningId === guild.id}
                          className="flex h-8 min-w-[80px] shrink-0 items-center justify-center rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
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