"use client";

import {
  CheckCircle2,
  History,
  Info,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ToastType = "success" | "error" | "info";

export type TypecordToast = {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  createdAt: number;
};

type ToastInput = Omit<TypecordToast, "id" | "createdAt">;

type ToastContextValue = {
  toasts: TypecordToast[];
  history: TypecordToast[];
  pushToast: (toast: ToastInput) => void;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function iconFor(type: ToastType) {
  if (type === "success") return <CheckCircle2 className="h-4 w-4" />;
  if (type === "error") return <TriangleAlert className="h-4 w-4" />;
  return <Info className="h-4 w-4" />;
}

function toneFor(type: ToastType) {
  if (type === "success") return "border-emerald-500/20 text-emerald-600 dark:text-emerald-300";
  if (type === "error") return "border-red-500/20 text-red-600 dark:text-red-300";
  return "border-indigo-500/20 text-indigo-600 dark:text-indigo-300";
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<TypecordToast[]>([]);
  const [history, setHistory] = useState<TypecordToast[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((input: ToastInput) => {
    const toast: TypecordToast = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };

    setToasts((current) => [toast, ...current].slice(0, 4));
    setHistory((current) => [toast, ...current].slice(0, 12));
    window.setTimeout(() => dismissToast(toast.id), input.type === "error" ? 6200 : 4200);
  }, [dismissToast]);

  const value = useMemo(
    () => ({ toasts, history, pushToast, dismissToast }),
    [dismissToast, history, pushToast, toasts],
  );

  useEffect(() => {
    if (!historyOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        historyRef.current &&
        event.target instanceof Node &&
        !historyRef.current.contains(event.target)
      ) {
        setHistoryOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [historyOpen]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed right-4 top-16 z-[100000] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-xl border bg-white/95 p-3 text-sm shadow-2xl backdrop-blur-xl dark:bg-[#111214]/95 ${toneFor(toast.type)}`}
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0">{iconFor(toast.type)}</span>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-zinc-950 dark:text-white">{toast.title}</div>
                {toast.description && (
                  <div className="mt-0.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                    {toast.description}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-white"
                aria-label="Fechar aviso"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div ref={historyRef} className="fixed bottom-4 right-4 z-[99990]">
        <button
          type="button"
          onClick={() => setHistoryOpen((current) => !current)}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 shadow-xl transition hover:bg-zinc-50 hover:text-zinc-900 dark:border-white/10 dark:bg-[#111214] dark:hover:bg-white/10 dark:hover:text-white"
          title="Histórico de avisos"
          aria-label="Histórico de avisos"
        >
          <History className="h-4 w-4" />
        </button>

        {historyOpen && (
          <div className="absolute bottom-12 right-0 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111214]">
            <div className="border-b border-zinc-200 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-zinc-500 dark:border-white/10">
              Avisos recentes
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {history.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-zinc-500">
                  Nenhum aviso ainda.
                </div>
              ) : (
                history.map((toast) => (
                  <div key={toast.id} className="rounded-lg px-3 py-2 hover:bg-zinc-100 dark:hover:bg-white/[0.06]">
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-900 dark:text-white">
                      <span className={toneFor(toast.type)}>{iconFor(toast.type)}</span>
                      <span className="truncate">{toast.title}</span>
                    </div>
                    {toast.description && (
                      <div className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {toast.description}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error("useToast precisa estar dentro de ToastProvider.");
  }
  return value;
}
