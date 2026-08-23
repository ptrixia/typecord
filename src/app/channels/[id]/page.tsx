import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar/index";
import DirectMessagesLayout from "@/components/DirectMessages/DirectMessagesLayout";
import EmptyChannel from "@/components/Channels/EmptyChannel";
import GuildLayout from "@/components/Guild/GuildLayout";
import { getGuildById } from "@/actions/guilds";
import { getCurrentUser } from "@/lib/current-user"; 

interface ChannelsPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChannelsPage({ params }: ChannelsPageProps) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  const isDirectMessages = id === "%40me";

  const currentUser = await getCurrentUser();

  let currentGuild = null;
  let currentMember = null;

  if (!isDirectMessages) {
    currentGuild = await getGuildById(id);

    if (currentGuild && currentUser) {
      currentMember = currentGuild.members.find(
        (m: any) => m.userId === currentUser.id
      );
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar />

      <div className="flex min-h-0 flex-1 overflow-hidden bg-zinc-50 dark:bg-black">
        <Sidebar />

        {isDirectMessages ? (
          <DirectMessagesLayout />
        ) : currentGuild ? (
          <GuildLayout guild={currentGuild} currentMember={currentMember} />
        ) : (
          <EmptyChannel />
        )}
      </div>
    </div>
  );
}