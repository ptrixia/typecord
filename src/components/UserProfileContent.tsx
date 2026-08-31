"use client";

import {
  Check,
  ChevronRight,
  Copy,
  AppWindow,
  Bell,
  Download,
  Eye,
  FileClock,
  Folder,
  Keyboard,
  KeyRound,
  Monitor,
  Search,
  ShieldCheck,
  Star,
  Timer,
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
import { useTheme } from "next-themes";
import { clearTauriAppPin, getTauriOpenApplications, getTauriSecureSecret, hasTauriAppPin, isTauriRuntime, setTauriAppPin, setTauriSecureSecret, type TauriOpenApplication } from "@/lib/tauri";
import { usePreferences } from "@/components/app/PreferencesProvider";

import { updateUserProfile, type ProfileStatus } from "@/actions/user";
import { decryptBackup, encryptBackup } from "@/lib/secure-backup";
import Avatar from "./Image/Avatar";
import Banner from "./Image/Banner";
import TwoFactorSettings from "./TwoFactorSettings";

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
  richPresence?: {
    type: "PLAYING" | "LISTENING" | "WATCHING" | "STREAMING" | "COMPETING" | "CUSTOM";
    name: string;
    details?: string | null;
    state?: string | null;
  } | null;
};

interface UserProfileContentProps {
  user: ProfileUser | null;
}

type SettingsTab = "profile" | "presence" | "appearance" | "notifications" | "privacy" | "accessibility" | "security" | "data";

type E2EEDevice = {
  id: string;
  deviceId: string;
  label: string | null;
  fingerprint: string;
  revokedAt: string | null;
  lastSeenAt: string;
  createdAt: string;
};

type ActiveSession = {
  id: string;
  expires: string;
  current: boolean;
};

