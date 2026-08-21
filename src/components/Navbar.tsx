"use client";

import { X, Square, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Navbar() {
  return (
    <nav className="w-full flex items-center justify-end bg-zinc-50 dark:bg-black">
      <div className="flex items-center gap-0.5">
        <ThemeToggle />

        <Button variant="ghost" size="icon">
          <Minus />
        </Button>

        <Button variant="ghost" size="icon">
          <Square />
        </Button>

        <Button variant="ghost" size="icon">
          <X />
        </Button>
      </div>
    </nav>
  );
}