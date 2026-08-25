"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
} from "@livekit/components-react";

interface VoiceChannelRoomProps {
  channelId: string;
  channelName?: string;
  onLeave?: () => void;
}

interface VoiceCredentials {
  token: string;
  serverUrl: string;
  room: string;

  permissions: {
    connect: boolean;
    speak: boolean;
    stream: boolean;
  };
}

export default function VoiceChannelRoom({
  channelId,
  channelName,
  onLeave,
}: VoiceChannelRoomProps) {
  const [
    credentials,
    setCredentials,
  ] = useState<VoiceCredentials | null>(
    null,
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  useEffect(() => {
    const controller =
      new AbortController();

    setLoading(true);
    setCredentials(null);
    setError(null);

    async function connect() {
      try {
        const response =
          await fetch(
            `/api/livekit/token?channelId=${encodeURIComponent(
              String(channelId),
            )}`,
            {
              method: "GET",
              cache: "no-store",
              signal:
                controller.signal,
            },
          );

        const data =
          await response
            .json()
            .catch(() => null);

        if (
          !response.ok ||
          !data?.success ||
          typeof data.token !==
            "string" ||
          typeof data.serverUrl !==
            "string"
        ) {
          throw new Error(
            data?.message ||
              "Não foi possível conectar ao canal de voz.",
          );
        }

        if (
          controller.signal.aborted
        ) {
          return;
        }

        setCredentials({
          token: data.token,
          serverUrl:
            data.serverUrl,
          room:
            String(
              data.room ?? "",
            ),

          permissions: {
            connect:
              Boolean(
                data.permissions
                  ?.connect,
              ),

            speak:
              Boolean(
                data.permissions
                  ?.speak,
              ),

            stream:
              Boolean(
                data.permissions
                  ?.stream,
              ),
          },
        });
      } catch (error) {
        if (
          controller.signal
            .aborted
        ) {
          return;
        }

        setError(
          error instanceof Error
            ? error.message
            : "Erro ao conectar ao canal de voz.",
        );
      } finally {
        if (
          !controller.signal
            .aborted
        ) {
          setLoading(false);
        }
      }
    }

    void connect();

    return () => {
      controller.abort();
    };
  }, [channelId]);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#111214]">
        <div className="text-center">
          <div className="text-sm font-semibold text-zinc-200">
            Conectando à voz
          </div>

          <div className="mt-1 text-xs text-zinc-500">
            {channelName ||
              "Canal de voz"}
          </div>
        </div>
      </div>
    );
  }

  if (
    error ||
    !credentials
  ) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#111214] p-6">
        <div className="max-w-md text-center">
          <div className="text-sm font-semibold text-red-400">
            Não foi possível entrar na voz
          </div>

          <p className="mt-2 text-sm text-zinc-400">
            {error ||
              "Credenciais de voz indisponíveis."}
          </p>

          {onLeave && (
            <button
              type="button"
              onClick={onLeave}
              className="mt-4 rounded-md bg-zinc-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
            >
              Voltar ao chat
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-full w-full bg-[#111214]"
      data-lk-theme="default"
    >
      <LiveKitRoom
        token={
          credentials.token
        }
        serverUrl={
          credentials.serverUrl
        }
        connect
        audio={false}
        video={false}
        onDisconnected={
          onLeave
        }
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 border-b border-zinc-800 bg-[#111214] px-4 py-3">
            <div className="truncate text-sm font-semibold text-zinc-100">
              {channelName ||
                "Canal de voz"}
            </div>

            <div className="mt-0.5 text-xs text-zinc-500">
              {credentials.permissions
                .speak
                ? "Microfone permitido"
                : "Somente ouvir"}
              {" • "}
              {credentials.permissions
                .stream
                ? "Vídeo e tela permitidos"
                : "Sem permissão para transmitir"}
            </div>
          </div>

          <div className="min-h-0 flex-1">
            <VideoConference />
          </div>
        </div>

        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}