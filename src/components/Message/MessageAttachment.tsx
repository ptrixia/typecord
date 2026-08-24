"use client";

import { useEffect, useState } from "react";
import { Download, File, Loader2, RefreshCw } from "lucide-react";

import VideoPlayer from "../VideoPlayer";
import ImageAttachment from "./ImageAttachment";

export interface MessageAttachmentData {
  id?: string;
  url?: string;
  key: string;
  name: string;
  size?: number;
  contentType?: string;
}

interface MessageAttachmentProps {
  attachment: MessageAttachmentData;
}

function formatFileSize(bytes?: number) {
  if (!bytes || bytes <= 0) return "Tamanho desconhecido";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function getFileType(contentType?: string, fileName?: string) {
  if (contentType) return contentType.toLowerCase();

  const extension = fileName?.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "png": return "image/png";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    case "bmp": return "image/bmp";
    case "svg": return "image/svg+xml";
    case "avif": return "image/avif";
    case "mp4": return "video/mp4";
    case "webm": return "video/webm";
    case "mov": return "video/quicktime";
    case "mkv": return "video/x-matroska";
    case "mp3": return "audio/mpeg";
    case "wav": return "audio/wav";
    case "ogg":
    case "oga": return "audio/ogg";
    case "m4a": return "audio/mp4";
    case "aac": return "audio/aac";
    case "flac": return "audio/flac";
    case "pdf": return "application/pdf";
    default: return "application/octet-stream";
  }
}

function buildFileUrl(key: string) {
  return `/api/files?key=${encodeURIComponent(key)}`;
}

export default function MessageAttachment({ attachment }: MessageAttachmentProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadFileUrl = () => {
    if (!attachment.key) {
      setError(true);
      setLoading(false);
      setUrl(null);
      return;
    }
    setLoading(true);
    setError(false);
    setUrl(buildFileUrl(attachment.key));
    setLoading(false);
  };

  useEffect(() => {
    loadFileUrl();
  }, [attachment.key]);

  if (loading) {
    return (
      <div className="mt-2 flex h-20 w-[360px] max-w-full items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-100 px-4 dark:border-zinc-700 dark:bg-zinc-800">
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-zinc-500" />
        <div className="min-w-0">
          <p className="truncate text-sm text-zinc-700 dark:text-zinc-200">{attachment.name}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Carregando arquivo...</p>
        </div>
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className="mt-2 flex max-w-[420px] items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/20">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-200 dark:bg-zinc-800">
          <File className="h-5 w-5 text-zinc-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{attachment.name}</p>
          <p className="text-xs text-red-500">Não foi possível carregar o arquivo.</p>
        </div>
        <button
          type="button"
          onClick={loadFileUrl}
          className="rounded-md p-2 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-white"
          title="Tentar novamente"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const type = getFileType(attachment.contentType, attachment.name);

  if (type.startsWith("image/")) {
    return <ImageAttachment url={url} name={attachment.name} size={attachment.size} />;
  }

  if (type.startsWith("video/")) {
    return (
      <div className="mt-2 max-w-[500px] overflow-hidden rounded-lg border border-zinc-200 bg-black shadow-sm dark:border-zinc-700">
        <VideoPlayer src={url} />
        <div className="border-t border-zinc-800 bg-zinc-950 px-3 py-2">
          <p className="truncate text-xs text-zinc-300">{attachment.name}</p>
          {attachment.size && <p className="mt-0.5 text-[11px] text-zinc-500">{formatFileSize(attachment.size)}</p>}
        </div>
      </div>
    );
  }

  if (type.startsWith("audio/")) {
    return (
      <div className="mt-2 flex max-w-[420px] items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-100 p-3 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-indigo-500 text-white">
          <File className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-2 truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{attachment.name}</p>
          <audio src={url} controls preload="metadata" className="h-9 w-full" onError={() => setError(true)} />
          {attachment.size && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{formatFileSize(attachment.size)}</p>}
        </div>
      </div>
    );
  }

  if (type === "application/pdf") {
    return (
      <div className="mt-2 max-w-[500px] overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
        <iframe src={url} title={attachment.name} className="h-[500px] w-full bg-white" />
        <div className="flex items-center gap-2 border-t border-zinc-200 bg-zinc-100 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
          <File className="h-4 w-4 shrink-0 text-red-500" />
          <div className="min-w-0 flex-1">
            <span className="block truncate text-xs text-zinc-600 dark:text-zinc-300">{attachment.name}</span>
            {attachment.size && <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">{formatFileSize(attachment.size)}</span>}
          </div>
          <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs font-medium text-indigo-500 hover:underline">
            Abrir
          </a>
        </div>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={attachment.name}
      className="mt-2 flex max-w-[420px] items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-100 p-3 transition hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-indigo-500 text-white">
        <File className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{attachment.name}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{formatFileSize(attachment.size)}</p>
      </div>
      <Download className="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
    </a>
  );
}