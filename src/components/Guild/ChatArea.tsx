"use client";

import { useState, useRef, useEffect } from "react";
import { Hash, Search, Users, Bell, Pin, Plus, Gift, StickyNote, Smile } from "lucide-react";
import GifPicker from "./GifPicker";
import EmojiPicker, { Theme } from "emoji-picker-react";

interface Message {
    id: number;
    author: string;
    authorColor: string;
    avatarColor: string;
    time: string;
    content: string | null;
    gifUrl: string | null;
}

export default function ChatArea() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 1,
            author: "Caveira Games",
            authorColor: "text-red-500",
            avatarColor: "bg-blue-500",
            time: "Ontem às 08:58",
            content: "To com 80 ns em expo normal, Queria pelo menos abaixar ele um pouco",
            gifUrl: null,
        },
    ]);

    const [inputValue, setInputValue] = useState("");

    const [isGifOpen, setIsGifOpen] = useState(false);
    const [isEmojiOpen, setIsEmojiOpen] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && inputValue.trim() !== "") {
            sendMessage(inputValue.trim(), null);
            setInputValue("");
        }
    };

    const handleSendGif = (url: string) => {
        sendMessage(null, url);
        setIsGifOpen(false);
    };

    const handleSelectEmoji = (emojiData: any) => {
        setInputValue((prev) => prev + emojiData.emoji);
    };

    const sendMessage = (text: string | null, gifUrl: string | null) => {
        const newMessage: Message = {
            id: messages.length + 1,
            author: "Você",
            authorColor: "text-indigo-400",
            avatarColor: "bg-indigo-600",
            time: "Agora",
            content: text,
            gifUrl: gifUrl,
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

    return (
        <div className="relative flex min-w-0 flex-1 flex-col bg-transparent">
            <div className="flex h-12 items-center justify-between border-b border-stone-300 px-4 shadow-sm dark:border-zinc-800/50">
                <div className="flex items-center gap-2 font-semibold">
                    <Hash className="h-5 w-5 text-stone-500" />
                    nomedocanal
                </div>
                <div className="flex items-center gap-4 text-stone-500 dark:text-zinc-400">
                    <Bell className="h-5 w-5 cursor-pointer hover:text-stone-700 dark:hover:text-zinc-200" />
                    <Pin className="h-5 w-5 cursor-pointer hover:text-stone-700 dark:hover:text-zinc-200" />
                    <Users className="h-5 w-5 cursor-pointer hover:text-stone-700 dark:hover:text-zinc-200" />
                    <div className="flex h-6 w-32 items-center rounded bg-stone-100 px-2 text-xs dark:bg-zinc-900">
                        <Search className="mr-1 h-3 w-3" /> Search...
                    </div>
                </div>
            </div>

            <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
                <div className="flex flex-col gap-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className="flex gap-3 rounded-md p-1 -mx-1 hover:bg-black/5 dark:hover:bg-white/5">
                            <div className={`mt-1 h-10 w-10 shrink-0 rounded-full ${msg.avatarColor}`}></div>
                            <div>
                                <div className="flex items-baseline gap-2">
                                    <span className={`cursor-pointer font-semibold hover:underline ${msg.authorColor}`}>
                                        {msg.author}
                                    </span>
                                    <span className="text-xs text-stone-500">{msg.time}</span>
                                </div>

                                {msg.content && <p className="text-sm text-stone-800 dark:text-zinc-200">{msg.content}</p>}
                                {msg.gifUrl && (

                                    <img
                                        src={msg.gifUrl}
                                        alt="GIF Enviado"
                                        className="mt-2 max-h-80 max-w-sm rounded-lg object-contain shadow-md"
                                    />
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            <div className="relative p-4">

                {isGifOpen && (
                    <div className="absolute bottom-[80px] right-24 z-50">
                        <GifPicker onSendGif={handleSendGif} />
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

                <div className="flex h-11 w-full items-center gap-3 rounded-lg bg-stone-300/50 px-4 dark:bg-[#383a40]">
                    <Plus className="h-5 w-5 shrink-0 cursor-pointer text-stone-500 hover:text-stone-800 dark:text-zinc-400 dark:hover:text-zinc-200" />

                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Conversar em #bate-papo"
                        className="flex-1 bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-500 dark:text-zinc-100 dark:placeholder:text-zinc-400"
                    />

                    <div className="flex shrink-0 items-center gap-3 text-stone-500 dark:text-zinc-400">
                        <Gift className="h-5 w-5 cursor-pointer hover:text-stone-800 dark:hover:text-zinc-200" />

                        <div
                            onClick={toggleGif}
                            className={`flex cursor-pointer items-center justify-center rounded px-1.5 py-0.5 text-xs font-bold hover:bg-stone-300 hover:text-stone-800 dark:hover:bg-zinc-600 dark:hover:text-zinc-200 ${isGifOpen ? "bg-stone-300 text-stone-800 dark:bg-zinc-600 dark:text-zinc-200" : ""}`}
                        >
                            GIF
                        </div>

                        <StickyNote className="h-5 w-5 cursor-pointer hover:text-stone-800 dark:hover:text-zinc-200" />

                        <Smile
                            onClick={toggleEmoji}
                            className={`h-5 w-5 cursor-pointer hover:text-stone-800 dark:hover:text-zinc-200 ${isEmojiOpen ? "text-stone-800 dark:text-zinc-200" : ""}`}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}