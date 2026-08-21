"use client";

import { useParams } from "next/navigation";

import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import DirectMessagesLayout from "@/components/DirectMessages/DirectMessagesLayout";
import EmptyChannel from "@/components/Channels/EmptyChannel";

export default function ChannelsPage() {
  const params = useParams();

  const id = params.id as string;

  

  const isDirectMessages = id === "%40me";

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar />

      <div className="flex min-h-0 flex-1 overflow-hidden bg-zinc-50 dark:bg-black">
        <Sidebar />

        {isDirectMessages ? (
          <DirectMessagesLayout />
        ) : (
          <EmptyChannel />
        )}
      </div>
    </div>
  );
}