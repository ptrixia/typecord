"use client";

import { Reply } from "lucide-react";

export interface MessageReplyData {
    messageId: string;
    author: string;
    content: string;
    avatarUrl?: string | null;
}

interface MessageReplyProps {
    reply: MessageReplyData;
    onClick?: () => void;
}

export default function MessageReply({
    reply,
    onClick,
}: MessageReplyProps) {
    return (
        <button
            type="button"
            onClick={onClick}
        className="group/reply flex max-w-[680px] items-center gap-2 rounded-md border-l-2 border-indigo-400/70 bg-indigo-500/[0.06] px-2 py-1 text-left transition hover:bg-indigo-500/[0.12] dark:border-indigo-400/60 dark:bg-indigo-400/[0.06]"
        >
            <div className="relative h-5 w-6 shrink-0">
                <div className="absolute left-4 top-1 h-4 w-5 rounded-tl-md border-l-2 border-t-2 border-zinc-400/60 dark:border-zinc-600" />
            </div>

            <Reply className="h-3.5 w-3.5 shrink-0 text-indigo-500" />

            {reply.avatarUrl ? (
                <img
                    src={reply.avatarUrl}
                    alt=""
                    className="h-4 w-4 rounded-full object-cover"
                />
            ) : (
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[8px] font-bold text-white">
                    {reply.author.charAt(0).toUpperCase()}
                </div>
            )}

            <span className="shrink-0 text-xs font-semibold text-zinc-600 group-hover/reply:text-zinc-800 dark:text-zinc-400 dark:group-hover/reply:text-zinc-200">
                {reply.author}
            </span>

            <span className="truncate text-xs text-zinc-500 dark:text-zinc-500">
                {reply.content.replace(/\n/g, " ").slice(0, 100)}
            </span>
        </button>
    );
}
