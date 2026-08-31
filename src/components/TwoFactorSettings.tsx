"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

export default function TwoFactorSettings() {
  const [enabled, setEnabled] = useState(false);
  const [secret, setSecret] = useState("");
  const [otpauth, setOtpauth] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { void fetch("/api/account/two-factor").then((response) => response.json()).then((data) => setEnabled(Boolean(data.enabled))).catch(() => undefined); }, []);

  async function begin() {
    setBusy(true); setMessage("");
    try { const response = await fetch("/api/account/two-factor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "begin" }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || data.message); setSecret(data.secret); setOtpauth(data.otpauth); } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível iniciar."); } finally { setBusy(false); }
  }

  async function submit(action: "enable" | "disable") {
    setBusy(true); setMessage("");
    try { const response = await fetch("/api/account/two-factor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, code, secret }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || data.message); setEnabled(Boolean(data.enabled)); setSecret(""); setOtpauth(""); setCode(""); setMessage(action === "enable" ? "Verificação em duas etapas ativada." : "Verificação em duas etapas desativada."); } catch (error) { setMessage(error instanceof Error ? error.message : "Código inválido."); } finally { setBusy(false); }
  }

  return <section className="rounded-xl border border-stone-200 p-4 dark:border-zinc-800"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-indigo-500" /><div className="min-w-0 flex-1"><h3 className="text-sm font-bold text-stone-900 dark:text-white">Verificação em duas etapas</h3><p className="mt-1 text-xs leading-5 text-stone-500 dark:text-zinc-400">Proteja sua conta usando um aplicativo autenticador compatível com TOTP.</p>{enabled ? <div className="mt-3 flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-600">Ativada</span><input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Código atual" className="h-9 w-32 rounded-lg border px-2 text-center text-sm dark:border-zinc-700 dark:bg-black" /><button type="button" disabled={busy || code.length !== 6} onClick={() => void submit("disable")} className="rounded-lg border border-rose-300 px-3 py-2 text-xs font-bold text-rose-600 disabled:opacity-50">Desativar</button></div> : !secret ? <button type="button" disabled={busy} onClick={() => void begin()} className="mt-3 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Configurar 2FA</button> : <div className="mt-3 space-y-2"><p className="text-xs text-stone-600 dark:text-zinc-300">Adicione esta chave no autenticador:</p><code className="block break-all rounded-lg bg-stone-100 p-2 text-[11px] dark:bg-black">{secret}</code><p className="text-[11px] text-stone-500">URI: {otpauth}</p><div className="flex gap-2"><input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Código de 6 dígitos" className="h-9 flex-1 rounded-lg border px-2 text-center text-sm dark:border-zinc-700 dark:bg-black" /><button type="button" disabled={busy || code.length !== 6} onClick={() => void submit("enable")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Confirmar</button></div></div>}{message && <p className="mt-2 text-xs text-indigo-500">{message}</p>}</div></div></section>;
}
