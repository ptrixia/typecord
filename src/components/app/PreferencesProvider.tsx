"use client";

import { MonitorCog, Moon, Settings2, Sun } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTheme } from "next-themes";

type Density = "cozy" | "compact";

type Preferences = {
  density: Density;
  reduceMotion: boolean;
  compactMembers: boolean;
};

type PreferencesContextValue = {
  preferences: Preferences;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
};

const DEFAULT_PREFERENCES: Preferences = {
  density: "cozy",
  reduceMotion: false,
  compactMembers: false,
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
  const containerRef = useRef<HTMLDivElement>(null);

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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
