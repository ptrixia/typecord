"use client";

import { useEffect, useRef, useState } from "react";
import {
  Ban,
  ChevronRight,
  Copy,
  Headphones,
  LogOut,
  Mic,
  MoreHorizontal,
  Pencil,
  Settings,
  UserRound,
  CircleHelp,
  EyeOff,
  UserX,
} from "lucide-react";

type UserPanelProps = {
  name?: string;
  username?: string;
  status?: string;
  avatar?: string;
};

type UserStatus = "online" | "ausente" | "ocupado" | "invisivel";

const statusOptions: {
  id: UserStatus;
  label: string;
  description: string;
  color: string;
}[] = [
  {
    id: "online",
    label: "Online",
    description: "Você está disponível",
    color: "bg-emerald-500",
  },
  {
    id: "ausente",
    label: "Ausente",
    description: "Você está ausente",
    color: "bg-yellow-500",
  },
  {
    id: "ocupado",
    label: "Ocupado",
    description: "Não perturbe",
    color: "bg-red-500",
  },
  {
    id: "invisivel",
    label: "Invisível",
    description: "Aparecer offline",
    color: "bg-zinc-500",
  },
];

function MenuItem({
  icon,
  children,
  onClick,
  danger = false,
  arrow = false,
  badge,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  arrow?: boolean;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex w-full items-center gap-3
        rounded-md px-2.5 py-2
        text-sm transition-colors
        ${
          danger
            ? "text-red-500 hover:bg-red-500/10"
            : "text-stone-700 hover:bg-stone-200 dark:text-zinc-200 dark:hover:bg-zinc-800"
        }
      `}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {icon}
      </span>

      <span className="min-w-0 flex-1 truncate text-left">
        {children}
      </span>

      {badge && (
        <span className="rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
          {badge}
        </span>
      )}

      {arrow && (
        <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
      )}
    </button>
  );
}

function Divider() {
  return (
    <div className="my-1 border-t border-stone-200 dark:border-zinc-800" />
  );
}

export default function UserProfileSideBar({
  name = "Nome",
  username = "@username",
  status = "Status personalizado",
  avatar = "N",
}: UserPanelProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  const [activeSubmenu, setActiveSubmenu] = useState<
    "status" | "more" | null
  >(null);

  const [userStatus, setUserStatus] =
    useState<UserStatus>("online");

  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
        setActiveSubmenu(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const currentStatus =
    statusOptions.find((item) => item.id === userStatus) ??
    statusOptions[0];

  function toggleMenu() {
    setIsUserMenuOpen((value) => !value);
    setActiveSubmenu(null);
  }

  function openSubmenu(menu: "status" | "more") {
    setActiveSubmenu((current) =>
      current === menu ? null : menu,
    );
  }

  function changeStatus(newStatus: UserStatus) {
    setUserStatus(newStatus);
    setActiveSubmenu(null);
  }

  return (
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
      {/* =====================================================
          USUÁRIO
      ====================================================== */}

      <button
        type="button"
        onClick={toggleMenu}
        className="
          flex min-w-0 flex-1 items-center
          rounded-md px-1 py-1
          text-left transition-colors
          hover:bg-stone-400/40
          dark:hover:bg-zinc-800/80
        "
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            className="
              flex h-8 w-8 items-center justify-center
              overflow-hidden rounded-full
              bg-indigo-500
              text-xs font-bold text-white
            "
          >
            {avatar}
          </div>

          <span
            className={`
              absolute bottom-[-1px] right-[-1px]
              h-3 w-3 rounded-full
              border-[3px] border-stone-300
              dark:border-[#1e1f22]
              ${currentStatus.color}
            `}
          />
        </div>

        {/* Nome / status */}
        <div className="ml-2 min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span
              className="
                truncate text-[13px] font-semibold
                leading-tight text-stone-900
                dark:text-white
              "
            >
              {name}
            </span>

            <span className="text-[10px] text-stone-500 dark:text-zinc-500">
              ✦
            </span>
          </div>

          <div
            className="
              truncate text-[11px] leading-tight
              text-stone-500 dark:text-zinc-400
            "
          >
            {status}
          </div>
        </div>
      </button>

      {/* =====================================================
          CONTROLES
      ====================================================== */}

      <div className="ml-1 flex items-center">
        {/* Microfone */}
        <button
          type="button"
          title={isMuted ? "Ativar microfone" : "Silenciar"}
          onClick={() => setIsMuted((value) => !value)}
          className={`
            flex h-8 w-8 items-center justify-center
            rounded-md transition-colors
            ${
              isMuted
                ? "text-red-400 hover:bg-red-500/10"
                : "text-stone-600 hover:bg-stone-400/40 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            }
          `}
        >
          <Mic className="h-[18px] w-[18px]" />
        </button>

        {/* Fones */}
        <button
          type="button"
          title={
            isDeafened
              ? "Ativar áudio"
              : "Desativar áudio"
          }
          onClick={() =>
            setIsDeafened((value) => !value)
          }
          className={`
            flex h-8 w-8 items-center justify-center
            rounded-md transition-colors
            ${
              isDeafened
                ? "text-red-400 hover:bg-red-500/10"
                : "text-stone-600 hover:bg-stone-400/40 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            }
          `}
        >
          <Headphones className="h-[18px] w-[18px]" />
        </button>

        {/* Configurações */}
        <button
          type="button"
          title="Configurações"
          className="
            flex h-8 w-8 items-center justify-center
            rounded-md text-stone-600
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

      {/* =====================================================
          MENU PRINCIPAL
      ====================================================== */}

      {isUserMenuOpen && (
        <div
          className="
            absolute bottom-[66px] left-1
            z-50 w-[calc(100%-8px)]
            overflow-visible
            rounded-lg
            border border-stone-300
            bg-white p-1.5
            shadow-2xl
            dark:border-zinc-800
            dark:bg-[#111214]
          "
        >
          {/* =================================================
              PERFIL
          ================================================== */}

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
                    flex h-12 w-12 items-center
                    justify-center rounded-full
                    bg-indigo-500
                    text-sm font-bold text-white
                  "
                >
                  {avatar}
                </div>

                <span
                  className={`
                    absolute bottom-0 right-0
                    h-3.5 w-3.5 rounded-full
                    border-[3px]
                    border-stone-100
                    dark:border-[#18191c]
                    ${currentStatus.color}
                  `}
                />
              </div>

              <div className="min-w-0">
                <div
                  className="
                    truncate text-sm font-bold
                    text-stone-900 dark:text-white
                  "
                >
                  {name}
                </div>

                <div
                  className="
                    truncate text-xs
                    text-stone-500 dark:text-zinc-400
                  "
                >
                  {username}
                </div>
              </div>
            </div>

            {/* Status personalizado */}
            <button
              type="button"
              className="
                mt-3 flex w-full items-center gap-2
                rounded-md border border-stone-300
                bg-white px-2.5 py-2
                text-left
                dark:border-zinc-700
                dark:bg-[#232428]
              "
            >
              <span className="text-sm">💭</span>

              <span
                className="
                  truncate text-xs italic
                  text-stone-500 dark:text-zinc-400
                "
              >
                O que você está fazendo?
              </span>
            </button>
          </div>

          {/* =================================================
              OPÇÕES
          ================================================== */}

          <div className="space-y-0.5">
            {/* Perfil */}
            <MenuItem
              icon={<UserRound className="h-4 w-4" />}
              arrow
            >
              Perfil
            </MenuItem>

            {/* Editar perfil */}
            <MenuItem
              icon={<Pencil className="h-4 w-4" />}
              badge="NOVO"
            >
              Editar perfil
            </MenuItem>

            {/* =================================================
                STATUS + SUBMENU
            ================================================== */}

            <div className="relative">
              <MenuItem
                icon={<Ban className="h-4 w-4" />}
                arrow
                onClick={() => openSubmenu("status")}
              >
                Status

                <span
                  className={`
                    ml-auto mr-2
                    h-2.5 w-2.5 shrink-0
                    rounded-full
                    ${currentStatus.color}
                  `}
                />
              </MenuItem>

              {activeSubmenu === "status" && (
                <div
                  className="
                    absolute left-full top-0
                    ml-2 w-[220px]
                    rounded-lg
                    border border-stone-300
                    bg-white p-1.5
                    shadow-2xl
                    dark:border-zinc-800
                    dark:bg-[#111214]
                  "
                >
                  <div className="px-2.5 py-2">
                    <div className="text-xs font-bold text-stone-800 dark:text-white">
                      Status
                    </div>

                    <div className="text-[10px] text-stone-500 dark:text-zinc-500">
                      Escolha como você aparece
                    </div>
                  </div>

                  {statusOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        changeStatus(option.id)
                      }
                      className="
                        flex w-full items-center gap-3
                        rounded-md px-2.5 py-2
                        text-left transition-colors
                        hover:bg-stone-200
                        dark:hover:bg-zinc-800
                      "
                    >
                      <span
                        className={`
                          h-3 w-3 shrink-0
                          rounded-full
                          ${option.color}
                        `}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-stone-800 dark:text-zinc-100">
                          {option.label}
                        </div>

                        <div className="text-[10px] text-stone-500 dark:text-zinc-500">
                          {option.description}
                        </div>
                      </div>

                      {userStatus === option.id && (
                        <span className="text-xs text-emerald-500">
                          ✓
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Divider />

            {/* Copiar ID */}
            <MenuItem
              icon={<Copy className="h-4 w-4" />}
              onClick={() => {
                navigator.clipboard?.writeText("USER_ID");
              }}
            >
              Copiar ID do usuário
            </MenuItem>

            {/* =================================================
                MAIS OPÇÕES + SUBMENU
            ================================================== */}

            <div className="relative">
              <MenuItem
                icon={
                  <MoreHorizontal className="h-4 w-4" />
                }
                arrow
                onClick={() => openSubmenu("more")}
              >
                Mais opções
              </MenuItem>

              {activeSubmenu === "more" && (
                <div
                  className="
                    absolute left-full top-0
                    ml-2 w-[200px]
                    rounded-lg
                    border border-stone-300
                    bg-white p-1.5
                    shadow-2xl
                    dark:border-zinc-800
                    dark:bg-[#111214]
                  "
                >
                  <MenuItem
                    icon={
                      <CircleHelp className="h-4 w-4" />
                    }
                  >
                    Ajuda
                  </MenuItem>

                  <MenuItem
                    icon={
                      <EyeOff className="h-4 w-4" />
                    }
                  >
                    Privacidade
                  </MenuItem>

                  <MenuItem
                    icon={
                      <UserX className="h-4 w-4" />
                    }
                    danger
                  >
                    Bloquear usuário
                  </MenuItem>
                </div>
              )}
            </div>

            <Divider />

            {/* Sair */}
            <MenuItem
              icon={<LogOut className="h-4 w-4" />}
              danger
              onClick={() => {
                console.log("Logout");
              }}
            >
              Sair
            </MenuItem>
          </div>
        </div>
      )}
    </div>
  );
}