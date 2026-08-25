"use client";

import {
  Check,
  ChevronRight,
  Copy,
  ImagePlus,
  Loader2,
  LogOut,
  Pencil,
  Settings,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { updateUserProfile, type ProfileStatus } from "@/actions/user";
import Modal from "@/components/Modal";
import Avatar from "./Image/Avatar";
import Banner from "./Image/Banner";

type ProfileUser = {
  id: string;
  username?: string | null;
  globalName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  status?: ProfileStatus | null;
  customStatus?: string | null;
};

interface UserProfileContentProps {
  user: ProfileUser | null;
}

type SettingsTab = "profile" | "presence";

type StatusOption = {
  id: ProfileStatus;
  label: string;
  description: string;
  color: string;
};

const statusOptions: StatusOption[] = [
  {
    id: "ONLINE",
    label: "Online",
    description: "Você aparece como disponível.",
    color: "bg-emerald-500",
  },
  {
    id: "IDLE",
    label: "Ausente",
    description: "Mostra que você pode estar longe do teclado.",
    color: "bg-amber-400",
  },
  {
    id: "DND",
    label: "Não perturbe",
    description: "Indica que você não quer ser interrompido.",
    color: "bg-rose-500",
  },
  {
    id: "OFFLINE",
    label: "Invisível",
    description: "Você aparece offline para outras pessoas.",
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
      className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
        danger
          ? "text-rose-500 hover:bg-rose-500/10"
          : "text-stone-700 hover:bg-stone-200 dark:text-zinc-200 dark:hover:bg-zinc-800"
      }`}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
      {arrow && <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />}
    </button>
  );
}

function Divider() {
  return <div className="my-1 border-t border-stone-200 dark:border-zinc-800" />;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-zinc-400">
      {children}
    </label>
  );
}

export default function UserProfileContent({ user }: UserProfileContentProps) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [localUser, setLocalUser] = useState<ProfileUser | null>(user);
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("profile");

  const [editUsername, setEditUsername] = useState("");
  const [editGlobalName, setEditGlobalName] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [editBannerUrl, setEditBannerUrl] = useState<string | null>(null);
  const [editBio, setEditBio] = useState("");
  const [editStatus, setEditStatus] = useState<ProfileStatus>("OFFLINE");
  const [editCustomStatus, setEditCustomStatus] = useState("");

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quickStatusSaving, setQuickStatusSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLocalUser(user);
  }, [user]);

  useEffect(() => {
    if (!localUser) return;

    setEditUsername(localUser.username || "");
    setEditGlobalName(localUser.globalName || "");
    setEditAvatarUrl(localUser.avatarUrl || null);
    setEditBannerUrl(localUser.bannerUrl || null);
    setEditBio(localUser.bio || "");
    setEditStatus(localUser.status || "OFFLINE");
    setEditCustomStatus(localUser.customStatus || "");
  }, [localUser, settingsOpen]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (
        target instanceof Node &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setMenuOpen(false);
        setStatusMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const username = localUser?.username || "usuario";
  const displayName = localUser?.globalName?.trim() || username;
  const currentStatus = localUser?.status || "OFFLINE";
  const currentStatusOption =
    statusOptions.find((item) => item.id === currentStatus) ?? statusOptions[3];

  const previewName = editGlobalName.trim() || editUsername.trim() || displayName;

  const hasUnsavedChanges = useMemo(() => {
    if (!localUser) return false;

    return (
      editUsername.trim().toLowerCase() !== (localUser.username || "").toLowerCase() ||
      editGlobalName.trim() !== (localUser.globalName || "") ||
      (editAvatarUrl || null) !== (localUser.avatarUrl || null) ||
      (editBannerUrl || null) !== (localUser.bannerUrl || null) ||
      editBio.trim() !== (localUser.bio || "") ||
      editStatus !== (localUser.status || "OFFLINE") ||
      editCustomStatus.trim() !== (localUser.customStatus || "")
    );
  }, [
    editAvatarUrl,
    editBannerUrl,
    editBio,
    editCustomStatus,
    editGlobalName,
    editStatus,
    editUsername,
    localUser,
  ]);

  if (!localUser) {
    return (
      <div className="flex h-[58px] shrink-0 items-center border-t border-stone-300 bg-stone-300/80 px-3 text-xs text-stone-500 dark:border-zinc-950 dark:bg-[#1e1f22] dark:text-zinc-500">
        Usuário não carregado
      </div>
    );
  }

  function closeMenu() {
    setMenuOpen(false);
    setStatusMenuOpen(false);
  }

  function openSettings(tab: SettingsTab = "profile") {
    closeMenu();
    setSettingsTab(tab);
    setFeedback("");
    setSettingsOpen(true);
  }

  function resetDraft() {
    setEditUsername(localUser.username || "");
    setEditGlobalName(localUser.globalName || "");
    setEditAvatarUrl(localUser.avatarUrl || null);
    setEditBannerUrl(localUser.bannerUrl || null);
    setEditBio(localUser.bio || "");
    setEditStatus(localUser.status || "OFFLINE");
    setEditCustomStatus(localUser.customStatus || "");
    setFeedback("");
  }

  async function copyUserId() {
    try {
      await navigator.clipboard.writeText(localUser.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function logout() {
    window.location.href = "/api/auth/signout";
  }

  async function uploadImage(
    event: React.ChangeEvent<HTMLInputElement>,
    type: "avatar" | "banner",
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFeedback("Selecione uma imagem válida.");
      return;
    }

    const maxSize = type === "avatar" ? 8 * 1024 * 1024 : 15 * 1024 * 1024;

    if (file.size > maxSize) {
      setFeedback(
        type === "avatar"
          ? "O avatar deve ter no máximo 8 MB."
          : "O banner deve ter no máximo 15 MB.",
      );
      return;
    }

    if (type === "avatar") setUploadingAvatar(true);
    else setUploadingBanner(true);

    setFeedback("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || data?.error || "Falha no upload.");
      }

      const reference = data.key || data.url;

      if (!reference || typeof reference !== "string") {
        throw new Error("O servidor não retornou a referência do arquivo.");
      }

      if (type === "avatar") setEditAvatarUrl(reference);
      else setEditBannerUrl(reference);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Erro ao enviar imagem.");
    } finally {
      if (type === "avatar") setUploadingAvatar(false);
      else setUploadingBanner(false);
    }
  }

  async function changeQuickStatus(status: ProfileStatus) {
    if (quickStatusSaving || status === currentStatus) {
      setStatusMenuOpen(false);
      return;
    }

    setQuickStatusSaving(true);

    try {
      const updated = await updateUserProfile({ status });
      setLocalUser((current) => (current ? { ...current, ...updated } : current));
      setStatusMenuOpen(false);
      router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setQuickStatusSaving(false);
    }
  }

  async function saveProfile() {
    if (saving || uploadingAvatar || uploadingBanner || !hasUnsavedChanges) return;

    setSaving(true);
    setFeedback("");

    try {
      const updated = await updateUserProfile({
        username: editUsername,
        globalName: editGlobalName || null,
        avatarUrl: editAvatarUrl,
        bannerUrl: editBannerUrl,
        bio: editBio || null,
        status: editStatus,
        customStatus: editCustomStatus || null,
      });

      setLocalUser(updated);
      setSettingsOpen(false);
      router.refresh();
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Não foi possível salvar o perfil.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(event) => uploadImage(event, "avatar")}
      />

      <input
        ref={bannerInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(event) => uploadImage(event, "banner")}
      />

      <div
        ref={menuRef}
        className="relative flex h-[58px] shrink-0 items-center gap-1 border-t border-stone-300 bg-stone-300/80 px-2 dark:border-zinc-950 dark:bg-[#1e1f22]"
      >
        <button
          type="button"
          onClick={() => {
            setMenuOpen((current) => !current);
            setStatusMenuOpen(false);
          }}
          className="flex min-w-0 flex-1 items-center rounded-md px-1 py-1 text-left transition-colors hover:bg-stone-400/40 dark:hover:bg-zinc-800/80"
        >
          <div className="relative shrink-0">
            <Avatar
              avatarUrl={localUser.avatarUrl}
              username={username}
              globalName={localUser.globalName}
              className="h-8 w-8"
            />
            <span
              className={`absolute bottom-[-1px] right-[-1px] h-3 w-3 rounded-full border-[3px] border-stone-300 dark:border-[#1e1f22] ${currentStatusOption.color}`}
            />
          </div>

          <div className="ml-2 min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold leading-tight text-stone-900 dark:text-white">
              {displayName}
            </div>
            <div className="truncate text-[11px] leading-tight text-stone-500 dark:text-zinc-400">
              {localUser.customStatus || currentStatusOption.label}
            </div>
          </div>
        </button>

        <button
          type="button"
          title="Configurações do perfil"
          onClick={() => openSettings("profile")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-stone-600 transition-colors hover:bg-stone-400/40 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          <Settings className="h-[18px] w-[18px]" />
        </button>

        {menuOpen && (
          <div className="absolute bottom-[66px] left-1 z-[100] w-[calc(100%-8px)] rounded-xl border border-stone-300 bg-white p-1.5 shadow-2xl dark:border-zinc-800 dark:bg-[#111214]">
            <button
              type="button"
              onClick={() => openSettings("profile")}
              className="mb-1 w-full overflow-hidden rounded-lg bg-stone-100 text-left transition hover:bg-stone-200 dark:bg-[#18191c] dark:hover:bg-zinc-800"
            >
              <div className="relative h-16 overflow-hidden bg-indigo-600">
                {localUser.bannerUrl ? (
                  <Banner bannerUrl={localUser.bannerUrl} />
                ) : (
                  <div className="h-full w-full bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600" />
                )}
              </div>

              <div className="relative px-3 pb-3">
                <div className="-mt-5 flex items-end gap-2">
                  <div className="relative rounded-full border-[4px] border-stone-100 dark:border-[#18191c]">
                    <Avatar
                      avatarUrl={localUser.avatarUrl}
                      username={username}
                      globalName={localUser.globalName}
                      className="h-11 w-11"
                    />
                    <span
                      className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-[3px] border-stone-100 dark:border-[#18191c] ${currentStatusOption.color}`}
                    />
                  </div>

                  <div className="min-w-0 pb-0.5">
                    <div className="truncate text-sm font-bold text-stone-900 dark:text-white">
                      {displayName}
                    </div>
                    <div className="truncate text-xs text-stone-500 dark:text-zinc-400">
                      @{username}
                    </div>
                  </div>
                </div>

                {localUser.customStatus && (
                  <div className="mt-2 truncate text-xs text-stone-600 dark:text-zinc-400">
                    {localUser.customStatus}
                  </div>
                )}
              </div>
            </button>

            <div className="space-y-0.5">
              <MenuItem
                icon={<UserRound className="h-4 w-4" />}
                onClick={() => openSettings("profile")}
              >
                Meu perfil
              </MenuItem>

              <div className="relative">
                <MenuItem
                  icon={
                    <span className={`h-3 w-3 rounded-full ${currentStatusOption.color}`} />
                  }
                  arrow
                  onClick={() => setStatusMenuOpen((current) => !current)}
                >
                  Definir status
                </MenuItem>

                {statusMenuOpen && (
                  <div className="absolute bottom-0 left-full ml-2 w-[235px] rounded-xl border border-stone-300 bg-white p-1.5 shadow-2xl dark:border-zinc-800 dark:bg-[#111214]">
                    {statusOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        disabled={quickStatusSaving}
                        onClick={() => changeQuickStatus(option.id)}
                        className="flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-stone-200 disabled:opacity-50 dark:hover:bg-zinc-800"
                      >
                        <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${option.color}`} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-stone-800 dark:text-zinc-100">
                            {option.label}
                          </div>
                          <div className="mt-0.5 text-[11px] leading-snug text-stone-500 dark:text-zinc-500">
                            {option.description}
                          </div>
                        </div>
                        {currentStatus === option.id && (
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Divider />

              <MenuItem
                icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                onClick={copyUserId}
              >
                {copied ? "ID copiado" : "Copiar ID do usuário"}
              </MenuItem>

              <Divider />

              <MenuItem icon={<LogOut className="h-4 w-4" />} danger onClick={logout}>
                Sair
              </MenuItem>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={settingsOpen}
        onClose={() => {
          if (saving || uploadingAvatar || uploadingBanner) return;
          resetDraft();
          setSettingsOpen(false);
        }}
        title="Configurações do perfil"
      >
        <div className="space-y-4">
          <div className="flex rounded-lg bg-stone-100 p-1 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setSettingsTab("profile")}
              className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition ${
                settingsTab === "profile"
                  ? "bg-white text-stone-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                  : "text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              Perfil
            </button>
            <button
              type="button"
              onClick={() => setSettingsTab("presence")}
              className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition ${
                settingsTab === "presence"
                  ? "bg-white text-stone-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                  : "text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              Presença
            </button>
          </div>

          {settingsTab === "profile" ? (
            <div className="space-y-5">
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-[#111214]">
                <div className="relative h-32 overflow-hidden bg-indigo-600">
                  {editBannerUrl ? (
                    <Banner bannerUrl={editBannerUrl} alt={`Banner de ${previewName}`} />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600" />
                  )}

                  <div className="absolute right-2 top-2 flex gap-1.5">
                    <button
                      type="button"
                      disabled={uploadingBanner}
                      onClick={() => bannerInputRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-50"
                    >
                      {uploadingBanner ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ImagePlus className="h-3.5 w-3.5" />
                      )}
                      Alterar
                    </button>

                    {editBannerUrl && (
                      <button
                        type="button"
                        disabled={uploadingBanner}
                        onClick={() => setEditBannerUrl(null)}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur transition hover:bg-rose-600 disabled:opacity-50"
                        title="Remover banner"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative px-4 pb-4">
                  <div className="-mt-10 flex items-end justify-between gap-3">
                    <div className="group relative rounded-full border-[5px] border-white dark:border-[#111214]">
                      <Avatar
                        avatarUrl={editAvatarUrl}
                        username={editUsername || username}
                        globalName={editGlobalName || null}
                        className="h-20 w-20"
                      />

                      <button
                        type="button"
                        disabled={uploadingAvatar}
                        onClick={() => avatarInputRef.current?.click()}
                        className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-white opacity-0 transition group-hover:bg-black/55 group-hover:opacity-100 disabled:opacity-50"
                        title="Alterar avatar"
                      >
                        {uploadingAvatar ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Pencil className="h-5 w-5" />
                        )}
                      </button>
                    </div>

                    {editAvatarUrl && (
                      <button
                        type="button"
                        disabled={uploadingAvatar}
                        onClick={() => setEditAvatarUrl(null)}
                        className="mb-1 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-rose-500 transition hover:bg-rose-500/10 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remover avatar
                      </button>
                    )}
                  </div>

                  <div className="mt-3">
                    <div className="text-lg font-bold text-stone-900 dark:text-white">
                      {previewName}
                    </div>
                    <div className="text-xs text-stone-500 dark:text-zinc-400">
                      @{editUsername || username}
                    </div>
                  </div>

                  {editBio.trim() && (
                    <div className="mt-3 border-t border-stone-200 pt-3 text-sm leading-relaxed text-stone-700 dark:border-zinc-800 dark:text-zinc-300">
                      {editBio}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <FieldLabel>Nome de exibição</FieldLabel>
                <input
                  type="text"
                  value={editGlobalName}
                  maxLength={32}
                  onChange={(event) => setEditGlobalName(event.target.value)}
                  placeholder="Como as pessoas verão seu nome"
                  className="h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none transition focus:border-indigo-500 dark:border-zinc-700 dark:bg-black dark:text-white"
                />
                <div className="mt-1 text-right text-[10px] text-stone-400">
                  {editGlobalName.length}/32
                </div>
              </div>

              <div>
                <FieldLabel>Nome de usuário</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">
                    @
                  </span>
                  <input
                    type="text"
                    value={editUsername}
                    maxLength={32}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    onChange={(event) =>
                      setEditUsername(
                        event.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""),
                      )
                    }
                    className="h-10 w-full rounded-md border border-stone-300 bg-white pl-8 pr-3 text-sm text-stone-900 outline-none transition focus:border-indigo-500 dark:border-zinc-700 dark:bg-black dark:text-white"
                  />
                </div>
                <p className="mt-1 text-[10px] text-stone-500 dark:text-zinc-500">
                  2–32 caracteres. Letras minúsculas, números, ponto e underline.
                </p>
              </div>

              <div>
                <FieldLabel>Sobre mim</FieldLabel>
                <textarea
                  value={editBio}
                  maxLength={190}
                  rows={4}
                  onChange={(event) => setEditBio(event.target.value)}
                  placeholder="Conte um pouco sobre você..."
                  className="w-full resize-none rounded-md border border-stone-300 bg-white p-3 text-sm text-stone-900 outline-none transition focus:border-indigo-500 dark:border-zinc-700 dark:bg-black dark:text-white"
                />
                <div className="mt-1 text-right text-[10px] text-stone-400">
                  {editBio.length}/190
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <FieldLabel>Status</FieldLabel>
                <div className="space-y-1 rounded-xl border border-stone-200 p-1.5 dark:border-zinc-800">
                  {statusOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setEditStatus(option.id)}
                      className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                        editStatus === option.id
                          ? "bg-indigo-500/10"
                          : "hover:bg-stone-100 dark:hover:bg-zinc-900"
                      }`}
                    >
                      <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${option.color}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-stone-800 dark:text-zinc-100">
                          {option.label}
                        </div>
                        <div className="mt-0.5 text-[11px] text-stone-500 dark:text-zinc-500">
                          {option.description}
                        </div>
                      </div>
                      {editStatus === option.id && (
                        <Check className="mt-0.5 h-4 w-4 text-indigo-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Status personalizado</FieldLabel>
                <div className="relative">
                  <input
                    type="text"
                    value={editCustomStatus}
                    maxLength={128}
                    onChange={(event) => setEditCustomStatus(event.target.value)}
                    placeholder="O que você está fazendo?"
                    className="h-10 w-full rounded-md border border-stone-300 bg-white px-3 pr-9 text-sm text-stone-900 outline-none transition focus:border-indigo-500 dark:border-zinc-700 dark:bg-black dark:text-white"
                  />

                  {editCustomStatus && (
                    <button
                      type="button"
                      onClick={() => setEditCustomStatus("")}
                      className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-zinc-800 dark:hover:text-white"
                      title="Limpar status personalizado"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="mt-1 text-right text-[10px] text-stone-400">
                  {editCustomStatus.length}/128
                </div>
              </div>

              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar
                      avatarUrl={editAvatarUrl}
                      username={editUsername || username}
                      globalName={editGlobalName || null}
                      className="h-10 w-10"
                    />
                    <span
                      className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-[3px] border-stone-50 dark:border-zinc-900 ${
                        statusOptions.find((item) => item.id === editStatus)?.color || "bg-zinc-500"
                      }`}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-stone-900 dark:text-white">
                      {previewName}
                    </div>
                    <div className="truncate text-xs text-stone-500 dark:text-zinc-400">
                      {editCustomStatus ||
                        statusOptions.find((item) => item.id === editStatus)?.label}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {feedback && (
            <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
              {feedback}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-stone-200 pt-4 dark:border-zinc-800">
            <button
              type="button"
              disabled={saving || uploadingAvatar || uploadingBanner || !hasUnsavedChanges}
              onClick={resetDraft}
              className="text-xs font-semibold text-stone-500 transition hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-500 dark:hover:text-white"
            >
              Descartar alterações
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving || uploadingAvatar || uploadingBanner}
                onClick={() => {
                  resetDraft();
                  setSettingsOpen(false);
                }}
                className="rounded-md px-3 py-2 text-xs font-semibold text-stone-600 transition hover:bg-stone-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={
                  saving ||
                  uploadingAvatar ||
                  uploadingBanner ||
                  !hasUnsavedChanges
                }
                onClick={saveProfile}
                className="flex min-w-28 items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}