"use client";

import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getTauriAppInfo, hasTauriAppPin, isTauriRuntime, verifyTauriAppBiometric, verifyTauriAppPin } from "@/lib/tauri";

const LOCK_AFTER_INACTIVITY_MS = 15 * 60 * 1000;

export default function TauriAppLock({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const failedAttempts = useRef(0);
  const inactivityTimer = useRef<number | null>(null);
  const [temporarilyBlocked, setTemporarilyBlocked] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);

  useEffect(() => {
    if (!isTauriRuntime()) { setChecking(false); return; }
    void Promise.all([hasTauriAppPin(), getTauriAppInfo()])
      .then(([hasPin, info]) => { setLocked(hasPin); setBiometricSupported(info?.platform === "windows"); })
      .catch(() => { setLocked(false); setBiometricSupported(false); })
      .finally(() => setChecking(false));
    const lock = () => { void hasTauriAppPin().then(setLocked).catch(() => undefined); };
    window.addEventListener("typecord:lock-app", lock);
    return () => window.removeEventListener("typecord:lock-app", lock);
  }, []);

  useEffect(() => {
    if (checking || !isTauriRuntime() || locked) {
      if (inactivityTimer.current !== null) {
        window.clearTimeout(inactivityTimer.current);
        inactivityTimer.current = null;
      }
      return;
    }

    const scheduleLock = () => {
      if (inactivityTimer.current !== null) window.clearTimeout(inactivityTimer.current);
      inactivityTimer.current = window.setTimeout(async () => {
        try {
          if (await hasTauriAppPin()) setLocked(true);
        } catch {
          // Keep the session available if the native vault cannot be queried.
        }
      }, LOCK_AFTER_INACTIVITY_MS);
    };

    const handleActivity = () => scheduleLock();
    window.addEventListener("pointerdown", handleActivity, { passive: true });
    window.addEventListener("keydown", handleActivity, { passive: true });
    window.addEventListener("touchstart", handleActivity, { passive: true });
    scheduleLock();

    return () => {
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      if (inactivityTimer.current !== null) {
        window.clearTimeout(inactivityTimer.current);
        inactivityTimer.current = null;
      }
    };
  }, [checking, locked]);

  async function unlock() {
    if (busy || !pin || temporarilyBlocked) return;
    setBusy(true); setError("");
    try {
      if (await verifyTauriAppPin(pin)) { failedAttempts.current = 0; setLocked(false); setPin(""); }
      else {
        failedAttempts.current += 1;
        if (failedAttempts.current >= 5) {
          setTemporarilyBlocked(true);
          window.setTimeout(() => setTemporarilyBlocked(false), 30_000);
          setError("Muitas tentativas. Aguarde 30 segundos.");
        } else setError("PIN incorreto.");
      }
    } catch { setError("Não foi possível validar o PIN."); }
    finally { setBusy(false); }
  }

  async function unlockWithBiometric() {
    if (busy || temporarilyBlocked) return;
    setBusy(true); setError("");
    try {
      if (await verifyTauriAppBiometric()) { failedAttempts.current = 0; setLocked(false); }
      else setError("Não foi possível confirmar a identidade.");
    } catch { setError("A autenticação biométrica não está disponível."); }
    finally { setBusy(false); }
  }

  if (checking) return <div className="flex min-h-screen items-center justify-center bg-[#111214] text-sm text-zinc-400">Carregando proteção local…</div>;
  if (!locked) return <>{children}</>;
  return <main className="flex min-h-screen items-center justify-center bg-[#111214] px-4 text-white"><section className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#1e1f22] p-7 text-center shadow-2xl"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-300"><LockKeyhole className="h-7 w-7" /></div><h1 className="mt-5 text-xl font-black">Typecord bloqueado</h1><p className="mt-2 text-sm leading-6 text-zinc-400">Confirme sua identidade para acessar este dispositivo.</p><form onSubmit={(event) => { event.preventDefault(); void unlock(); }}><input autoFocus inputMode="numeric" type="password" value={pin} disabled={temporarilyBlocked} onChange={(event) => { setPin(event.target.value.replace(/\D/g, "").slice(0, 12)); setError(""); }} placeholder="PIN" className="mt-6 h-11 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-center text-lg tracking-[0.4em] outline-none focus:border-indigo-400 disabled:opacity-50" /><button type="submit" disabled={busy || pin.length < 4 || temporarilyBlocked} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 text-sm font-bold disabled:opacity-50">{busy ? "Verificando…" : temporarilyBlocked ? "Bloqueado temporariamente" : "Desbloquear com PIN"}</button></form>{biometricSupported && <button type="button" onClick={() => void unlockWithBiometric()} disabled={busy || temporarilyBlocked} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] text-sm font-bold text-zinc-200 transition hover:bg-white/[0.08] disabled:opacity-50">{busy ? "Autenticando…" : "Usar biometria"}</button>}{error && <p className="mt-3 text-xs font-semibold text-rose-400">{error}</p>}<div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-zinc-500"><ShieldCheck className="h-3.5 w-3.5" /> Protegido pelo cofre nativo</div></section></main>;
}
