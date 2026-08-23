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
            className="group/reply mb-1 flex max-w-[600px] items-center gap-2 text-left"
        >
            <div className="relative h-5 w-8 shrink-0">
                <div className="absolute left-4 top-1 h-4 w-5 rounded-tl-md border-l-2 border-t-2 border-zinc-400/60 dark:border-zinc-600" />
            </div>

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