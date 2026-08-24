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
  ImagePlus,
  Loader2,
} from "lucide-react";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/Modal";
import { updateUserProfile } from "@/actions/user";
import { useRouter } from "next/navigation";
import Avatar from "./Image/Avatar";
import Banner from "./Image/Banner";

type UserStatus = "ONLINE" | "IDLE" | "DND" | "INVISIBLE" | "OFFLINE";

type ProfileUser = {
  id: string;
  username?: string | null;
  globalName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  status?: UserStatus | null;
  customStatus?: string | null;
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
  { id: "ONLINE", label: "Online", description: "Disponível", color: "bg-emerald-500" },
  { id: "IDLE", label: "Ausente", description: "Ausente", color: "bg-yellow-500" },
  { id: "DND", label: "Ocupado", description: "Não perturbe", color: "bg-red-500" },
  { id: "INVISIBLE", label: "Invisível", description: "Invisível", color: "bg-zinc-500" },
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
        "text-sm transition-colors font-medium",
        danger
          ? "text-red-500 hover:bg-red-500/10"
          : "text-stone-700 hover:bg-stone-200 dark:text-zinc-200 dark:hover:bg-zinc-800",
      ].join(" ")}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
      {arrow && <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />}
    </button>
  );
}

function Divider() {
  return <div className="my-1 border-t border-stone-200 dark:border-zinc-800" />;
}

