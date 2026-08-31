"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Square, Minus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { InboxButton } from "@/components/app/ActivityProvider";
import { PreferencesButton } from "@/components/app/PreferencesProvider";

export default function Navbar() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      ("__TAURI_INTERNALS__" in window || "__TAURI__" in window)
    ) {
      setIsDesktop(true);
    }
  }, []);

  useEffect(() => {
    void fetch("/api/admin/overview?hours=1", { cache: "no-store" })
      .then((response) => setIsPlatformAdmin(response.ok))
      .catch(() => setIsPlatformAdmin(false));
  }, []);

  const handleMinimize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().minimize();
    } catch (error) {
      console.error("Erro ao minimizar:", error);
    }
  };

  const handleMaximize = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().toggleMaximize();
    } catch (error) {
      console.error("Erro ao maximizar:", error);
    }
  };

  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch (error) {
      console.error("Erro ao fechar:", error);
    }
  };

  return (
    <nav
      data-tauri-drag-region
      className="flex h-12 w-full select-none items-center justify-between bg-zinc-50 dark:bg-black"
    >
      <div data-tauri-drag-region className="h-full flex-1" />

      {/* data-tauri-no-drag impede que o arrastar da janela interfira nos cliques dos botões */}
      <div data-tauri-no-drag className="flex h-full items-center gap-1 px-2">
        <InboxButton />
        <PreferencesButton />
        <ThemeToggle />
        {isPlatformAdmin && <Link href="/admin" className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-200 hover:text-indigo-500 dark:text-zinc-400 dark:hover:bg-zinc-800" title="Painel admin"><ShieldCheck className="h-4 w-4" /></Link>}

        {isDesktop && (
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleMinimize}
              className="h-9 w-12 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800"
            >
              <Minus className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleMaximize}
              className="h-9 w-12 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800"
            >
              <Square className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-9 w-12 rounded-md hover:bg-red-500 hover:text-white dark:hover:bg-red-500 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </nav>
  );
}
