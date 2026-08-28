"use client";

import { Bell, Hash, MessageSquare, Pin, Reply } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { onGatewayEvent } from "@/lib/realtime/gateway-client";

type Location =
  | { type: "guild"; guildId: string; channelId: string | null }
  | { type: "direct"; conversationId: string | null }
  | null;

type InboxKind = "mention" | "reply" | "pin";

type InboxItem = {
  id: string;
  kind: InboxKind;
  scopeId: string;
  title: string;
  excerpt: string;
  href: string;
  createdAt: number;
};

type ActivityContextValue = {
  activeLocation: Location;
  setActiveLocation: (location: Location) => void;
  currentUserId: string;
  setCurrentUserId: (userId: string) => void;
  unread: Record<string, number>;
  inbox: InboxItem[];
  markRead: (scopeId: string) => void;
  markAllRead: () => void;
  registerGuildScopes: (guildId: string, channelIds: string[]) => void;
  getGuildUnread: (guildId: string) => number;
  getDirectUnread: () => number;
};

const ActivityContext = createContext<ActivityContextValue | null>(null);

function parseContent(raw: unknown) {
  if (typeof raw !== "string") return "";
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.content === "string") {
      return parsed.content;
    }
  } catch {}
  return raw;
}

function readMessagePayload(data: any) {
  const message = data?.message ?? data?.data?.message ?? data;
  const channelId = String(data?.channelId ?? message?.channelId ?? "");
  const conversationId = String(data?.conversationId ?? message?.conversationId ?? "");
  const scopeId = conversationId || channelId;
  const content = parseContent(message?.content);
  const author =
    typeof message?.author === "string"
      ? message.author
      : message?.author?.globalName ||
        message?.author?.username ||
        message?.authorName ||
        "Usuário";

  return {
    id: String(message?.id ?? crypto.randomUUID()),
    scopeId,
    channelId,
    conversationId,
    content,
    author,
    authorId: String(message?.authorId ?? message?.userId ?? message?.author?.id ?? ""),
    replyAuthorId: String(message?.reply?.authorId ?? message?.reply?.author?.id ?? ""),
    isPinned: Boolean(message?.isPinned),
  };
}

