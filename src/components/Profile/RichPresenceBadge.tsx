"use client";
import { useEffect, useState } from "react";
import { getFileUrl } from "@/lib/validations";

type Presence = { type?: string | null; name?: string | null; details?: string | null; state?: string | null; expiresAt?: string | Date | null; largeImageUrl?: string | null; smallImageUrl?: string | null; largeImageText?: string | null; smallImageText?: string | null } | null;

export default function RichPresenceBadge({ presence, compact = false }: { presence?: Presence; compact?: boolean }) {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!presence?.expiresAt) { setExpired(false); return; }
    const remaining = new Date(presence.expiresAt).getTime() - Date.now();
    if (remaining <= 0) { setExpired(true); return; }
    const timer = window.setTimeout(() => setExpired(true), remaining);
    return () => window.clearTimeout(timer);
  }, [presence?.expiresAt]);
  if (!presence?.name) return null;
  if (expired) return null;
  const activity = presence.type === "LISTENING" ? "Ouvindo" : presence.type === "WATCHING" ? "Assistindo" : presence.type === "STREAMING" ? "Transmitindo" : presence.type === "COMPETING" ? "Competindo" : presence.type === "PLAYING" ? "Jogando" : "Atividade";
  const largeImage = getFileUrl(presence.largeImageUrl);
  const smallImage = getFileUrl(presence.smallImageUrl);
  return <div className={`min-w-0 ${compact ? "text-[10px]" : "text-xs"}`} title={[activity, presence.name, presence.details].filter(Boolean).join(" · ")}><div className="flex min-w-0 items-center gap-2">{!compact && <div className="relative shrink-0">{largeImage ? <img src={largeImage} alt={presence.largeImageText || ""} className="h-10 w-10 rounded-lg object-cover" /> : <div className="h-10 w-10 rounded-lg bg-indigo-500/15" />}{smallImage && <img src={smallImage} alt={presence.smallImageText || ""} className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white object-cover dark:border-zinc-950" />}</div>}<div className="min-w-0"><div className="truncate font-semibold text-indigo-500">{activity} {presence.name}</div>{!compact && (presence.details || presence.state) && <div className="truncate text-zinc-500 dark:text-zinc-400">{presence.details || presence.state}</div>}</div></div></div>;
}
