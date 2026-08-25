"use client";

import {
  AlertCircle,
  Check,
  Hash,
  Loader2,
  LogIn,
  UserPlus,
  Users,
} from "lucide-react";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { acceptGuildInvite } from "@/actions/invites";

type Props = {
  status:
    | "valid"
    | "not_found"
    | "expired"
    | "exhausted";

  code: string;

  authenticated?: boolean;
  alreadyMember?: boolean;
  autoJoin?: boolean;

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
  authenticated = false,
  alreadyMember = false,
  autoJoin = false,
  guild,
}: Props) {
  const router = useRouter();

  const autoJoinAttempted = useRef(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const accept = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result =
        await acceptGuildInvite(code);

      router.replace(
        `/channels/${result.guildId}`,
      );

      router.refresh();
    } catch (err: any) {
      const message = err?.message;

      if (message === "AUTH_REQUIRED") {
        const redirect =
          `/invite/${encodeURIComponent(code)}?autoJoin=1`;

        router.push(
          `/login?redirect=${encodeURIComponent(redirect)}`,
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
          "Esse convite atingiu o limite de utilizações.",
        );
        return;
      }

      if (
        message === "DEFAULT_ROLE_NOT_FOUND"
      ) {
        setError(
          "Não foi possível configurar sua entrada no servidor.",
        );
        return;
      }

      setError(
        "Não foi possível entrar no servidor.",
      );
    } finally {
      setLoading(false);
    }
  }, [code, router]);

  useEffect(() => {
    if (status !== "valid") {
      return;
    }

    if (!authenticated) {
      return;
    }

    if (alreadyMember) {
      return;
    }

    if (!autoJoin) {
      return;
    }

    if (autoJoinAttempted.current) {
      return;
    }

    autoJoinAttempted.current = true;

    void accept();
  }, [
    status,
    authenticated,
    alreadyMember,
    autoJoin,
    accept,
  ]);

  function goToLogin() {
    const redirect =
      `/invite/${encodeURIComponent(code)}?autoJoin=1`;

    router.push(
      `/login?redirect=${encodeURIComponent(redirect)}`,
    );
  }

  function goToRegister() {
    const redirect =
      `/invite/${encodeURIComponent(code)}?autoJoin=1`;

    router.push(
      `/register?redirect=${encodeURIComponent(redirect)}`,
    );
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
            type="button"
            onClick={() =>
              router.push("/channels/@me")
            }
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

  const automaticallyJoining =
    authenticated &&
    autoJoin &&
    !alreadyMember;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0d0f] p-6 text-white">
      {guild.bannerUrl && (
        <div
          className="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center opacity-20 blur-3xl"
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
                type="button"
                onClick={() =>
                  router.push(
                    `/channels/${guild.id}`,
                  )
                }
                className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 font-semibold transition hover:bg-indigo-500"
              >
                <Check size={17} />

                Abrir servidor
              </button>
            ) : !authenticated ? (
              <div className="mt-7 space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-semibold text-zinc-100">
                    Entre para aceitar o convite
                  </p>

                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    Faça login ou crie uma conta.
                    Depois disso, você entrará
                    automaticamente em{" "}
                    <strong className="font-semibold text-zinc-200">
                      {guild.name}
                    </strong>
                    .
                  </p>
                </div>

                <button
                  type="button"
                  onClick={goToLogin}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 font-semibold transition hover:bg-indigo-500"
                >
                  <LogIn size={17} />

                  Entrar e aceitar convite
                </button>

                <button
                  type="button"
                  onClick={goToRegister}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] font-semibold text-zinc-200 transition hover:bg-white/[0.08]"
                >
                  <UserPlus size={17} />

                  Criar uma conta
                </button>

                <p className="text-center text-[11px] leading-relaxed text-zinc-500">
                  Você voltará para este convite
                  automaticamente após entrar.
                </p>
              </div>
            ) : (
              <button
                type="button"
                disabled={
                  loading ||
                  automaticallyJoining
                }
                onClick={accept}
                className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 font-semibold transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ||
                automaticallyJoining ? (
                  <>
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />

                    Entrando no servidor...
                  </>
                ) : (
                  "Aceitar convite"
                )}
              </button>
            )}

            {error && (
              <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-400">
                {error}
              </p>
            )}

            <p className="mt-5 text-center text-xs text-zinc-600">
              Ao entrar, você concorda com as
              regras deste servidor.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}