"use client";

import { Bell, MonitorCog, Moon, Settings2, Sun, AppWindow } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTheme } from "next-themes";
import { getTauriOpenApplications, isTauriRuntime, type TauriOpenApplication } from "@/lib/tauri";

type Density = "cozy" | "compact";

type Preferences = {
  density: Density;
  reduceMotion: boolean;
  compactMembers: boolean;
  focusMode: boolean;
  desktopNotifications: boolean;
  soundNotifications: boolean;
  showOnlineStatus: boolean;
  showActivity: boolean;
  showRichPresence: boolean;
  shareDetectedApps: boolean;
  accentColor: string;
  appBackground: string;
};

type PreferencesContextValue = {
  preferences: Preferences;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
};

const DEFAULT_PREFERENCES: Preferences = {
  density: "cozy",
  reduceMotion: false,
  compactMembers: false,
  focusMode: false,
  desktopNotifications: true,
  soundNotifications: true,
  showOnlineStatus: true,
  showActivity: true,
  showRichPresence: true,
  shareDetectedApps: false,
  accentColor: "#5865f2",
  appBackground: "#111214",
};

const STORAGE_KEY = "typecord:preferences";
const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Preferences>;
      setPreferences({
        density: parsed.density === "compact" ? "compact" : "cozy",
        reduceMotion: Boolean(parsed.reduceMotion),
        compactMembers: Boolean(parsed.compactMembers),
        focusMode: Boolean(parsed.focusMode),
        desktopNotifications: parsed.desktopNotifications !== false,
        soundNotifications: parsed.soundNotifications !== false,
        showOnlineStatus: parsed.showOnlineStatus !== false,
        showActivity: parsed.showActivity !== false,
        showRichPresence: parsed.showRichPresence !== false,
        shareDetectedApps: Boolean(parsed.shareDetectedApps),
        accentColor: typeof parsed.accentColor === "string" && /^#[0-9a-f]{6}$/i.test(parsed.accentColor) ? parsed.accentColor : DEFAULT_PREFERENCES.accentColor,
        appBackground: typeof parsed.appBackground === "string" && /^#[0-9a-f]{6}$/i.test(parsed.appBackground) ? parsed.appBackground : DEFAULT_PREFERENCES.appBackground,
      });
    } catch {
      setPreferences(DEFAULT_PREFERENCES);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    document.documentElement.dataset.typecordDensity = preferences.density;
    document.documentElement.dataset.typecordReduceMotion = String(preferences.reduceMotion);
    document.documentElement.dataset.typecordCompactMembers = String(preferences.compactMembers);
    document.documentElement.dataset.typecordFocusMode = String(preferences.focusMode);
    document.documentElement.style.setProperty("--typecord-accent", preferences.accentColor);
    document.documentElement.style.setProperty("--typecord-app-background", preferences.appBackground);
  }, [preferences]);

  const value = useMemo(
    () => ({
      preferences,
      setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
        setPreferences((current) => ({ ...current, [key]: value }));
      },
    }),
    [preferences],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) {
    throw new Error("usePreferences precisa estar dentro de PreferencesProvider.");
  }
  return value;
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-zinc-100 dark:hover:bg-white/[0.06]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-zinc-900 dark:text-white">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">{description}</span>
      </span>
      <span className={`relative h-5 w-9 rounded-full transition ${checked ? "bg-indigo-500" : "bg-zinc-300 dark:bg-zinc-700"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-4" : "left-0.5"}`} />
      </span>
    </button>
  );
}

