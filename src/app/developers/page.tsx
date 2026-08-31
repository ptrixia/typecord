"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Bot,
  Braces,
  Check,
  ChevronRight,
  Code2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LayoutGrid,
  Loader2,
  LockKeyhole,
  Plus,
  Puzzle,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Terminal,
  X,
  ExternalLink,
  Zap,
} from "lucide-react";

interface GuildData {
  id: string;
  name: string;
  iconUrl: string | null;
}

interface BotData {
  id: string;
  userId: string;
  ownerId?: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  disabled: boolean;
  createdAt: string;
  guilds: GuildData[];
}

type Toast = {
  type: "success" | "error" | "info";
  message: string;
};

type PluginData = {
  id: string;
  name: string;
  version: string;
  description: string;
  permissions: string[];
  commands: Array<{ name: string; description: string }>;
};

type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

type PublicApiDoc = {
  id: string;
  method: ApiMethod;
  path: string;
  title: string;
  description: string;
  auth: "Bot Token";
  request?: string;
  response: string;
  notes?: string[];
};

const PUBLIC_API_DOCS: readonly PublicApiDoc[] = [
  {
    id: "gateway-session",
    method: "GET",
    path: "/api/gateway",
    title: "Criar sessão do Gateway",
    description:
      "Troca o Bot Token por uma sessão temporária usada para autenticar a conexão Socket.IO do bot.",
    auth: "Bot Token",
    response: `{
  "success": true,
  "url": "<gateway-url>",
  "session": {
    "id": "uuid",
    "token": "sessao-temporaria",
    "expiresAt": "2026-08-26T18:00:00.000Z"
  },
  "bot": { "id": "...", "user": { "id": "...", "username": "..." } },
  "guilds": []
}`,
    notes: [
      "O Bot Token nunca deve ser enviado em query string.",
      "A sessão do Gateway possui validade curta e pode ser revogada ao regenerar o token do bot.",
    ],
  },
  {
    id: "create-message",
    method: "POST",
    path: "/api/channels/{channelId}/messages",
    title: "Enviar mensagem",
    description:
      "Envia uma mensagem em um canal onde o bot é membro e possui permissões básicas.",
    auth: "Bot Token",
    request: `{
  "content": "Olá do Typecord!",
  "replyToId": null,
  "embeds": []
}`,
    response: `{
  "success": true,
  "message": {
    "id": "...",
    "content": "Olá do Typecord!",
    "guildId": "...",
    "channelId": "...",
    "isBot": true,
    "createdAt": "2026-08-26T17:00:00.000Z"
  }
}`,
    notes: [
      "O campo content suporta até 8.000 caracteres.",
      "São permitidos no máximo 10 embeds por mensagem.",
      "O uso de Embeds exige a permissão EMBED_LINKS.",
    ],
  },
  {
    id: "update-message",
    method: "PATCH",
    path: "/api/channels/{channelId}/messages?messageId={messageId}",
    title: "Editar mensagem do bot",
    description:
      "Edita somente mensagens criadas pelo próprio bot autenticado.",
    auth: "Bot Token",
    request: `{
  "content": "Mensagem atualizada",
  "embeds": []
}`,
    response: `{
  "success": true,
  "message": {
    "id": "...",
    "content": "Mensagem atualizada",
    "editedAt": "2026-08-26T17:01:00.000Z"
  }
}`,
  },
  {
    id: "delete-message",
    method: "DELETE",
    path: "/api/channels/{channelId}/messages?messageId={messageId}",
    title: "Excluir mensagem do bot",
    description:
      "Faz soft-delete somente de uma mensagem pertencente ao próprio bot autenticado.",
    auth: "Bot Token",
    response: `{
  "success": true,
  "messageId": "..."
}`,
  },
] as const;

function methodClasses(method: ApiMethod) {
  switch (method) {
    case "GET":
      return "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20";
    case "POST":
      return "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
    case "PATCH":
      return "bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
    case "DELETE":
      return "bg-red-50 text-red-600 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20";
  }
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { cache: "no-store", ...init });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message ?? `A requisição falhou (${response.status}).`);
  }

  return data as T;
}

