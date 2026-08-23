"use client";

import { useEffect, useRef, useState } from "react";
import {
    Bell,
    Hash,
    Loader2,
    Pin,
    Plus,
    Reply,
    Smile,
    Users,
    Volume2,
    X,
    Gift,
} from "lucide-react";

import GifPicker from "./GifPicker";
import EmojiPicker, { Theme } from "emoji-picker-react";
import SearchCommand from "../SearchCommand";
import MessageItem, { MessageData } from "../Message/MessageItem";
import { sendMessageAction } from "@/actions/messages";
import { pusherClient } from "@/lib/pusher";

interface ChatAreaProps {
    channel: any;
    currentUser?: any;
    users?: any[];
    channels?: any[];
}

interface MentionSuggestion {
    id: string;
    name: string;
    type: "user" | "channel";
    avatarUrl?: string | null;
}

interface UploadingFile {
    name: string;
    progress: number;
}

function normalizeMessage(message: any): MessageData {
    let parsed: any = message;

    if (typeof message?.content === "string") {
        try {
            const json = JSON.parse(message.content);
            if (json && typeof json === "object" && ("content" in json || "attachments" in json || "reply" in json)) {
                parsed = { ...message, ...json };
            }
        } catch {}
    }

    const memberUser = parsed.member?.user || {};
    const authorName = parsed.author || parsed.authorName || memberUser.globalName || memberUser.displayName || memberUser.username || "Usuário";
    const authorId = parsed.authorId || parsed.userId || memberUser.id;
    const avatarUrl = parsed.avatarUrl ?? memberUser.avatarUrl ?? memberUser.avatar ?? null;
    const isWebhookMessage = memberUser.email === "webhook@typecord.bot" || parsed.isWebhook;

    return {
        id: String(parsed.id),
        isBot: Boolean(parsed.isBot),
        author: authorName,
        authorId: authorId ? String(authorId) : undefined,
        authorColor: isWebhookMessage ? "text-rose-500" : parsed.authorColor || "text-indigo-400",
        avatarColor: isWebhookMessage ? "bg-rose-600" : parsed.avatarColor || "bg-indigo-600",
        avatarUrl: avatarUrl,
        time: parsed.time || (parsed.createdAt ? new Date(parsed.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })),
        content: parsed.content || "",
        reply: parsed.reply || null,
        attachments: Array.isArray(parsed.attachments) ? parsed.attachments : [],
        embeds: Array.isArray(parsed.embeds) ? parsed.embeds : [],
        isPending: parsed.isPending,
        isWebhook: isWebhookMessage,
    };
}

