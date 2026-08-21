"use client";

import { useEffect, useRef, useState } from "react";
import {
  Ban,
  ChevronRight,
  Copy,
  Headphones,
  Hash,
  LogOut,
  Mic,
  MoreHorizontal,
  Pencil,
  Settings,
  UserCircle,
  UserRound,
} from "lucide-react";

export default function ChannelsSidebar() {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative flex w-60 shrink-0 flex-col bg-stone-300/50 dark:bg-[#111214]">
      
      <div className="flex h-12 shrink-0 items-center border-b border-stone-300 px-4 font-bold shadow-sm dark:border-zinc-800/60 dark:text-white">
        Nome
      </div>

      
      <div className="flex-1 overflow-y-auto p-2">
        <div className="mb-4">
          <div
            className="
              mt-1 flex cursor-pointer items-center gap-2
              rounded-md px-2 py-1.5
              text-stone-600
              transition-colors
              hover:bg-stone-300
              hover:text-stone-900
              dark:text-zinc-400
              dark:hover:bg-zinc-800
              dark:hover:text-zinc-100
            "
          >
            <Hash className="h-4 w-4 shrink-0" />

            <span className="truncate text-sm">
              nomedocanal
            </span>
          </div>
        </div>
      </div>

      
      <div
        ref={userMenuRef}
        className="
          relative flex h-[58px] shrink-0 items-center
          border-t border-stone-300
          bg-stone-300/80 px-2
          dark:border-zinc-950
          dark:bg-[#1e1f22]
        "
      >
        
        <button
          type="button"
          onClick={() => setIsUserMenuOpen((value) => !value)}
          className="
            flex min-w-0 flex-1 items-center
            rounded-md px-1 py-1
            text-left
            transition-colors
            hover:bg-stone-400/40
            dark:hover:bg-zinc-800/80
          "
        >
          
          <div className="relative shrink-0">
            <div
              className="
                flex h-8 w-8 items-center justify-center
                overflow-hidden rounded-full
                bg-indigo-500
                text-xs font-bold text-white
              "
            >
              N
            </div>

            
            <span
              className="
                absolute bottom-[-1px] right-[-1px]
                h-3 w-3 rounded-full
                border-[3px] border-stone-300
                bg-emerald-500
                dark:border-[#1e1f22]
              "
            />
          </div>

          
          <div className="ml-2 min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="truncate text-[13px] font-semibold leading-tight text-stone-900 dark:text-white">
                Nome
              </span>

              <span className="text-[10px] text-stone-500 dark:text-zinc-500">
                ✦
              </span>
            </div>

            <div className="truncate text-[11px] leading-tight text-stone-500 dark:text-zinc-400">
              Status personalizado
            </div>
          </div>
        </button>

        
        <div className="ml-1 flex items-center">
          
          <button
            type="button"
            title={isMuted ? "Ativar microfone" : "Silenciar"}
            onClick={() => setIsMuted((value) => !value)}
            className={`
              flex h-8 w-8 items-center justify-center
              rounded-md
              transition-colors
              ${
                isMuted
                  ? "text-red-400 hover:bg-red-500/10"
                  : "text-stone-600 hover:bg-stone-400/40 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
              }
            `}
          >
            {isMuted ? (
              <Mic className="h-[18px] w-[18px]" />
            ) : (
              <Mic className="h-[18px] w-[18px]" />
            )}
          </button>

          
          <button
            type="button"
            title={isDeafened ? "Ativar áudio" : "Desativar áudio"}
            onClick={() => setIsDeafened((value) => !value)}
            className={`
              flex h-8 w-8 items-center justify-center
              rounded-md
              transition-colors
              ${
                isDeafened
                  ? "text-red-400 hover:bg-red-500/10"
                  : "text-stone-600 hover:bg-stone-400/40 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
              }
            `}
          >
            <Headphones className="h-[18px] w-[18px]" />
          </button>

          
          <button
            type="button"
            title="Configurações"
            className="
              flex h-8 w-8 items-center justify-center
              rounded-md
              text-stone-600
              transition-colors
              hover:bg-stone-400/40
              hover:text-stone-900
              dark:text-zinc-400
              dark:hover:bg-zinc-800
              dark:hover:text-white
            "
          >
            <Settings className="h-[18px] w-[18px]" />
          </button>
        </div>

        
        {isUserMenuOpen && (
          <div
            className="
              absolute bottom-[66px] left-1
              z-50 w-[calc(100%-8px)]
              overflow-hidden rounded-lg
              border border-stone-300
              bg-white
              p-1.5
              shadow-2xl
              dark:border-zinc-800
              dark:bg-[#111214]
            "
          >
            
            <div
              className="
                mb-1 rounded-md
                bg-stone-100 p-3
                dark:bg-[#18191c]
              "
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div
                    className="
                      flex h-12 w-12 items-center justify-center
                      rounded-full
                      bg-indigo-500
                      text-sm font-bold text-white
                    "
                  >
                    N
                  </div>

                  <span
                    className="
                      absolute bottom-0 right-0
                      h-3.5 w-3.5 rounded-full
                      border-[3px]
                      border-stone-100
                      bg-emerald-500
                      dark:border-[#18191c]
                    "
                  />
                </div>

                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-stone-900 dark:text-white">
                    Nome
                  </div>

                  <div className="truncate text-xs text-stone-500 dark:text-zinc-400">
                    @username
                  </div>
                </div>
              </div>

              
              <button
                type="button"
                className="
                  mt-3 flex w-full items-center gap-2
                  rounded-md
                  border border-stone-300
                  bg-white px-2.5 py-2
                  text-left
                  dark:border-zinc-700
                  dark:bg-[#232428]
                "
              >
                <span className="text-sm">💭</span>

                <span className="truncate text-xs italic text-stone-500 dark:text-zinc-400">
                  O que você está fazendo?
                </span>
              </button>
            </div>

            
            <div className="space-y-0.5">
              <button
                type="button"
                className="
                  flex w-full items-center gap-3
                  rounded-md px-2.5 py-2
                  text-sm
                  text-stone-700
                  transition-colors
                  hover:bg-stone-200
                  dark:text-zinc-200
                  dark:hover:bg-zinc-800
                "
              >
                <UserRound className="h-4 w-4" />
                <span className="flex-1 text-left">Perfil</span>
                <ChevronRight className="h-4 w-4 text-zinc-500" />
              </button>

              <button
                type="button"
                className="
                  flex w-full items-center gap-3
                  rounded-md px-2.5 py-2
                  text-sm
                  text-stone-700
                  transition-colors
                  hover:bg-stone-200
                  dark:text-zinc-200
                  dark:hover:bg-zinc-800
                "
              >
                <Pencil className="h-4 w-4" />
                <span className="flex-1 text-left">
                  Editar perfil
                </span>

                <span className="rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  NOVO
                </span>
              </button>

              <button
                type="button"
                className="
                  flex w-full items-center gap-3
                  rounded-md px-2.5 py-2
                  text-sm
                  text-stone-700
                  transition-colors
                  hover:bg-stone-200
                  dark:text-zinc-200
                  dark:hover:bg-zinc-800
                "
              >
                <Ban className="h-4 w-4" />
                <span className="flex-1 text-left">
                  Status
                </span>

                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />

                <ChevronRight className="h-4 w-4 text-zinc-500" />
              </button>

              <div className="my-1 border-t border-stone-200 dark:border-zinc-800" />

              <button
                type="button"
                className="
                  flex w-full items-center gap-3
                  rounded-md px-2.5 py-2
                  text-sm
                  text-stone-700
                  transition-colors
                  hover:bg-stone-200
                  dark:text-zinc-200
                  dark:hover:bg-zinc-800
                "
              >
                <Copy className="h-4 w-4" />

                <span className="flex-1 text-left">
                  Copiar ID do usuário
                </span>
              </button>

              <button
                type="button"
                className="
                  flex w-full items-center gap-3
                  rounded-md px-2.5 py-2
                  text-sm
                  text-stone-700
                  transition-colors
                  hover:bg-stone-200
                  dark:text-zinc-200
                  dark:hover:bg-zinc-800
                "
              >
                <MoreHorizontal className="h-4 w-4" />

                <span className="flex-1 text-left">
                  Mais opções
                </span>

                <ChevronRight className="h-4 w-4 text-zinc-500" />
              </button>

              <div className="my-1 border-t border-stone-200 dark:border-zinc-800" />

              <button
                type="button"
                className="
                  flex w-full items-center gap-3
                  rounded-md px-2.5 py-2
                  text-sm
                  text-stone-700
                  transition-colors
                  hover:bg-stone-200
                  dark:text-zinc-200
                  dark:hover:bg-zinc-800
                "
              >
                <LogOut className="h-4 w-4" />

                <span className="flex-1 text-left">
                  Sair
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}