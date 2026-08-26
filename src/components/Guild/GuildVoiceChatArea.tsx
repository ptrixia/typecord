"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  LiveKitRoom,
  StartAudio,
  VideoConference,
  useConnectionQualityIndicator,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
} from "@livekit/components-react";
import {
  Camera,
  CameraOff,
  Check,
  Copy,
  Headphones,
  Loader2,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Monitor,
  PhoneOff,
  Settings,
  Shield,
  Users,
  Wifi,
  X,
} from "lucide-react";
import {
  Track,
  type AudioCaptureOptions,
  type ScreenShareCaptureOptions,
  type TrackPublishOptions,
  type VideoCaptureOptions,
} from "livekit-client";
import "@livekit/components-styles";

import type { ChatAreaProps } from "./ChatArea";

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

type VoiceConnectionState =
  | "loading"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

type ResolutionId = "480p" | "720p" | "1080p";
type FrameRate = 15 | 30 | 60;
type MediaAction =
  | "microphone"
  | "camera"
  | "screen"
  | "quality"
  | "device"
  | null;

interface VoiceSettings {
  cameraResolution: ResolutionId;
  cameraFps: FrameRate;
  screenResolution: ResolutionId;
  screenFps: FrameRate;
  shareScreenAudio: boolean;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  pushToTalk: boolean;
}

interface ResolutionOption {
  id: ResolutionId;
  label: string;
  width: number;
  height: number;
}

interface VoiceConferenceProps {
  channel: any;
  channelName: string;
  permissions: VoiceCredentials["permissions"];
  connectionState: VoiceConnectionState;
  onLeaveVoice?: () => void;
}

const SETTINGS_STORAGE_KEY = "typecord:voice-preferences:v2";

const DEFAULT_SETTINGS: VoiceSettings = {
  cameraResolution: "720p",
  cameraFps: 30,
  screenResolution: "1080p",
  screenFps: 30,
  shareScreenAudio: true,
  echoCancellation: true,
  noiseSuppression: true,
  pushToTalk: false,
};

const RESOLUTIONS: ResolutionOption[] = [
  { id: "480p", label: "480p", width: 854, height: 480 },
  { id: "720p", label: "720p HD", width: 1280, height: 720 },
  { id: "1080p", label: "1080p Full HD", width: 1920, height: 1080 },
];

const FRAME_RATES: FrameRate[] = [15, 30, 60];

function normalizeVoiceSettings(value: unknown): VoiceSettings {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;

  const candidate = value as Partial<VoiceSettings>;
  const isResolution = (resolution: unknown): resolution is ResolutionId =>
    RESOLUTIONS.some((option) => option.id === resolution);
  const isFrameRate = (fps: unknown): fps is FrameRate =>
    FRAME_RATES.includes(fps as FrameRate);

  return {
    cameraResolution: isResolution(candidate.cameraResolution)
      ? candidate.cameraResolution
      : DEFAULT_SETTINGS.cameraResolution,
    cameraFps: isFrameRate(candidate.cameraFps)
      ? candidate.cameraFps
      : DEFAULT_SETTINGS.cameraFps,
    screenResolution: isResolution(candidate.screenResolution)
      ? candidate.screenResolution
      : DEFAULT_SETTINGS.screenResolution,
    screenFps: isFrameRate(candidate.screenFps)
      ? candidate.screenFps
      : DEFAULT_SETTINGS.screenFps,
    shareScreenAudio:
      typeof candidate.shareScreenAudio === "boolean"
        ? candidate.shareScreenAudio
        : DEFAULT_SETTINGS.shareScreenAudio,
    echoCancellation:
      typeof candidate.echoCancellation === "boolean"
        ? candidate.echoCancellation
        : DEFAULT_SETTINGS.echoCancellation,
    noiseSuppression:
      typeof candidate.noiseSuppression === "boolean"
        ? candidate.noiseSuppression
        : DEFAULT_SETTINGS.noiseSuppression,
    pushToTalk:
      typeof candidate.pushToTalk === "boolean"
        ? candidate.pushToTalk
        : DEFAULT_SETTINGS.pushToTalk,
  };
}

function getResolution(id: ResolutionId) {
  return RESOLUTIONS.find((resolution) => resolution.id === id) ?? RESOLUTIONS[1];
}

