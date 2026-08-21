import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import GuildLayout from "@/components/Guild/GuildLayout";

export default function Home() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar />

      <div className="flex flex-1 flex-row bg-zinc-50 font-sans dark:bg-black overflow-hidden">
        <Sidebar />
        <GuildLayout />

      </div>
    </div>
  );
}