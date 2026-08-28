import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar/index";
import DirectMessagesLayout from "@/components/DirectMessages/DirectMessagesLayout";
import EmptyChannel from "@/components/Channels/EmptyChannel";
import GuildLayout from "@/components/Guild/GuildLayout";
import { getGuildById } from "@/actions/guilds";
import { getCurrentUser } from "@/lib/current-user";

interface ChannelTargetPageProps {
  params: Promise<{
    id: string;
    targetId: string;
  }>;
}

export default async function ChannelTargetPage({ params }: ChannelTargetPageProps) {
  const { id, targetId } = await params;
  const isDirectMessages = id === "@me" || id === "%40me";

  const currentUser = await getCurrentUser();
  let currentGuild: Awaited<ReturnType<typeof getGuildById>> | null = null;
  let currentMember: NonNullable<Awaited<ReturnType<typeof getGuildById>>>["members"][number] | null = null;

  if (!isDirectMessages) {
    currentGuild = await getGuildById(id);

    if (currentGuild && currentUser) {
      currentMember = currentGuild.members.find(
        (member: any) => member.userId === currentUser.id,
      ) ?? null;
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar />

      <div className="flex min-h-0 flex-1 overflow-hidden bg-zinc-50 dark:bg-black">
        <Sidebar />

        {isDirectMessages ? (
          <DirectMessagesLayout initialConversationId={targetId} />
        ) : currentGuild ? (
          <GuildLayout
            guild={currentGuild}
            currentMember={currentMember}
            initialChannelId={targetId}
          />
        ) : (
          <EmptyChannel />
        )}
      </div>
    </div>
  );
}