function getMaxBitrate(resolution: ResolutionId, fps: FrameRate) {
  const baseBitrates: Record<ResolutionId, number> = {
    "480p": 1_000_000,
    "720p": 2_500_000,
    "1080p": 5_000_000,
  };
  const multiplier = fps === 60 ? 1.6 : fps === 15 ? 0.72 : 1;
  return Math.round(baseBitrates[resolution] * multiplier);
}

function buildCameraCaptureOptions(settings: VoiceSettings): VideoCaptureOptions {
  const resolution = getResolution(settings.cameraResolution);
  return {
    resolution: {
      width: resolution.width,
      height: resolution.height,
      frameRate: settings.cameraFps,
      aspectRatio: 16 / 9,
    },
    frameRate: settings.cameraFps,
  };
}

function buildScreenCaptureOptions(settings: VoiceSettings): ScreenShareCaptureOptions {
  const resolution = getResolution(settings.screenResolution);
  return {
    audio: settings.shareScreenAudio,
    video: true,
    resolution: {
      width: resolution.width,
      height: resolution.height,
      frameRate: settings.screenFps,
      aspectRatio: 16 / 9,
    },
    contentHint: settings.screenFps >= 60 ? "motion" : "detail",
    selfBrowserSurface: "exclude",
    surfaceSwitching: "include",
    systemAudio: settings.shareScreenAudio ? "include" : "exclude",
  };
}

function buildAudioCaptureOptions(settings: VoiceSettings): AudioCaptureOptions {
  return {
    echoCancellation: settings.echoCancellation,
    noiseSuppression: settings.noiseSuppression,
    autoGainControl: true,
  };
}

function buildCameraPublishOptions(settings: VoiceSettings): TrackPublishOptions {
  return {
    simulcast: true,
    videoEncoding: {
      maxBitrate: getMaxBitrate(settings.cameraResolution, settings.cameraFps),
      maxFramerate: settings.cameraFps,
    },
  };
}

function buildScreenPublishOptions(settings: VoiceSettings): TrackPublishOptions {
  return {
    simulcast: true,
    screenShareEncoding: {
      maxBitrate: getMaxBitrate(settings.screenResolution, settings.screenFps),
      maxFramerate: settings.screenFps,
    },
  };
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const values = hours > 0 ? [hours, minutes, seconds] : [minutes, seconds];
  return values.map((value) => String(value).padStart(2, "0")).join(":");
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "A permissão foi recusada pelo navegador.";
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)
  );
}

function getActiveDeviceId(publication: unknown) {
  const track = (
    publication as
      | { track?: { mediaStreamTrack?: MediaStreamTrack } }
      | undefined
  )?.track;
  return track?.mediaStreamTrack?.getSettings().deviceId ?? "";
}

