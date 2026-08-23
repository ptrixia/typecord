import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar/index";
import DirectMessagesLayout from "@/components/DirectMessages/DirectMessagesLayout";
import EmptyChannel from "@/components/Channels/EmptyChannel";
import GuildLayout from "@/components/Guild/GuildLayout";

import { getGuildById } from "@/actions/guilds"; 

interface ChannelsPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChannelsPage({ params }: ChannelsPageProps) {
  const resolvedParams = await params;
  const id = resolvedParams.id;

  const isDirectMessages = id === "%40me";

  let currentGuild = null;
  if (!isDirectMessages) {
    currentGuild = await getGuildById(id);
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar />
      

      <div className="flex min-h-0 flex-1 overflow-hidden bg-zinc-50 dark:bg-black">
        <Sidebar />

        {isDirectMessages ? (
          <DirectMessagesLayout />
        ) : currentGuild ? (

          <GuildLayout guild={currentGuild} />
        ) : (
          <EmptyChannel />
        )}
      </div>
    </div>
  );
}