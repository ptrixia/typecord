"use client";

import {
  ExternalLink,
} from "lucide-react";

import MarkdownRenderer from "./MarkDownRenderer";

export interface MessageEmbedData {
  url?: string;
  title?: string;
  description?: string;
  siteName?: string;
  color?: string;
  image?: string;
  thumbnail?: string;
}

interface MessageEmbedProps {
  embed: MessageEmbedData;
  users?: any[];
  channels?: any[];
}

export default function MessageEmbed({
  embed,
  users = [],
  channels = [],
}: MessageEmbedProps) {
  const hasContent =
    Boolean(
      embed.siteName ||
        embed.title ||
        embed.description ||
        embed.image ||
        embed.thumbnail,
    );

  if (!hasContent) {
    return null;
  }

  return (
    <article
      className="mt-2 w-fit max-w-[520px] overflow-hidden rounded-md border border-zinc-200 bg-stone-100 dark:border-zinc-700 dark:bg-[#2b2d31]"
      style={{
        borderLeftWidth: 4,
        borderLeftColor:
          embed.color ||
          "#5865F2",
      }}
    >
      <div className="p-3">
        {embed.siteName && (
          <div className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {embed.siteName}
          </div>
        )}

        {embed.title && (
          <div className="flex items-start gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {embed.url ? (
              <a
                href={
                  embed.url
                }
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 break-words text-indigo-600 hover:underline dark:text-indigo-300"
              >
                {embed.title}
              </a>
            ) : (
              <span className="min-w-0 break-words">
                {embed.title}
              </span>
            )}

            {embed.url && (
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
            )}
          </div>
        )}

        {embed.description && (
          <div className="mt-1 max-w-[490px] overflow-hidden">
            <MarkdownRenderer
              content={
                embed.description
              }
              users={users}
              channels={
                channels
              }
              variant="embed"
            />
          </div>
        )}

        {embed.thumbnail &&
          !embed.image && (
            <a
              href={
                embed.url ||
                embed.thumbnail
              }
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block w-fit"
            >
              <img
                src={
                  embed.thumbnail
                }
                alt={
                  embed.title ||
                  "Miniatura"
                }
                loading="lazy"
                className="max-h-[160px] max-w-[220px] rounded-md object-cover"
              />
            </a>
          )}

        {embed.image && (
          <a
            href={
              embed.url ||
              embed.image
            }
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block"
          >
            <img
              src={
                embed.image
              }
              alt={
                embed.title ||
                "Imagem da prévia"
              }
              loading="lazy"
              className="max-h-[320px] w-auto max-w-full rounded-md object-contain"
            />
          </a>
        )}
      </div>
    </article>
  );
}