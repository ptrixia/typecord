"use client";

import GuildIcon from "./Guild/GuildIcon";
import DirectMessagesIcon from "./DirectMessages/DirectMessagesIcon";

export default function Sidebar() {
  return (
    <div className="m-1 flex h-full w-full max-w-24 flex-col items-center rounded-t-3xl bg-white py-3 font-sans dark:bg-black">
      
      {/* 1. SEÇÃO FIXA NO TOPO */}
      <DirectMessagesIcon />

      {/* 2. DIVISOR VISUAL */}
      <div className="my-2 h-[2px] w-8 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-800" />

      {/* 3. SEÇÃO ROLÁVEL (APENAS PARA OS GUILDS) */}
      <div className="flex w-full flex-1 flex-col items-center gap-2 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {[
          1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        ].map((guildId) => (
          <GuildIcon
            key={guildId}
            guild={{ id: guildId, name: `Guild ${guildId}` }}
          />
        ))}
      </div>
      
    </div>
  );
}