function MediaControlButton({
  label,
  active = false,
  danger = false,
  disabled = false,
  busy = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  busy?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const colors = danger
    ? "bg-red-500 text-white hover:bg-red-400"
    : active
      ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400"
      : "bg-white/10 text-zinc-100 hover:bg-white/15";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex min-w-14 flex-col items-center gap-1.5 rounded-2xl px-3 py-2 text-[10px] font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${colors}`}
    >
      <span className="flex h-5 items-center justify-center">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : children}
      </span>
      <span className="max-w-20 truncate">{label}</span>
    </button>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-white/10 bg-[#15171c] px-3 text-xs font-medium text-zinc-100 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
      >
        {children}
      </select>
    </label>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-zinc-200">{label}</span>
        <span className="mt-0.5 block text-[10px] leading-4 text-zinc-500">
          {description}
        </span>
      </span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${
          checked ? "bg-indigo-500" : "bg-zinc-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
            checked ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function VoiceConference({
  channel,
  channelName,
  permissions,
  connectionState,
  onLeaveVoice,
}: VoiceConferenceProps) {
  const room = useRoomContext();
  const participants = useParticipants();
  const {
    localParticipant,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
  } = useLocalParticipant();
  const { quality } = useConnectionQualityIndicator({ participant: localParticipant });

  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<MediaAction>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [gatewayLatency, setGatewayLatency] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const pushToTalkEngagedRef = useRef(false);
  const noticeTimerRef = useRef<number | null>(null);

  const cameraPublication = localParticipant.getTrackPublication(Track.Source.Camera);
  const microphonePublication = localParticipant.getTrackPublication(
    Track.Source.Microphone,
  );
  const activeCameraId = getActiveDeviceId(cameraPublication);
  const activeMicrophoneId = getActiveDeviceId(microphonePublication);

  const qualityInfo = useMemo(() => {
    const normalized = String(quality).toLowerCase();
    if (normalized.includes("excellent")) {
      return {
        label: "Excelente",
        className: "text-emerald-400",
        dotClassName: "bg-emerald-400",
      };
    }
    if (normalized.includes("good")) {
      return {
        label: "Boa",
        className: "text-sky-400",
        dotClassName: "bg-sky-400",
      };
    }
    if (normalized.includes("poor")) {
      return {
        label: "Instável",
        className: "text-amber-400",
        dotClassName: "bg-amber-400",
      };
    }
    if (normalized.includes("lost")) {
      return {
        label: "Sem sinal",
        className: "text-red-400",
        dotClassName: "bg-red-400",
      };
    }
    return {
      label: "Medindo",
      className: "text-zinc-400",
      dotClassName: "bg-zinc-500",
    };
  }, [quality]);

  const showNotice = useCallback((message: string) => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    setNotice(message);
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, 3200);
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter((device) => device.kind === "audioinput"));
      setVideoInputs(devices.filter((device) => device.kind === "videoinput"));
    } catch (deviceError) {
      console.error("[VOICE_ENUMERATE_DEVICES]", deviceError);
    }
  }, []);

  const runMediaAction = useCallback(
    async (
      action: Exclude<MediaAction, null>,
      operation: () => Promise<void>,
      successMessage?: string,
    ) => {
      if (busyAction) return;
      setBusyAction(action);
      setMediaError(null);
      try {
        await operation();
        await refreshDevices();
        if (successMessage) showNotice(successMessage);
      } catch (actionError) {
        console.error(`[VOICE_${action.toUpperCase()}_ERROR]`, actionError);
        setMediaError(
          getErrorMessage(
            actionError,
            "Não foi possível alterar esta configuração de voz.",
          ),
        );
      } finally {
        setBusyAction(null);
      }
    },
    [busyAction, refreshDevices, showNotice],
  );

  useEffect(() => {
    try {
      const storedSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (storedSettings) {
        setSettings(normalizeVoiceSettings(JSON.parse(storedSettings)));
      }
    } catch (storageError) {
      console.error("[VOICE_SETTINGS_LOAD]", storageError);
    } finally {
      setSettingsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (storageError) {
      console.error("[VOICE_SETTINGS_SAVE]", storageError);
    }
  }, [settings, settingsLoaded]);

  useEffect(() => {
    void refreshDevices();
    const handleDeviceChange = () => void refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.(
        "devicechange",
        handleDeviceChange,
      );
    };
  }, [refreshDevices]);

  useEffect(() => {
    if (isMicrophoneEnabled || isCameraEnabled) void refreshDevices();
  }, [isCameraEnabled, isMicrophoneEnabled, refreshDevices]);

  useEffect(() => {
    const startedAt = Date.now();
    const updateDuration = () =>
      setDuration(Math.floor((Date.now() - startedAt) / 1000));
    updateDuration();
    const timer = window.setInterval(updateDuration, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const guildId = String(channel?.guildId ?? "");
    if (!guildId) return;

    let cancelled = false;
    let controller: AbortController | null = null;

    const measureLatency = async () => {
      controller?.abort();
      controller = new AbortController();
      const startedAt = performance.now();
      try {
        const response = await fetch(
          `/api/realtime/voice-state?guildId=${encodeURIComponent(guildId)}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!cancelled && response.ok) {
          setGatewayLatency(Math.max(1, Math.round(performance.now() - startedAt)));
        }
      } catch (latencyError) {
        if (
          !cancelled &&
          !(latencyError instanceof DOMException && latencyError.name === "AbortError")
        ) {
          setGatewayLatency(null);
        }
      }
    };

    void measureLatency();
    const timer = window.setInterval(() => void measureLatency(), 15_000);
    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, [channel?.guildId]);

  useEffect(() => {
    const handleFullscreenChange = () =>
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!settings.pushToTalk || !permissions.speak) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.code !== "Space" ||
        event.repeat ||
        isEditableTarget(event.target)
      ) {
        return;
      }
      event.preventDefault();
      if (!isMicrophoneEnabled) {
        pushToTalkEngagedRef.current = true;
        void localParticipant
          .setMicrophoneEnabled(true, buildAudioCaptureOptions(settings))
          .catch((pushToTalkError) => {
            pushToTalkEngagedRef.current = false;
            setMediaError(
              getErrorMessage(
                pushToTalkError,
                "Não foi possível ativar o pressionar para falar.",
              ),
            );
          });
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space" || !pushToTalkEngagedRef.current) return;
      event.preventDefault();
      pushToTalkEngagedRef.current = false;
      void localParticipant.setMicrophoneEnabled(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (pushToTalkEngagedRef.current) {
        pushToTalkEngagedRef.current = false;
        void localParticipant.setMicrophoneEnabled(false);
      }
    };
  }, [isMicrophoneEnabled, localParticipant, permissions.speak, settings]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const toggleMicrophone = () => {
    if (!permissions.speak) return;
    void runMediaAction("microphone", async () => {
      await localParticipant.setMicrophoneEnabled(
        !isMicrophoneEnabled,
        buildAudioCaptureOptions(settings),
      );
    });
  };

  const toggleCamera = () => {
    if (!permissions.stream) return;
    void runMediaAction("camera", async () => {
      await localParticipant.setCameraEnabled(
        !isCameraEnabled,
        buildCameraCaptureOptions(settings),
        buildCameraPublishOptions(settings),
      );
    });
  };

  const toggleScreenShare = () => {
    if (!permissions.stream) return;
    void runMediaAction("screen", async () => {
      await localParticipant.setScreenShareEnabled(
        !isScreenShareEnabled,
        buildScreenCaptureOptions(settings),
        buildScreenPublishOptions(settings),
      );
    });
  };

  const applyQualitySettings = () => {
    void runMediaAction(
      "quality",
      async () => {
        if (isMicrophoneEnabled) {
          const microphoneTrack = microphonePublication?.track as
            | { restartTrack: (options?: AudioCaptureOptions) => Promise<void> }
            | undefined;
          await microphoneTrack?.restartTrack(buildAudioCaptureOptions(settings));
        }
        if (isCameraEnabled) {
          const cameraTrack = cameraPublication?.track as
            | { restartTrack: (options?: VideoCaptureOptions) => Promise<void> }
            | undefined;
          await cameraTrack?.restartTrack(buildCameraCaptureOptions(settings));
        }
        if (isScreenShareEnabled) {
          await localParticipant.setScreenShareEnabled(false);
          await localParticipant.setScreenShareEnabled(
            true,
            buildScreenCaptureOptions(settings),
            buildScreenPublishOptions(settings),
          );
        }
      },
      isScreenShareEnabled
        ? "Qualidade aplicada. A fonte da tela foi selecionada novamente."
        : "Preferências de transmissão aplicadas.",
    );
  };

  const switchDevice = (
    kind: "audioinput" | "videoinput",
    deviceId: string,
  ) => {
    if (!deviceId) return;
    void runMediaAction(
      "device",
      async () => {
        await room.switchActiveDevice(kind, deviceId);
      },
      "Dispositivo alterado.",
    );
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await containerRef.current?.requestFullscreen();
    } catch (fullscreenError) {
      setMediaError(
        getErrorMessage(fullscreenError, "Não foi possível ativar a tela cheia."),
      );
    }
  };

  const copyChannelLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showNotice("Link do canal copiado.");
    } catch (clipboardError) {
      setMediaError(
        getErrorMessage(
          clipboardError,
          "Não foi possível copiar o link do canal.",
        ),
      );
    }
  };

  return (
    <div
      ref={containerRef}
      className="typecord-voice relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-[#090a0d] text-zinc-100"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_0%,rgba(99,102,241,0.16),transparent_32%),radial-gradient(circle_at_90%_90%,rgba(16,185,129,0.08),transparent_30%)]" />

      <header className="relative z-30 flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] bg-[#0b0c10]/90 px-4 py-3 backdrop-blur-xl sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-300 ring-1 ring-inset ring-indigo-400/20">
            <Headphones className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-sm font-bold text-white">{channelName}</h1>
              <span className="hidden rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-400 sm:inline-flex">
                ao vivo
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    connectionState === "connected"
                      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)]"
                      : "animate-pulse bg-amber-400"
                  }`}
                />
                {connectionState === "connected" ? "Conectado" : "Conectando"}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {participants.length} {participants.length === 1 ? "pessoa" : "pessoas"}
              </span>
              <span>{formatDuration(duration)}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div className="hidden items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.035] px-3 py-2 md:flex">
            <span
              className={`flex items-center gap-1.5 text-[10px] font-semibold ${qualityInfo.className}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${qualityInfo.dotClassName}`} />
              {qualityInfo.label}
            </span>
            <span className="h-3 w-px bg-white/10" />
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-400">
              <Wifi className="h-3 w-3" />
              {gatewayLatency === null ? "— ms" : `${gatewayLatency} ms`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void copyChannelLink()}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-zinc-400 transition hover:bg-white/[0.07] hover:text-white"
            title="Copiar link do canal"
            aria-label="Copiar link do canal"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="relative z-10 min-h-0 min-w-0 flex-1 overflow-hidden">
        <VideoConference />
        <StartAudio
          label="Clique para ativar o áudio"
          className="absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-xl border border-amber-400/20 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-100 shadow-xl backdrop-blur-xl transition hover:bg-amber-500/25"
        />
        {connectionState === "connecting" && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#090a0d]/95 backdrop-blur-sm">
            <div className="flex flex-col items-center text-center">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-500/10 ring-1 ring-indigo-400/20">
                <Loader2 className="h-7 w-7 animate-spin text-indigo-300" />
                <span className="absolute inset-0 animate-ping rounded-3xl border border-indigo-400/20" />
              </div>
              <p className="mt-5 text-sm font-bold text-zinc-100">Entrando no canal</p>
              <p className="mt-1 text-xs text-zinc-500">{channelName}</p>
            </div>
          </div>
        )}
      </main>

      {isSettingsOpen && (
        <div className="absolute bottom-24 left-1/2 z-50 w-[min(760px,calc(100%_-_24px))] -translate-x-1/2 overflow-hidden rounded-3xl border border-white/10 bg-[#101116]/95 shadow-2xl shadow-black/60 backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-white">Voz e transmissão</h2>
              <p className="mt-0.5 text-[10px] text-zinc-500">
                As preferências são salvas automaticamente neste dispositivo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-500 transition hover:bg-white/[0.07] hover:text-white"
              aria-label="Fechar configurações"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[min(64vh,560px)] overflow-y-auto p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Camera className="h-4 w-4 text-indigo-300" />
                  <h3 className="text-xs font-bold text-zinc-100">Webcam</h3>
                  <span className="ml-auto rounded-full bg-indigo-500/10 px-2 py-0.5 text-[9px] font-bold text-indigo-300">
                    até 1080p
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Resolução"
                    value={settings.cameraResolution}
                    onChange={(value) =>
                      setSettings((current) => ({
                        ...current,
                        cameraResolution: value as ResolutionId,
                      }))
                    }
                  >
                    {RESOLUTIONS.map((resolution) => (
                      <option key={resolution.id} value={resolution.id}>
                        {resolution.label}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    label="Quadros por segundo"
                    value={settings.cameraFps}
                    onChange={(value) =>
                      setSettings((current) => ({
                        ...current,
                        cameraFps: Number(value) as FrameRate,
                      }))
                    }
                  >
                    {FRAME_RATES.map((fps) => (
                      <option key={fps} value={fps}>{fps} FPS</option>
                    ))}
                  </SelectField>
                </div>
                <div className="mt-3 rounded-xl bg-black/20 px-3 py-2 text-[10px] leading-4 text-zinc-500">
                  Perfil estimado: até {Math.ceil(getMaxBitrate(settings.cameraResolution, settings.cameraFps) / 1_000_000)} Mb/s. O LiveKit adapta a qualidade à conexão.
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                <div className="mb-4 flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-emerald-300" />
                  <h3 className="text-xs font-bold text-zinc-100">Compartilhar tela</h3>
                  <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                    até 1080p
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Resolução"
                    value={settings.screenResolution}
                    onChange={(value) =>
                      setSettings((current) => ({
                        ...current,
                        screenResolution: value as ResolutionId,
                      }))
                    }
                  >
                    {RESOLUTIONS.map((resolution) => (
                      <option key={resolution.id} value={resolution.id}>
                        {resolution.label}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    label="Quadros por segundo"
                    value={settings.screenFps}
                    onChange={(value) =>
                      setSettings((current) => ({
                        ...current,
                        screenFps: Number(value) as FrameRate,
                      }))
                    }
                  >
                    {FRAME_RATES.map((fps) => (
                      <option key={fps} value={fps}>{fps} FPS</option>
                    ))}
                  </SelectField>
                </div>
                <div className="mt-3">
                  <SwitchRow
                    label="Compartilhar áudio"
                    description="Inclui o som da aba ou do sistema quando o navegador permitir."
                    checked={settings.shareScreenAudio}
                    onChange={(checked) =>
                      setSettings((current) => ({
                        ...current,
                        shareScreenAudio: checked,
                      }))
                    }
                  />
                </div>
              </section>
            </div>

            <section className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <div className="mb-4 flex items-center gap-2">
                <Headphones className="h-4 w-4 text-sky-300" />
                <h3 className="text-xs font-bold text-zinc-100">Dispositivos e áudio</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField
                  label="Microfone"
                  value={activeMicrophoneId}
                  onChange={(value) => switchDevice("audioinput", value)}
                >
                  <option value="">Padrão do sistema</option>
                  {audioInputs.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microfone ${index + 1}`}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Câmera"
                  value={activeCameraId}
                  onChange={(value) => switchDevice("videoinput", value)}
                >
                  <option value="">Padrão do sistema</option>
                  {videoInputs.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Câmera ${index + 1}`}
                    </option>
                  ))}
                </SelectField>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <SwitchRow
                  label="Supressão de ruído"
                  description="Reduz ruídos constantes do ambiente."
                  checked={settings.noiseSuppression}
                  onChange={(checked) =>
                    setSettings((current) => ({ ...current, noiseSuppression: checked }))
                  }
                />
                <SwitchRow
                  label="Cancelamento de eco"
                  description="Evita que o áudio dos outros retorne."
                  checked={settings.echoCancellation}
                  onChange={(checked) =>
                    setSettings((current) => ({ ...current, echoCancellation: checked }))
                  }
                />
                <SwitchRow
                  label="Pressionar para falar"
                  description="Segure Espaço fora dos campos de texto."
                  checked={settings.pushToTalk}
                  onChange={(checked) =>
                    setSettings((current) => ({ ...current, pushToTalk: checked }))
                  }
                />
              </div>
            </section>

            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-indigo-400/10 bg-indigo-500/[0.06] p-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 gap-2.5">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
                <p className="text-[10px] leading-4 text-zinc-400">
                  Ao aplicar uma nova qualidade durante o compartilhamento de tela, o navegador pedirá que você escolha a tela ou janela novamente.
                </p>
              </div>
              <button
                type="button"
                onClick={applyQualitySettings}
                disabled={busyAction !== null}
                className="flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 text-xs font-bold text-white transition hover:bg-indigo-400 disabled:opacity-50"
              >
                {busyAction === "quality" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Aplicar agora
              </button>
            </div>
          </div>
        </div>
      )}

      {(notice || mediaError) && (
        <div
          className={`absolute left-1/2 top-20 z-[70] flex max-w-[calc(100%_-_24px)] -translate-x-1/2 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold shadow-2xl backdrop-blur-xl ${
            mediaError
              ? "border-red-400/20 bg-red-500/15 text-red-200"
              : "border-emerald-400/20 bg-emerald-500/15 text-emerald-100"
          }`}
        >
          {mediaError ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          <span className="min-w-0">{mediaError ?? notice}</span>
          {mediaError && (
            <button
              type="button"
              onClick={() => setMediaError(null)}
              className="ml-1 rounded p-0.5 hover:bg-white/10"
              aria-label="Fechar aviso"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center bg-gradient-to-t from-black/75 via-black/35 to-transparent px-3 pb-4 pt-16">
        <div className="pointer-events-auto flex max-w-full items-center gap-1.5 overflow-x-auto rounded-3xl border border-white/10 bg-[#121318]/90 p-2 shadow-2xl shadow-black/50 backdrop-blur-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <MediaControlButton
            label={isMicrophoneEnabled ? "Silenciar" : "Microfone"}
            active={isMicrophoneEnabled}
            disabled={!permissions.speak}
            busy={busyAction === "microphone"}
            onClick={toggleMicrophone}
          >
            {isMicrophoneEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </MediaControlButton>
          <MediaControlButton
            label={isCameraEnabled ? "Desligar vídeo" : "Câmera"}
            active={isCameraEnabled}
            disabled={!permissions.stream}
            busy={busyAction === "camera"}
            onClick={toggleCamera}
          >
            {isCameraEnabled ? <Camera className="h-5 w-5" /> : <CameraOff className="h-5 w-5" />}
          </MediaControlButton>
          <MediaControlButton
            label={isScreenShareEnabled ? "Parar tela" : "Transmitir"}
            active={isScreenShareEnabled}
            disabled={!permissions.stream}
            busy={busyAction === "screen"}
            onClick={toggleScreenShare}
          >
            <Monitor className="h-5 w-5" />
          </MediaControlButton>

          <span className="mx-0.5 h-10 w-px shrink-0 bg-white/10" />
          <MediaControlButton
            label="Configurações"
            active={isSettingsOpen}
            onClick={() => setIsSettingsOpen((current) => !current)}
          >
            <Settings className="h-5 w-5" />
          </MediaControlButton>
          <MediaControlButton
            label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            onClick={() => void toggleFullscreen()}
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </MediaControlButton>

          {onLeaveVoice && (
            <>
              <span className="mx-0.5 h-10 w-px shrink-0 bg-white/10" />
              <MediaControlButton label="Desconectar" danger onClick={onLeaveVoice}>
                <PhoneOff className="h-5 w-5" />
              </MediaControlButton>
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        .typecord-voice .lk-video-conference {
          height: 100%;
          min-height: 0;
          background: transparent;
        }
        .typecord-voice .lk-video-conference-inner {
          height: 100%;
          min-height: 0;
          background: transparent;
        }
        .typecord-voice .lk-control-bar {
          display: none !important;
        }
        .typecord-voice .lk-grid-layout-wrapper,
        .typecord-voice .lk-focus-layout-wrapper {
          min-height: 0;
          padding: 18px 18px 106px;
          background: transparent;
        }
        .typecord-voice .lk-grid-layout {
          gap: 12px;
        }
        .typecord-voice .lk-participant-tile {
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          background: linear-gradient(145deg, #17191f, #101116);
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.22);
          transition: border-color 180ms ease, box-shadow 180ms ease,
            transform 180ms ease;
        }
        .typecord-voice .lk-participant-tile:hover {
          transform: translateY(-1px);
          border-color: rgba(129, 140, 248, 0.3);
          box-shadow: 0 22px 52px rgba(0, 0, 0, 0.3);
        }
        .typecord-voice .lk-participant-tile[data-lk-speaking="true"] {
          border-color: rgba(52, 211, 153, 0.8);
          box-shadow: 0 0 0 2px rgba(52, 211, 153, 0.13),
            0 22px 52px rgba(0, 0, 0, 0.3);
        }
        .typecord-voice .lk-participant-media-video {
          object-fit: cover;
        }
        .typecord-voice .lk-participant-metadata {
          right: 10px;
          bottom: 10px;
          left: 10px;
          width: auto;
          border-radius: 12px;
          background: rgba(8, 9, 12, 0.72);
          backdrop-filter: blur(14px);
        }
        .typecord-voice .lk-participant-name {
          font-size: 11px;
          font-weight: 700;
        }
        .typecord-voice .lk-focus-layout-wrapper .lk-participant-tile {
          border-radius: 22px;
        }
        .typecord-voice .lk-carousel {
          gap: 10px;
        }
        .typecord-voice:fullscreen {
          background: #090a0d;
        }
        @media (max-width: 640px) {
          .typecord-voice .lk-grid-layout-wrapper,
          .typecord-voice .lk-focus-layout-wrapper {
            padding: 10px 10px 102px;
          }
          .typecord-voice .lk-participant-tile {
            border-radius: 16px;
          }
        }
      `}</style>
    </div>
  );
}