export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const [activeLocation, setActiveLocationState] = useState<Location>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [scopeParents, setScopeParents] = useState<Record<string, string>>({});
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const activeRef = useRef<Location>(null);
  const userIdRef = useRef("");

  const markRead = useCallback((scopeId: string) => {
    setUnread((current) => {
      if (!current[scopeId]) return current;
      const next = { ...current };
      delete next[scopeId];
      return next;
    });
  }, []);

  const setActiveLocation = useCallback((location: Location) => {
    activeRef.current = location;
    setActiveLocationState(location);
    const scopeId =
      location?.type === "guild"
        ? location.channelId
        : location?.type === "direct"
          ? location.conversationId
          : null;
    if (scopeId) markRead(scopeId);
  }, [markRead]);

  useEffect(() => {
    userIdRef.current = currentUserId;
  }, [currentUserId]);

  const markAllRead = useCallback(() => setUnread({}), []);

  const registerGuildScopes = useCallback((guildId: string, channelIds: string[]) => {
    setScopeParents((current) => {
      const next = { ...current };
      for (const channelId of channelIds) {
        next[channelId] = guildId;
      }
      return next;
    });
  }, []);

  const getGuildUnread = useCallback(
    (guildId: string) =>
      Object.entries(unread).reduce((total, [scopeId, count]) => {
        return scopeParents[scopeId] === guildId ? total + count : total;
      }, 0),
    [scopeParents, unread],
  );

  const getDirectUnread = useCallback(
    () =>
      Object.entries(unread).reduce((total, [scopeId, count]) => {
        return scopeParents[scopeId] ? total : total + count;
      }, 0),
    [scopeParents, unread],
  );

  useEffect(() => {
    const removeCreate = onGatewayEvent<any>("MESSAGE_CREATE", ({ data }) => {
      const payload = readMessagePayload(data);
      if (!payload.scopeId || payload.authorId === userIdRef.current) return;

      const active = activeRef.current;
      const activeScope =
        active?.type === "guild"
          ? active.channelId
          : active?.type === "direct"
            ? active.conversationId
            : null;

      if (activeScope !== payload.scopeId) {
        setUnread((current) => ({
          ...current,
          [payload.scopeId]: (current[payload.scopeId] ?? 0) + 1,
        }));
      }

      const mentionToken = userIdRef.current ? `<@${userIdRef.current}>` : "";
      const hasMention = Boolean(mentionToken && payload.content.includes(mentionToken));
      const isReply = Boolean(userIdRef.current && payload.replyAuthorId === userIdRef.current);
      if (!hasMention && !isReply) return;
      const kind: InboxKind = hasMention ? "mention" : "reply";

      setInbox((current) => [
        {
          id: `${payload.id}:${kind}`,
          kind,
          scopeId: payload.scopeId,
          title: hasMention ? `Menção de ${payload.author}` : `Resposta de ${payload.author}`,
          excerpt: payload.content || "Mensagem",
          href: payload.conversationId
            ? `/channels/@me/${payload.conversationId}`
            : `/channels/${String(data?.guildId ?? data?.message?.guildId ?? "")}/${payload.channelId}`,
          createdAt: Date.now(),
        },
        ...current,
      ].slice(0, 40));
    });

    const removeUpdate = onGatewayEvent<any>("MESSAGE_UPDATE", ({ data }) => {
      const payload = readMessagePayload(data);
      if (!payload.scopeId || !payload.isPinned) return;
      setInbox((current) => [
        {
          id: `${payload.id}:pin`,
          kind: "pin" as InboxKind,
          scopeId: payload.scopeId,
          title: "Mensagem fixada",
          excerpt: payload.content || "Mensagem fixada no canal",
          href: payload.conversationId
            ? `/channels/@me/${payload.conversationId}`
            : `/channels/${String(data?.guildId ?? data?.message?.guildId ?? "")}/${payload.channelId}`,
          createdAt: Date.now(),
        },
        ...current,
      ].slice(0, 40));
    });

    return () => {
      removeCreate();
      removeUpdate();
    };
  }, []);

  const value = useMemo(
    () => ({
      activeLocation,
      setActiveLocation,
      currentUserId,
      setCurrentUserId,
      unread,
      inbox,
      markRead,
      markAllRead,
      registerGuildScopes,
      getGuildUnread,
      getDirectUnread,
    }),
    [
      activeLocation,
      currentUserId,
      getGuildUnread,
      getDirectUnread,
      inbox,
      markAllRead,
      markRead,
      registerGuildScopes,
      setActiveLocation,
      unread,
    ],
  );

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export function useActivity() {
  const value = useContext(ActivityContext);
  if (!value) {
    throw new Error("useActivity precisa estar dentro de ActivityProvider.");
  }
  return value;
}

export function UnreadBadge({ scopeId }: { scopeId?: string | null }) {
  const { unread } = useActivity();
  const count = scopeId ? unread[scopeId] ?? 0 : 0;
  if (!count) return null;
  return (
    <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black leading-4 text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function InboxButton() {
  const { inbox, markAllRead } = useActivity();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
        title="Inbox"
        aria-label="Inbox"
      >
        <Bell className="h-4 w-4" />
        {inbox.length > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-zinc-50 dark:ring-black" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-[1000] w-[min(420px,calc(100vw-32px))] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111214]">
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-white/10">
            <div className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Inbox</div>
            <button
              type="button"
              onClick={markAllRead}
              className="rounded-md px-2 py-1 text-xs font-bold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white"
            >
              Marcar lido
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto p-2">
            {inbox.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-zinc-500">
                Menções, respostas e fixadas aparecem aqui.
              </div>
            ) : (
              inbox.map((item) => {
                const Icon = item.kind === "pin" ? Pin : item.kind === "reply" ? Reply : Hash;
                return (
                  <a
                    key={item.id}
                    href={item.href}
                    className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-zinc-100 dark:hover:bg-white/[0.06]"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-zinc-900 dark:text-white">{item.title}</span>
                      <span className="mt-0.5 line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{item.excerpt}</span>
                    </span>
                    <MessageSquare className="mt-1 h-4 w-4 shrink-0 text-zinc-400" />
                  </a>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
