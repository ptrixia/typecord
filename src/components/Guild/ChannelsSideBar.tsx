"use client";

import { Hash } from "lucide-react";

export default function ChannelsSidebar() {
  return (
    <div className="flex w-60 shrink-0 flex-col bg-stone-300/50 dark:bg-zinc-900/50">
      <div className="flex h-12 items-center border-b border-stone-300 px-4 font-bold shadow-sm dark:border-zinc-800/50">
        Nome
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="mb-4">
          {/* <h3 className="px-2 text-xs font-semibold text-stone-500 dark:text-zinc-400">
            CANAIS FIXADOS
          </h3> */}
          <div className="mt-1 flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-stone-300 dark:hover:bg-zinc-800">
            <Hash className="h-4 w-4 text-stone-500" />
            <span className="text-sm">nomedocanal</span>
          </div>
        </div>

        <div>
          {/* <h3 className="px-2 text-xs font-semibold text-stone-500 dark:text-zinc-400">
            categoria
          </h3>
          <div className="mt-1 flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-stone-300 dark:hover:bg-zinc-800">
            <Hash className="h-4 w-4 text-stone-500" />
            <span className="text-sm">nomedocanal</span>
          </div> */}
        </div>
      </div>

      <div className="flex h-14 items-center bg-stone-300/80 px-2 dark:bg-zinc-900/80">
        <div className="h-8 w-8 rounded-full bg-indigo-500"></div>
        <div className="ml-2 flex-1">
          <div className="text-sm font-bold leading-tight">Nome</div>
          <div className="text-xs leading-tight text-stone-500 dark:text-zinc-400">Status</div>
        </div>
      </div>
    </div>
  );
}