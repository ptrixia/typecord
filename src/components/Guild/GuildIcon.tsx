"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Guild {
  id: string | number;
  name: string;
  icon?: string | null;
}

interface GuildIconProps {
  guild: Guild;
}

export default function GuildIcon({ guild }: GuildIconProps) {
  const firstLetter = guild.name?.charAt(0).toUpperCase() || "?";

  return (
    <Tooltip>
      <TooltipTrigger>
        <Link
          href={`/channels/${guild.id}`}
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-300 text-zinc-800 transition-all hover:rounded-2xl dark:bg-neutral-900 dark:text-zinc-200"
        >
          {guild.icon ? (
            <Image
              src={guild.icon}
              alt={guild.name}
              width={48}
              height={48}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="select-none text-lg font-bold">
              {firstLetter}
            </span>
          )}
        </Link>
      </TooltipTrigger>

      <TooltipContent
        side="right"
        sideOffset={12}
        className="border-zinc-200 bg-white text-black dark:border-zinc-800 dark:bg-black dark:text-white"
      >
        <p className="font-medium">{guild.name}</p>
      </TooltipContent>
    </Tooltip>
  );
}