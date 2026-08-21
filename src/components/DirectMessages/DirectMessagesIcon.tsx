"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function DirectMessagesIcon() {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Link
          href="/channels/@me"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-300 text-zinc-800 transition-all hover:rounded-2xl hover:bg-indigo-600 hover:text-white dark:bg-neutral-900 dark:text-zinc-200 dark:hover:bg-indigo-600 dark:hover:text-white"
        >
          <MessageSquare className="h-5 w-5" />
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