function Dialog({
  open,
  onClose,
  children,
  width = "max-w-xl",
  closeOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: string;
  closeOnBackdrop?: boolean;
}) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && closeOnBackdrop) onClose();
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, closeOnBackdrop]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-zinc-950/40 p-4 backdrop-blur-sm sm:p-6 transition-all duration-300 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`my-auto flex max-h-[calc(100dvh-32px)] w-full flex-col overflow-hidden rounded-[24px] border border-white/20 bg-white shadow-[0_8px_40px_-12px_rgba(0,0,0,0.2)] ring-1 ring-zinc-200 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.6)] dark:ring-white/10 sm:max-h-[calc(100dvh-64px)] ${width} animate-in zoom-in-95 duration-200`}
      >
        {children}
      </div>
    </div>
  );
}

function DialogHeader({
  title,
  description,
  icon,
  onClose,
  disabled,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  onClose: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-100 bg-zinc-50/50 px-6 py-5 dark:border-zinc-800/80 dark:bg-zinc-900/50">
      <div className="flex min-w-0 items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 shadow-sm shadow-indigo-200/50 dark:bg-indigo-500/20 dark:text-indigo-400 dark:shadow-indigo-900/20">
          {icon}
        </div>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">{title}</h2>
          {description && (
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        disabled={disabled}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-zinc-400 shadow-sm border border-zinc-200 transition-all hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-40 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-white"
        aria-label="Fechar"
      >
        <X size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
}

function BotAvatar({ bot, large = false }: { bot: BotData; large?: boolean }) {
  return (
    <div
      className={`${
        large ? "h-20 w-20 rounded-lg shadow-sm" : "h-11 w-11 rounded-lg shadow-sm"
      } flex shrink-0 items-center justify-center overflow-hidden bg-zinc-900 text-white ring-1 ring-inset ring-white/10 dark:bg-zinc-800`}
    >
      {bot.avatarUrl ? (
        <img src={bot.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <Bot size={large ? 32 : 20} strokeWidth={1.5} />
      )}
    </div>
  );
}

export default function DevelopersPage() {
  const [section, setSection] = useState<"apps" | "api">("apps");
  const [bots, setBots] = useState<BotData[]>([]);
  const [guilds, setGuilds] = useState<GuildData[]>([]);
  const [plugins, setPlugins] = useState<PluginData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [apiSearch, setApiSearch] = useState("");
  const [selectedDocId, setSelectedDocId] = useState(PUBLIC_API_DOCS[0].id);
  const [showCreate, setShowCreate] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showRegenerate, setShowRegenerate] = useState(false);
  const [selectedBot, setSelectedBot] = useState<BotData | null>(null);
  const [selectedGuild, setSelectedGuild] = useState("");
  const [botName, setBotName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const notify = useCallback((message: string, type: Toast["type"] = "success") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const load = useCallback(async (initial = false) => {
    try {
      initial ? setLoading(true) : setRefreshing(true);
      const data = await requestJson<{ bots?: BotData[]; guilds?: GuildData[] }>(
        "/api/developers/bots"
      );
      setBots(Array.isArray(data.bots) ? data.bots.map((bot) => ({ ...bot, guilds: bot.guilds ?? [] })) : []);
      setGuilds(Array.isArray(data.guilds) ? data.guilds : []);
      const pluginData = await requestJson<{ plugins?: PluginData[] }>("/api/plugins");
      setPlugins(Array.isArray(pluginData.plugins) ? pluginData.plugins : []);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível carregar as aplicações.", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [notify]);

  useEffect(() => {
    void load(true);
  }, [load]);

  const filteredBots = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return bots;
    return bots.filter((bot) =>
      [bot.username, bot.globalName, bot.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [bots, search]);

  const filteredDocs = useMemo(() => {
    const query = apiSearch.trim().toLowerCase();
    if (!query) return PUBLIC_API_DOCS;
    return PUBLIC_API_DOCS.filter((doc) =>
      `${doc.method} ${doc.path} ${doc.title} ${doc.description}`.toLowerCase().includes(query)
    );
  }, [apiSearch]);

  const selectedDoc =
    PUBLIC_API_DOCS.find((doc) => doc.id === selectedDocId) ?? PUBLIC_API_DOCS[0];

  const availableGuilds = useMemo(() => {
    if (!selectedBot) return [];
    const installed = new Set(selectedBot.guilds.map((guild) => guild.id));
    return guilds.filter((guild) => !installed.has(guild.id));
  }, [guilds, selectedBot]);

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000);
    } catch {
      notify("Não foi possível copiar.", "error");
    }
  }

  async function createBot() {
    const username = botName.trim();
    if (username.length < 2 || username.length > 32 || creating) return;

    try {
      setCreating(true);
      const data = await requestJson<{ bot: BotData; token: string }>("/api/developers/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          avatarUrl: avatarUrl.trim() || null,
          bannerUrl: bannerUrl.trim() || null,
        }),
      });

      setBotName("");
      setAvatarUrl("");
      setBannerUrl("");
      setShowCreate(false);
      setSelectedBot(data.bot);
      setToken(data.token);
      setTokenVisible(false);
      setShowToken(true);
      notify("Aplicação criada com sucesso.");
      await load(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível criar o bot.", "error");
    } finally {
      setCreating(false);
    }
  }

  async function installBot() {
    if (!selectedBot || !selectedGuild || installing) return;

    try {
      setInstalling(true);
      await requestJson(`/api/developers/bots/${selectedBot.id}/install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId: selectedGuild }),
      });
      setShowInstall(false);
      setSelectedGuild("");
      notify("Bot adicionado ao servidor com sucesso.");
      await load(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível instalar o bot.", "error");
    } finally {
      setInstalling(false);
    }
  }

  async function regenerateToken() {
    if (!selectedBot || regenerating) return;

    try {
      setRegenerating(true);
      const data = await requestJson<{ token: string }>(
        `/api/developers/bots/${selectedBot.id}/token`,
        { method: "POST" }
      );
      setShowRegenerate(false);
      setToken(data.token);
      setTokenVisible(false);
      setShowToken(true);
      notify("Token regenerado com segurança.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível regenerar o token.", "error");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="flex h-screen min-w-0 flex-1 overflow-hidden bg-[#f5f5f7] font-sans text-zinc-900 dark:bg-[#08080a] dark:text-zinc-100 selection:bg-indigo-500/25 selection:text-indigo-900 dark:selection:text-indigo-200">
      
      {/* Sidebar Navigation */}
      <aside className="hidden w-[280px] shrink-0 flex-col border-r border-zinc-200/70 bg-white/82 backdrop-blur-2xl dark:border-zinc-800/60 dark:bg-[#09090b]/90 lg:flex">
        <div className="px-5 pb-4 pt-6">
          <div className="flex items-center gap-3 rounded-2xl p-2 transition-all hover:bg-zinc-100/70 dark:hover:bg-zinc-900/50">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900">
              <Code2 size={24} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-black tracking-tight text-zinc-900 dark:text-white">Typecord</p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Developer Portal</p>
            </div>
          </div>
        </div>

        <nav className="mt-2 flex-1 space-y-1.5 px-4 overflow-y-auto">
          <button
            type="button"
            onClick={() => setSection("apps")}
            className={`flex h-11 w-full items-center gap-3 rounded-xl px-4 text-sm font-semibold transition-all duration-200 ${
              section === "apps"
                ? "bg-indigo-50 text-indigo-700 shadow-sm dark:bg-indigo-500/10 dark:text-indigo-400 dark:shadow-none"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            <LayoutGrid size={18} strokeWidth={2.5} />
            Aplicações
          </button>
          <button
            type="button"
            onClick={() => setSection("api")}
            className={`flex h-11 w-full items-center gap-3 rounded-xl px-4 text-sm font-semibold transition-all duration-200 ${
              section === "api"
                ? "bg-indigo-50 text-indigo-700 shadow-sm dark:bg-indigo-500/10 dark:text-indigo-400 dark:shadow-none"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            <Braces size={18} strokeWidth={2.5} />
            API Reference
          </button>
        </nav>

        <div className="p-4">
          <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
              <Zap size={16} fill="currentColor" className="text-indigo-500 dark:text-indigo-400" />
              API Pública
            </div>
            <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
              A documentação exibe apenas a superfície autorizada para integrações externas.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {section === "apps" ? (
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1400px] px-6 py-8 sm:px-8 lg:px-12 lg:py-10">
              
              {/* Header */}
              <header className="flex flex-col justify-between gap-6 rounded-[28px] border border-white/80 bg-white/80 p-6 shadow-sm backdrop-blur-2xl md:flex-row md:items-end dark:border-white/10 dark:bg-white/[0.04]">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    <LayoutGrid size={16} /> Meus Aplicativos
                  </div>
                    <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-900 dark:text-white">Gerenciamento de Bots</h1>
                  <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                    Crie novas integrações, instale-as em seus servidores e gerencie as chaves de acesso com segurança.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    disabled={refreshing}
                    onClick={() => void load(false)}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-bold text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 hover:text-zinc-900 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-white"
                  >
                    <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
                    <span className="hidden sm:inline">Atualizar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-md shadow-indigo-500/20 transition-all hover:bg-indigo-500 active:scale-95 dark:shadow-indigo-900/20"
                  >
                    <Plus size={18} strokeWidth={2.5} />
                    Nova Aplicação
                  </button>
                </div>
              </header>

              <section className="mt-6 rounded-[28px] border border-indigo-200/70 bg-gradient-to-br from-indigo-50/90 via-white to-white p-6 shadow-sm dark:border-indigo-500/20 dark:from-indigo-500/10 dark:via-[#111113] dark:to-[#111113]">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div className="flex gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"><Puzzle size={21} /></div>
                    <div><h2 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">Plugins nativos</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">Extensões seguras para adicionar comandos, automações e integrações ao Typecord.</p></div>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">{plugins.length} disponíveis</span>
                </div>
                {plugins.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-indigo-200 bg-white/60 p-5 text-sm text-zinc-500 dark:border-indigo-500/20 dark:bg-white/[0.03]">O catálogo está pronto para receber plugins. Quando um plugin for publicado, ele aparecerá aqui com suas permissões e comandos.</div> : <div className="mt-5 grid gap-3 md:grid-cols-2">{plugins.map((plugin) => <article key={plugin.id} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-white/[0.04]"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-zinc-900 dark:text-white">{plugin.name}</h3><p className="mt-1 text-xs text-zinc-500">v{plugin.version} · {plugin.id}</p></div><span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-black uppercase text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">Disponível</span></div><p className="mt-3 text-sm leading-5 text-zinc-600 dark:text-zinc-400">{plugin.description}</p><div className="mt-3 flex flex-wrap gap-1.5">{plugin.commands.slice(0, 4).map((command) => <span key={command.name} className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-[10px] text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">/{command.name}</span>)}</div></article>)}</div>}
              </section>

              <div className="py-8">
                {/* Search Bar */}
                <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Aplicações Criadas</h2>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {bots.length} aplicação(ões) vinculada(s) à sua conta.
                    </p>
                  </div>
                  {bots.length > 0 && (
                    <div className="relative w-full sm:w-[320px]">
                      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        aria-label="Buscar por nome ou ID"
                        className="h-11 w-full rounded-2xl border border-zinc-200 bg-white pl-11 pr-4 text-sm font-medium text-zinc-900 shadow-sm outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:focus:border-indigo-500/80 dark:focus:ring-indigo-500/20"
                      />
                    </div>
                  )}
                </div>

                {/* Content */}
                {loading ? (
                  <div className="flex min-h-[400px] flex-col items-center justify-center rounded-[28px] border border-zinc-200 bg-white/70 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/20">
                    <Loader2 size={32} className="animate-spin text-indigo-500" />
                    <p className="mt-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Carregando aplicações...</p>
                  </div>
                ) : filteredBots.length === 0 ? (
                  <div className="flex min-h-[400px] flex-col items-center justify-center rounded-[28px] border border-zinc-200 bg-white/75 p-10 text-center shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/20">
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-zinc-100 text-zinc-600 shadow-inner dark:bg-zinc-800 dark:text-zinc-300">
                      <Bot size={40} strokeWidth={1.5} />
                    </div>
                    <h3 className="mt-6 text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Nenhuma aplicação encontrada</h3>
                    <p className="mt-2 max-w-md text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                      {search ? "Nenhuma aplicação corresponde à sua busca. Tente usar outros termos." : "Você ainda não possui aplicações. Crie seu primeiro bot para começar a usar a API pública."}
                    </p>
                    {!search && (
                      <button
                        type="button"
                        onClick={() => setShowCreate(true)}
                        className="mt-6 flex h-11 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-6 text-sm font-bold text-white shadow-md transition-all hover:bg-zinc-800 active:scale-95 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                      >
                        <Plus size={18} strokeWidth={2.5} />
                        Criar primeira aplicação
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredBots.map((bot) => (
                      <article
                        key={bot.id}
                        className="group relative flex flex-col overflow-hidden rounded-[24px] border border-zinc-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-xl hover:shadow-zinc-200/60 dark:border-zinc-800 dark:bg-[#111113] dark:hover:border-zinc-700 dark:hover:shadow-black/30"
                      >
                        <div className="relative h-20 shrink-0 overflow-hidden bg-zinc-900">
                          {bot.bannerUrl ? <img src={bot.bannerUrl} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" /> : null}
                          <div className="absolute inset-0 bg-black/10" />
                        </div>
                        
                        <div className="flex flex-1 flex-col px-6 pb-6">
                          <div className="-mt-10 flex items-end justify-between gap-4">
                            <div className="rounded-2xl border-4 border-white bg-white dark:border-[#111113] dark:bg-[#111113]">
                              <BotAvatar bot={bot} large />
                            </div>
                            <span
                              className={`mb-2 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${
                                bot.disabled
                                  ? "bg-red-50 text-red-600 ring-1 ring-inset ring-red-500/20 dark:bg-red-500/10 dark:text-red-400"
                                  : "bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
                              }`}
                            >
                              {bot.disabled ? "Desativado" : "Ativo"}
                            </span>
                          </div>
                          
                          <div className="mt-4">
                            <h3 className="truncate text-xl font-black tracking-tight text-zinc-900 dark:text-white">
                              {bot.globalName ?? bot.username}
                            </h3>
                            <p className="truncate text-sm font-medium text-zinc-500 dark:text-zinc-400">@{bot.username}</p>
                          </div>
                          
                          <div className="mt-6 flex flex-1 flex-col justify-end gap-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3.5 transition-colors group-hover:bg-zinc-100/50 dark:border-zinc-800/50 dark:bg-zinc-900/50 dark:group-hover:bg-zinc-900/80">
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Servidores</p>
                                <p className="mt-1.5 flex items-center gap-2 text-base font-bold text-zinc-900 dark:text-white">
                                  <Server size={14} className="text-zinc-400" />
                                  {bot.guilds.length}
                                </p>
                              </div>
                              <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3.5 transition-colors group-hover:bg-zinc-100/50 dark:border-zinc-800/50 dark:bg-zinc-900/50 dark:group-hover:bg-zinc-900/80">
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Client ID</p>
                                <button
                                  type="button"
                                  onClick={() => void copy(bot.id, `id-${bot.id}`)}
                                  className="mt-1.5 flex w-full items-center justify-between gap-2 rounded text-left text-sm font-bold font-mono text-zinc-900 outline-none transition-colors hover:text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-white dark:hover:text-indigo-400"
                                >
                                  <span className="truncate">{bot.id.slice(0, 8)}...</span>
                                  {copied === `id-${bot.id}` ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="text-zinc-400 hover:text-indigo-500" />}
                                </button>
                              </div>
                            </div>
                            
                            <div className="mt-1 grid grid-cols-2 gap-3">
                              <button
                                type="button"
                                disabled={bot.disabled}
                                onClick={() => {
                                  setSelectedBot(bot);
                                  setSelectedGuild("");
                                  setShowInstall(true);
                                }}
                                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-3 text-[13px] font-bold text-white shadow-sm transition-all hover:bg-zinc-800 active:scale-95 disabled:opacity-40 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                              >
                                <Plus size={16} />
                                Instalar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedBot(bot);
                                  setShowRegenerate(true);
                                }}
                                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-[13px] font-bold text-zinc-700 shadow-sm transition-all hover:border-zinc-300 hover:bg-zinc-50 active:scale-95 dark:border-zinc-700 dark:bg-[#111113] dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-white"
                              >
                                <KeyRound size={16} />
                                Token
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col xl:flex-row">
            {/* API Sidebar */}
            <aside className="flex w-full shrink-0 flex-col border-b border-zinc-200 bg-white xl:w-[360px] xl:border-b-0 xl:border-r dark:border-zinc-800 dark:bg-[#111113]">
              <div className="p-6">
                <h2 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">Endpoints</h2>
                <div className="relative mt-4">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    value={apiSearch}
                    onChange={(event) => setApiSearch(event.target.value)}
                    aria-label="Buscar na API"
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm font-medium outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-900/50 dark:focus:border-indigo-500/80 dark:focus:bg-zinc-900 dark:focus:ring-indigo-500/20"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-6">
                <div className="space-y-1.5">
                  {filteredDocs.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`w-full rounded-xl p-3.5 text-left transition-all ${
                        selectedDoc.id === doc.id
                          ? "bg-indigo-50 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/10 dark:ring-indigo-500/20"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-900/80"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm ${methodClasses(doc.method)}`}>
                          {doc.method}
                        </span>
                        <span className="truncate font-mono text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{doc.path}</span>
                      </div>
                      <p className={`mt-2.5 text-[14px] font-bold ${selectedDoc.id === doc.id ? "text-indigo-900 dark:text-indigo-300" : "text-zinc-700 dark:text-zinc-300"}`}>
                        {doc.title}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            {/* API Content */}
            <section className="flex-1 overflow-y-auto bg-zinc-50/50 dark:bg-[#09090b]">
              <div className="mx-auto max-w-4xl p-6 sm:p-8 lg:p-12">
                <div className="overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-sm dark:border-zinc-800/80 dark:bg-[#111113]">
                  <div className="border-b border-zinc-100 p-6 sm:p-8 dark:border-zinc-800/80">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-widest shadow-sm ${methodClasses(selectedDoc.method)}`}>
                        {selectedDoc.method}
                      </span>
                      <code className="rounded-lg bg-zinc-100 px-3 py-1.5 font-mono text-sm font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                        {selectedDoc.path}
                      </code>
                    </div>
                    <h1 className="mt-6 text-3xl font-black tracking-tight text-zinc-900 dark:text-white">{selectedDoc.title}</h1>
                    <p className="mt-3 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">{selectedDoc.description}</p>
                  </div>

                  <div className="p-6 sm:p-8 space-y-8">
                    {/* Auth Section */}
                    <div>
                      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-zinc-900 dark:text-white">
                        <LockKeyhole size={16} className="text-indigo-500" />
                        Autenticação
                      </h2>
                      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Requer o envio do Bot Token no cabeçalho da requisição.</p>
                      <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-1 pl-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                        <code className="overflow-x-auto whitespace-nowrap font-mono text-xs font-medium text-zinc-800 dark:text-zinc-300">
                          <span className="text-indigo-600 dark:text-indigo-400">Authorization:</span> Bot {"<token>"}
                        </code>
                        <button
                          type="button"
                          onClick={() => void copy("Authorization: Bot <token>", "auth")}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-white"
                        >
                          {copied === "auth" ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Request Body */}
                    {selectedDoc.request && (
                      <div>
                        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-900 dark:text-white">Request Body</h2>
                        <div className="group relative mt-3 overflow-hidden rounded-xl border border-zinc-800 bg-[#0d0e10] shadow-inner">
                          <div className="flex items-center justify-between border-b border-zinc-800/80 bg-[#16171a] px-4 py-2">
                            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400">application/json</span>
                            <button
                              type="button"
                              onClick={() => void copy(selectedDoc.request!, "request")}
                              className="text-zinc-500 hover:text-zinc-300"
                            >
                              {copied === "request" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            </button>
                          </div>
                          <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-zinc-300">
                            <code>{selectedDoc.request}</code>
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Response */}
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-900 dark:text-white">Response</h2>
                      <div className="group relative mt-3 overflow-hidden rounded-xl border border-zinc-800 bg-[#0d0e10] shadow-inner">
                        <div className="flex items-center justify-between border-b border-zinc-800/80 bg-[#16171a] px-4 py-2">
                          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-500">200 OK</span>
                          <button
                            type="button"
                            onClick={() => void copy(selectedDoc.response, "response")}
                            className="text-zinc-500 hover:text-zinc-300"
                          >
                            {copied === "response" ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                        </div>
                        <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-zinc-300">
                          <code>{selectedDoc.response}</code>
                        </pre>
                      </div>
                    </div>

                    {/* Notes */}
                    {selectedDoc.notes?.length ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/20 dark:bg-amber-500/10">
                        <div className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-400">
                          <AlertTriangle size={18} />
                          Observações Importantes
                        </div>
                        <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-amber-900/80 dark:text-amber-200/80">
                          {selectedDoc.notes.map((note, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 dark:bg-amber-500/50" />
                              <span>{note}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* CREATE BOT MODAL */}
      <Dialog open={showCreate} onClose={() => !creating && setShowCreate(false)} closeOnBackdrop={!creating} width="max-w-2xl">
        <DialogHeader
          title="Nova Aplicação"
          description="Crie a identidade do bot. Você receberá o token de acesso logo em seguida."
          icon={<Bot size={22} />}
          onClose={() => setShowCreate(false)}
          disabled={creating}
        />
        <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="grid gap-8 sm:grid-cols-[140px_1fr]">
            <div className="flex flex-col items-center gap-3">
              <div className="group relative flex h-[140px] w-[140px] items-center justify-center overflow-hidden rounded-[32px] bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-500/20">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                ) : (
                  <Bot size={48} strokeWidth={1.5} />
                )}
                <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-[32px]" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Preview</p>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-bold text-zinc-900 dark:text-white">Nome da Aplicação</label>
                <input
                  value={botName}
                  onChange={(event) => setBotName(event.target.value)}
                  maxLength={32}
                  autoFocus
                  className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:focus:border-indigo-500/80 dark:focus:ring-indigo-500/20"
                  aria-label="Nome da aplicação"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-zinc-900 dark:text-white">URL do Avatar <span className="text-xs font-normal text-zinc-500">(Opcional)</span></label>
                <input
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                  className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:focus:border-indigo-500/80 dark:focus:ring-indigo-500/20"
                  aria-label="URL do avatar"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-zinc-900 dark:text-white">URL do Banner <span className="text-xs font-normal text-zinc-500">(Opcional)</span></label>
                <input
                  value={bannerUrl}
                  onChange={(event) => setBannerUrl(event.target.value)}
                  className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 shadow-sm outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:focus:border-indigo-500/80 dark:focus:ring-indigo-500/20"
                  aria-label="URL do banner"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-zinc-100 bg-zinc-50/50 px-6 py-5 dark:border-zinc-800/80 dark:bg-zinc-900/50">
          <button
            type="button"
            disabled={creating}
            onClick={() => setShowCreate(false)}
            className="h-11 rounded-xl px-5 text-sm font-bold text-zinc-600 transition-colors hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={creating || botName.trim().length < 2}
            onClick={() => void createBot()}
            className="flex h-11 min-w-[120px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-bold text-white shadow-md shadow-indigo-500/20 transition-all hover:bg-indigo-500 active:scale-95 disabled:pointer-events-none disabled:opacity-50 dark:shadow-indigo-900/20"
          >
            {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            Criar Bot
          </button>
        </div>
      </Dialog>

      {/* INSTALL BOT MODAL */}
      <Dialog open={showInstall} onClose={() => !installing && setShowInstall(false)} closeOnBackdrop={!installing}>
        <DialogHeader
          title="Adicionar ao Servidor"
          description={selectedBot ? `Selecione um servidor para instalar o @${selectedBot.username}` : undefined}
          icon={<Server size={22} />}
          onClose={() => setShowInstall(false)}
          disabled={installing}
        />
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {availableGuilds.length > 0 ? (
            <div className="space-y-3">
              {availableGuilds.map((guild) => (
                <button
                  key={guild.id}
                  type="button"
                  onClick={() => setSelectedGuild(guild.id)}
                  className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 ${
                    selectedGuild === guild.id
                      ? "border-indigo-500 bg-indigo-50/50 shadow-sm ring-1 ring-inset ring-indigo-500 dark:bg-indigo-500/10"
                      : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-[#111113] dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
                  }`}
                >
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl text-lg font-bold shadow-sm transition-transform group-hover:scale-105 ${selectedGuild === guild.id ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                    {guild.iconUrl ? <img src={guild.iconUrl} alt="" className="h-full w-full object-cover" /> : guild.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className={`min-w-0 flex-1 truncate text-base font-bold ${selectedGuild === guild.id ? "text-indigo-900 dark:text-indigo-100" : "text-zinc-900 dark:text-white"}`}>{guild.name}</span>
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${selectedGuild === guild.id ? "bg-indigo-500 text-white" : "text-zinc-300 dark:text-zinc-600"}`}>
                    {selectedGuild === guild.id ? <Check size={14} strokeWidth={3} /> : <ChevronRight size={16} />}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-10 text-center dark:border-zinc-800 dark:bg-zinc-900/20">
              <Server size={32} className="text-zinc-400" />
              <p className="mt-4 text-[15px] font-bold text-zinc-900 dark:text-white">Nenhum servidor disponível</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Você já instalou este bot em todos os servidores permitidos ou não possui servidores.</p>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-zinc-100 bg-zinc-50/50 px-6 py-5 dark:border-zinc-800/80 dark:bg-zinc-900/50">
          <button
            type="button"
            disabled={installing}
            onClick={() => setShowInstall(false)}
            className="h-11 rounded-xl px-5 text-sm font-bold text-zinc-600 transition-colors hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={installing || !selectedGuild}
            onClick={() => void installBot()}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-bold text-white shadow-md shadow-indigo-500/20 transition-all hover:bg-indigo-500 active:scale-95 disabled:pointer-events-none disabled:opacity-50 dark:shadow-indigo-900/20"
          >
            {installing ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            Adicionar ao Servidor
          </button>
        </div>
      </Dialog>

      {/* REGENERATE TOKEN MODAL */}
      <Dialog open={showRegenerate} onClose={() => !regenerating && setShowRegenerate(false)} closeOnBackdrop={!regenerating}>
        <DialogHeader
          title="Regenerar Token"
          description="Atenção: Esta ação é irreversível."
          icon={<AlertTriangle size={22} className="text-red-500 dark:text-red-400" />}
          onClose={() => setShowRegenerate(false)}
          disabled={regenerating}
        />
        <div className="p-6">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10">
            <p className="text-[15px] font-semibold leading-relaxed text-red-900 dark:text-red-200">
              O token atual deixará de funcionar imediatamente. Todas as conexões ativas do Gateway usando este token serão desconectadas. Você precisará atualizar suas variáveis de ambiente no código fonte do bot.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-zinc-100 bg-zinc-50/50 px-6 py-5 dark:border-zinc-800/80 dark:bg-zinc-900/50">
          <button
            type="button"
            disabled={regenerating}
            onClick={() => setShowRegenerate(false)}
            className="h-11 rounded-xl px-5 text-sm font-bold text-zinc-600 transition-colors hover:bg-zinc-200/50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={regenerating}
            onClick={() => void regenerateToken()}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-6 text-sm font-bold text-white shadow-md shadow-red-500/20 transition-all hover:bg-red-500 active:scale-95 disabled:pointer-events-none disabled:opacity-50 dark:shadow-red-900/20"
          >
            {regenerating ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
            Regenerar Token
          </button>
        </div>
      </Dialog>

      {/* SHOW TOKEN MODAL */}
      <Dialog
        open={showToken && Boolean(token)}
        onClose={() => {
          setShowToken(false);
          setToken(null);
          setTokenVisible(false);
        }}
        closeOnBackdrop={false}
        width="max-w-2xl"
      >
        <DialogHeader
          title="Seu Novo Token"
          description="Armazene esta chave com segurança. Ela só será exibida esta vez."
          icon={<KeyRound size={22} />}
          onClose={() => {
            setShowToken(false);
            setToken(null);
            setTokenVisible(false);
          }}
        />
        <div className="p-6 sm:p-8">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[14px] font-semibold text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
            <span className="flex items-center gap-2 font-bold mb-1"><AlertTriangle size={16} /> Alerta de Segurança</span>
            Nunca compartilhe ou suba este token para o GitHub no lado do cliente. Alguém com este token pode controlar o bot.
          </div>
          
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <input
                readOnly
                type={tokenVisible ? "text" : "password"}
                value={token ?? ""}
                className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 pr-12 font-mono text-sm font-medium text-zinc-900 shadow-sm outline-none dark:border-zinc-800 dark:bg-[#09090b] dark:text-white"
              />
              <button
                type="button"
                onClick={() => setTokenVisible((value) => !value)}
                className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
              >
                {tokenVisible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => token && void copy(token, "token")}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-sm font-bold text-white shadow-md shadow-indigo-500/20 transition-all hover:bg-indigo-500 active:scale-95 dark:shadow-indigo-900/20"
            >
              {copied === "token" ? <Check size={18} /> : <Copy size={18} />}
              Copiar Token
            </button>
          </div>

          <div className="mt-8 rounded-xl border border-zinc-800 bg-[#0d0e10] p-5 shadow-inner">
            <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-widest text-zinc-400">
              <div className="flex items-center gap-2"><Terminal size={14} /> .env.local</div>
            </div>
            <code className="font-mono text-[13px] text-zinc-300">
              <span className="text-indigo-400">TYPECORD_TOKEN</span>={tokenVisible ? token : "••••••••••••••••••••••••••••••••••••••••"}
            </code>
          </div>
        </div>
      </Dialog>

      {/* TOASTS */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] w-[calc(100%-48px)] max-w-[380px] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="flex items-start gap-4 rounded-2xl border border-zinc-200/50 bg-white/90 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
              toast.type === "error" ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400" :
              toast.type === "info" ? "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400" :
              "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
            }`}>
              {toast.type === "error" ? <AlertTriangle size={16} strokeWidth={2.5} /> :
               toast.type === "info" ? <ExternalLink size={16} strokeWidth={2.5} /> :
               <Check size={16} strokeWidth={2.5} />}
            </div>
            <p className="min-w-0 flex-1 pt-1 text-[14px] font-semibold leading-relaxed text-zinc-900 dark:text-white">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-zinc-400 transition-colors hover:text-zinc-900 dark:hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
