"use client";

import {
    Copy,
    MoreVertical,
    Reply,
    SmilePlus,
} from "lucide-react";

import MessageContent from "./MessageContent";
import MessageReply, {
    MessageReplyData,
} from "./MessageReply";
import { MessageAttachmentData } from "./MessageAttachment";
import { MessageEmbedData } from "./MessageEmbed";

export interface MessageData {
    id: string;

    author: string;
    authorId?: string;

    authorColor?: string;
    avatarColor?: string;
    avatarUrl?: string | null;

    time: string;

    content: string;

    reply?: MessageReplyData | null;

    attachments?: MessageAttachmentData[];
    embeds?: MessageEmbedData[];

    isPending?: boolean;

    /*
     * Indica que a mensagem foi enviada
     * por um bot.
     */
    isBot?: boolean;

    /*
     * Indica que a mensagem veio de um webhook.
     */
    isWebhook?: boolean;
}

interface MessageItemProps {
    message: MessageData;

    users?: any[];
    channels?: any[];

    isMenuOpen: boolean;

    onReply: (message: MessageData) => void;
    onMenu: (messageId: string) => void;
    onCopy: (text: string) => void;
    onReact: (message: MessageData) => void;
}

export default function MessageItem({
    message,
    users = [],
    channels = [],
    isMenuOpen,
    onReply,
    onMenu,
    onCopy,
    onReact,
}: MessageItemProps) {

    return (
        <div
            className={`group relative -mx-2 flex w-full gap-3 rounded-md p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${
                message.isPending
                    ? "opacity-50"
                    : "opacity-100"
            }`}
        >
            {/* Barra de ações */}
            <div className="absolute right-4 -top-3 hidden items-center rounded-md border border-zinc-200 bg-white shadow-md group-hover:flex dark:border-zinc-700 dark:bg-[#313338]">
                <button
                    onClick={() => onReact(message)}
                    className="rounded-l-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                    title="Adicionar reação"
                >
                    <SmilePlus className="h-4 w-4" />
                </button>

                <button
                    onClick={() => onReply(message)}
                    className="p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                    title="Responder"
                >
                    <Reply className="h-4 w-4" />
                </button>

                <div className="relative">
                    <button
                        onClick={() =>
                            onMenu(
                                isMenuOpen
                                    ? ""
                                    : message.id
                            )
                        }
                        className="rounded-r-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                        title="Mais opções"
                    >
                        <MoreVertical className="h-4 w-4" />
                    </button>

                    {isMenuOpen && (
                        <div className="absolute right-0 top-8 z-50 w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 text-xs shadow-xl dark:border-zinc-700 dark:bg-[#2b2d31]">
                            <button
                                onClick={() =>
                                    onCopy(message.content)
                                }
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-zinc-700 hover:bg-indigo-600 hover:text-white dark:text-zinc-200"
                            >
                                <Copy className="h-3.5 w-3.5" />
                                Copiar conteúdo
                            </button>

                            <button
                                onClick={() =>
                                    onCopy(message.id)
                                }
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-zinc-700 hover:bg-indigo-600 hover:text-white dark:text-zinc-200"
                            >
                                <Copy className="h-3.5 w-3.5" />
                                Copiar ID
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Avatar */}
            {message.avatarUrl ? (
                <img
                    src={message.avatarUrl}
                    alt=""
                    className="mt-1 h-10 w-10 shrink-0 rounded-full object-cover"
                />
            ) : (
                <div
                    className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        message.avatarColor ||
                        "bg-indigo-600"
                    } text-sm font-bold text-white`}
                >
                    {message.author
                        ? message.author
                              .charAt(0)
                              .toUpperCase()
                        : "?"}
                </div>
            )}

            <div className="min-w-0 flex-1">
                {/* Reply */}
                {message.reply && (
                    <MessageReply
                        reply={message.reply}
                    />
                )}

                {/* Header */}
                <div className="flex items-center gap-2">
                    <span
                        className={`cursor-pointer font-semibold hover:underline ${
                            message.authorColor ||
                            "text-indigo-500"
                        }`}
                    >
                        {message.author}
                    </span>

                    {/* BOT */}
                    {message.isBot && (
                        <span className="rounded bg-indigo-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            BOT
                        </span>
                    )}

                    {/* WEBHOOK */}
                    {!message.isBot &&
                        message.isWebhook && (
                            <span className="rounded bg-indigo-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                WEBHOOK
                            </span>
                        )}

                    <span className="text-xs text-zinc-500">
                        {message.time}
                    </span>
                </div>

                {/* Conteúdo */}
                <MessageContent
                    content={message.content}
                    attachments={message.attachments}
                    embeds={message.embeds}
                    users={users}
                    channels={channels}
                />
            </div>
        </div>
    );
}