"use client";

import { useState, useEffect } from "react";
import ChannelsSidebar from "./ChannelsSideBar";
import ChatArea from "./ChatArea";
import MembersSidebar from "./MembersSidebar";

export default function GuildLayout({ guild }: { guild: any }) {
  // Estado que guarda o canal atual selecionado
  const [activeChannel, setActiveChannel] = useState<any>(null);

  // Assim que a guild carregar, seleciona o primeiro canal de texto por padrão
  useEffect(() => {
    if (guild.channels?.length > 0 && !activeChannel) {
      const firstTextChannel = guild.channels.find((c: any) => c.type === "GUILD_TEXT") || guild.channels[0];
      setActiveChannel(firstTextChannel);
    }
  }, [guild, activeChannel]);

  return (
    <div className="m-1 flex w-full flex-row overflow-hidden rounded-t-3xl bg-stone-200 dark:bg-zinc-950/80">
      
      <ChannelsSidebar 
        guild={guild} 
        activeChannel={activeChannel}
        onSelectChannel={setActiveChannel} 
      />
      
      {/* Passamos o canal selecionado para o Chat */}
      <ChatArea channel={activeChannel} />
      
      <MembersSidebar members={guild.members} />
      
    </div>
  );
}