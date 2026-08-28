"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActivity } from "@/components/app/ActivityProvider";

interface Guild {
  id: string | number;
  name: string;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  memberCount?: number;
}

interface GuildIconProps {
  guild: Guild;
}

function resolveFileUrl(urlOrKey?: string | null) {
  if (!urlOrKey) return "";
  if (
    urlOrKey.startsWith("http://") ||
    urlOrKey.startsWith("https://") ||
    urlOrKey.startsWith("blob:") ||
    urlOrKey.startsWith("/")
  ) {
    return urlOrKey;
  }
  return `/api/files?key=${encodeURIComponent(urlOrKey)}`;
}

export default function GuildIcon({ guild }: GuildIconProps) {
  const params = useParams();
  const { getGuildUnread } = useActivity();
  const firstLetter = guild.name?.charAt(0).toUpperCase() || "?";

  const isActive =
    params?.id === guild.id.toString() ||
    params?.guildId === guild.id.toString();

  const resolvedIconUrl = resolveFileUrl(guild.iconUrl);
  const unreadCount = getGuildUnread(String(guild.id));

  return (
    <div className="relative group flex items-center justify-center w-full py-1">
      <div className="absolute left-0 flex h-full w-2 items-center justify-start pointer-events-none">
        <div
          className={`w-1 rounded-r-full bg-zinc-900 dark:bg-white transition-all duration-200 ${
            isActive
              ? "h-[40px] opacity-100" 
              : "h-[8px] opacity-0 group-hover:h-[20px] group-hover:opacity-100"
          }`}
        />
      </div>

      <Tooltip>
        <TooltipTrigger>
          <Link
            href={`/channels/${guild.id}`}
            className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden transition-all duration-200 ${
              isActive
                ? "rounded-2xl bg-indigo-500 text-white dark:bg-indigo-500"
                : "rounded-full bg-zinc-300 text-zinc-800 hover:rounded-2xl hover:bg-indigo-500 hover:text-white dark:bg-neutral-900 dark:text-zinc-200"
            }`}
          >
            {resolvedIconUrl ? (
              <img
                src={resolvedIconUrl}
                alt={guild.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="select-none text-lg font-bold">
                {firstLetter}
              </span>
            )}
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 z-10 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black leading-5 text-white ring-2 ring-white dark:ring-black">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        </TooltipTrigger>

        <TooltipContent
          side="right"
          sideOffset={20}
          className="w-72 p-0 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-[#111214] text-zinc-950 dark:text-zinc-50 z-[100]"
        >

          <div className="relative p-4 pt-3">
            <div>
              <h3 className="font-bold text-base leading-tight truncate">
                {guild.name}
              </h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                Um servidor no seu Typecord para juntar a galera e conversar.
              </p>
            </div>

            <div className="mt-4 flex items-center gap-4 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                {guild.memberCount ? Math.max(1, Math.floor(guild.memberCount / 3)) : 1} Online
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-400 dark:bg-zinc-600"></span>
                {guild.memberCount || 1} Membros
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
