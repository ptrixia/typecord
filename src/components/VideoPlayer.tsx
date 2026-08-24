"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";

interface VideoPlayerProps {
  src: string;
  poster?: string;
}

export default function VideoPlayer({
  src,
  poster,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideControlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [isHovered, setIsHovered] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds)) return "0:00";

    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }

    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const clearHideControls = () => {
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
  };

  const scheduleHideControls = () => {
    clearHideControls();

    if (!isPlaying) return;

    hideControlsTimeout.current = setTimeout(() => {
      if (!isHovered) {
        setShowControls(false);
      }
    }, 2500);
  };

  const revealControls = () => {
    setShowControls(true);
    scheduleHideControls();
  };

  const togglePlay = async () => {
    const video = videoRef.current;

    if (!video) return;

    try {
      if (video.paused) {
        await video.play();
        setIsPlaying(true);
      } else {
        video.pause();
        setIsPlaying(false);
      }
    } catch (error) {
      console.error("Erro ao reproduzir vídeo:", error);
    }

    revealControls();
  };

  const toggleMute = () => {
    const video = videoRef.current;

    if (!video) return;

    const newMutedState = !video.muted;

    video.muted = newMutedState;

    if (!newMutedState && video.volume === 0) {
      video.volume = 1;
      setVolume(1);
    }

    setIsMuted(newMutedState);
    revealControls();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    const video = videoRef.current;

    if (!video) return;

    video.volume = value;
    video.muted = value === 0;

    setVolume(value);
    setIsMuted(value === 0);

    revealControls();
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;

    if (!video || !Number.isFinite(video.duration)) return;

    setCurrentTime(video.currentTime);

    setProgress((video.currentTime / video.duration) * 100);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;

    if (!video) return;

    setDuration(video.duration);
    setIsLoading(false);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    const video = videoRef.current;

    if (!video || !Number.isFinite(video.duration)) return;

    const newTime = (value / 100) * video.duration;

    video.currentTime = newTime;
    setProgress(value);
    setCurrentTime(newTime);

    revealControls();
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;

    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Erro ao alternar fullscreen:", error);
    }
  };

  const handleFullscreenChange = () => {
    setIsFullscreen(Boolean(document.fullscreenElement));
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
    setShowControls(true);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
    setShowControls(true);
    clearHideControls();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    scheduleHideControls();
  };

  const handleMouseMove = () => {
    setShowControls(true);
    scheduleHideControls();
  };

  const handleDoubleClick = () => {
    toggleFullscreen();
  };

  useEffect(() => {
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange,
      );

      clearHideControls();
    };
  }, []);

  // useEffect(() => {
  //   const handleKeyboard = (event: KeyboardEvent) => {
  //     const activeElement = document.activeElement;

  //     if (
  //       activeElement instanceof HTMLInputElement ||
  //       activeElement instanceof HTMLButtonElement
  //     ) {
  //       return;
  //     }

  //     switch (event.code) {
  //       case "Space":
  //         event.preventDefault();
  //         togglePlay();
  //         break;

  //       case "KeyM":
  //         toggleMute();
  //         break;

  //       case "KeyF":
  //         toggleFullscreen();
  //         break;

  //       case "ArrowRight":
  //         if (videoRef.current) {
  //           videoRef.current.currentTime = Math.min(
  //             videoRef.current.currentTime + 5,
  //             videoRef.current.duration,
  //           );
  //         }
  //         revealControls();
  //         break;

  //       case "ArrowLeft":
  //         if (videoRef.current) {
  //           videoRef.current.currentTime = Math.max(
  //             videoRef.current.currentTime - 5,
  //             0,
  //           );
  //         }
  //         revealControls();
  //         break;
  //     }
  //   };

  //   window.addEventListener("keydown", handleKeyboard);

  //   return () => {
  //     window.removeEventListener("keydown", handleKeyboard);
  //   };
  // }, [isPlaying, isMuted]);

  return (
    <div
      ref={containerRef}
      className="
        group relative  w-full max-w-[720px]
        overflow-hidden rounded-2xl
        border border-white/[0.08]
        bg-black
        shadow-[0_25px_80px_rgba(0,0,0,0.45)]
      "
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >

      <video
        ref={videoRef}
        src={src}
        poster={poster}
        preload="metadata"
        playsInline
        onClick={togglePlay}
        onDoubleClick={handleDoubleClick}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleVideoEnd}
        className="
          aspect-video
          w-full
          cursor-pointer
          bg-black
          object-contain
          select-none
        "
      />

      {isLoading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      )}


      <div
        className={`
          pointer-events-none absolute inset-0
          bg-black/30
          transition-opacity duration-300
          ${!isPlaying ? "opacity-100" : "opacity-0"}
        `}
      />


      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pausar vídeo" : "Reproduzir vídeo"}
        className={`
          absolute left-1/2 top-1/2
          flex h-16 w-16
          -translate-x-1/2 -translate-y-1/2
          items-center justify-center
          rounded-full
          border border-white/20
          bg-white/10
          text-white
          shadow-2xl
          backdrop-blur-xl
          transition-all duration-300
          hover:scale-110 hover:bg-white/20
          active:scale-95
          ${isPlaying ? "pointer-events-none scale-75 opacity-0" : "opacity-100"}
        `}
      >
        {isPlaying ? (
          <Pause className="h-7 w-7 fill-white" />
        ) : (
          <Play className="ml-1 h-7 w-7 fill-white" />
        )}
      </button>

      {/* Download */}
      <a
        href={src}
        download
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Baixar vídeo"
        title="Baixar vídeo"
        className={`
          absolute right-4 top-4
          flex h-10 w-10
          items-center justify-center
          rounded-xl
          border border-white/10
          bg-black/40
          text-white
          shadow-lg
          backdrop-blur-xl
          transition-all duration-300
          hover:scale-105
          hover:bg-white/10
          ${showControls ? "opacity-100" : "opacity-0"}
        `}
      >
        <Download className="h-4 w-4" />
      </a>

      {/* Controles */}
      <div
        className={`
          absolute inset-x-0 bottom-0
          p-4 pt-14
          bg-gradient-to-t
          from-black/90
          via-black/55
          to-transparent
          transition-all duration-300
          ${
            showControls || !isPlaying
              ? "translate-y-0 opacity-100"
              : "pointer-events-none translate-y-2 opacity-0"
          }
        `}
      >

        <div className="relative mb-3 flex h-4 items-center">
          <div className="pointer-events-none absolute left-0 right-0 h-1.5 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>

          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progress}
            onChange={handleSeek}
            aria-label="Progresso do vídeo"
            className="
              relative z-10
              h-4 w-full
              cursor-pointer
              appearance-none
              bg-transparent
              accent-white
            "
          />
        </div>


        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">

            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pausar" : "Reproduzir"}
              className="
                text-white
                transition-transform
                hover:scale-110
              "
            >
              {isPlaying ? (
                <Pause className="h-5 w-5 fill-white" />
              ) : (
                <Play className="h-5 w-5 fill-white" />
              )}
            </button>

            {/* Volume */}
            <div className="group/volume flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? "Ativar som" : "Silenciar"}
                className="
                  text-white
                  transition-transform
                  hover:scale-110
                "
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </button>

              <div
                className="
                  w-0 overflow-hidden opacity-0
                  transition-all duration-200
                  group-hover/volume:w-20
                  group-hover/volume:opacity-100
                "
              >
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  aria-label="Volume"
                  className="
                    h-1 w-20
                    cursor-pointer
                    appearance-none
                    rounded-full
                    bg-white/30
                    accent-white
                  "
                />
              </div>
            </div>

            <span className="text-xs font-medium tabular-nums text-white/80">
              {formatTime(currentTime)}
              <span className="mx-1.5 text-white/30">/</span>
              {formatTime(duration)}
            </span>
          </div>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={
              isFullscreen
                ? "Sair da tela cheia"
                : "Entrar em tela cheia"
            }
            className="
              text-white
              transition-transform
              hover:scale-110
            "
          >
            {isFullscreen ? (
              <Minimize className="h-5 w-5" />
            ) : (
              <Maximize className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>


      {isFullscreen && (
        <style jsx>{`
          div:fullscreen {
            width: 100vw;
            height: 100vh;
            max-width: none;
            border-radius: 0;
          }

          div:fullscreen video {
            width: 100%;
            height: 100%;
            aspect-ratio: auto;
          }
        `}</style>
      )}
    </div>
  );
}