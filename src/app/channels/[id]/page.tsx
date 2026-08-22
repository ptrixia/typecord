"use client";

import { useParams } from "next/navigation";

import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import DirectMessagesLayout from "@/components/DirectMessages/DirectMessagesLayout";
import EmptyChannel from "@/components/Channels/EmptyChannel";

// Importe o componente que será exibido quando uma guild for encontrada.
// (Ajuste o caminho conforme a estrutura do seu projeto)
import GuildLayout from "@/components/Guild/GuildLayout";
import SearchCommand from "@/components/SearchCommand";

// 1. Array simulando os dados dos servidores do usuário
const userGuilds = [
  { id: "12345", name: "Servidor de Jogos" },
  { id: "67890", name: "Comunidade Next.js" },
];

export default function ChannelsPage() {
  const params = useParams();
  const id = params.id as string;

  const isDirectMessages = id === "%40me";

  // 2. Busca se o ID passado na URL existe dentro do array de guilds
  const currentGuild = userGuilds.find((guild) => guild.id === id);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar />
      <SearchCommand/>

      <div className="flex min-h-0 flex-1 overflow-hidden bg-zinc-50 dark:bg-black">
        <Sidebar />

        {/* 3. Lógica de renderização condicional aninhada */}
        {isDirectMessages ? (
          <DirectMessagesLayout />
        ) : currentGuild ? (
          // Se não for DM e a guild existir, mostra o layout do servidor
          // Passamos os dados da guild como prop para o componente
          <GuildLayout guild={currentGuild} />
        ) : (
          // Se a URL tiver um ID que não está no array (ex: servidor apagado ou URL errada)
          <EmptyChannel />
        )}
      </div>
    </div>
  );
}