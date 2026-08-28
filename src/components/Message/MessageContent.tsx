"use client";

import MarkdownRenderer from "./MarkDownRenderer";

import MessageAttachment, {
  MessageAttachmentData,
} from "./MessageAttachment";

import MessageEmbed, {
  MessageEmbedData,
} from "./MessageEmbed";

interface MessageContentProps {
  content?: string | null;

  attachments?: MessageAttachmentData[];

  embeds?: MessageEmbedData[];
  voiceMessage?: {
    url?: string | null;
    key?: string | null;
    durationSeconds?: number;
  } | null;
  poll?: {
    id: string;
    question: string;
    allowMultiple?: boolean;
    expiresAt?: string | null;
    options: Array<{
      id: string;
      label: string;
      count: number;
      votedByMe?: boolean;
    }>;
  } | null;

  users?: any[];

  channels?: any[];
  onPollVote?: (optionId: string) => void;
}

export default function MessageContent({
  content,
  attachments = [],
  embeds = [],
  voiceMessage,
  poll,
  users = [],
  channels = [],
  onPollVote,
}: MessageContentProps) {
  const hasContent =
    typeof content ===
      "string" &&
    content.trim().length >
      0;

  return (
    <div className="min-w-0 max-w-full">
      {hasContent && (
        <div className="break-words">
          <MarkdownRenderer
            content={content}
            users={users}
            channels={
              channels
            }
          />
        </div>
      )}

      {attachments.length >
        0 && (
        <div className="flex flex-col gap-1">
          {attachments.map(
            (
              attachment,
              index,
            ) => (
              <MessageAttachment
                key={
                  attachment.id ??
                  `${
                    attachment.key ??
                    attachment.url
                  }-${index}`
                }
                attachment={
                  attachment
                }
              />
            ),
          )}
        </div>
      )}

      {voiceMessage?.url && (
        <div className="mt-2 max-w-md rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/70">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
            Mensagem de voz
          </div>
          <audio
            controls
            preload="metadata"
            src={
              voiceMessage.url.startsWith("/api/files")
                ? voiceMessage.url
                : `/api/files?key=${encodeURIComponent(voiceMessage.url)}`
            }
            className="w-full"
          />
        </div>
      )}

      {poll && poll.options.length > 0 && (
        <div className="mt-2 max-w-lg rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/70">
          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
            {poll.question}
          </div>
          <div className="mt-3 space-y-2">
            {poll.options.map((option) => {
              const total = Math.max(
                1,
                poll.options.reduce((sum, item) => sum + item.count, 0),
              );
              const percent = Math.round((option.count / total) * 100);

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onPollVote?.(option.id)}
                  className={`relative flex w-full items-center justify-between overflow-hidden rounded-md border px-3 py-2 text-left text-sm transition ${
                    option.votedByMe
                      ? "border-indigo-400 bg-indigo-500/10 text-indigo-700 dark:text-indigo-200"
                      : "border-zinc-200 bg-white hover:border-indigo-300 dark:border-zinc-700 dark:bg-[#111214] dark:hover:border-indigo-500/50"
                  }`}
                >
                  <span
                    className="absolute inset-y-0 left-0 bg-indigo-500/10"
                    style={{ width: `${percent}%` }}
                  />
                  <span className="relative min-w-0 truncate font-medium">
                    {option.label}
                  </span>
                  <span className="relative shrink-0 text-xs font-bold text-zinc-500">
                    {option.count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 text-[11px] text-zinc-500">
            {poll.allowMultiple ? "Múltipla escolha" : "Escolha única"}
          </div>
        </div>
      )}

      {embeds.length > 0 && (
        <div className="flex flex-col gap-2">
          {embeds.map(
            (
              embed,
              index,
            ) => (
              <MessageEmbed
                key={
                  embed.url ??
                  `embed-${index}`
                }
                embed={embed}
                users={users}
                channels={
                  channels
                }
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
