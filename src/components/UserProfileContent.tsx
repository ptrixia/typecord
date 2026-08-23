"use client";

import {
  Check,
  ChevronRight,
  Copy,
  Headphones,
  LogOut,
  Mic,
  Pencil,
  Settings,
  UserRound,
} from "lucide-react";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/Modal";

type UserStatus = "online" | "ausente" | "ocupado" | "invisivel";

type ProfileUser = {
  id: string;
  username?: string | null;
  globalName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
};

interface UserProfileContentProps {
  user: ProfileUser | null;
}

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
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
  arrow?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-3 rounded-md px-2.5 py-2",
        "text-sm transition-colors",
        danger
          ? "text-red-500 hover:bg-red-500/10"
          : "text-stone-700 hover:bg-stone-200 dark:text-zinc-200 dark:hover:bg-zinc-800",
      ].join(" ")}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {icon}
      </span>

      <span className="min-w-0 flex-1 truncate text-left">
        {children}
      </span>

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

export default function UserProfileContent({
  user,
}: UserProfileContentProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [submenu, setSubmenu] = useState<"status" | null>(null);

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editProfileModalOpen, setEditProfileModalOpen] = useState(false);

  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  const [status, setStatus] = useState<UserStatus>("online");

  const [customStatus, setCustomStatus] = useState(
    "Desenvolvendo aplicações",
  );

  const [editingStatus, setEditingStatus] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  const username = user?.username || "usuario";
  const displayName = user?.globalName || username;

  const avatar = user?.avatarUrl || null;
  const banner = user?.bannerUrl || null;
  const bio = user?.bio || null;
  const userId = user?.id || "";

  const currentStatus =
    statusOptions.find((item) => item.id === status) ??
    statusOptions[0];

  /*
   * Fecha o menu ao clicar fora.
   */
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (
        target instanceof Node &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setMenuOpen(false);
        setSubmenu(null);
        setEditingStatus(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );
    };
  }, []);

  function getInitials(name: string) {
    const clean = name.trim();

    if (!clean) {
      return "U";
    }

    const parts = clean.split(/\s+/);

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return parts[0][0].toUpperCase();
  }

  function toggleMenu() {
    setMenuOpen((current) => !current);
    setSubmenu(null);
    setEditingStatus(false);
  }

  function toggleStatusMenu() {
    setSubmenu((current) =>
      current === "status" ? null : "status",
    );
  }

  function selectStatus(value: UserStatus) {
    setStatus(value);
    setSubmenu(null);
  }

  async function copyUserId() {
    if (!userId) {
      return;
    }

    try {
      await navigator.clipboard.writeText(userId);
    } catch {
      console.error("Não foi possível copiar o ID.");
    }
  }

  function closeMenu() {
    setMenuOpen(false);
    setSubmenu(null);
    setEditingStatus(false);
  }

  function logout() {
    window.location.href = "/api/auth/signout";
  }

  return (
    <>
      {/* ========================================================= */}
      {/* BARRA DO USUÁRIO                                          */}
      {/* ========================================================= */}

      <div
        ref={menuRef}
        className="
          relative flex h-[58px] shrink-0 items-center
          border-t border-stone-300
          bg-stone-300/80 px-2
          dark:border-zinc-950
          dark:bg-[#1e1f22]
        "
      >
        {/* PERFIL */}

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
          <div className="relative shrink-0">
            <div
              className="
                flex h-8 w-8 items-center justify-center
                overflow-hidden rounded-full
                bg-indigo-500
                text-xs font-bold text-white
              "
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(displayName)
              )}
            </div>

            <span
              className={[
                "absolute bottom-[-1px] right-[-1px]",
                "h-3 w-3 rounded-full",
                "border-[3px] border-stone-300",
                "dark:border-[#1e1f22]",
                currentStatus.color,
              ].join(" ")}
            />
          </div>

          <div className="ml-2 min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold leading-tight text-stone-900 dark:text-white">
              {displayName}
            </div>

            <div className="truncate text-[11px] leading-tight text-stone-500 dark:text-zinc-400">
              {customStatus || "Disponível"}
            </div>
          </div>
        </button>

        {/* CONTROLES */}

        <div className="ml-1 flex items-center">
          <button
            type="button"
            title={isMuted ? "Ativar microfone" : "Silenciar"}
            onClick={() => setIsMuted((value) => !value)}
            className={[
              "flex h-8 w-8 items-center justify-center rounded-md",
              "transition-colors",
              isMuted
                ? "text-red-400 hover:bg-red-500/10"
                : "text-stone-600 hover:bg-stone-400/40 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white",
            ].join(" ")}
          >
            <Mic className="h-[18px] w-[18px]" />
          </button>

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
            className={[
              "flex h-8 w-8 items-center justify-center rounded-md",
              "transition-colors",
              isDeafened
                ? "text-red-400 hover:bg-red-500/10"
                : "text-stone-600 hover:bg-stone-400/40 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white",
            ].join(" ")}
          >
            <Headphones className="h-[18px] w-[18px]" />
          </button>

          <button
            type="button"
            title="Configurações"
            onClick={() => {
              closeMenu();
              setEditProfileModalOpen(true);
            }}
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

        {/* ======================================================= */}
        {/* MENU PRINCIPAL                                          */}
        {/* ======================================================= */}

        {menuOpen && (
          <div
            className="
              absolute bottom-[66px] left-1
              z-[100]
              w-[calc(100%-8px)]
              rounded-lg
              border border-stone-300
              bg-white p-1.5
              shadow-2xl
              dark:border-zinc-800
              dark:bg-[#111214]
            "
          >
            {/* CABEÇALHO */}

            <div className="mb-1 rounded-md bg-stone-100 p-3 dark:bg-[#18191c]">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div
                    className="
                      flex h-12 w-12 items-center justify-center
                      overflow-hidden rounded-full
                      bg-indigo-500
                      text-sm font-bold text-white
                    "
                  >
                    {avatar ? (
                      <img
                        src={avatar}
                        alt={displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitials(displayName)
                    )}
                  </div>

                  <span
                    className={[
                      "absolute bottom-0 right-0",
                      "h-3.5 w-3.5 rounded-full",
                      "border-[3px] border-stone-100",
                      "dark:border-[#18191c]",
                      currentStatus.color,
                    ].join(" ")}
                  />
                </div>

                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-stone-900 dark:text-white">
                    {displayName}
                  </div>

                  <div className="truncate text-xs text-stone-500 dark:text-zinc-400">
                    @{username}
                  </div>
                </div>
              </div>

              {/* STATUS PERSONALIZADO */}

              {editingStatus ? (
                <input
                  type="text"
                  value={customStatus}
                  maxLength={128}
                  autoFocus
                  onChange={(event) =>
                    setCustomStatus(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      setEditingStatus(false);
                    }

                    if (event.key === "Escape") {
                      setEditingStatus(false);
                    }
                  }}
                  onBlur={() =>
                    setEditingStatus(false)
                  }
                  placeholder="O que você está fazendo?"
                  className="
                    mt-3 w-full rounded-md
                    border border-stone-300
                    bg-white px-2.5 py-1.5
                    text-xs text-stone-900
                    outline-none
                    focus:border-indigo-500
                    dark:border-zinc-700
                    dark:bg-[#232428]
                    dark:text-white
                  "
                />
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setEditingStatus(true)
                  }
                  className="
                    mt-3 flex w-full items-center gap-2
                    rounded-md border
                    border-stone-300
                    bg-white px-2.5 py-2
                    text-left transition-colors
                    hover:border-stone-400
                    dark:border-zinc-700
                    dark:bg-[#232428]
                    dark:hover:border-zinc-600
                  "
                >
                  <span className="text-sm">
                    💭
                  </span>

                  <span className="truncate text-xs italic text-stone-500 dark:text-zinc-400">
                    {customStatus ||
                      "Definir status personalizado"}
                  </span>

                  <Pencil className="ml-auto h-3.5 w-3.5 text-zinc-500" />
                </button>
              )}
            </div>

            {/* ================================================= */}
            {/* OPÇÕES                                            */}
            {/* ================================================= */}

            <div className="space-y-0.5">
              {/* PERFIL */}

              <MenuItem
                icon={
                  <UserRound className="h-4 w-4" />
                }
                onClick={() => {
                  closeMenu();
                  setProfileModalOpen(true);
                }}
              >
                Perfil
              </MenuItem>

              {/* EDITAR PERFIL */}

              <MenuItem
                icon={
                  <Pencil className="h-4 w-4" />
                }
                onClick={() => {
                  closeMenu();
                  setEditProfileModalOpen(true);
                }}
              >
                Editar perfil
              </MenuItem>

              {/* STATUS */}

              <div className="relative">
                <MenuItem
                  icon={
                    <span
                      className={[
                        "h-3 w-3 rounded-full",
                        currentStatus.color,
                      ].join(" ")}
                    />
                  }
                  arrow
                  onClick={toggleStatusMenu}
                >
                  Status
                </MenuItem>

                {submenu === "status" && (
                  <div
                    className="
                      absolute bottom-0 left-full ml-2
                      w-[230px]
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

                    {statusOptions.map(
                      (option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() =>
                            selectStatus(
                              option.id,
                            )
                          }
                          className="
                            flex w-full items-center gap-3
                            rounded-md px-2.5 py-2
                            text-left
                            transition-colors
                            hover:bg-stone-200
                            dark:hover:bg-zinc-800
                          "
                        >
                          <span
                            className={[
                              "h-3 w-3 shrink-0 rounded-full",
                              option.color,
                            ].join(" ")}
                          />

                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-stone-800 dark:text-zinc-100">
                              {option.label}
                            </div>

                            <div className="text-[10px] text-stone-500 dark:text-zinc-500">
                              {
                                option.description
                              }
                            </div>
                          </div>

                          {status ===
                            option.id && (
                            <Check className="h-4 w-4 text-emerald-500" />
                          )}
                        </button>
                      ),
                    )}
                  </div>
                )}
              </div>

              <Divider />

              {/* COPIAR ID */}

              <MenuItem
                icon={
                  <Copy className="h-4 w-4" />
                }
                onClick={copyUserId}
              >
                Copiar ID do usuário
              </MenuItem>

              {/* CONFIGURAÇÕES */}

              <MenuItem
                icon={
                  <Settings className="h-4 w-4" />
                }
                onClick={() => {
                  closeMenu();
                  setEditProfileModalOpen(true);
                }}
              >
                Configurações
              </MenuItem>

              <Divider />

              {/* SAIR */}

              <MenuItem
                icon={
                  <LogOut className="h-4 w-4" />
                }
                danger
                onClick={logout}
              >
                Sair
              </MenuItem>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL DE PERFIL                                           */}
      {/* ========================================================= */}

      <Modal
        isOpen={profileModalOpen}
        onClose={() =>
          setProfileModalOpen(false)
        }
        title="Perfil"
      >
        <div className="-mx-1 overflow-hidden rounded-lg">
          {/* BANNER */}

          <div className="relative h-32 overflow-hidden rounded-t-lg bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500">
            {banner && (
              <img
                src={banner}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
          </div>

          {/* AVATAR */}

          <div className="relative px-5 pb-5">
            <div className="-mt-10 mb-3">
              <div className="relative inline-block">
                <div
                  className="
                    flex h-20 w-20
                    items-center justify-center
                    overflow-hidden rounded-full
                    border-[5px]
                    border-white
                    bg-indigo-500
                    text-xl font-bold
                    text-white
                    dark:border-zinc-950
                  "
                >
                  {avatar ? (
                    <img
                      src={avatar}
                      alt={displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getInitials(displayName)
                  )}
                </div>

                <span
                  className={[
                    "absolute bottom-0 right-0",
                    "h-5 w-5 rounded-full",
                    "border-[4px] border-white",
                    "dark:border-zinc-950",
                    currentStatus.color,
                  ].join(" ")}
                />
              </div>
            </div>

            {/* NOME */}

            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                {displayName}
              </h2>

              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                @{username}
              </p>
            </div>

            {/* STATUS */}

            {customStatus && (
              <div className="mt-4 rounded-lg bg-zinc-100 px-3 py-2.5 dark:bg-zinc-900">
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={[
                      "h-2.5 w-2.5 rounded-full",
                      currentStatus.color,
                    ].join(" ")}
                  />

                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    {currentStatus.label}
                  </span>
                </div>

                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {customStatus}
                </p>
              </div>
            )}

            {/* SOBRE MIM */}

            {bio && (
              <div className="mt-4">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                  Sobre mim
                </p>

                <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {bio}
                </p>
              </div>
            )}

            {/* ID */}

            <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                ID do usuário
              </p>

              <button
                type="button"
                onClick={copyUserId}
                className="
                  flex max-w-full items-center gap-2
                  rounded-md px-1 py-1
                  text-xs text-zinc-600
                  transition-colors
                  hover:bg-zinc-100
                  hover:text-zinc-900
                  dark:text-zinc-400
                  dark:hover:bg-zinc-900
                  dark:hover:text-white
                "
              >
                <Copy className="h-3.5 w-3.5 shrink-0" />

                <span className="truncate">
                  {userId}
                </span>
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL EDITAR PERFIL                                       */}
      {/* ========================================================= */}

      <Modal
        isOpen={editProfileModalOpen}
        onClose={() =>
          setEditProfileModalOpen(false)
        }
        title="Editar perfil"
      >
        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">
              Seu perfil
            </p>

            <p className="mt-1 text-xs text-zinc-500">
              Personalize as informações que outros
              usuários podem ver.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div
              className="
                flex h-16 w-16 shrink-0
                items-center justify-center
                overflow-hidden rounded-full
                bg-indigo-500
                text-lg font-bold text-white
              "
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(displayName)
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate font-semibold text-zinc-900 dark:text-white">
                {displayName}
              </p>

              <p className="truncate text-xs text-zinc-500">
                @{username}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-900 dark:text-white">
              Editor de perfil
            </p>

            <p className="mt-1 text-xs text-zinc-500">
              Aqui você poderá editar avatar, banner,
              nome, biografia e outras informações.
            </p>

            <div className="mt-4 rounded-md bg-zinc-100 p-3 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              O formulário de edição pode ser conectado
              às suas actions do servidor posteriormente.
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}