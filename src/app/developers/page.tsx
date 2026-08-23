"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  Plus,
  Copy,
  Check,
  RefreshCw,
  Server,
  KeyRound,
  X,
  Shield,
  Image as ImageIcon,
  Link as LinkIcon,
} from "lucide-react";

interface BotData {
  id: string;
  userId: string;
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  disabled: boolean;
  createdAt: string;

  guilds: {
    id: string;
    name: string;
    iconUrl: string | null;
  }[];
}

interface GuildData {
  id: string;
  name: string;
  iconUrl: string | null;
}

export default function DevelopersPage() {
  const [bots, setBots] = useState<BotData[]>([]);
  const [guilds, setGuilds] = useState<GuildData[]>([]);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [showCreate, setShowCreate] = useState(false);

  const [selectedBot, setSelectedBot] =
    useState<BotData | null>(null);

  const [showToken, setShowToken] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const [copied, setCopied] = useState(false);

  const [botName, setBotName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");

  const [selectedGuild, setSelectedGuild] = useState("");

  const [installing, setInstalling] = useState(false);

  async function load() {
    try {
      setLoading(true);

      const response = await fetch(
        "/api/developers/bots",
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ??
            "Não foi possível carregar os bots.",
        );
      }

      setBots(
        Array.isArray(data.bots)
          ? data.bots
          : [],
      );

      setGuilds(
        Array.isArray(data.guilds)
          ? data.guilds
          : [],
      );
    } catch (error) {
      console.error(
        "[DEVELOPERS_LOAD]",
        error,
      );

      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os bots.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createBot() {
    const username = botName.trim();

    if (!username) {
      return;
    }

    try {
      setCreating(true);

      const response = await fetch(
        "/api/developers/bots",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            username,

            avatarUrl:
              avatarUrl.trim() || null,

            bannerUrl:
              bannerUrl.trim() || null,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ??
            "Erro ao criar bot.",
        );
      }

      /*
       * O backend já deve devolver o bot
       * completo, incluindo guilds.
       */
      setBots((current) => [
        data.bot,
        ...current,
      ]);

      setToken(data.token);

      setShowCreate(false);
      setShowToken(true);

      setBotName("");
      setAvatarUrl("");
      setBannerUrl("");

      /*
       * Recarrega os dados do servidor para
       * garantir que ownerId/guilds estejam
       * sincronizados com o banco.
       */
      await load();
    } catch (error) {
      console.error(
        "[DEVELOPERS_CREATE_BOT]",
        error,
      );

      alert(
        error instanceof Error
          ? error.message
          : "Erro ao criar bot.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function regenerateToken(
    bot: BotData,
  ) {
    const confirmed = window.confirm(
      "O token atual deixará de funcionar. Deseja gerar um novo token?",
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/developers/bots/${bot.id}/token`,
        {
          method: "POST",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ??
            "Erro ao gerar token.",
        );
      }

      setToken(data.token);
      setSelectedBot(bot);
      setShowToken(true);
    } catch (error) {
      console.error(
        "[DEVELOPERS_REGENERATE_TOKEN]",
        error,
      );

      alert(
        error instanceof Error
          ? error.message
          : "Erro ao gerar token.",
      );
    }
  }

  async function installBot() {
    if (
      !selectedBot ||
      !selectedGuild
    ) {
      return;
    }

    /*
     * Segurança adicional no frontend.
     * O backend também PRECISA validar isso.
     */
    const alreadyInstalled =
      selectedBot.guilds.some(
        (guild) =>
          guild.id === selectedGuild,
      );

    if (alreadyInstalled) {
      alert(
        "Este bot já está instalado neste servidor.",
      );

      return;
    }

    try {
      setInstalling(true);

      const response = await fetch(
        `/api/developers/bots/${selectedBot.id}/install`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            guildId: selectedGuild,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ??
            "Erro ao adicionar bot.",
        );
      }

      /*
       * Atualiza a lista local imediatamente.
       */
      setBots((current) =>
        current.map((bot) => {
          if (bot.id !== selectedBot.id) {
            return bot;
          }

          const alreadyExists =
            bot.guilds.some(
              (guild) =>
                guild.id ===
                data.guild.id,
            );

          if (alreadyExists) {
            return bot;
          }

          return {
            ...bot,
            guilds: [
              ...bot.guilds,
              data.guild,
            ],
          };
        }),
      );

      /*
       * Atualiza o bot selecionado.
       */
      setSelectedBot((current) => {
        if (!current) {
          return null;
        }

        const alreadyExists =
          current.guilds.some(
            (guild) =>
              guild.id ===
              data.guild.id,
          );

        if (alreadyExists) {
          return current;
        }

        return {
          ...current,
          guilds: [
            ...current.guilds,
            data.guild,
          ],
        };
      });

      setSelectedGuild("");

      alert(
        "Bot adicionado ao servidor!",
      );

      /*
       * Sincroniza novamente com o banco.
       */
      await load();
    } catch (error) {
      console.error(
        "[DEVELOPERS_INSTALL_BOT]",
        error,
      );

      alert(
        error instanceof Error
          ? error.message
          : "Erro ao adicionar bot.",
      );
    } finally {
      setInstalling(false);
    }
  }

  async function copyToken() {
    if (!token) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        token,
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error(
        "[COPY_TOKEN]",
        error,
      );
    }
  }

  function resetCreateModal() {
    setShowCreate(false);

    setBotName("");
    setAvatarUrl("");
    setBannerUrl("");
  }

  function openInstallModal(bot: BotData) {
    setSelectedBot(bot);
    setSelectedGuild("");
  }

  function closeInstallModal() {
    if (installing) {
      return;
    }

    setSelectedBot(null);
    setSelectedGuild("");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#313338] text-white">
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <RefreshCw
            size={18}
            className="animate-spin"
          />

          Carregando...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#313338] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* HEADER */}
        <div className="mb-10 flex items-start justify-between gap-6">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <Bot size={30} />

              <h1 className="text-3xl font-bold">
                Desenvolvedores
              </h1>
            </div>

            <p className="text-zinc-400">
              Crie e gerencie os bots da sua
              aplicação Typecord.
            </p>
          </div>

          <button
            onClick={() =>
              setShowCreate(true)
            }
            className="flex shrink-0 items-center gap-2 rounded-md bg-[#5865f2] px-4 py-2.5 text-sm font-semibold transition hover:bg-[#4752c4]"
          >
            <Plus size={18} />

            Criar bot
          </button>
        </div>

        {/* EMPTY STATE */}
        {bots.length === 0 ? (
          <div className="rounded-lg border border-[#3f4147] bg-[#2b2d31] p-12 text-center">
            <Bot
              size={48}
              className="mx-auto mb-4 text-zinc-500"
            />

            <h2 className="mb-2 text-xl font-semibold">
              Você ainda não possui bots
            </h2>

            <p className="mb-6 text-sm text-zinc-400">
              Crie seu primeiro bot para
              começar a usar a API do
              Typecord.
            </p>

            <button
              onClick={() =>
                setShowCreate(true)
              }
              className="rounded-md bg-[#5865f2] px-5 py-2.5 text-sm font-semibold hover:bg-[#4752c4]"
            >
              Criar meu primeiro bot
            </button>
          </div>
        ) : (
          /* BOTS */
          <div className="grid gap-4 md:grid-cols-2">
            {bots.map((bot) => (
              <div
                key={bot.id}
                className="overflow-hidden rounded-lg border border-[#3f4147] bg-[#2b2d31]"
              >
                {/* BANNER */}
                <div className="relative h-24 overflow-hidden bg-[#1e1f22]">
                  {bot.bannerUrl ? (
                    <img
                      src={bot.bannerUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-r from-[#5865f2] to-[#7289da]" />
                  )}
                </div>

                <div className="p-5">
                  {/* BOT HEADER */}
                  <div className="-mt-12 mb-5 flex items-end gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-[#2b2d31] bg-[#5865f2]">
                      {bot.avatarUrl ? (
                        <img
                          src={bot.avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Bot size={28} />
                      )}
                    </div>

                    <div className="min-w-0 pb-1">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-lg font-bold">
                          {bot.globalName ??
                            bot.username}
                        </h2>

                        <span className="rounded bg-[#3ba55d]/20 px-2 py-1 text-[10px] font-bold text-[#57f287]">
                          BOT
                        </span>
                      </div>

                      <p className="truncate text-sm text-zinc-400">
                        @{bot.username}
                      </p>
                    </div>
                  </div>

                  {/* INFO */}
                  <div className="mb-5 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Server size={16} />

                      <span>
                        {bot.guilds.length}{" "}
                        servidor
                        {bot.guilds.length !==
                        1
                          ? "es"
                          : ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-zinc-400">
                      <Shield size={16} />

                      <span className="truncate">
                        ID: {bot.id}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-zinc-400">
                      <Bot size={16} />

                      <span className="truncate">
                        User ID: {bot.userId}
                      </span>
                    </div>
                  </div>

                  {/* ACTIONS */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() =>
                        openInstallModal(bot)
                      }
                      className="flex items-center gap-2 rounded-md bg-[#404249] px-3 py-2 text-sm font-medium hover:bg-[#4b4d53]"
                    >
                      <Server size={16} />

                      Adicionar ao servidor
                    </button>

                    <button
                      onClick={() =>
                        regenerateToken(bot)
                      }
                      className="flex items-center gap-2 rounded-md bg-[#404249] px-3 py-2 text-sm font-medium hover:bg-[#4b4d53]"
                    >
                      <KeyRound size={16} />

                      Gerar token
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================================================== */}
      {/* CREATE BOT MODAL */}
      {/* ================================================== */}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-lg bg-[#2b2d31] shadow-2xl">
            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-[#3f4147] p-5">
              <div>
                <h2 className="text-xl font-bold">
                  Criar bot
                </h2>

                <p className="mt-1 text-xs text-zinc-400">
                  Configure a identidade do
                  seu bot.
                </p>
              </div>

              <button
                onClick={resetCreateModal}
                disabled={creating}
                className="text-zinc-400 hover:text-white disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            {/* BODY */}
            <div className="space-y-5 p-5">
              {/* AVATAR PREVIEW */}
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#5865f2]">
                  {avatarUrl.trim() ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display =
                          "none";
                      }}
                    />
                  ) : (
                    <Bot size={32} />
                  )}
                </div>

                <div>
                  <p className="font-semibold">
                    Avatar do bot
                  </p>

                  <p className="text-xs text-zinc-500">
                    URL pública da imagem.
                  </p>
                </div>
              </div>

              {/* NAME */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Nome do bot
                </label>

                <input
                  value={botName}
                  onChange={(event) =>
                    setBotName(
                      event.target.value,
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter"
                    ) {
                      createBot();
                    }
                  }}
                  placeholder="Meu Bot"
                  maxLength={32}
                  autoFocus
                  className="w-full rounded-md bg-[#1e1f22] px-3 py-2.5 text-sm outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-[#5865f2]"
                />

                <p className="mt-1 text-xs text-zinc-500">
                  Entre 2 e 32 caracteres.
                </p>
              </div>

              {/* AVATAR URL */}
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <ImageIcon size={15} />

                  URL do avatar
                </label>

                <div className="relative">
                  <LinkIcon
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  />

                  <input
                    value={avatarUrl}
                    onChange={(event) =>
                      setAvatarUrl(
                        event.target.value,
                      )
                    }
                    placeholder="https://exemplo.com/avatar.png"
                    className="w-full rounded-md bg-[#1e1f22] py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-[#5865f2]"
                  />
                </div>
              </div>

              {/* BANNER URL */}
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <ImageIcon size={15} />

                  URL do banner
                </label>

                <div className="relative">
                  <LinkIcon
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  />

                  <input
                    value={bannerUrl}
                    onChange={(event) =>
                      setBannerUrl(
                        event.target.value,
                      )
                    }
                    placeholder="https://exemplo.com/banner.png"
                    className="w-full rounded-md bg-[#1e1f22] py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-[#5865f2]"
                  />
                </div>

                {bannerUrl.trim() && (
                  <div className="mt-3 h-24 overflow-hidden rounded-md bg-[#1e1f22]">
                    <img
                      src={bannerUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display =
                          "none";
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="rounded-md bg-[#1e1f22] p-3 text-xs text-zinc-400">
                O bot será criado como um
                usuário especial do Typecord e
                ficará vinculado à sua conta como
                proprietário.
              </div>
            </div>

            {/* FOOTER */}
            <div className="flex justify-end gap-2 border-t border-[#3f4147] p-5">
              <button
                onClick={resetCreateModal}
                disabled={creating}
                className="rounded-md px-4 py-2 text-sm hover:bg-[#404249] disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                disabled={
                  creating ||
                  botName.trim().length < 2
                }
                onClick={createBot}
                className="rounded-md bg-[#5865f2] px-4 py-2 text-sm font-semibold hover:bg-[#4752c4] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating
                  ? "Criando..."
                  : "Criar bot"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* TOKEN MODAL */}
      {/* ================================================== */}

      {showToken && token && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-lg bg-[#2b2d31] shadow-2xl">
            <div className="border-b border-[#3f4147] p-5">
              <div className="flex items-center gap-3">
                <KeyRound
                  size={24}
                  className="text-[#faa61a]"
                />

                <div>
                  <h2 className="font-bold">
                    Token do bot
                  </h2>

                  <p className="text-xs text-zinc-400">
                    Guarde este token em
                    segurança.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5">
              <div className="rounded-md border border-[#faa61a]/40 bg-[#faa61a]/10 p-4 text-sm text-[#ffd27a]">
                ⚠️ Nunca compartilhe o token.
                Ele permite que um programa
                controle este bot.
              </div>

              <div className="mt-4 flex items-center gap-2">
                <input
                  readOnly
                  value={token}
                  className="min-w-0 flex-1 rounded-md bg-[#1e1f22] px-3 py-3 font-mono text-xs text-zinc-300 outline-none"
                />

                <button
                  onClick={copyToken}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#5865f2] hover:bg-[#4752c4]"
                >
                  {copied ? (
                    <Check size={18} />
                  ) : (
                    <Copy size={18} />
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end border-t border-[#3f4147] p-5">
              <button
                onClick={() => {
                  setShowToken(false);
                  setToken(null);
                  setCopied(false);
                }}
                className="rounded-md bg-[#5865f2] px-5 py-2 text-sm font-semibold hover:bg-[#4752c4]"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* INSTALL BOT MODAL */}
      {/* ================================================== */}

      {selectedBot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-lg bg-[#2b2d31] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#3f4147] p-5">
              <div>
                <h2 className="text-xl font-bold">
                  Adicionar bot
                </h2>

                <p className="text-sm text-zinc-400">
                  {selectedBot.username}
                </p>
              </div>

              <button
                onClick={closeInstallModal}
                disabled={installing}
                className="text-zinc-400 hover:text-white disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              <label className="mb-2 block text-sm font-semibold">
                Servidor
              </label>

              <select
                value={selectedGuild}
                onChange={(event) =>
                  setSelectedGuild(
                    event.target.value,
                  )
                }
                disabled={installing}
                className="w-full rounded-md bg-[#1e1f22] px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-[#5865f2]"
              >
                <option value="">
                  Selecione um servidor
                </option>

                {guilds
                  .filter(
                    (guild) =>
                      !selectedBot.guilds.some(
                        (installed) =>
                          installed.id ===
                          guild.id,
                      ),
                  )
                  .map((guild) => (
                    <option
                      key={guild.id}
                      value={guild.id}
                    >
                      {guild.name}
                    </option>
                  ))}
              </select>

              {guilds.filter(
                (guild) =>
                  !selectedBot.guilds.some(
                    (installed) =>
                      installed.id ===
                      guild.id,
                  ),
              ).length === 0 && (
                <p className="mt-3 text-sm text-zinc-500">
                  Este bot já está instalado em
                  todos os servidores disponíveis
                  para você.
                </p>
              )}

              <div className="mt-4 rounded-md bg-[#1e1f22] p-3 text-xs text-zinc-400">
                O bot será adicionado como membro
                deste servidor. A API também
                verificará se você possui
                permissão para adicionar o bot.
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#3f4147] p-5">
              <button
                onClick={closeInstallModal}
                disabled={installing}
                className="rounded-md px-4 py-2 text-sm hover:bg-[#404249] disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                disabled={
                  installing ||
                  !selectedGuild
                }
                onClick={installBot}
                className="rounded-md bg-[#5865f2] px-4 py-2 text-sm font-semibold hover:bg-[#4752c4] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {installing
                  ? "Adicionando..."
                  : "Adicionar bot"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}