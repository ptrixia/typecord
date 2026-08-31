"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Hash,
  MessageSquare,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import { searchLocalMessages } from "@/lib/local-message-search";

export type CommandItem = {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  icon?: React.ReactNode;
  href?: string;
  action?: () => void | Promise<void>;
};

interface SearchCommandProps {
  items?: CommandItem[];
  buttonClassName?: string;
}

function defaultIcon(item: CommandItem) {
  if (item.href?.includes("@me")) return <MessageSquare className="h-4 w-4" />;
  if (item.href?.includes("/channels/")) return <Hash className="h-4 w-4" />;
  if (item.label.toLowerCase().includes("config")) return <Settings className="h-4 w-4" />;
  return <Sparkles className="h-4 w-4" />;
}

export default function SearchCommand({
  items = [],
  buttonClassName,
}: SearchCommandProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [messageResults, setMessageResults] = useState<CommandItem[]>([]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setMessageResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const localResults = searchLocalMessages(normalized, 8).map((result) => ({
          id: `local-message:${result.id}`,
          label: result.content,
          description: `${result.author} em ${result.scopeLabel}`,
          href: result.href,
          keywords: ["mensagem", "busca local", result.author],
        }));

        const response = await fetch(`/api/messages/search?q=${encodeURIComponent(normalized)}&limit=8`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const body = await response.json().catch(() => null);
        const remoteResults = response.ok && Array.isArray(body?.results)
          ? body.results.map((result: { id: string; content: string; author: string; channel: { name: string; guildId: string }; channelId: string }) => ({
          id: `message:${result.id}`,
          label: result.content || "Mensagem sem texto",
          description: `${result.author} em #${result.channel.name}`,
          href: `/channels/${result.channel.guildId}/${result.channelId}`,
          keywords: ["mensagem", "buscar", result.author],
          }))
          : [];
        const seen = new Set<string>();
        setMessageResults([...localResults, ...remoteResults].filter((item) => {
          if (seen.has(item.label + item.href)) return false;
          seen.add(item.label + item.href);
          return true;
        }).slice(0, 12));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setMessageResults([]);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    const availableItems = [...items, ...messageResults];
    if (!normalized) return availableItems.slice(0, 10);

    return availableItems
      .filter((item) => {
        const haystack = [
          item.label,
          item.description,
          ...(item.keywords ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase("pt-BR");

        return haystack.includes(normalized);
      })
      .slice(0, 12);
  }, [items, messageResults, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, isOpen]);

  async function runCommand(item: CommandItem) {
    setIsOpen(false);
    setQuery("");

    if (item.action) {
      await item.action();
      return;
    }

    if (item.href) {
      router.push(item.href);
    }
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, filtered.length - 1));
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    }

    if (event.key === "Enter" && filtered[activeIndex]) {
      event.preventDefault();
      void runCommand(filtered[activeIndex]);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={
          buttonClassName ??
          "flex items-center gap-4 rounded-md border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }
      >
        <span>Buscar no Typecord...</span>
        <kbd className="pointer-events-none inline-flex h-5 items-center gap-1 rounded border border-zinc-200 bg-zinc-50 px-1.5 font-mono text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
          Ctrl K
        </kbd>
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Command palette"
      >
        <div className="space-y-3">
          <label className="flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10 dark:border-white/10 dark:bg-[#111214]">
            <Search className="h-4 w-4 shrink-0 text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Ir para canal, DM, config ou status"
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-sm text-zinc-950 outline-none placeholder:text-zinc-400 dark:text-white"
            />
          </label>

          <div className="max-h-[380px] overflow-y-auto rounded-xl border border-zinc-200 p-1 dark:border-white/10">
            {filtered.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-zinc-500">
                Nenhum comando encontrado.
              </div>
            ) : (
              filtered.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => void runCommand(item)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                    index === activeIndex
                      ? "bg-indigo-500 text-white"
                      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/5 dark:bg-white/10">
                    {item.icon ?? defaultIcon(item)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{item.label}</span>
                    {item.description && (
                      <span className={`mt-0.5 block truncate text-xs ${index === activeIndex ? "text-white/75" : "text-zinc-500"}`}>
                        {item.description}
                      </span>
                    )}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
