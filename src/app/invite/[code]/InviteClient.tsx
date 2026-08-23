"use client";

import {
  AlertCircle,
  Check,
  Hash,
  Loader2,
  Users,
} from "lucide-react";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { acceptGuildInvite } from "@/actions/invites";

type Props = {
  status:
    | "valid"
    | "not_found"
    | "expired"
    | "exhausted";

  code: string;

  alreadyMember?: boolean;

  guild?: {
    id: string;
    name: string;
    iconUrl: string | null;
    bannerUrl: string | null;
  };
};

export default function InviteClient({
  status,
  code,
  alreadyMember = false,
  guild,
}: Props) {
  const router = useRouter();

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function accept() {
    try {
      setLoading(true);
      setError(null);

      const result =
        await acceptGuildInvite(code);

      router.push(
        `/channels/${result.guildId}`
      );

      router.refresh();
    } catch (err: any) {
      const message = err?.message;

      if (message === "AUTH_REQUIRED") {
        router.push(
          `/login?redirect=/invite/${encodeURIComponent(code)}`
        );
        return;
      }

      if (message === "INVITE_NOT_FOUND") {
        setError("Esse convite não existe.");
        return;
      }

      if (message === "INVITE_EXPIRED") {
        setError("Esse convite expirou.");
        return;
      }

      if (message === "INVITE_EXHAUSTED") {
        setError(
          "Esse convite atingiu o limite de utilizações."
        );
        return;
      }

      if (
        message === "DEFAULT_ROLE_NOT_FOUND"
      ) {
        setError(
          "Não foi possível configurar sua entrada no servidor."
        );
        return;
      }

      setError(
        "Não foi possível entrar no servidor."
      );
    } finally {
      setLoading(false);
    }
  }

  if (status !== "valid") {
    const title =
      status === "expired"
        ? "Convite expirado"
        : status === "exhausted"
          ? "Convite esgotado"
          : "Convite inválido";

    const description =
      status === "expired"
        ? "Esse convite não é mais válido."
        : status === "exhausted"
          ? "Esse convite já atingiu o limite de utilizações."
          : "Esse convite não existe ou foi revogado.";

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0d0f] p-6 text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111315] p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-400">
            <AlertCircle size={30} />
          </div>

          <h1 className="text-xl font-bold">
            {title}
          </h1>

          <p className="mt-2 text-sm text-zinc-400">
            {description}
          </p>

          <button
            onClick={() => router.push("/channels/@me")}
            className="mt-6 h-11 w-full rounded-lg bg-indigo-600 font-semibold transition hover:bg-indigo-500"
          >
            Voltar para o Typecord
          </button>
        </div>
      </main>
    );
  }

  if (!guild) {
    return null;
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0d0f] p-6 text-white">
      {guild.bannerUrl && (
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-20 blur-2xl"
          style={{
            backgroundImage: `url("${guild.bannerUrl}")`,
          }}
        />
      )}

      <div className="relative w-full max-w-[440px]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#111315] shadow-2xl">
          <div className="h-32 overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-700">
            {guild.bannerUrl && (
              <img
                src={guild.bannerUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            )}
          </div>

          <div className="relative px-7 pb-7">
            <div className="-mt-12 mb-5">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border-8 border-[#111315] bg-[#1e2125] text-3xl font-bold shadow-xl">
                {guild.iconUrl ? (
                  <img
                    src={guild.iconUrl}
                    alt={guild.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  guild.name
                    .charAt(0)
                    .toUpperCase()
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Você foi convidado para
              </p>

              <h1 className="mt-1 text-2xl font-bold">
                {guild.name}
              </h1>
            </div>

            <div className="mt-5 flex items-center gap-4 text-sm text-zinc-400">
              <div className="flex items-center gap-2">
                <Users size={16} />
                Servidor Typecord
              </div>

              <div className="flex items-center gap-2">
                <Hash size={16} />
                Convite
              </div>
            </div>

            {alreadyMember ? (
              <button
                onClick={() =>
                  router.push(
                    `/channels/${guild.id}`
                  )
                }
                className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 font-semibold transition hover:bg-indigo-500"
              >
                <Check size={17} />
                Abrir servidor
              </button>
            ) : (
              <button
                disabled={loading}
                onClick={accept}
                className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 font-semibold transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />

                    Entrando...
                  </>
                ) : (
                  "Aceitar convite"
                )}
              </button>
            )}

            {error && (
              <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-center text-sm text-red-400">
                {error}
              </p>
            )}

            <p className="mt-5 text-center text-xs text-zinc-600">
              Ao entrar, você concorda com as regras
              deste servidor.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}