function LoadingVoiceState({ channelName }: { channelName: string }) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 items-center justify-center overflow-hidden bg-[#090a0d] p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(99,102,241,0.18),transparent_35%)]" />
      <div className="relative flex flex-col items-center text-center">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] border border-indigo-400/20 bg-indigo-500/10 shadow-2xl shadow-indigo-500/10">
          <Headphones className="h-8 w-8 text-indigo-300" />
          <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#090a0d]">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
          </span>
        </div>
        <h2 className="mt-5 text-base font-bold text-zinc-100">Preparando sua conexão</h2>
        <p className="mt-1 text-xs text-zinc-500">{channelName}</p>
        <div className="mt-5 flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold text-zinc-500">
          <Shield className="h-3.5 w-3.5 text-emerald-400" />
          Conexão segura via LiveKit
        </div>
      </div>
    </div>
  );
}

function VoiceErrorState({
  channelName,
  error,
  onRetry,
  onLeaveVoice,
}: {
  channelName: string;
  error: string;
  onRetry: () => void;
  onLeaveVoice?: () => void;
}) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 items-center justify-center overflow-hidden bg-[#090a0d] p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(239,68,68,0.12),transparent_35%)]" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/[0.08] bg-white/[0.035] p-6 text-center shadow-2xl backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-300 ring-1 ring-inset ring-red-400/20">
          <Wifi className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-base font-bold text-zinc-100">
          Não foi possível entrar na voz
        </h2>
        <p className="mt-1 text-xs font-medium text-zinc-500">{channelName}</p>
        <p className="mt-4 rounded-xl bg-black/20 px-3 py-2.5 text-xs leading-5 text-zinc-400">
          {error}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-400"
          >
            Tentar novamente
          </button>
          {onLeaveVoice && (
            <button
              type="button"
              onClick={onLeaveVoice}
              className="rounded-xl bg-white/[0.06] px-4 py-2.5 text-xs font-bold text-zinc-200 transition hover:bg-white/10"
            >
              Voltar aos canais
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GuildVoiceChatArea({ channel, onLeaveVoice }: ChatAreaProps) {
  const [credentials, setCredentials] = useState<VoiceCredentials | null>(null);
  const [connectionState, setConnectionState] =
    useState<VoiceConnectionState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [connectionKey, setConnectionKey] = useState(0);

  const channelId = String(channel?.id ?? "");
  const channelName = String(channel?.name ?? "Canal de voz");

  const loadCredentials = useCallback(
    async (signal?: AbortSignal) => {
      if (!channelId) {
        setCredentials(null);
        setConnectionState("error");
        setError("Canal de voz inválido.");
        return;
      }

      setConnectionState("loading");
      setCredentials(null);
      setError(null);

      try {
        const response = await fetch(
          `/api/livekit/token?channelId=${encodeURIComponent(channelId)}`,
          { method: "GET", cache: "no-store", signal },
        );
        const data = await response.json().catch(() => null);

        if (
          !response.ok ||
          !data?.success ||
          typeof data.token !== "string" ||
          typeof data.serverUrl !== "string"
        ) {
          throw new Error(
            data?.message || "Não foi possível conectar ao canal de voz.",
          );
        }
        if (signal?.aborted) return;

        const permissions = {
          connect: Boolean(data.permissions?.connect ?? true),
          speak: Boolean(data.permissions?.speak),
          stream: Boolean(data.permissions?.stream),
        };
        if (!permissions.connect) {
          throw new Error(
            "Você não tem permissão para entrar neste canal de voz.",
          );
        }

        setCredentials({
          token: data.token,
          serverUrl: data.serverUrl,
          room: String(data.room ?? channelId),
          permissions,
        });
        setConnectionState("connecting");
      } catch (connectError) {
        if (signal?.aborted) return;
        setCredentials(null);
        setConnectionState("error");
        setError(
          getErrorMessage(connectError, "Erro ao conectar ao canal de voz."),
        );
      }
    },
    [channelId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadCredentials(controller.signal);
    return () => controller.abort();
  }, [connectionKey, loadCredentials]);

  const reconnect = () => setConnectionKey((current) => current + 1);

  if (connectionState === "loading") {
    return <LoadingVoiceState channelName={channelName} />;
  }

  if (connectionState === "error" || !credentials) {
    return (
      <VoiceErrorState
        channelName={channelName}
        error={error || "Credenciais de voz indisponíveis."}
        onRetry={reconnect}
        onLeaveVoice={onLeaveVoice}
      />
    );
  }

  if (connectionState === "disconnected") {
    return (
      <VoiceErrorState
        channelName={channelName}
        error="A conexão com o canal foi encerrada. Você pode reconectar ou voltar aos canais de texto."
        onRetry={reconnect}
        onLeaveVoice={onLeaveVoice}
      />
    );
  }

  return (
    <div
      className="relative flex h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden bg-[#090a0d]"
      data-lk-theme="default"
    >
      <LiveKitRoom
        key={`${channelId}:${connectionKey}`}
        token={credentials.token}
        serverUrl={credentials.serverUrl}
        connect
        audio={false}
        video={false}
        onConnected={() => {
          setConnectionState("connected");
          setError(null);
        }}
        onDisconnected={() => setConnectionState("disconnected")}
        onError={(roomError) => {
          console.error("[LIVEKIT_ROOM_ERROR]", roomError);
          setError(getErrorMessage(roomError, "Erro na conexão de voz."));
          setConnectionState((current) =>
            current === "connected" ? current : "error",
          );
        }}
        className="flex h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden"
      >
        <VoiceConference
          channel={channel}
          channelName={channelName}
          permissions={credentials.permissions}
          connectionState={connectionState}
          onLeaveVoice={onLeaveVoice}
        />
      </LiveKitRoom>
    </div>
  );
}