export default function UserProfileContent({ user }: UserProfileContentProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [submenu, setSubmenu] = useState<"status" | null>(null);

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editProfileModalOpen, setEditProfileModalOpen] = useState(false);

  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  const [status, setStatus] = useState<UserStatus>(() => (user?.status as UserStatus) || "ONLINE");
  const [customStatus, setCustomStatus] = useState<string>(() => user?.customStatus || "");
  const [editingStatus, setEditingStatus] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const menuRef = useRef<HTMLDivElement>(null);
  const editAvatarRef = useRef<HTMLInputElement>(null);
  const editBannerRef = useRef<HTMLInputElement>(null);

  const [editGlobalName, setEditGlobalName] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editBannerUrl, setEditBannerUrl] = useState("");
  const [editBio, setEditBio] = useState("");
  
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const username = user?.username || "usuario";
  const displayName = user?.globalName || username;
  const userId = user?.id || "";

  const currentStatus = statusOptions.find((item) => item.id === status) ?? statusOptions[0];

  useEffect(() => {
    if (!user) return;
    setEditGlobalName(user.globalName || "");
    setEditAvatarUrl(user.avatarUrl || "");
    setEditBannerUrl(user.bannerUrl || "");
    setEditBio(user.bio || "");
    setStatus(user.status || "ONLINE");
    setCustomStatus(user.customStatus || "");
  }, [user]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
        setSubmenu(null);
        setEditingStatus(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => { document.removeEventListener("pointerdown", handlePointerDown); };
  }, []);

  function getInitials(name: string) {
    const clean = name.trim();
    if (!clean) return "U";
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0][0].toUpperCase();
  }

  async function copyUserId() {
    if (!userId) return;
    try {
      await navigator.clipboard.writeText(userId);
    } catch {
      console.error("Erro ao copiar ID");
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

  async function handleUploadFile(event: React.ChangeEvent<HTMLInputElement>, type: "avatar" | "banner") {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Selecione uma imagem válida.");
      return;
    }

    if (type === "avatar") setIsUploadingAvatar(true);
    else setIsUploadingBanner(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !data.success || !data.key) {
        throw new Error(data.message ?? "Falha no upload.");
      }

      if (type === "avatar") {
        setEditAvatarUrl(data.key);
      } else {
        setEditBannerUrl(data.key);
      }
    } catch (error: any) {
      alert(error.message ?? "Erro ao enviar imagem.");
    } finally {
      if (type === "avatar") setIsUploadingAvatar(false);
      else setIsUploadingBanner(false);
    }
  }

  async function handleStatusChange(newStatus: UserStatus) {
    setStatus(newStatus);
    setSubmenu(null);
    try {
      await updateUserProfile({
        status: newStatus,
      } as Parameters<typeof updateUserProfile>[0]);
      router.refresh();
    } catch (error) {
      console.error(error);
    }
  }

  async function handleCustomStatusChange(newCustomStatus: string) {
    setCustomStatus(newCustomStatus);
    setEditingStatus(false);
    try {
      await updateUserProfile({
        customStatus: newCustomStatus,
      } as Parameters<typeof updateUserProfile>[0]);
      router.refresh();
    } catch (error) {
      console.error(error);
    }
  }

  async function handleSaveProfile() {
    setIsSaving(true);
    try {
      await updateUserProfile({
        globalName: editGlobalName,
        avatarUrl: editAvatarUrl,
        bannerUrl: editBannerUrl,
        bio: editBio,
      });
      
      setEditProfileModalOpen(false);
      router.refresh();
      window.location.reload();
    } catch (error) {
      console.error(error);
      alert("Não foi possível salvar o perfil.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <input ref={editAvatarRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => handleUploadFile(e, "avatar")} />
      <input ref={editBannerRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => handleUploadFile(e, "banner")} />

      <div
        ref={menuRef}
        className="relative flex h-[58px] shrink-0 items-center border-t border-stone-300 bg-stone-300/80 px-2 dark:border-zinc-950 dark:bg-[#1e1f22]"
      >
        <button
          type="button"
          onClick={() => { setMenuOpen((c) => !c); setSubmenu(null); setEditingStatus(false); }}
          className="flex min-w-0 flex-1 items-center rounded-md px-1 py-1 text-left transition-colors hover:bg-stone-400/40 dark:hover:bg-zinc-800/80"
        >
          <div className="relative shrink-0">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-indigo-500 text-xs font-bold text-white shadow-sm">
              {user?.avatarUrl ? (
                <Avatar avatarUrl={user?.avatarUrl} className="h-full w-full object-cover" />
              ) : (
                getInitials(displayName)
              )}
            </div>
            <span className={["absolute bottom-[-1px] right-[-1px] h-3 w-3 rounded-full border-[3px] border-stone-300 dark:border-[#1e1f22]", currentStatus.color].join(" ")} />
          </div>

          <div className="ml-2 min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold leading-tight text-stone-900 dark:text-white">
              {displayName}
            </div>
            <div className="truncate text-[11px] leading-tight text-stone-500 dark:text-zinc-400">
            {isMounted ? (customStatus || "Disponível") : (user?.customStatus || "Disponível")}
            </div>
          </div>
        </button>

        <div className="ml-1 flex items-center">
          <button
            type="button"
            title={isMuted ? "Ativar microfone" : "Silenciar"}
            onClick={() => setIsMuted((val) => !val)}
            className={["flex h-8 w-8 items-center justify-center rounded-md transition-colors", isMuted ? "text-red-400 hover:bg-red-500/10" : "text-stone-600 hover:bg-stone-400/40 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"].join(" ")}
          >
            <Mic className="h-[18px] w-[18px]" />
          </button>

          <button
            type="button"
            title={isDeafened ? "Ativar áudio" : "Desativar áudio"}
            onClick={() => setIsDeafened((val) => !val)}
            className={["flex h-8 w-8 items-center justify-center rounded-md transition-colors", isDeafened ? "text-red-400 hover:bg-red-500/10" : "text-stone-600 hover:bg-stone-400/40 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"].join(" ")}
          >
            <Headphones className="h-[18px] w-[18px]" />
          </button>

          <button
            type="button"
            title="Configurações"
            onClick={() => { closeMenu(); setEditProfileModalOpen(true); }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-stone-600 transition-colors hover:bg-stone-400/40 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <Settings className="h-[18px] w-[18px]" />
          </button>
        </div>

        {menuOpen && (
          <div className="absolute bottom-[66px] left-1 z-[100] w-[calc(100%-8px)] rounded-lg border border-stone-300 bg-white p-1.5 shadow-2xl dark:border-zinc-800 dark:bg-[#111214]">
            <div className="mb-1 rounded-md bg-stone-100 p-3 dark:bg-[#18191c]">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-indigo-500 text-sm font-bold text-white shadow">
                    {user?.avatarUrl ? (
                      <Avatar avatarUrl={user?.avatarUrl} className="h-full w-full object-cover" />
                    ) : (
                      getInitials(displayName)
                    )}
                  </div>
                  <span className={["absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-[3px] border-stone-100 dark:border-[#18191c]", currentStatus.color].join(" ")} />
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

              {editingStatus ? (
                <input
                  type="text"
                  value={customStatus}
                  maxLength={128}
                  autoFocus
                  onChange={(e) => setCustomStatus(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCustomStatusChange(customStatus);
                    } else if (e.key === "Escape") {
                      setCustomStatus(user?.customStatus || "");
                      setEditingStatus(false);
                    }
                  }}
                  onBlur={() => handleCustomStatusChange(customStatus)}
                  placeholder="O que você está fazendo?"
                  className="mt-3 w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs text-stone-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-[#232428] dark:text-white"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingStatus(true)}
                  className="mt-3 flex w-full items-center gap-2 rounded-md border border-stone-300 bg-white px-2.5 py-2 text-left transition-colors hover:border-stone-400 dark:border-zinc-700 dark:bg-[#232428] dark:hover:border-zinc-600"
                >
                  <span className="text-sm">💭</span>
                  <span className="truncate text-xs italic text-stone-500 dark:text-zinc-400">
                    {customStatus || "Definir status personalizado"}
                  </span>
                  <Pencil className="ml-auto h-3.5 w-3.5 text-zinc-500" />
                </button>
              )}
            </div>

            <div className="space-y-0.5">
              <MenuItem icon={<UserRound className="h-4 w-4" />} onClick={() => { closeMenu(); setProfileModalOpen(true); }}>
                Perfil
              </MenuItem>
              <MenuItem icon={<Pencil className="h-4 w-4" />} onClick={() => { closeMenu(); setEditProfileModalOpen(true); }}>
                Editar perfil
              </MenuItem>

              <div className="relative">
                <MenuItem icon={<span className={["h-3 w-3 rounded-full", currentStatus.color].join(" ")} />} arrow onClick={() => setSubmenu((c) => c === "status" ? null : "status")}>
                  Status
                </MenuItem>

                {submenu === "status" && (
                  <div className="absolute bottom-0 left-full ml-2 w-[220px] rounded-lg border border-stone-300 bg-white p-1.5 shadow-2xl dark:border-zinc-800 dark:bg-[#111214]">
                    <div className="px-2.5 py-2">
                      <div className="text-xs font-bold text-stone-800 dark:text-white">Status</div>
                    </div>
                    {statusOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleStatusChange(opt.id)}
                        className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-stone-200 dark:hover:bg-zinc-800"
                      >
                        <span className={["h-3 w-3 shrink-0 rounded-full", opt.color].join(" ")} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-stone-800 dark:text-zinc-100">{opt.label}</div>
                        </div>
                        {status === opt.id && <Check className="h-4 w-4 text-emerald-500" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Divider />
              <MenuItem icon={<Copy className="h-4 w-4" />} onClick={copyUserId}>Copiar ID do usuário</MenuItem>
              <MenuItem icon={<Settings className="h-4 w-4" />} onClick={() => { closeMenu(); setEditProfileModalOpen(true); }}>
                Configurações
              </MenuItem>
              <Divider />
              <MenuItem icon={<LogOut className="h-4 w-4" />} danger onClick={logout}>Sair</MenuItem>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={profileModalOpen} onClose={() => setProfileModalOpen(false)} title="Perfil">
        <div className="overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-[#111214] border border-stone-200 dark:border-zinc-800">
          <div className="relative h-36 w-full bg-indigo-600 overflow-hidden">
            {user?.bannerUrl ? (
              <Banner bannerUrl={user?.bannerUrl} />
            ) : (
              <div className="h-full w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500" />
            )}
          </div>

          <div className="relative px-6 pb-6 pt-4">
            <div className="-mt-14 mb-4 flex items-end justify-between">
              <div className="relative inline-block h-24 w-24">
                <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-[6px] border-white bg-indigo-500 text-2xl font-bold text-white dark:border-[#111214] shadow-lg">
                  {user?.avatarUrl ? (
                    <Avatar avatarUrl={user.avatarUrl} className="h-full w-full object-cover" />
                  ) : (
                    getInitials(displayName)
                  )}
                </div>
                <span className={["absolute bottom-1 right-1 h-5 w-5 rounded-full border-[4px] border-white dark:border-[#111214]", currentStatus.color].join(" ")} />
              </div>

              <button
                type="button"
                onClick={() => { setProfileModalOpen(false); setEditProfileModalOpen(true); }}
                className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow transition-colors hover:bg-indigo-500"
              >
                Editar Perfil
              </button>
            </div>

            <div>
              <h2 className="text-xl font-bold text-stone-900 dark:text-white">{displayName}</h2>
              <p className="text-sm font-medium text-stone-500 dark:text-zinc-400">@{username}</p>
            </div>

            {customStatus && (
              <div className="mt-4 rounded-lg bg-stone-100 p-3 dark:bg-zinc-900">
                <div className="flex items-center gap-2">
                  <span className={["h-2.5 w-2.5 rounded-full", currentStatus.color].join(" ")} />
                  <span className="text-xs font-semibold text-stone-700 dark:text-zinc-300">{currentStatus.label}</span>
                </div>
                <p className="mt-1 text-sm text-stone-600 dark:text-zinc-400">{customStatus}</p>
              </div>
            )}

            {user?.bio && (
              <div className="mt-4">
                <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400">Sobre mim</h4>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700 dark:text-zinc-300">{user.bio}</p>
              </div>
            )}

            <div className="mt-6 border-t border-stone-200 pt-4 dark:border-zinc-800">
              <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400">ID do usuário</h4>
              <button
                type="button"
                onClick={copyUserId}
                className="flex items-center gap-2 rounded-md px-1 py-1 text-xs text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white"
              >
                <Copy className="h-3.5 w-3.5" />
                <span className="truncate">{userId}</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>

      <Modal isOpen={editProfileModalOpen} onClose={() => setEditProfileModalOpen(false)} title="Editar perfil">
        <div className="space-y-5">
          <p className="text-sm text-stone-500 dark:text-zinc-400">
            Personalize sua aparência com banner, avatar e biografia.
          </p>

          <div className="space-y-4 rounded-xl border border-stone-200 p-4 dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900/40">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                Banner do Perfil
              </label>
              <div className="relative h-28 w-full overflow-hidden rounded-lg bg-indigo-600 mb-2 border border-stone-200 dark:border-zinc-800">
                {editBannerUrl ? (
                  <Banner bannerUrl={editBannerUrl} />
                ) : (
                  <div className="h-full w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500" />
                )}
                <button
                  type="button"
                  onClick={() => editBannerRef.current?.click()}
                  disabled={isUploadingBanner}
                  className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-md bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/80"
                >
                  {isUploadingBanner ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                  Alterar banner
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                Avatar do Usuário
              </label>
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-500 text-lg font-bold text-white shadow">
                  {editAvatarUrl ? (
                    <Avatar avatarUrl={editAvatarUrl} className="h-full w-full object-cover" />
                  ) : (
                    getInitials(displayName)
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => editAvatarRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 shadow-sm transition hover:bg-stone-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  {isUploadingAvatar ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
                  {isUploadingAvatar ? "Enviando..." : "Alterar avatar"}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                Nome de Exibição
              </label>
              <input
                type="text"
                value={editGlobalName}
                onChange={(e) => setEditGlobalName(e.target.value)}
                placeholder="Seu nome visível"
                className="h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none transition-colors focus:border-indigo-500 dark:border-zinc-700 dark:bg-black dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
                Sobre Mim
              </label>
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="Conte um pouco sobre você..."
                rows={3}
                className="w-full resize-none rounded-md border border-stone-300 bg-white p-3 text-sm text-stone-900 outline-none transition-colors focus:border-indigo-500 dark:border-zinc-700 dark:bg-black dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setEditProfileModalOpen(false)}
              disabled={isSaving}
              className="rounded-md px-4 py-2 text-sm font-semibold text-stone-600 transition-colors hover:underline dark:text-zinc-400"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveProfile}
              disabled={isSaving || isUploadingAvatar || isUploadingBanner}
              className="flex items-center justify-center rounded-md bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 shadow"
            >
              {isSaving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}