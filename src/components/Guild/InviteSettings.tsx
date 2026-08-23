"use client";

import {
  Check,
  Clock,
  Copy,
  Link,
  Loader2,
  Plus,
  Trash2,
  Users,
} from "lucide-react";

import { useEffect, useState } from "react";

import {
  createGuildInvite,
  deleteGuildInvite,
  getGuildInvites,
} from "@/actions/invites";

type Invite = {
  id: string;
  code: string;
  uses: number;
  maxUses: number;
  expiresAt: Date | string | null;
  createdAt: Date | string;

  creator?: {
    id: string;
    username: string;
    globalName: string | null;
    avatarUrl: string | null;
  } | null;
};

export default function InvitesSettings({
  guild,
}: {
  guild: any;
}) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [expires, setExpires] = useState("0");
  const [maxUses, setMaxUses] = useState("0");

  async function load() {
    try {
      setLoading(true);

      const result = await getGuildInvites(guild.id);

      setInvites(result as Invite[]);
    } catch (error: any) {
      alert(error.message || "Não foi possível carregar os convites.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [guild.id]);

  async function createInvite() {
    try {
      setCreating(true);

      const invite = await createGuildInvite(guild.id, {
        maxUses: Number(maxUses),
        expiresIn: Number(expires) || null,
      });

      setInvites((current) => [invite as Invite, ...current]);

      setExpires("0");
      setMaxUses("0");
    } catch (error: any) {
      alert(error.message || "Não foi possível criar o convite.");
    } finally {
      setCreating(false);
    }
  }

  async function removeInvite(invite: Invite) {
    if (
      !confirm(
        `Revogar o convite ${invite.code}?`
      )
    ) {
      return;
    }

    try {
      await deleteGuildInvite(
        guild.id,
        invite.id
      );

      setInvites((current) =>
        current.filter(
          (item) => item.id !== invite.id
        )
      );
    } catch (error: any) {
      alert(error.message || "Não foi possível revogar o convite.");
    }
  }

  async function copyInvite(code: string) {
    const url = `${window.location.origin}/invite/${code}`;

    await navigator.clipboard.writeText(url);

    setCopied(code);

    setTimeout(() => {
      setCopied(null);
    }, 1500);
  }

  function formatExpiration(date: Date | string | null) {
    if (!date) {
      return "Nunca";
    }

    const expiration = new Date(date);

    if (expiration.getTime() <= Date.now()) {
      return "Expirado";
    }

    return expiration.toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  }

  function isExpired(invite: Invite) {
    return (
      invite.expiresAt !== null &&
      new Date(invite.expiresAt).getTime() <= Date.now()
    );
  }

  function isMaxed(invite: Invite) {
    return (
      invite.maxUses > 0 &&
      invite.uses >= invite.maxUses
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
            <Link size={20} />
          </div>

          <div>
            <h2 className="text-xl font-bold">
              Convites
            </h2>

            <p className="text-sm text-zinc-500">
              Crie links para convidar pessoas para este servidor.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-[#18191c]">
        <div className="mb-4">
          <h3 className="font-semibold">
            Criar um novo convite
          </h3>

          <p className="mt-1 text-sm text-zinc-500">
            Configure a duração e o número máximo de utilizações.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-zinc-500">
              Expirar depois de
            </label>

            <select
              value={expires}
              onChange={(e) =>
                setExpires(e.target.value)
              }
              className="h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none transition focus:border-indigo-500 dark:border-zinc-700 dark:bg-[#111214]"
            >
              <option value="0">
                Nunca
              </option>

              <option value="1800">
                30 minutos
              </option>

              <option value="3600">
                1 hora
              </option>

              <option value="21600">
                6 horas
              </option>

              <option value="43200">
                12 horas
              </option>

              <option value="86400">
                1 dia
              </option>

              <option value="604800">
                7 dias
              </option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-zinc-500">
              Número de utilizações
            </label>

            <select
              value={maxUses}
              onChange={(e) =>
                setMaxUses(e.target.value)
              }
              className="h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none transition focus:border-indigo-500 dark:border-zinc-700 dark:bg-[#111214]"
            >
              <option value="0">
                Ilimitado
              </option>

              <option value="1">
                1 utilização
              </option>

              <option value="5">
                5 utilizações
              </option>

              <option value="10">
                10 utilizações
              </option>

              <option value="25">
                25 utilizações
              </option>

              <option value="50">
                50 utilizações
              </option>

              <option value="100">
                100 utilizações
              </option>
            </select>
          </div>
        </div>

        <button
          disabled={creating}
          onClick={createInvite}
          className="mt-5 flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating ? (
            <Loader2
              size={16}
              className="animate-spin"
            />
          ) : (
            <Plus size={16} />
          )}

          Criar convite
        </button>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">
            Convites existentes
          </h3>

          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
            title="Atualizar"
          >
            <Clock
              size={16}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border dark:border-zinc-800">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2
                className="animate-spin text-zinc-500"
                size={24}
              />
            </div>
          ) : invites.length === 0 ? (
            <div className="flex min-h-40 flex-col items-center justify-center p-6 text-center">
              <Link
                size={28}
                className="mb-3 text-zinc-500"
              />

              <p className="font-medium">
                Nenhum convite ativo
              </p>

              <p className="mt-1 text-sm text-zinc-500">
                Crie um convite para começar.
              </p>
            </div>
          ) : (
            <div className="divide-y dark:divide-zinc-800">
              {invites.map((invite) => {
                const expired =
                  isExpired(invite);

                const maxed =
                  isMaxed(invite);

                const disabled =
                  expired || maxed;

                return (
                  <div
                    key={invite.id}
                    className="flex items-center gap-4 p-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
                      <Link size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-sm font-semibold">
                          {invite.code}
                        </code>

                        {disabled && (
                          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-red-500">
                            {expired
                              ? "Expirado"
                              : "Esgotado"}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                          <Users size={13} />

                          {invite.uses}
                          {invite.maxUses > 0
                            ? `/${invite.maxUses}`
                            : " usos"}
                        </span>

                        <span className="flex items-center gap-1">
                          <Clock size={13} />

                          {formatExpiration(
                            invite.expiresAt
                          )}
                        </span>

                        {invite.creator && (
                          <span>
                            criado por{" "}
                            {invite.creator.globalName ||
                              invite.creator.username}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      disabled={disabled}
                      onClick={() =>
                        copyInvite(invite.code)
                      }
                      className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900 disabled:opacity-30 dark:hover:bg-zinc-800 dark:hover:text-white"
                      title="Copiar convite"
                    >
                      {copied === invite.code ? (
                        <Check
                          size={17}
                          className="text-emerald-500"
                        />
                      ) : (
                        <Copy size={17} />
                      )}
                    </button>

                    <button
                      onClick={() =>
                        removeInvite(invite)
                      }
                      className="rounded-lg p-2 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-500"
                      title="Revogar convite"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}