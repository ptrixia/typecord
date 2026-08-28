"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActivity } from "@/components/app/ActivityProvider";

export default function DirectMessagesIcon() {
  const { getDirectUnread } = useActivity();
  const unreadCount = getDirectUnread();

  return (
    <Tooltip>
      <TooltipTrigger>
        <Link
          href="/channels/@me"
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-300 text-zinc-800 transition-all hover:rounded-2xl hover:bg-indigo-600 hover:text-white dark:bg-neutral-900 dark:text-zinc-200 dark:hover:bg-indigo-600 dark:hover:text-white"
        >
          <MessageSquare className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black leading-5 text-white ring-2 ring-white dark:ring-black">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>
      </TooltipTrigger>

      <TooltipContent
        side="right"
        sideOffset={12}
        className="border-zinc-200 bg-white text-black dark:border-zinc-800 dark:bg-black dark:text-white"
      >
        <p className="font-medium">Mensagens Diretas</p>
      </TooltipContent>
    </Tooltip>
  );
}
