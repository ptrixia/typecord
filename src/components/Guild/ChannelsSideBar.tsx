"use client";

import { useEffect, useRef, useState } from "react";
import {
  Ban,
  ChevronRight,
  Copy,
  Headphones,
  Hash,
  LogOut,
  Mic,
  MoreHorizontal,
  Pencil,
  Settings,
  UserCircle,
  UserRound,
} from "lucide-react";
import UserProfileSideBar from "../UserProfileSideBar";

export default function ChannelsSidebar() {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative flex w-60 shrink-0 flex-col bg-stone-300/50 dark:bg-[#111214]">
      
      <div className="flex h-12 shrink-0 items-center border-b border-stone-300 px-4 font-bold shadow-sm dark:border-zinc-800/60 dark:text-white">
        Nome
      </div>

      
      <div className="flex-1 overflow-y-auto p-2">
        <div className="mb-4">
          <div
            className="
              mt-1 flex cursor-pointer items-center gap-2
              rounded-md px-2 py-1.5
              text-stone-600
              transition-colors
              hover:bg-stone-300
              hover:text-stone-900
              dark:text-zinc-400
              dark:hover:bg-zinc-800
              dark:hover:text-zinc-100
            "
          >
            <Hash className="h-4 w-4 shrink-0" />

            <span className="truncate text-sm">
              nomedocanal
            </span>
          </div>
        </div>
      </div>

      <UserProfileSideBar
      name="Nome"
        username="@username"
        status="Status personalizado"
        avatar="N"
         ></UserProfileSideBar>
    </div>
  );
}