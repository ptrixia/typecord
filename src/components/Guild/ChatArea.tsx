"use client";

import { useState, useRef, useEffect } from "react";
import { Hash, Search, Users, Bell, Pin, Plus, Gift, StickyNote, Smile, Volume2, Loader2, MoreVertical, Reply, Copy, SmilePlus, X } from "lucide-react";
import GifPicker from "./GifPicker";
import EmojiPicker, { Theme } from "emoji-picker-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import VideoPlayer from "../VideoPlayer";
import SearchCommand from "../SearchCommand";

import { getMessages, sendMessageAction } from "@/actions/messages"; 
import { pusherClient } from "@/lib/pusher";

interface Message {
    id: string; 
    author: string;
    authorColor: string;
    avatarColor: string;
    avatarUrl?: string | null;
    time: string;
    content: string;
    isPending?: boolean;
    isWebhook?: boolean;
}

interface ChatAreaProps {
    channel: any;
    currentUser?: any; 
}

export default function ChatArea({ channel, currentUser }: ChatAreaProps) {
    const [isMounted, setIsMounted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState("");
    const [isGifOpen, setIsGifOpen] = useState(false);
    const [isEmojiOpen, setIsEmojiOpen] = useState(false);
    const [failedAvatars, setFailedAvatars] = useState<Set<string>>(new Set());
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!channel?.id) return;
        
        const fetchMessages = async () => {
            setIsLoading(true);
            try {
                const data = await getMessages(channel.id);
                setMessages(data);
            } catch (error) {
                console.error(error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchMessages();

        const channelName = `channel-${channel.id}`;
        pusherClient.subscribe(channelName);

        const handleNewMessage = (newMessage: Message) => {
            setMessages((prev) => {
                if (prev.some((m) => m.id === newMessage.id)) return prev;

                const pendingIndex = prev.findIndex(
                    (m) => m.isPending && m.content === newMessage.content
                );

                if (pendingIndex !== -1) {
                    return prev.map((msg, idx) => (idx === pendingIndex ? newMessage : msg));
                }

                return [...prev, newMessage];
            });
        };

        pusherClient.bind("new-message", handleNewMessage);

        return () => {
            pusherClient.unsubscribe(channelName);
            pusherClient.unbind("new-message", handleNewMessage);
        };
    }, [channel?.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(e.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 250)}px`;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (inputValue.trim() !== "") {
                sendMessage(inputValue.trim());
                setInputValue("");
                setReplyingTo(null);
                if (textareaRef.current) {
                    textareaRef.current.style.height = "auto";
                }
            }
        }
    };

    const handleSendMedia = (url: string) => {
        sendMessage(`![Media](${url})`);
        setIsGifOpen(false);
        setReplyingTo(null);
    };

    const handleSelectEmoji = (emojiData: any) => {
        setInputValue((prev) => prev + emojiData.emoji);
    };

    const sendMessage = async (text: string) => {
        if (!channel?.id) return;

        const finalContent = replyingTo ? `> Responder a @${replyingTo.author}: "${replyingTo.content}"\n\n${text}` : text;
        const tempId = `temp-${Date.now()}`;
        
        const optimisticMessage: Message = {
            id: tempId,
            author: currentUser?.globalName || currentUser?.username || "Você",
            authorColor: "text-indigo-400",
            avatarColor: "bg-indigo-600",
            avatarUrl: currentUser?.avatarUrl,
            time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            content: finalContent,
            isPending: true,
        };
        
        setMessages((prev) => [...prev, optimisticMessage]);

        try {
            await sendMessageAction(channel.id, finalContent);
        } catch (error) {
            console.error(error);
            setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
            alert("Não foi possível enviar a mensagem.");
        }
    };

    const toggleGif = () => {
        setIsGifOpen(!isGifOpen);
        setIsEmojiOpen(false);
    };

    const toggleEmoji = () => {
        setIsEmojiOpen(!isEmojiOpen);
        setIsGifOpen(false);
    };

    const handleAvatarError = (msgId: string) => {
        setFailedAvatars((prev) => new Set(prev).add(msgId));
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setActiveMenuMessageId(null);
    };

    const parseMessageContent = (content: string) => {
        const replyMatch = content.match(/^> Responder a @(.*?): "(.*?)"\n\n([\s\S]*)$/);
        if (replyMatch) {
            return {
                isReply: true,
                replyAuthor: replyMatch[1],
                replyContent: replyMatch[2],
                actualContent: replyMatch[3]
            };
        }
        return { isReply: false, actualContent: content };
    };

    if (!isMounted) return null;

    if (!channel) {
        return (
            <div className="flex flex-1 items-center justify-center bg-transparent">
                <span className="text-zinc-500">Nenhum canal selecionado</span>
            </div>
        );
    }

    const isVoiceChannel = channel.type === "GUILD_VOICE";

    return (
        <div className="relative flex min-w-0 flex-1 flex-col bg-transparent">
            <div className="flex h-12 items-center justify-between border-b border-stone-300 px-4 shadow-sm dark:border-zinc-800/50">
                <div className="flex items-center gap-2 font-semibold">
                    {isVoiceChannel ? (
                        <Volume2 className="h-5 w-5 text-stone-500" />
                    ) : (
                        <Hash className="h-5 w-5 text-stone-500" />
                    )}
                    {channel.name}
                </div>
                <div className="flex items-center gap-4 text-stone-500 dark:text-zinc-400">
                    <Bell className="h-5 w-5 cursor-pointer hover:text-stone-700 dark:hover:text-zinc-200" />
                    <Pin className="h-5 w-5 cursor-pointer hover:text-stone-700 dark:hover:text-zinc-200" />
                    <Users className="h-5 w-5 cursor-pointer hover:text-stone-700 dark:hover:text-zinc-200" />
                    <SearchCommand />
                </div>
            </div>

            <div className="custom-scrollbar flex-1 overflow-y-auto p-4 overflow-x-hidden">
                {isLoading ? (
                    <div className="flex h-full items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 pt-2">
                        {messages.map((msg) => {
                            const hasValidAvatar = msg.avatarUrl && !failedAvatars.has(msg.id);
                            const isMenuOpen = activeMenuMessageId === msg.id;
                            const parsed = parseMessageContent(msg.content);

                            return (
                                <div 
                                    key={msg.id} 
                                    className={`group relative flex w-full gap-3 rounded-md p-2 -mx-2 hover:bg-black/5 dark:hover:bg-white/5 transition-opacity ${msg.isPending ? 'opacity-50' : 'opacity-100'}`}
                                >
                                    <div className="absolute right-4 -top-3.5 hidden group-hover:flex items-center bg-white dark:bg-[#313338] border border-stone-200 dark:border-zinc-700 rounded-md shadow-md z-20">
                                        <button 
                                            onClick={() => {
                                                setInputValue((prev) => prev + "❤️ ");
                                                textareaRef.current?.focus();
                                            }}
                                            className="p-1.5 text-stone-500 hover:text-stone-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-stone-100 dark:hover:bg-zinc-700/50 rounded-l"
                                            title="Reagir"
                                        >
                                            <SmilePlus className="h-4 w-4" />
                                        </button>
                                        <button 
                                            onClick={() => setReplyingTo(msg)}
                                            className="p-1.5 text-stone-500 hover:text-stone-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-stone-100 dark:hover:bg-zinc-700/50"
                                            title="Responder"
                                        >
                                            <Reply className="h-4 w-4" />
                                        </button>
                                        <div className="relative">
                                            <button 
                                                onClick={() => setActiveMenuMessageId(isMenuOpen ? null : msg.id)}
                                                className="p-1.5 text-stone-500 hover:text-stone-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-stone-100 dark:hover:bg-zinc-700/50 rounded-r"
                                                title="Mais opções"
                                            >
                                                <MoreVertical className="h-4 w-4" />
                                            </button>

                                            {isMenuOpen && (
                                                <div className="absolute right-0 top-8 w-44 bg-white dark:bg-[#2b2d31] border border-stone-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 z-50 text-xs">
                                                    <button 
                                                        onClick={() => copyToClipboard(msg.content)}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-stone-700 dark:text-zinc-200 hover:bg-indigo-600 hover:text-white"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                        Copiar Conteúdo
                                                    </button>
                                                    <button 
                                                        onClick={() => copyToClipboard(msg.id)}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-stone-700 dark:text-zinc-200 hover:bg-indigo-600 hover:text-white"
                                                    >
                                                        <Copy className="h-3.5 w-3.5" />
                                                        Copiar ID
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {hasValidAvatar ? (
                                        <img 
                                            src={msg.avatarUrl!} 
                                            alt="Avatar" 
                                            onError={() => handleAvatarError(msg.id)}
                                            className="mt-1 h-10 w-10 shrink-0 rounded-full object-cover" 
                                        />
                                    ) : (
                                        <div className={`mt-1 h-10 w-10 shrink-0 rounded-full ${msg.avatarColor} flex items-center justify-center font-bold text-white text-sm`}>
                                            {msg.author ? msg.author.charAt(0).toUpperCase() : "?"}
                                        </div>
                                    )}

                                    <div className="min-w-0 flex-1">
                                        {parsed.isReply && (
                                            <div className="relative flex items-center gap-1.5 text-xs text-stone-500 dark:text-zinc-400 mb-1 select-none">
                                                <div className="absolute -left-3.5 top-1.5 w-3 h-3 border-l-2 border-t-2 border-stone-400/60 dark:border-zinc-600 rounded-tl-md pointer-events-none" />
                                                <span className="font-semibold text-stone-700 dark:text-zinc-300 hover:underline cursor-pointer">
                                                    @{parsed.replyAuthor}
                                                </span>
                                                <span className="truncate text-stone-500 dark:text-zinc-400 max-w-[400px]">
                                                    {parsed.replyContent}
                                                </span>
                                            </div>
                                        )}

                                        {/* ============================================== */}
                                        {/* RENDERIZA O NOME, A TAG DE WEBHOOK E A HORA    */}
                                        {/* ============================================== */}
                                        <div className="flex items-center gap-2">
                                            <span className={`cursor-pointer font-semibold hover:underline ${msg.authorColor}`}>
                                                {msg.author}
                                            </span>
                                            
                                            {msg.isWebhook && (
                                                <span className="rounded bg-indigo-500 px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase text-white shadow-sm dark:bg-[#5865F2]">
                                                    Webhook
                                                </span>
                                            )}

                                            <span className="text-xs text-stone-500">{msg.time}</span>
                                        </div>

                                        <div className="mt-1 w-full break-words">
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    img: ({ node, ...props }) => {
                                                        const urlString = typeof props.src === "string" ? props.src : "";
                                                        const isGif = urlString.includes("giphy") || urlString.endsWith(".gif");
                                                        return (
                                                            <div className="mt-2 inline-block">
                                                                <img {...props} src={urlString} className="aspect-video w-full max-w-[400px] rounded-xl object-cover shadow-lg border border-zinc-200 dark:border-zinc-800" alt={props.alt || "Media"} />
                                                                {isGif && <span className="mt-1 block text-[10px] font-bold tracking-wider text-stone-500 dark:text-zinc-400 uppercase">GIF</span>}
                                                            </div>
                                                        );
                                                    },
                                                    p: ({ node, ...props }) => <p {...props} className="text-sm text-stone-800 dark:text-zinc-200 break-words whitespace-pre-wrap" />,
                                                    a: ({ node, ...props }) => {
                                                        const href = props.href || "";
                                                        const isVideo = href.endsWith(".mp4") || href.endsWith(".webm") || href.endsWith(".mov");
                                                        if (isVideo) {
                                                            return (
                                                                <div className="max-w-[400px] overflow-hidden rounded-xl border border-zinc-200 bg-black shadow-lg dark:border-zinc-800">
                                                                    <VideoPlayer src={href} />
                                                                </div>
                                                            );
                                                        }
                                                        return <a {...props} className="text-blue-500 hover:underline break-all" target="_blank" rel="noopener noreferrer" />;
                                                    },
                                                    code: ({ node, inline, className, children, ...props }: any) => {
                                                        const match = /language-(\w+)/.exec(className || "");
                                                        const isInline = inline || !match;
                                                        return isInline ? (
                                                            <code className="rounded bg-stone-200 px-1.5 py-0.5 text-[13px] dark:bg-zinc-800 dark:text-zinc-200 break-words" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }} {...props}>{children}</code>
                                                        ) : (
                                                            <pre className="mt-2 max-w-full overflow-x-auto rounded-md bg-stone-200 p-3 text-[13px] dark:bg-[#1e1e20] dark:text-zinc-200 border border-stone-300 dark:border-zinc-800 custom-scrollbar" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
                                                                <code {...props} className={className}>{children}</code>
                                                            </pre>
                                                        );
                                                    },
                                                }}
                                            >
                                                {parsed.actualContent}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            <div className="relative p-4">
                {isGifOpen && (
                    <div className="absolute bottom-[80px] right-24 z-50">
                        <GifPicker onSendGif={handleSendMedia} />
                    </div>
                )}

                {isEmojiOpen && (
                    <div className="absolute bottom-[80px] right-4 z-50 shadow-xl">
                        <EmojiPicker
                            onEmojiClick={handleSelectEmoji}
                            theme={Theme.AUTO}
                            lazyLoadEmojis={true}
                        />
                    </div>
                )}

                <div className="flex flex-col rounded-lg bg-stone-300/50 dark:bg-[#383a40] px-3 py-2">
                    {replyingTo && (
                        <div className="flex items-center justify-between pb-2 mb-1 border-b border-stone-400/20 dark:border-zinc-700/50 text-xs text-stone-600 dark:text-zinc-300">
                            <div className="flex items-center gap-1.5 truncate">
                                <Reply className="h-3.5 w-3.5 shrink-0" />
                                <span>Respondendo para <strong className="font-semibold">{replyingTo.author}</strong></span>
                            </div>
                            <button 
                                onClick={() => setReplyingTo(null)}
                                className="p-0.5 hover:text-stone-900 dark:hover:text-zinc-100 rounded"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}

                    <div className="flex min-h-[44px] w-full items-center gap-3">
                        <Plus className="h-5 w-5 shrink-0 cursor-pointer text-stone-500 hover:text-stone-800 dark:text-zinc-400 dark:hover:text-zinc-200" />
                        <textarea
                            ref={textareaRef}
                            value={inputValue}
                            onChange={handleInput}
                            onKeyDown={handleKeyDown}
                            maxLength={800}
                            rows={1}
                            placeholder={replyingTo ? `Responder a ${replyingTo.author}...` : `Conversar em #${channel.name}`}
                            className="custom-scrollbar flex-1 resize-none self-center bg-transparent text-sm leading-5 text-stone-900 outline-none placeholder:text-stone-500 dark:text-zinc-100 dark:placeholder:text-zinc-400 break-words"
                        />
                        <div className="flex shrink-0 items-center gap-3 text-stone-500 dark:text-zinc-400">
                            <Gift className="h-5 w-5 cursor-pointer hover:text-stone-800 dark:hover:text-zinc-200" />
                            <div
                                onClick={toggleGif}
                                className={`flex cursor-pointer items-center justify-center rounded px-1.5 py-0.5 text-xs font-bold hover:bg-stone-300 hover:text-stone-800 dark:hover:bg-zinc-600 dark:hover:text-zinc-200 ${
                                    isGifOpen ? "bg-stone-300 text-stone-800 dark:bg-zinc-600 dark:text-zinc-200" : ""
                                }`}
                            >
                                GIF
                            </div>
                            <StickyNote className="h-5 w-5 cursor-pointer hover:text-stone-800 dark:hover:text-zinc-200" />
                            <Smile
                                onClick={toggleEmoji}
                                className={`h-5 w-5 cursor-pointer hover:text-stone-800 dark:hover:text-zinc-200 ${
                                    isEmojiOpen ? "text-stone-800 dark:text-zinc-200" : ""
                                }`}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}