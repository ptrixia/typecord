"use client";

import ChannelsSidebar from "./ChannelsSideBar"; // Ajuste o caminho conforme sua estrutura
import ChatArea from "./ChatArea";
import MembersSidebar from "./MembersSidebar";

export default function GuildLayout() {
  return (
    <div className="m-1 flex w-full flex-row overflow-hidden rounded-t-3xl bg-stone-200 dark:bg-zinc-950/80">
      <ChannelsSidebar />
      <ChatArea />
      <MembersSidebar />
    </div>
  );
}