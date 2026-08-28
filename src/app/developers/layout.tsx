import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { getCurrentUser } from "@/lib/current-user";
import UserProfileSideBar from "@/components/UserProfileSideBar";

export const dynamic = "force-dynamic";

export default async function DevelopersLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?callbackUrl=/developers");
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-50 text-zinc-950 dark:bg-black dark:text-zinc-100">
      <Navbar />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <UserProfileSideBar user={user} />
        <Sidebar />
        {children}
      </div>
    </div>
  );
}
