"use client";

import { useState, useEffect } from "react";
import ChannelsSidebar from "./ChannelsSideBar";
import ChatArea from "./ChatArea";
import MembersSidebar from "./MembersSidebar";
import VoiceRoom from "../VoiceRoom"; // O componente de voz

interface GuildLayoutProps {
  guild: any;
  currentMember: any;
}

export default function GuildLayout({ guild, currentMember }: GuildLayoutProps) {
  const [activeChannel, setActiveChannel] = useState<any>(null);

  // Estados para gerenciar a sala de voz ativa independentemente do chat de texto
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<any>(null);
  const [voiceToken, setVoiceToken] = useState<string | null>(null);

  useEffect(() => {
    if (guild.channels?.length > 0 && !activeChannel && !activeVoiceChannel) {
      const firstTextChannel = guild.channels.find((c: any) => c.type === "GUILD_TEXT") || guild.channels[0];
      setActiveChannel(firstTextChannel);
    }
  }, [guild, activeChannel, activeVoiceChannel]);

  return (
    <div className="m-1 flex w-full flex-row overflow-hidden rounded-t-3xl bg-stone-200 dark:bg-zinc-950/80">
      <ChannelsSidebar 
        guild={guild} 
        activeChannel={activeChannel}
        onSelectChannel={(channel) => {
          // Quando seleciona um canal de texto, limpamos a voz se preferir focar no texto, 
          // ou mantemos. Aqui mantemos a voz rodando em segundo plano e mudamos o foco para o chat.
          setActiveChannel(channel);
        }}
        activeVoiceChannel={activeVoiceChannel}
        onJoinVoice={(voiceChannel, token) => {
          setActiveVoiceChannel(voiceChannel);
          setVoiceToken(token);
        }}
        currentMember={currentMember}
      />
      
      {/* Se houver um canal de voz ativo, exibe a sala de voz no lugar da área principal. 
          Caso contrário, exibe o chat de texto normal. */}
      {activeVoiceChannel && voiceToken ? (
        <div className="flex flex-1 flex-col overflow-hidden bg-[#313338]">
          <VoiceRoom
            roomName={activeVoiceChannel.id}
            channelName={activeVoiceChannel.name}
            userName={currentMember?.user?.globalName || currentMember?.user?.username || "Usuário"}
            token={voiceToken}
            onLeave={() => {
              setActiveVoiceChannel(null);
              setVoiceToken(null);
            }}
          />
        </div>
      ) : (
        <ChatArea channel={activeChannel} />
      )}
      
      {/* A lista de membros só aparece se não estiver na tela de voz, ou pode ser mantida */}
      {!activeVoiceChannel && <MembersSidebar members={guild.members} />}
    </div>
  );
}