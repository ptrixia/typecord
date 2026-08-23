"use client";

import { useState, useRef, useEffect } from "react";
import { Hash, Search, Users, Bell, Pin, Plus, Gift, StickyNote, Smile, Volume2 } from "lucide-react";
import GifPicker from "./GifPicker";
import EmojiPicker, { Theme } from "emoji-picker-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import VideoPlayer from "../VideoPlayer";
import SearchCommand from "../SearchCommand";

interface Message {
    id: number;
    author: string;
    authorColor: string;
    avatarColor: string;
    time: string;
    content: string;
}

interface ChatAreaProps {
    channel: any;
}

export default function ChatArea({ channel }: ChatAreaProps) {
    const [isMounted, setIsMounted] = useState(false);

    const [messages, setMessages] = useState<Message[]>([
        {
            id: 1,
            author: "teste",
            authorColor: "text-red-500",
            avatarColor: "bg-blue-500",
            time: new Date("2026-08-22T21:00:00").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            content: "Teste",
        },
    ]);

    const [inputValue, setInputValue] = useState("");
    const [isGifOpen, setIsGifOpen] = useState(false);
    const [isEmojiOpen, setIsEmojiOpen] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setIsMounted(true);
    }, []);

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
                
                if (textareaRef.current) {
                    textareaRef.current.style.height = "auto";
                }
            }
        }
    };

    const handleSendMedia = (url: string) => {
        sendMessage(`![Media](${url})`);
        setIsGifOpen(false);
    };

    const handleSelectEmoji = (emojiData: any) => {
        setInputValue((prev) => prev + emojiData.emoji);
    };

    const sendMessage = (text: string) => {
        const newMessage: Message = {
            id: messages.length + 1,
            author: "Você",
            authorColor: "text-indigo-400",
            avatarColor: "bg-indigo-600",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            content: text,
        };
        setMessages([...messages, newMessage]);
    };

    const toggleGif = () => {
        setIsGifOpen(!isGifOpen);
        setIsEmojiOpen(false);
    };

    const toggleEmoji = () => {
        setIsEmojiOpen(!isEmojiOpen);
        setIsGifOpen(false);
    };

    if (!isMounted) {
        return null; 
    }


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

            {/* MENSAGENS */}
            <div className="custom-scrollbar flex-1 overflow-y-auto p-4 overflow-x-hidden">
                <div className="flex flex-col gap-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className="flex w-full gap-3 rounded-md p-1 -mx-1 hover:bg-black/5 dark:hover:bg-white/5">
                            <div className={`mt-1 h-10 w-10 shrink-0 rounded-full ${msg.avatarColor}`}></div>
                            
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2">
                                    <span className={`cursor-pointer font-semibold hover:underline ${msg.authorColor}`}>
                                        {msg.author}
                                    </span>
                                    <span className="text-xs text-stone-500">{msg.time}</span>
                                </div>
                                
                                <div className="mt-1 w-full break-words">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            img: ({ node, ...props }) => {
                                                const url = props.src;
                                                const urlString = typeof url === "string" ? url : "";
                                                const isGif = urlString.includes("giphy") || urlString.endsWith(".gif");

                                                return (
                                                    <div className="mt-2 inline-block">
                                                        <img
                                                            {...props}
                                                            src={urlString}
                                                            className="aspect-video w-full max-w-[400px] rounded-xl object-cover shadow-lg border border-zinc-200 dark:border-zinc-800"
                                                            alt={props.alt || "Media"}
                                                        />
                                                        {isGif && (
                                                            <span className="mt-1 block text-[10px] font-bold tracking-wider text-stone-500 dark:text-zinc-400 uppercase">
                                                                GIF
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            },
                                            p: ({ node, ...props }) => (
                                                <p {...props} className="text-sm text-stone-800 dark:text-zinc-200 break-words whitespace-pre-wrap" />
                                            ),
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

                                                return (
                                                    <a 
                                                        {...props} 
                                                        className="text-blue-500 hover:underline break-all" 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                    />
                                                );
                                            },
                                            code: ({ node, inline, className, children, ...props }: any) => {
                                                const match = /language-(\w+)/.exec(className || "");
                                                const isInline = inline || !match;
                                                return isInline ? (
                                                    <code 
                                                        className="rounded bg-stone-200 px-1.5 py-0.5 text-[13px] dark:bg-zinc-800 dark:text-zinc-200 break-words" 
                                                        style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
                                                        {...props}
                                                    >
                                                        {children}
                                                    </code>
                                                ) : (
                                                    <pre 
                                                        className="mt-2 max-w-full overflow-x-auto rounded-md bg-stone-200 p-3 text-[13px] dark:bg-[#1e1e20] dark:text-zinc-200 border border-stone-300 dark:border-zinc-800 custom-scrollbar"
                                                        style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
                                                    >
                                                        <code {...props} className={className}>
                                                            {children}
                                                        </code>
                                                    </pre>
                                                );
                                            },
                                        }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
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

                <div className="flex min-h-[44px] w-full items-center gap-3 rounded-lg bg-stone-300/50 px-3 py-2 dark:bg-[#383a40]">
                    <Plus className="h-5 w-5 shrink-0 cursor-pointer text-stone-500 hover:text-stone-800 dark:text-zinc-400 dark:hover:text-zinc-200" />

                    <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={handleInput}
                        onKeyDown={handleKeyDown}
                        maxLength={800}
                        rows={1}
                        placeholder={`Conversar em #${channel.name}`}
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
    );
}