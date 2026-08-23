"use client";
import ReactMarkdown from 'react-markdown';
import MarkdownRenderer from './MarkDownRenderer'
import remarkGfm from 'remark-gfm';
import React from 'react';
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
}


export default function MessageEmbed({
    embed,
}: MessageEmbedProps) {
    return (
        <div
            className="mt-2 max-w-[520px] overflow-hidden rounded-md border border-zinc-200 bg-stone-100 dark:border-zinc-700 dark:bg-[#2b2d31]"
            style={{
                borderLeftWidth: 4,
                borderLeftColor: embed.color || "#5865F2",
            }}
        >
            <div className="p-3">
                {embed.siteName && (
                    <div className="mb-1 text-xs font-medium text-zinc-500">
                        {embed.siteName}
                    </div>
                )}

                {embed.title && (
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {embed.url ? (
                            <a
                                href={embed.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                            >
                                {embed.title}
                            </a>
                        ) : (
                            embed.title
                        )}
                    </div>
                )}

                {embed.description && (
                    <div className="mt-1 whitespace-pre-wrap text-xs leading-5 text-zinc-600 dark:text-zinc-300">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{

                        
                                        strong: ({ children }) => (
                                            <strong className="font-bold text-stone-900 dark:text-zinc-100">
                                                {children}
                                            </strong>
                                        ),
                        
                                        em: ({ children }) => (
                                            <em className="italic">
                                                {children}
                                            </em>
                                        ),
                        
                                        del: ({ children }) => (
                                            <del className="text-stone-500 dark:text-zinc-500">
                                                {children}
                                            </del>
                                        ),
                        
                                        blockquote: ({ children }) => (
                                            <blockquote className="my-1 border-l-4 border-zinc-400 pl-3 text-stone-500 dark:border-zinc-600 dark:text-zinc-400">
                                                {children}
                                            </blockquote>
                                        ),
                        
                                        ul: ({ children }) => (
                                            <ul className="ml-5 list-disc">
                                                {children}
                                            </ul>
                                        ),
                        
                                        ol: ({ children }) => (
                                            <ol className="ml-5 list-decimal">
                                                {children}
                                            </ol>
                                        ),
                        
                                        li: ({ children }) => (
                                            <li className="leading-5">
                                                {children}
                                            </li>
                                        ),
                        
                                        a: ({ href, children }) => (
                                            <a
                                                href={href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="break-all text-indigo-500 hover:underline dark:text-indigo-300"
                                            >
                                                {children}
                                            </a>
                                        ),
                        
                                        code: ({
                                            inline,
                                            className,
                                            children,
                                            ...props
                                        }: any) => {
                                            const match = /language-(\w+)/.exec(
                                                className || ""
                                            );
                        
                                            if (!inline && match) {
                                                return (
                                                    <pre className="my-2 max-w-full overflow-x-auto rounded-md border border-stone-300 bg-stone-200 p-3 text-[13px] dark:border-zinc-800 dark:bg-[#1e1f22]">
                                                        <code
                                                            className={className}
                                                            {...props}
                                                        >
                                                            {children}
                                                        </code>
                                                    </pre>
                                                );
                                            }
                        
                                            return (
                                                <code
                                                    className="rounded bg-stone-200 px-1.5 py-0.5 font-mono text-[13px] dark:bg-zinc-800"
                                                    {...props}
                                                >
                                                    {children}
                                                </code>
                                            );
                                        },
                        
                                        img: ({ src, alt }) => (
                                            <img
                                                src={src}
                                                alt={alt || "Imagem"}
                                                loading="lazy"
                                                className="my-2 max-h-[500px] max-w-[500px] rounded-lg border border-stone-200 object-contain dark:border-zinc-800"
                                            />
                                        ),
                                    }}
                                >
                                    {embed.description}
                                </ReactMarkdown>
                        
                    </div>
                )}

                {embed.image && (
                    <img
                        src={embed.image}
                        alt={embed.title || "Embed"}
                        loading="lazy"
                        className="mt-3 max-h-[300px] max-w-full rounded-md object-cover"
                    />
                )}

                {embed.thumbnail && (
                    <img
                        src={embed.thumbnail}
                        alt=""
                        loading="lazy"
                        className="mt-3 max-h-[100px] max-w-[160px] rounded-md object-cover"
                    />
                )}
            </div>
        </div>
    );
}