type SecurityLog = { id: string; label: string; level: string; createdAt: string };

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
      className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors ${
        danger
          ? "text-rose-500 hover:bg-rose-500/10"
          : "text-stone-700 hover:bg-stone-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
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
  return <div className="my-1.5 border-t border-stone-200 dark:border-zinc-800/80" />;
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
  const { theme, setTheme } = useTheme();
  const { preferences: appPreferences, setPreference } = usePreferences();

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
  const [usernameStep, setUsernameStep] = useState<"idle" | "review" | "confirm">("idle");
  const [quickStatusSaving, setQuickStatusSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [copied, setCopied] = useState(false);
  const [temporaryMessages, setTemporaryMessages] = useState("off");
  const [templateText, setTemplateText] = useState("");
  const [templates, setTemplates] = useState<string[]>([]);
  const [localSearch, setLocalSearch] = useState("");
  const [backupFeedback, setBackupFeedback] = useState("");
  const [backupPassphrase, setBackupPassphrase] = useState("");
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [e2eeDevices, setE2eeDevices] = useState<E2EEDevice[]>([]);
  const [loadingE2eeDevices, setLoadingE2eeDevices] = useState(false);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [appPinConfigured, setAppPinConfigured] = useState(false);
  const [appPin, setAppPin] = useState("");
  const [appPinFeedback, setAppPinFeedback] = useState("");

  useEffect(() => {
    try {
      setTemporaryMessages(window.localStorage.getItem("typecord:temporary-messages") || "off");
      const storedTemplates = window.localStorage.getItem("typecord:quick-templates");
      if (storedTemplates) setTemplates(JSON.parse(storedTemplates));
    } catch { /* preferir os padrões quando o storage estiver indisponível */ }
  }, []);

  useEffect(() => {
    if (settingsOpen && settingsTab === "security" && isTauriRuntime()) void hasTauriAppPin().then(setAppPinConfigured).catch(() => setAppPinConfigured(false));
  }, [settingsOpen, settingsTab]);

  useEffect(() => {
    if (!settingsOpen || settingsTab !== "security") return;
    let cancelled = false;
    void fetch("/api/account/security-logs", { cache: "no-store" }).then((response) => response.json()).then((body) => { if (!cancelled && Array.isArray(body?.logs)) setSecurityLogs(body.logs); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [settingsOpen, settingsTab]);

  async function saveAppPin() {
    if (appPin.length < 4) { setAppPinFeedback("O PIN precisa ter pelo menos 4 dígitos."); return; }
    try { await setTauriAppPin(appPin); setAppPin(""); setAppPinConfigured(true); setAppPinFeedback("Bloqueio por PIN ativado neste dispositivo."); } catch (error) { setAppPinFeedback(error instanceof Error ? error.message : "Não foi possível ativar o bloqueio."); }
  }

  async function removeAppPin() {
    try { await clearTauriAppPin(); setAppPinConfigured(false); setAppPinFeedback("Bloqueio por PIN removido."); } catch { setAppPinFeedback("Não foi possível remover o bloqueio."); }
  }

  function lockAppNow() {
    window.dispatchEvent(new Event("typecord:lock-app"));
  }

  function setTemporaryMessagePolicy(value: string) {
    setTemporaryMessages(value);
    window.localStorage.setItem("typecord:temporary-messages", value);
  }

  function addTemplate() {
    const value = templateText.trim();
    if (!value) return;
    const next = [...templates, value].slice(-20);
    setTemplates(next);
    setTemplateText("");
    window.localStorage.setItem("typecord:quick-templates", JSON.stringify(next));
  }

  function removeTemplate(index: number) {
    const next = templates.filter((_, itemIndex) => itemIndex !== index);
    setTemplates(next);
    window.localStorage.setItem("typecord:quick-templates", JSON.stringify(next));
  }

  function downloadJson(filename: string, value: unknown) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function exportE2EEBackup() {
    setBackupFeedback("");
    if (backupPassphrase.length < 12) {
      setBackupFeedback("Use uma senha de pelo menos 12 caracteres para proteger o backup.");
      return;
    }
    try {
      const rawKeys = Object.entries(localStorage).filter(([key]) => key.startsWith("typecord:e2ee:"));
      const secureIdentity = isTauriRuntime()
        ? await getTauriSecureSecret(`e2ee-identity:${profileUser.id}`)
        : null;
      const encrypted = await encryptBackup({
        version: 2,
        exportedAt: new Date().toISOString(),
        storage: isTauriRuntime() ? "tauri-keyring" : "browser-storage",
        keys: rawKeys,
        secureIdentity,
      }, backupPassphrase);
      const blob = new Blob([encrypted], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `typecord-e2ee-backup-encrypted-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setBackupPassphrase("");
      setBackupFeedback("Backup de chaves criptografado exportado. Guarde a senha offline.");
    } catch {
      setBackupFeedback("Não foi possível exportar o backup neste dispositivo.");
    }
  }

  async function exportSettingsBackup() {
    if (backupPassphrase.length < 12) {
      setBackupFeedback("Use uma senha de pelo menos 12 caracteres para proteger o backup.");
      return;
    }
    const encrypted = await encryptBackup({ version: 1, exportedAt: new Date().toISOString(), preferences: appPreferences, templates, temporaryMessages, theme }, backupPassphrase);
    const blob = new Blob([encrypted], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `typecord-settings-encrypted-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setBackupPassphrase("");
    setBackupFeedback("Backup criptografado exportado. A senha não pode ser recuperada.");
  }

  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (backupPassphrase.length < 12) {
      setBackupFeedback("Informe a senha do backup antes de importar.");
      return;
    }
    try {
      const restored = await decryptBackup(await file.text(), backupPassphrase);
      const preferences = restored.preferences;
      if (preferences && typeof preferences === "object") {
        window.localStorage.setItem("typecord:app-preferences", JSON.stringify(preferences));
        window.localStorage.setItem("typecord:preferences", JSON.stringify(preferences));
      }
      if (Array.isArray(restored.templates)) window.localStorage.setItem("typecord:quick-templates", JSON.stringify(restored.templates));
      if (typeof restored.temporaryMessages === "string") window.localStorage.setItem("typecord:temporary-messages", restored.temporaryMessages);
      if (Array.isArray(restored.keys)) {
        for (const item of restored.keys) {
          if (!Array.isArray(item) || typeof item[0] !== "string" || typeof item[1] !== "string") continue;
          window.localStorage.setItem(item[0], item[1]);
        }
      }
      if (isTauriRuntime() && typeof restored.secureIdentity === "string") {
        await setTauriSecureSecret(`e2ee-identity:${profileUser.id}`, restored.secureIdentity);
      }
      setBackupPassphrase("");
      setBackupFeedback("Backup restaurado. Recarregando o aplicativo...");
      window.setTimeout(() => window.location.reload(), 700);
    } catch {
      setBackupFeedback("Não foi possível abrir o backup. Verifique o arquivo e a senha.");
    }
  }

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
    if (!settingsOpen || settingsTab !== "security") return;
    let cancelled = false;
    setLoadingE2eeDevices(true);
    void fetch("/api/users/crypto", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => {
        if (!cancelled && Array.isArray(body?.devices)) setE2eeDevices(body.devices);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingE2eeDevices(false);
      });
    return () => { cancelled = true; };
  }, [settingsOpen, settingsTab]);

  useEffect(() => {
    if (!settingsOpen || settingsTab !== "security") return;
    let cancelled = false;
    setLoadingSessions(true);
    void fetch("/api/account/sessions", { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => {
        if (!cancelled && Array.isArray(body?.sessions)) setActiveSessions(body.sessions);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingSessions(false);
      });
    return () => { cancelled = true; };
  }, [settingsOpen, settingsTab]);

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
      <div className="fixed bottom-6 left-6 z-50 flex h-[64px] w-[280px] shrink-0 items-center justify-center rounded-2xl border border-stone-200/60 bg-white/80 px-3 text-sm text-stone-500 shadow-xl backdrop-blur-xl dark:border-zinc-800/60 dark:bg-[#111214]/80 dark:text-zinc-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Carregando...
      </div>
    );
  }

  const profileUser = localUser;

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
    setEditUsername(profileUser.username || "");
    setEditGlobalName(profileUser.globalName || "");
    setEditAvatarUrl(profileUser.avatarUrl || null);
    setEditBannerUrl(profileUser.bannerUrl || null);
    setEditBio(profileUser.bio || "");
    setEditStatus(profileUser.status || "OFFLINE");
    setEditCustomStatus(profileUser.customStatus || "");
    setFeedback("");
    setUsernameStep("idle");
  }

  async function copyUserId() {
    try {
      await navigator.clipboard.writeText(profileUser.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function logout() {
    window.location.href = "/api/auth/signout";
  }

  async function revokeE2EEDevice(deviceId: string) {
    if (!window.confirm("Revogar este dispositivo? Ele não poderá mais descriptografar novas mensagens.")) return;
    setRevokingDeviceId(deviceId);
    try {
      const response = await fetch(`/api/users/crypto?deviceId=${encodeURIComponent(deviceId)}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setE2eeDevices((current) => current.map((device) => device.deviceId === deviceId ? { ...device, revokedAt: new Date().toISOString() } : device));
    } catch {
      setFeedback("Não foi possível revogar o dispositivo.");
    } finally {
      setRevokingDeviceId(null);
    }
  }

  async function revokeSession(id: string) {
    if (!window.confirm("Encerrar esta sessão remotamente?")) return;
    setRevokingSessionId(id);
    try {
      const response = await fetch("/api/account/sessions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!response.ok) throw new Error();
      setActiveSessions((current) => current.filter((session) => session.id !== id));
    } catch {
      setFeedback("Não foi possível encerrar a sessão.");
    } finally {
      setRevokingSessionId(null);
    }
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

    const usernameChanged = editUsername.trim().toLowerCase() !== (profileUser.username || "").toLowerCase();
    if (usernameChanged && usernameStep === "idle") {
      setUsernameStep("review");
      setFeedback("Revise a alteração do username antes de continuar.");
      return;
    }
    if (usernameChanged && usernameStep === "review") {
      setUsernameStep("confirm");
      setFeedback("Última confirmação: este username ficará visível para todos e pode afetar menções antigas.");
      return;
    }

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
      setUsernameStep("idle");
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
        className="fixed bottom-6 left-6 z-50 flex h-[64px] w-[280px] shrink-0 items-center gap-1.5 rounded-2xl border border-stone-200/60 bg-white/80 p-2 shadow-2xl backdrop-blur-xl transition-all hover:shadow-indigo-500/10 dark:border-zinc-800/60 dark:bg-[#111214]/80"
      >
        <button
          type="button"
          onClick={() => {
            setMenuOpen((current) => !current);
            setStatusMenuOpen(false);
          }}
          className="flex min-w-0 flex-1 items-center rounded-xl p-1.5 text-left transition-colors hover:bg-stone-100/80 dark:hover:bg-zinc-800/80"
        >
          <div className="relative shrink-0">
            <Avatar
              avatarUrl={localUser.avatarUrl}
              username={username}
              globalName={localUser.globalName}
              className="h-9 w-9 rounded-full shadow-sm"
            />
            <span
              className={`absolute bottom-[-1px] right-[-1px] h-3.5 w-3.5 rounded-full border-[3px] border-white dark:border-[#111214] ${currentStatusOption.color}`}
            />
          </div>

          <div className="ml-3 min-w-0 flex-1">
            <div className="truncate text-sm font-semibold leading-tight text-stone-900 dark:text-white">
              {displayName}
            </div>
            <div className="truncate text-xs leading-tight text-stone-500 dark:text-zinc-400">
              {localUser.customStatus || currentStatusOption.label}
            </div>
          </div>
        </button>

        <button
          type="button"
          title="Configurações do perfil"
          onClick={() => openSettings("profile")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-stone-500 transition-colors hover:bg-stone-100/80 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800/80 dark:hover:text-white"
        >
          <Settings className="h-5 w-5" />
        </button>

        {menuOpen && (
          <div className="absolute bottom-[calc(100%+16px)] left-0 z-[100] w-[280px] rounded-2xl border border-stone-200/60 bg-white p-2 shadow-2xl backdrop-blur-xl dark:border-zinc-800/80 dark:bg-[#111214]/95">
            <button
              type="button"
              onClick={() => openSettings("profile")}
              className="mb-2 w-full overflow-hidden rounded-xl bg-stone-50 text-left transition hover:bg-stone-100 dark:bg-[#18191c] dark:hover:bg-zinc-800"
            >
              <div className="relative h-16 overflow-hidden bg-indigo-600">
                {localUser.bannerUrl ? (
                  <Banner bannerUrl={localUser.bannerUrl} />
                ) : (
                  <div className="h-full w-full bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600" />
                )}
              </div>

              <div className="relative px-3 pb-3">
                <div className="-mt-6 flex items-end gap-2">
                  <div className="relative rounded-full border-[4px] border-stone-50 dark:border-[#18191c]">
                    <Avatar
                      avatarUrl={localUser.avatarUrl}
                      username={username}
                      globalName={localUser.globalName}
                      className="h-12 w-12"
                    />
                    <span
                      className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-[3px] border-stone-50 dark:border-[#18191c] ${currentStatusOption.color}`}
                    />
                  </div>

                  <div className="min-w-0 pb-1">
                    <div className="truncate text-sm font-bold text-stone-900 dark:text-white">
                      {displayName}
                    </div>
                    <div className="truncate text-[11px] text-stone-500 dark:text-zinc-400">
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
                icon={<UserRound className="h-[18px] w-[18px]" />}
                onClick={() => openSettings("profile")}
              >
                Meu perfil
              </MenuItem>
              <MenuItem
                icon={<Monitor className="h-[18px] w-[18px]" />}
                onClick={() => openSettings("appearance")}
              >
                Configurações do app
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
                  <div className="absolute bottom-0 left-[calc(100%+12px)] w-[240px] rounded-2xl border border-stone-200/60 bg-white p-2 shadow-2xl backdrop-blur-xl dark:border-zinc-800/80 dark:bg-[#111214]/95">
                    {statusOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        disabled={quickStatusSaving}
                        onClick={() => changeQuickStatus(option.id)}
                        className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-stone-100 disabled:opacity-50 dark:hover:bg-zinc-800"
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
                icon={copied ? <Check className="h-[18px] w-[18px]" /> : <Copy className="h-[18px] w-[18px]" />}
                onClick={copyUserId}
              >
                {copied ? "ID copiado" : "Copiar ID"}
              </MenuItem>

              <Divider />

              <MenuItem icon={<LogOut className="h-[18px] w-[18px]" />} danger onClick={logout}>
                Sair
              </MenuItem>
            </div>
          </div>
        )}
      </div>

      {settingsOpen && <div className="fixed inset-0 z-[100] flex h-screen w-screen flex-col bg-stone-50 text-stone-700 dark:bg-[#0b0c0e] dark:text-zinc-300">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-6 dark:border-zinc-800 dark:bg-[#111214]">
          <div><p className="text-lg font-bold text-stone-900 dark:text-white">Configurações</p><p className="text-xs text-stone-500 dark:text-zinc-500">Personalize sua experiência no Typecord</p></div>
          <button type="button" onClick={() => {
          if (saving || uploadingAvatar || uploadingBanner) return;
          resetDraft();
          setSettingsOpen(false);
        }} className="rounded-lg px-3 py-2 text-sm font-semibold text-stone-500 hover:bg-stone-100 dark:hover:bg-zinc-800">Fechar</button>
        </div>
        <div className="flex min-h-0 flex-1">
          <aside className="w-64 shrink-0 overflow-y-auto border-r border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#111214]">
            <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-wider text-stone-400">Conta</p>
            <button
              type="button"
              onClick={() => setSettingsTab("profile")}
              className={`mb-1 flex w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
                settingsTab === "profile"
                  ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                  : "text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              Perfil
            </button>
            <button
              type="button"
              onClick={() => setSettingsTab("presence")}
              className={`mb-4 flex w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
                settingsTab === "presence"
                  ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                  : "text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white"
              }`}
            >
              Atividade
            </button>
            <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-wider text-stone-400">Aplicativo</p>
            {([ ["appearance", "Aparência"], ["notifications", "Notificações"], ["privacy", "Privacidade"], ["accessibility", "Acessibilidade"], ["security", "Segurança"], ["data", "Dados e recursos"] ] as const).map(([tab, label]) => <button key={tab} type="button" onClick={() => setSettingsTab(tab)} className={`mb-1 flex w-full rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${settingsTab === tab ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" : "text-stone-500 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white"}`}>{label}</button>)}
          </aside>
          <main className="min-w-0 flex-1 overflow-y-auto p-5 sm:p-10">
            <div className="mx-auto max-w-3xl space-y-4">

          {(settingsTab === "appearance" || settingsTab === "notifications" || settingsTab === "privacy" || settingsTab === "accessibility" || settingsTab === "security" || settingsTab === "data") ? (
            <div className="space-y-5">
              {settingsTab === "appearance" && <>
                <div><FieldLabel>Tema</FieldLabel><div className="grid grid-cols-3 gap-2">{(["light", "dark", "system"] as const).map((value) => <button key={value} type="button" onClick={() => setTheme(value)} className={`rounded-lg border px-3 py-3 text-sm font-semibold capitalize transition ${theme === value ? "border-indigo-500 bg-indigo-500/10 text-indigo-600" : "border-stone-200 hover:bg-stone-100 dark:border-zinc-800 dark:hover:bg-zinc-900"}`}><Monitor className="mx-auto mb-1 h-4 w-4" />{value === "system" ? "Sistema" : value === "light" ? "Claro" : "Escuro"}</button>)}</div></div>
                <div className="rounded-xl border border-stone-200 p-4 dark:border-zinc-800">
                  <div className="flex items-start gap-3">
                    <ImagePlus className="mt-0.5 h-5 w-5 text-indigo-500" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-stone-900 dark:text-white">Tema personalizado</p>
                      <p className="mt-1 text-xs text-stone-500 dark:text-zinc-400">Ajuste a identidade visual do Typecord neste dispositivo.</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2.5 text-xs font-semibold dark:border-zinc-800">
                      Cor de destaque
                      <input type="color" value={appPreferences.accentColor} onChange={(event) => setPreference("accentColor", event.target.value)} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent" />
                    </label>
                    <label className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 px-3 py-2.5 text-xs font-semibold dark:border-zinc-800">
                      Fundo do aplicativo
                      <input type="color" value={appPreferences.appBackground} onChange={(event) => setPreference("appBackground", event.target.value)} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent" />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["#5865f2", "#7c3aed", "#0ea5e9", "#10b981", "#f97316", "#e11d48"].map((color) => <button key={color} type="button" onClick={() => setPreference("accentColor", color)} className="h-7 w-7 rounded-full border-2 border-white shadow-sm ring-1 ring-stone-300 transition hover:scale-110 dark:border-zinc-950 dark:ring-zinc-700" style={{ backgroundColor: color }} aria-label={`Usar cor ${color}`} title={color} />)}
                  </div>
                </div>
                <PreferenceRow icon={<Monitor className="h-4 w-4" />} title="Modo compacto" description="Reduz espaçamentos para mostrar mais mensagens na tela." checked={appPreferences.density === "compact"} onChange={(value) => setPreference("density", value ? "compact" : "cozy")} />
                <PreferenceRow icon={<Keyboard className="h-4 w-4" />} title="Movimento reduzido" description="Diminui transições e animações da interface." checked={appPreferences.reduceMotion} onChange={(value) => setPreference("reduceMotion", value)} />
              </>}
              {settingsTab === "notifications" && <>
                <PreferenceRow icon={<Bell className="h-4 w-4" />} title="Notificações da área de trabalho" description="Receba alertas quando uma conversa exigir sua atenção." checked={appPreferences.desktopNotifications} onChange={(value) => setPreference("desktopNotifications", value)} />
                <PreferenceRow icon={<Bell className="h-4 w-4" />} title="Sons de notificação" description="Reproduz um som para novas mensagens e menções." checked={appPreferences.soundNotifications} onChange={(value) => setPreference("soundNotifications", value)} />
              </>}
              {settingsTab === "privacy" && <>
                <PreferenceRow icon={<Eye className="h-4 w-4" />} title="Mostrar status online" description="Exibe indicadores de status online na interface." checked={appPreferences.showOnlineStatus} onChange={(value) => setPreference("showOnlineStatus", value)} />
                <PreferenceRow icon={<Eye className="h-4 w-4" />} title="Mostrar atividade" description="Exibe sua presença e atividade atual no perfil." checked={appPreferences.showActivity} onChange={(value) => setPreference("showActivity", value)} />
                <div className="rounded-xl border border-stone-200 p-4 dark:border-zinc-800"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-500" /><div><p className="font-semibold text-stone-900 dark:text-white">Privacidade das mensagens</p><p className="mt-1 text-xs text-stone-500 dark:text-zinc-500">Gerencie as opções de privacidade e mantenha suas conversas sob seu controle.</p></div></div></div>
              </>}
              {settingsTab === "security" && <><TwoFactorSettings /><div className="rounded-xl border border-stone-200 p-4 dark:border-zinc-800"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-500" /><div><p className="font-semibold text-stone-900 dark:text-white">Proteção da conta</p><p className="text-xs text-stone-500 dark:text-zinc-500">Mantenha a autenticação em duas etapas ativa para reforçar a segurança da sua conta.</p></div></div></div><div className="rounded-xl border border-stone-200 p-4 dark:border-zinc-800"><div className="flex items-center gap-3"><KeyRound className="h-5 w-5 text-indigo-500" /><div><p className="font-semibold text-stone-900 dark:text-white">Dispositivos com criptografia</p><p className="text-xs text-stone-500 dark:text-zinc-500">Confira as chaves públicas associadas à sua conta e revogue acessos que você não reconhece.</p></div></div><div className="mt-3 space-y-2">{loadingE2eeDevices ? <p className="text-xs text-stone-500">Carregando dispositivos...</p> : e2eeDevices.length === 0 ? <p className="text-xs text-stone-500">Nenhum dispositivo registrado ainda.</p> : e2eeDevices.map((device) => <div key={device.id} className="flex items-center gap-3 rounded-lg bg-stone-50 p-3 dark:bg-zinc-900"><div className={`h-2.5 w-2.5 rounded-full ${device.revokedAt ? "bg-rose-500" : "bg-emerald-500"}`} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-stone-900 dark:text-white">{device.label || "Dispositivo"}{device.revokedAt ? " · Revogado" : ""}</p><p className="truncate font-mono text-[10px] text-stone-500">{device.fingerprint.slice(0, 24)}…</p></div>{!device.revokedAt && <button type="button" disabled={revokingDeviceId === device.deviceId} onClick={() => void revokeE2EEDevice(device.deviceId)} className="rounded-md px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-500/10 disabled:opacity-50">Revogar</button>}</div>)}</div></div></>}
              {settingsTab === "accessibility" && <PreferenceRow icon={<Keyboard className="h-4 w-4" />} title="Atalhos de teclado" description="Ative atalhos para navegar e focar rapidamente no chat." checked={true} onChange={() => undefined} />}
              {settingsTab === "data" && <>
                <div><FieldLabel>Mensagens temporárias</FieldLabel><select value={temporaryMessages} onChange={(event) => setTemporaryMessagePolicy(event.target.value)} className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-black dark:text-white"><option value="off">Desativadas</option><option value="1h">Apagar após 1 hora</option><option value="24h">Apagar após 24 horas</option><option value="7d">Apagar após 7 dias</option></select><p className="mt-1 text-xs text-stone-500">Escolha por quanto tempo novas mensagens devem permanecer disponíveis.</p></div>
                <div className="rounded-xl border border-stone-200 p-4 dark:border-zinc-800"><div className="flex items-center gap-3"><Search className="h-5 w-5 text-indigo-500" /><div className="min-w-0 flex-1"><p className="font-semibold text-stone-900 dark:text-white">Busca local</p><p className="text-xs text-stone-500">Encontre rapidamente conversas disponíveis neste dispositivo.</p></div></div><input value={localSearch} onChange={(event) => setLocalSearch(event.target.value)} placeholder="Buscar mensagens..." className="mt-3 h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-black dark:text-white" />{localSearch && <p className="mt-2 text-xs text-stone-500">Resultados para “{localSearch}”.</p>}</div>
                <div className="rounded-xl border border-stone-200 p-4 dark:border-zinc-800"><div className="flex items-center gap-3"><Folder className="h-5 w-5 text-indigo-500" /><div><p className="font-semibold text-stone-900 dark:text-white">Pastas e favoritos</p><p className="text-xs text-stone-500">Organize suas conversas do jeito que preferir.</p></div></div><div className="mt-3 flex gap-2"><span className="rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-600"><Star className="mr-1 inline h-3 w-3" /> Favoritos</span><span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold dark:bg-zinc-800"><Folder className="mr-1 inline h-3 w-3" /> Pastas</span></div></div>
                <div className="rounded-xl border border-stone-200 p-4 dark:border-zinc-800"><div className="flex items-center gap-3"><Timer className="h-5 w-5 text-indigo-500" /><div className="min-w-0 flex-1"><p className="font-semibold text-stone-900 dark:text-white">Respostas rápidas e templates</p><p className="text-xs text-stone-500">Salve mensagens usadas com frequência.</p></div></div><div className="mt-3 flex gap-2"><input value={templateText} onChange={(event) => setTemplateText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addTemplate(); }} placeholder="Ex.: Olá! Já vou verificar isso." className="h-10 min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-black dark:text-white" /><button type="button" onClick={addTemplate} className="rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white">Adicionar</button></div>{templates.length > 0 && <div className="mt-3 space-y-1">{templates.map((template, index) => <div key={`${template}-${index}`} className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2 text-xs dark:bg-zinc-900"><span className="min-w-0 flex-1 truncate">{template}</span><button type="button" onClick={() => removeTemplate(index)} className="text-rose-500">Remover</button></div>)}</div>}</div>
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4"><div className="flex items-center gap-3"><KeyRound className="h-5 w-5 text-indigo-500" /><div><p className="font-semibold text-stone-900 dark:text-white">Chaves e backups</p><p className="text-xs text-stone-500">Exporte ou restaure seus dados usando uma senha que apenas você conhece.</p></div></div><input type="password" value={backupPassphrase} onChange={(event) => setBackupPassphrase(event.target.value)} placeholder="Senha do backup (mínimo de 12 caracteres)" className="mt-3 h-10 w-full rounded-lg border border-indigo-500/30 bg-white px-3 text-sm outline-none focus:border-indigo-500 dark:bg-zinc-950 dark:text-white" /><input ref={backupInputRef} type="file" accept="application/json,.json" onChange={(event) => void importBackup(event)} className="hidden" /><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void exportE2EEBackup()} className="flex items-center gap-2 rounded-lg border border-indigo-500/40 px-3 py-2 text-xs font-semibold text-indigo-600"><Download className="h-3.5 w-3.5" /> Exportar chaves</button><button type="button" onClick={() => void exportSettingsBackup()} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"><Download className="h-3.5 w-3.5" /> Exportar configurações</button><button type="button" onClick={() => backupInputRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700 dark:border-zinc-700 dark:text-zinc-200"><Download className="h-3.5 w-3.5 rotate-180" /> Importar backup</button></div>{backupFeedback && <p className="mt-2 text-xs text-emerald-600">{backupFeedback}</p>}</div>
                <div className="rounded-xl border border-stone-200 p-4 dark:border-zinc-800"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-stone-900 dark:text-white">Sessões ativas</p><p className="mt-1 text-xs text-stone-500">Revise e encerre acessos conectados à sua conta.</p></div><button type="button" onClick={() => { window.location.href = "/api/auth/signout"; }} className="rounded-lg border border-rose-500/30 px-3 py-2 text-xs font-semibold text-rose-600">Sair</button></div><div className="mt-3 space-y-2">{loadingSessions ? <p className="text-xs text-stone-500">Carregando sessões...</p> : activeSessions.length === 0 ? <p className="text-xs text-stone-500">Nenhuma sessão persistente encontrada.</p> : activeSessions.map((session) => <div key={session.id} className="flex items-center gap-3 rounded-lg bg-stone-50 p-3 dark:bg-zinc-900"><Monitor className="h-4 w-4 shrink-0 text-indigo-500" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-stone-900 dark:text-white">{session.current ? "Este dispositivo" : "Sessão ativa"}</p><p className="text-[10px] text-stone-500">Expira em {new Date(session.expires).toLocaleDateString("pt-BR")}</p></div>{!session.current && <button type="button" disabled={revokingSessionId === session.id} onClick={() => void revokeSession(session.id)} className="rounded-md px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-500/10 disabled:opacity-50">Encerrar</button>}</div>)}</div></div>
                {isTauriRuntime() && <div className="rounded-xl border border-stone-200 p-4 dark:border-zinc-800"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-500" /><div className="min-w-0 flex-1"><p className="font-semibold text-stone-900 dark:text-white">Bloqueio do aplicativo</p><p className="mt-1 text-xs text-stone-500 dark:text-zinc-500">Proteja o acesso ao Typecord com um PIN armazenado no cofre nativo.</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${appPinConfigured ? "bg-emerald-500/10 text-emerald-600" : "bg-stone-100 text-stone-500 dark:bg-zinc-900"}`}>{appPinConfigured ? "Ativo" : "Inativo"}</span></div><div className="mt-3 flex flex-wrap gap-2">{!appPinConfigured && <><input inputMode="numeric" type="password" value={appPin} onChange={(event) => setAppPin(event.target.value.replace(/\D/g, "").slice(0, 12))} placeholder="PIN de 4 a 12 dígitos" className="h-9 min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-black" /><button type="button" onClick={() => void saveAppPin()} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Ativar</button></>}{appPinConfigured && <><button type="button" onClick={lockAppNow} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Bloquear agora</button><button type="button" onClick={() => void removeAppPin()} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold text-rose-600">Desativar</button></>}</div>{appPinFeedback && <p className="mt-2 text-xs text-indigo-500">{appPinFeedback}</p>}</div>}
                <div className="rounded-xl border border-stone-200 p-4 dark:border-zinc-800"><div className="flex items-center gap-3"><FileClock className="h-5 w-5 text-indigo-500" /><div><p className="font-semibold text-stone-900 dark:text-white">Atividade de segurança</p><p className="text-xs text-stone-500">Eventos recentes relacionados à proteção da sua conta.</p></div></div><div className="mt-3 space-y-2">{securityLogs.length === 0 ? <p className="text-xs text-stone-500">Nenhuma atividade recente.</p> : securityLogs.slice(0, 12).map((log) => <div key={log.id} className="flex items-center gap-3 rounded-lg bg-stone-50 px-3 py-2 dark:bg-zinc-900"><span className={`h-2 w-2 rounded-full ${log.level === "security" ? "bg-emerald-500" : "bg-indigo-500"}`} /><span className="min-w-0 flex-1 truncate text-xs font-medium text-stone-700 dark:text-zinc-300">{log.label}</span><time className="shrink-0 text-[10px] text-stone-400">{new Date(log.createdAt).toLocaleString("pt-BR")}</time></div>)}</div></div>
              </>}
            </div>
          ) : settingsTab === "profile" ? (
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
                <FieldLabel>Username</FieldLabel>
                <input
                  type="text"
                  value={editUsername}
                  maxLength={32}
                  autoCapitalize="none"
                  onChange={(event) => setEditUsername(event.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
                  placeholder="seu_username"
                  className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none transition focus:border-indigo-500 dark:border-zinc-700 dark:bg-black dark:text-white"
                />
                <p className="mt-1 text-[11px] text-stone-500 dark:text-zinc-500">Use de 2 a 32 caracteres: letras minúsculas, números, ponto ou underline.</p>
              </div>

              <div>
                <FieldLabel>Nome de exibição</FieldLabel>
                <input
                  type="text"
                  value={editGlobalName}
                  maxLength={32}
                  onChange={(event) => setEditGlobalName(event.target.value)}
                  placeholder="Como as pessoas verão seu nome"
                  className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none transition focus:border-indigo-500 dark:border-zinc-700 dark:bg-black dark:text-white"
                />
                <div className="mt-1 text-right text-[10px] text-stone-400">
                  {editGlobalName.length}/32
                </div>
              </div>

              <div>
                <FieldLabel>Sobre mim</FieldLabel>
                <textarea
                  value={editBio}
                  maxLength={190}
                  rows={4}
                  onChange={(event) => setEditBio(event.target.value)}
                  placeholder="Conte um pouco sobre você..."
                  className="w-full resize-none rounded-lg border border-stone-300 bg-white p-3 text-sm text-stone-900 outline-none transition focus:border-indigo-500 dark:border-zinc-700 dark:bg-black dark:text-white"
                />
                <div className="mt-1 text-right text-[10px] text-stone-400">
                  {editBio.length}/190
                </div>
              </div>

              <TwoFactorSettings />
            </div>
          ) : (
            <>
              <PresenceOverview user={profileUser} />
            <div className={settingsTab === "presence" ? "hidden" : "space-y-5"}>
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
                    className="h-10 w-full rounded-lg border border-stone-300 bg-white px-3 pr-9 text-sm text-stone-900 outline-none transition focus:border-indigo-500 dark:border-zinc-700 dark:bg-black dark:text-white"
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
            </>
          )}

          {feedback && (
            <div className="rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
              {feedback}
            </div>
          )}

          {usernameStep !== "idle" && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <p className="font-bold">Alteração de username — etapa {usernameStep === "review" ? "1 de 2" : "2 de 2"}</p>
              <p className="mt-1">{usernameStep === "review" ? "Confira o novo username e clique em Salvar para continuar." : "Confirme novamente clicando em Salvar para aplicar a alteração."}</p>
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
                className="rounded-lg px-3 py-2 text-xs font-semibold text-stone-600 transition hover:bg-stone-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
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
                className="flex min-w-28 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {saving ? "Salvando..." : usernameStep === "idle" ? "Salvar" : usernameStep === "review" ? "Continuar" : "Confirmar username"}
              </button>
            </div>
          </div>
            </div>
          </main>
        </div>
      </div>}
    </>
  );
}

function PreferenceRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-stone-200 p-3 dark:border-zinc-800">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-stone-900 dark:text-white">{title}</p>
        <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-500">{description}</p>
      </div>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-indigo-600" : "bg-stone-300 dark:bg-zinc-700"}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}

function PresenceOverview({ user }: { user: ProfileUser }) {
  const [applications, setApplications] = useState<TauriOpenApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const refresh = async () => {
    if (!isTauriRuntime()) return;
    setLoading(true);
    try { setApplications(await getTauriOpenApplications()); } finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, []);
  const presence = user.richPresence;
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#111214]">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500"><AppWindow className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1"><p className="text-base font-bold text-stone-900 dark:text-white">Atividade atual</p><p className="mt-1 text-xs text-stone-500">{presence?.name ? `${presence.name}${presence.details ? ` · ${presence.details}` : ""}` : "Nenhuma atividade compartilhada"}</p></div>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-600">PRIVADA</span>
        </div>
        <p className="mt-4 text-xs leading-5 text-stone-500">Sua presença exibe apenas o estado geral da plataforma. O canal e a conversa atual nunca são compartilhados.</p>
      </div>
      <div className="rounded-xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#111214]">
        <div className="flex items-center gap-3"><AppWindow className="h-5 w-5 text-indigo-500" /><div className="min-w-0 flex-1"><p className="text-base font-bold text-stone-900 dark:text-white">Aplicativos detectados</p><p className="mt-1 text-xs text-stone-500">Atividade disponível neste dispositivo para enriquecer sua presença.</p></div><button type="button" onClick={() => void refresh()} disabled={!isTauriRuntime() || loading} className="rounded-lg border border-stone-200 px-3 py-2 text-xs font-semibold hover:bg-stone-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900">{loading ? "Atualizando..." : "Atualizar"}</button></div>
        {!isTauriRuntime() ? <p className="mt-4 rounded-lg bg-stone-50 p-3 text-xs text-stone-500 dark:bg-zinc-900">Abra o Typecord pelo aplicativo desktop para visualizar a atividade local.</p> : <div className="mt-4 grid gap-2 sm:grid-cols-2">{applications.filter((application) => !/^typecord|app\.exe$/i.test(application.name)).slice(0, 20).map((application) => <div key={`${application.name}-${application.pid}`} className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2 text-xs font-medium text-stone-700 dark:bg-zinc-900 dark:text-zinc-300"><span className="h-2 w-2 rounded-full bg-emerald-500" />{application.name}</div>)}{applications.length === 0 && <p className="text-xs text-stone-500">Nenhum aplicativo detectado.</p>}</div>}
      </div>
    </div>
  );
}