export default function ChatArea({ channel, currentUser, users, channels }: ChatAreaProps) {
    const [isMounted, setIsMounted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [messages, setMessages] = useState<MessageData[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isGifOpen, setIsGifOpen] = useState(false);
    const [isEmojiOpen, setIsEmojiOpen] = useState(false);
    const [replyingTo, setReplyingTo] = useState<MessageData | null>(null);
    const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);
    const [typingUsers, setTypingUsers] = useState<string[]>([]);
    const [mentionSuggestions, setMentionSuggestions] = useState<MentionSuggestion[]>([]);
    const [mentionIndex, setMentionIndex] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

    const lastTypedRef = useRef<number>(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const prevScrollHeightRef = useRef<number>(0);

    const currentUserName = currentUser?.globalName || currentUser?.displayName || currentUser?.username || currentUser?.name || "Usuário";
    const currentUserId = String(currentUser?.id ?? "");
    const currentUserAvatar = currentUser?.avatarUrl ?? currentUser?.avatar ?? currentUser?.imageUrl ?? null;

    const usersList = users || (() => {
        const source = channel?.members || channel?.server?.members || channel?.guild?.members || channel?.users || [];
        const arr = Array.isArray(source) ? source : source?.values ? Array.from(source.values()) : [];
        return arr.map((item: any) => item?.user || item?.profile || item);
    })();

    const channelsList = channels || (() => {
        const source = channel?.server?.channels || channel?.guild?.channels || channel?.channels || [];
        return Array.isArray(source) ? source : source?.values ? Array.from(source.values()) : [];
    })();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const fetchMessages = async (cursor?: string) => {
        if (!channel?.id) return;

        if (cursor) {
            setIsLoadingMore(true);
        } else {
            setIsLoading(true);
        }

        try {
            const url = cursor 
                ? `/api/messages?channelId=${channel.id}&cursor=${cursor}` 
                : `/api/messages?channelId=${channel.id}`;
            
            const res = await fetch(url);
            if (!res.ok) return;

            const data = await res.json();
            const rawItems = Array.isArray(data.items) ? data.items : [];
            const normalizedItems = rawItems.map(normalizeMessage);

            const reversedItems = normalizedItems.reverse();

            setHasMore(Boolean(data.nextCursor));

            setMessages((prev) => {
                if (cursor) {
                    const existingIds = new Set(prev.map((m) => m.id));
                    const newUniqueItems = reversedItems.filter((m: { id: string; }) => !existingIds.has(m.id));
                    return [...newUniqueItems, ...prev];
                }
                return reversedItems;
            });
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    };

    useEffect(() => {
        if (!channel?.id) return;
        setMessages([]);
        setHasMore(true);
        fetchMessages();

        const channelName = `channel-${channel.id}`;
        const pusherChannel = pusherClient.subscribe(channelName);

        const handleNewMessage = (incoming: any) => {
            const newMessage = normalizeMessage(incoming);

            setMessages((prev) => {
                if (prev.some((m) => m.id === newMessage.id)) return prev;
                return [...prev, newMessage];
            });

            requestAnimationFrame(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            });
        };

        const handleTyping = (data: { userName: string }) => {
            if (data.userName === currentUserName) return;

            setTypingUsers((prev) => {
                if (prev.includes(data.userName)) return prev;
                return [...prev, data.userName];
            });

            setTimeout(() => {
                setTypingUsers((prev) => prev.filter((name) => name !== data.userName));
            }, 3000);
        };

        pusherChannel.bind("new-message", handleNewMessage);
        pusherChannel.bind("typing", handleTyping);

        return () => {
            pusherChannel.unbind("new-message", handleNewMessage);
            pusherChannel.unbind("typing", handleTyping);
            pusherClient.unsubscribe(channelName);
        };
    }, [channel?.id]);

    useEffect(() => {
        if (!isLoading && messages.length > 0 && !isLoadingMore) {
            messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        }
    }, [channel?.id]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.currentTarget;
        if (target.scrollTop === 0 && hasMore && !isLoadingMore && messages.length > 0) {
            prevScrollHeightRef.current = target.scrollHeight;
            const oldestMessageId = messages[0].id;
            fetchMessages(oldestMessageId).then(() => {
                if (chatContainerRef.current) {
                    const newScrollHeight = chatContainerRef.current.scrollHeight;
                    chatContainerRef.current.scrollTop = newScrollHeight - prevScrollHeightRef.current;
                }
            });
        }
    };

    const updateMentionSuggestions = (value: string, cursorPosition: number) => {
        const beforeCursor = value.slice(0, cursorPosition);
        const match = beforeCursor.match(/(?:^|\s)([@#])([^\s@#]*)$/);

        if (!match) {
            setMentionSuggestions([]);
            return;
        }

        const trigger = match[1];
        const query = match[2].toLowerCase();
        const suggestions: MentionSuggestion[] = [];

        if (trigger === "@") {
            usersList.forEach((user: any) => {
                const id = String(user?.id ?? user?.userId ?? "");
                const name = user?.globalName || user?.displayName || user?.username || user?.name || "";

                if (!id || !name) return;

                if (!query || name.toLowerCase().includes(query)) {
                    suggestions.push({
                        id,
                        name,
                        type: "user",
                        avatarUrl: user?.avatarUrl ?? user?.avatar ?? user?.imageUrl ?? null,
                    });
                }
            });
        }

        if (trigger === "#") {
            channelsList.forEach((item: any) => {
                const id = String(item?.id ?? "");
                const name = item?.name || "";

                if (!id || !name) return;

                if (!query || name.toLowerCase().includes(query)) {
                    suggestions.push({
                        id,
                        name,
                        type: "channel",
                    });
                }
            });
        }

        setMentionSuggestions(suggestions.slice(0, 8));
        setMentionIndex(0);
    };

    const selectMention = (suggestion: MentionSuggestion) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const cursor = textarea.selectionStart;
        const before = inputValue.slice(0, cursor);
        const after = inputValue.slice(cursor);
        const match = before.match(/(?:^|\s)([@#])([^\s@#]*)$/);

        if (!match) return;

        const start = before.length - match[0].length;
        const prefix = before.slice(0, start) + (match[0].match(/^\s/) ? match[0][0] : "");
        const token = suggestion.type === "user" ? `<@${suggestion.id}>` : `<#${suggestion.id}>`;
        const newValue = `${prefix}${token} ${after}`;

        setInputValue(newValue);
        setMentionSuggestions([]);
        textarea.focus();

        requestAnimationFrame(() => {
            const position = prefix.length + token.length + 1;
            textarea.setSelectionRange(position, position);
        });
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        const cursorPosition = e.target.selectionStart;
        setInputValue(value);

        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 250)}px`;
        }

        updateMentionSuggestions(value, cursorPosition);

        const now = Date.now();
        if (now - lastTypedRef.current > 2000 && channel?.id) {
            lastTypedRef.current = now;
            fetch("/api/typing", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ channelId: channel.id, userName: currentUserName }),
            }).catch(() => {});
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (mentionSuggestions.length > 0) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionIndex((prev) => Math.min(prev + 1, mentionSuggestions.length - 1));
                return;
            }

            if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionIndex((prev) => Math.max(prev - 1, 0));
                return;
            }

            if (e.key === "Tab" || e.key === "Enter") {
                e.preventDefault();
                selectMention(mentionSuggestions[mentionIndex]);
                return;
            }

            if (e.key === "Escape") {
                e.preventDefault();
                setMentionSuggestions([]);
                return;
            }
        }

        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (inputValue.trim() !== "" || replyingTo) {
                sendMessage();
            }
        }
    };

    const uploadFile = async (file: File) => {
        setIsUploading(true);
        setUploadingFiles((prev) => [...prev, { name: file.name, progress: 0 }]);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Falha no upload");
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || "Falha no upload");
            }

            const attachment = {
                id: crypto.randomUUID(),
                key: data.key,
                name: data.name || file.name,
                size: data.size ?? file.size,
                contentType: data.contentType || file.type || "application/octet-stream",
            };

            setUploadingFiles((prev) => prev.map((item) => (item.name === file.name ? { ...item, progress: 100 } : item)));

            await sendMessage(inputValue.trim(), [attachment]);
            setInputValue("");
            setReplyingTo(null);
        } catch (error) {
            alert(`Não foi possível enviar ${file.name}`);
        } finally {
            setIsUploading(false);
            setTimeout(() => {
                setUploadingFiles((prev) => prev.filter((item) => item.name !== file.name));
            }, 500);
        }
    };

    const handleFiles = async (files: FileList | File[]) => {
        const list = Array.from(files);
        const maxSize = 25 * 1024 * 1024;

        for (const file of list) {
            if (file.size > maxSize) {
                alert(`${file.name} é maior que 25 MB.`);
                continue;
            }
            await uploadFile(file);
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            handleFiles(e.target.files);
        }
        e.target.value = "";
    };

    const sendMessage = async (text = inputValue.trim(), attachments: any[] = []) => {
        if (!channel?.id) return;
        if (!text && attachments.length === 0) return;

        const payload = {
            content: text,
            reply: replyingTo
                ? {
                      messageId: replyingTo.id,
                      author: replyingTo.author,
                      content: replyingTo.content,
                      avatarUrl: replyingTo.avatarUrl ?? null,
                  }
                : null,
            attachments,
            embeds: [],
        };

        setInputValue("");
        setReplyingTo(null);
        setMentionSuggestions([]);

        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
        }

        try {
            await sendMessageAction(channel.id, JSON.stringify(payload));
        } catch (error) {
            alert("Não foi possível enviar a mensagem.");
        }
    };

    const handleSendMedia = (url: string) => {
        sendMessage(`![GIF](${url})`);
        setIsGifOpen(false);
    };

    const handleSelectEmoji = (emojiData: any) => {
        setInputValue((prev) => prev + emojiData.emoji);
        textareaRef.current?.focus();
    };

    const toggleGif = () => {
        setIsGifOpen((prev) => !prev);
        setIsEmojiOpen(false);
    };

    const toggleEmoji = () => {
        setIsEmojiOpen((prev) => !prev);
        setIsGifOpen(false);
    };

    if (!isMounted) return null;

    if (!channel) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <span className="text-zinc-500">Nenhum canal selecionado</span>
            </div>
        );
    }

    const isVoiceChannel = channel.type === "GUILD_VOICE";

    return (
        <div className="relative flex min-w-0 flex-1 flex-col bg-transparent" onClick={() => setActiveMenuMessageId(null)}>
            <div className="flex h-12 items-center justify-between border-b border-stone-300 px-4 shadow-sm dark:border-zinc-800/50">
                <div className="flex items-center gap-2 font-semibold text-zinc-800 dark:text-zinc-100">
                    {isVoiceChannel ? <Volume2 className="h-5 w-5 text-zinc-500" /> : <Hash className="h-5 w-5 text-zinc-500" />}
                    {channel.name}
                </div>

                <div className="flex items-center gap-4 text-zinc-500 dark:text-zinc-400">
                    <Bell className="h-5 w-5 cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200" />
                    <Pin className="h-5 w-5 cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200" />
                    <Users className="h-5 w-5 cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200" />
                    <SearchCommand />
                </div>
            </div>

            <div 
                ref={chatContainerRef}
                onScroll={handleScroll}
                className="custom-scrollbar flex-1 overflow-x-hidden overflow-y-auto p-4"
            >
                {isLoading ? (
                    <div className="flex h-full items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 pt-2">
                        {isLoadingMore && (
                            <div className="flex justify-center py-2">
                                <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                            </div>
                        )}
                        {messages.map((message) => (
                            <MessageItem
                                key={message.id}
                                message={message}
                                users={usersList}
                                channels={channelsList}
                                isMenuOpen={activeMenuMessageId === message.id}
                                onReply={(msg) => {
                                    setReplyingTo(msg);
                                    textareaRef.current?.focus();
                                }}
                                onMenu={(id) => setActiveMenuMessageId(id || null)}
                                onCopy={(text) => {
                                    navigator.clipboard.writeText(text);
                                    setActiveMenuMessageId(null);
                                }}
                                onReact={() => {}}
                            />
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            <div className="relative p-4 pt-1">
                <div className="mb-1 flex h-5 items-center gap-1.5 px-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {typingUsers.length > 0 && (
                        <>
                            <div className="flex items-center gap-1">
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.3s]" />
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.15s]" />
                                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500" />
                            </div>
                            <span className="truncate font-semibold">
                                {typingUsers.length === 1 ? `${typingUsers[0]} está digitando...` : "Várias pessoas estão digitando..."}
                            </span>
                        </>
                    )}
                </div>

                {mentionSuggestions.length > 0 && (
                    <div className="absolute bottom-[82px] left-4 z-50 w-[320px] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-[#2b2d31]">
                        <div className="border-b border-zinc-200 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:border-zinc-700">
                            {mentionSuggestions[0].type === "user" ? "Membros" : "Canais"}
                        </div>

                        {mentionSuggestions.map((suggestion, index) => (
                            <button
                                key={`${suggestion.type}-${suggestion.id}`}
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    selectMention(suggestion);
                                }}
                                className={`flex w-full items-center gap-3 px-3 py-2 text-left ${
                                    index === mentionIndex
                                        ? "bg-indigo-500 text-white"
                                        : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-700"
                                }`}
                            >
                                {suggestion.type === "user" ? (
                                    suggestion.avatarUrl ? (
                                        <img src={suggestion.avatarUrl} className="h-7 w-7 rounded-full object-cover" alt="" />
                                    ) : (
                                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white">
                                            {suggestion.name.charAt(0).toUpperCase()}
                                        </div>
                                    )
                                ) : (
                                    <Hash className="h-5 w-5 opacity-70" />
                                )}
                                <span className="truncate text-sm font-medium">{suggestion.name}</span>
                            </button>
                        ))}
                    </div>
                )}

                {isGifOpen && (
                    <div className="absolute bottom-[80px] right-24 z-50">
                        <GifPicker onSendGif={handleSendMedia} />
                    </div>
                )}

                {isEmojiOpen && (
                    <div className="absolute bottom-[80px] right-4 z-50 shadow-xl">
                        <EmojiPicker onEmojiClick={handleSelectEmoji} theme={Theme.AUTO} lazyLoadEmojis />
                    </div>
                )}

                <div className="flex flex-col rounded-lg bg-stone-300/50 px-3 py-2 dark:bg-[#383a40]">
                    {replyingTo && (
                        <div className="flex items-center gap-2 border-b border-stone-400/20 pb-2 text-xs dark:border-zinc-700/50">
                            <Reply className="h-3.5 w-3.5 text-zinc-500" />
                            <span className="text-zinc-500">Respondendo a</span>
                            <strong className="text-zinc-700 dark:text-zinc-200">{replyingTo.author}</strong>
                            <button
                                onClick={() => setReplyingTo(null)}
                                className="ml-auto rounded p-1 text-zinc-500 hover:bg-zinc-300 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-white"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}

                    {uploadingFiles.length > 0 && (
                        <div className="mb-2 border-b border-zinc-400/20 pb-2">
                            {uploadingFiles.map((file) => (
                                <div key={file.name} className="flex items-center gap-2 text-xs text-zinc-500">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    <span className="truncate">Enviando {file.name}...</span>
                                    <span>{file.progress}%</span>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex min-h-[44px] w-full items-center gap-3">
                        <button
                            type="button"
                            disabled={isUploading}
                            onClick={() => fileInputRef.current?.click()}
                            className="shrink-0 text-zinc-500 hover:text-zinc-800 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-200"
                            title="Enviar arquivo"
                        >
                            <Plus className="h-5 w-5" />
                        </button>

                        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput} />

                        <textarea
                            ref={textareaRef}
                            value={inputValue}
                            onChange={handleInput}
                            onKeyDown={handleKeyDown}
                            maxLength={8000}
                            rows={1}
                            placeholder={replyingTo ? `Responder a ${replyingTo.author}...` : `Conversar em #${channel.name}`}
                            className="custom-scrollbar flex-1 resize-none self-center bg-transparent text-sm leading-5 text-zinc-900 outline-none placeholder:text-zinc-500 dark:text-zinc-100 dark:placeholder:text-zinc-400"
                        />

                        <div className="flex shrink-0 items-center gap-3 text-zinc-500 dark:text-zinc-400">
                            <Gift className="h-5 w-5 cursor-pointer hover:text-zinc-800 dark:hover:text-zinc-200" />
                            <button
                                type="button"
                                onClick={toggleGif}
                                className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                                    isGifOpen ? "bg-zinc-300 text-zinc-900 dark:bg-zinc-600 dark:text-zinc-100" : "hover:bg-zinc-300 hover:text-zinc-800 dark:hover:bg-zinc-600 dark:hover:text-zinc-200"
                                }`}
                            >
                                GIF
                            </button>
                            <Smile
                                onClick={toggleEmoji}
                                className={`h-5 w-5 cursor-pointer ${
                                    isEmojiOpen ? "text-zinc-900 dark:text-zinc-100" : "hover:text-zinc-800 dark:hover:text-zinc-200"
                                }`}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}