'use client'
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import GuildLayout from "@/components/Guild/GuildLayout";
import Modal from "@/components/Modal";

export default function Home() {

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Navbar />


      {/* <Modal 
        isOpen={false} 
        onClose={() => {}}
        title="Titulo"
      >
        <p className="py-4 text-zinc-600 dark:text-zinc-400">
          Content
        </p>
        <div className="flex justify-end gap-2 mt-4">

        </div>
      </Modal> */}

      <div className="flex flex-1 flex-row bg-zinc-50 font-sans dark:bg-black overflow-hidden">
        <Sidebar />
        <GuildLayout />

      </div>
    </div>
  );
}