export function PreferencesButton() {
  const { preferences, setPreference } = usePreferences();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const [openApplications, setOpenApplications] = useState<TauriOpenApplication[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNotificationPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    if (open) void getTauriOpenApplications().then(setOpenApplications).catch(() => setOpenApplications([]));
  }, [open]);

  async function requestNotifications() {
    if (typeof Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
  }

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
        title="Preferências"
        aria-label="Preferências"
      >
        <Settings2 className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-[1000] w-[320px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111214]">
          <div className="flex items-center gap-2 border-b border-zinc-200 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-500 dark:border-white/10">
            <MonitorCog className="h-4 w-4" />
            Preferências
          </div>

          <div className="p-2">
            <div className="px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">
              Tema
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-black/30">
              {[
                { id: "light", label: "Claro", icon: Sun },
                { id: "dark", label: "Escuro", icon: Moon },
                { id: "system", label: "Sistema", icon: MonitorCog },
              ].map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTheme(option.id)}
                    className={`flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition ${
                      theme === option.id
                        ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-bold dark:border-white/10">
                Cor de destaque
                <input type="color" value={preferences.accentColor} onChange={(event) => setPreference("accentColor", event.target.value)} className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent" />
              </label>
              <label className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 px-3 py-2 text-xs font-bold dark:border-white/10">
                Fundo do app
                <input type="color" value={preferences.appBackground} onChange={(event) => setPreference("appBackground", event.target.value)} className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent" />
              </label>
            </div>

            <div className="mt-3 px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">
              Densidade
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-black/30">
              {(["cozy", "compact"] as const).map((density) => (
                <button
                  key={density}
                  type="button"
                  onClick={() => setPreference("density", density)}
                  className={`h-9 rounded-lg text-xs font-bold transition ${
                    preferences.density === density
                      ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  {density === "cozy" ? "Confortável" : "Compacta"}
                </button>
              ))}
            </div>

            <div className="mt-2 space-y-1">
              <ToggleRow
                title="Reduzir animações"
                description="Diminui transições e movimentos da interface."
                checked={preferences.reduceMotion}
                onChange={(value) => setPreference("reduceMotion", value)}
              />
              <ToggleRow
                title="Membros compactos"
                description="Encurta a lista lateral de membros."
                checked={preferences.compactMembers}
                onChange={(value) => setPreference("compactMembers", value)}
              />
              <ToggleRow
                title="Modo foco"
                description="Esconde as barras laterais para você se concentrar na conversa."
                checked={preferences.focusMode}
                onChange={(value) => setPreference("focusMode", value)}
              />
              <ToggleRow
                title="Sons de notificação"
                description="Emite um som quando você é mencionado ou recebe uma resposta."
                checked={preferences.soundNotifications}
                onChange={(value) => setPreference("soundNotifications", value)}
              />
              <ToggleRow
                title="Mostrar presença"
                description="Exibe sua atividade geral sem revelar o canal ou conversa atual."
                checked={preferences.showRichPresence}
                onChange={(value) => setPreference("showRichPresence", value)}
              />
              <ToggleRow
                title="Compartilhar aplicativo detectado"
                description="Mostra apenas aplicativos conhecidos e permitidos, sem títulos de janela ou chats."
                checked={preferences.shareDetectedApps}
                onChange={(value) => setPreference("shareDetectedApps", value)}
              />
              <button type="button" onClick={() => void requestNotifications()} disabled={notificationPermission === "granted" || notificationPermission === "unsupported"} className="mt-2 flex w-full items-center gap-3 rounded-xl border border-zinc-200 px-3 py-2.5 text-left transition hover:bg-zinc-50 disabled:cursor-default disabled:opacity-60 dark:border-white/10 dark:hover:bg-white/[0.04]">
                <Bell className="h-4 w-4 shrink-0 text-indigo-500" />
                <span className="min-w-0"><span className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">{notificationPermission === "granted" ? "Notificações do sistema ativas" : "Ativar notificações do sistema"}</span><span className="mt-0.5 block text-[11px] text-zinc-500">Alertas quando houver menções ou respostas.</span></span>
              </button>
              {isTauriRuntime() && <div className="mt-3 rounded-xl border border-zinc-200 p-3 dark:border-white/10"><div className="flex items-center gap-2"><AppWindow className="h-4 w-4 text-indigo-500" /><span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Aplicativos detectados</span><span className="ml-auto text-[10px] font-bold text-zinc-400">{openApplications.length}</span></div><div className="mt-2 max-h-24 space-y-1 overflow-y-auto">{openApplications.slice(0, 8).map((application) => <div key={`${application.name}-${application.pid}`} className="truncate text-[11px] text-zinc-500">{application.name}</div>)}{openApplications.length === 0 && <div className="text-[11px] text-zinc-500">Nenhum aplicativo listado.</div>}</div></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
