"use client";

import React from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
  users?: any[];
  channels?: any[];
  variant?: "message" | "embed";
}

function getUserId(
  user: any,
) {
  return String(
    user?.id ??
      user?.userId ??
      "",
  );
}

function getUserName(
  user: any,
) {
  return (
    user?.globalName ||
    user?.displayName ||
    user?.username ||
    user?.name ||
    "Usuário Inválido"
  );
}

function getChannelId(
  channel: any,
) {
  return String(
    channel?.id ?? "",
  );
}

function getChannelName(
  channel: any,
) {
  return (
    channel?.name ||
    "canal"
  );
}

export default function MarkdownRenderer({
  content,
  users = [],
  channels = [],
  variant = "message",
}: MarkdownRendererProps) {
  const router = useRouter();
  const compact =
    variant === "embed";

  const renderTextWithMentions = (
    text: string,
  ) => {
    const regex =
      /(<@!?[\w-]+>|<#[\w-]+>)/g;

    const parts =
      text.split(regex);

    return parts.map(
      (
        part,
        index,
      ) => {
        if (!part) {
          return null;
        }

        const userMatch =
          part.match(
            /^<@!?([\w-]+)>$/,
          );

        if (userMatch) {
          const targetId =
            userMatch[1];

          const user =
            users.find(
              (item) =>
                getUserId(
                  item,
                ) ===
                targetId,
            );

          return (
            <span
              key={index}
              className="cursor-pointer rounded bg-indigo-500/15 px-1 font-medium text-indigo-500 hover:bg-indigo-500/25 dark:text-indigo-300"
            >
              @
              {user
                ? getUserName(
                    user,
                  )
                : "Usuário Inválido"}
            </span>
          );
        }

        const channelMatch =
          part.match(
            /^<#([\w-]+)>$/,
          );

        if (
          channelMatch
        ) {
          const targetId =
            channelMatch[1];

          const channel =
            channels.find(
              (item) =>
                getChannelId(
                  item,
                ) ===
                targetId,
            );

          return (
            <span
              key={index}
              className="cursor-pointer rounded bg-indigo-500/15 px-1 font-medium text-indigo-500 hover:bg-indigo-500/25 dark:text-indigo-300"
            >
              #
              {channel
                ? getChannelName(
                    channel,
                  )
                : "canal"}
            </span>
          );
        }

        return (
          <React.Fragment
            key={index}
          >
            {part}
          </React.Fragment>
        );
      },
    );
  };

  return (
    <ReactMarkdown
      remarkPlugins={[
        remarkGfm,
      ]}
      components={{
        p: ({
          children,
        }) => (
          <p
            className={
              compact
                ? "m-0 whitespace-pre-wrap break-words text-xs leading-5 text-zinc-600 dark:text-zinc-300"
                : "m-0 whitespace-pre-wrap break-words text-sm leading-5 text-stone-800 dark:text-zinc-200"
            }
          >
            {React.Children.map(
              children,
              (child) => {
                if (
                  typeof child ===
                  "string"
                ) {
                  return renderTextWithMentions(
                    child,
                  );
                }

                return child;
              },
            )}
          </p>
        ),

        strong: ({
          children,
        }) => (
          <strong className="font-bold text-stone-900 dark:text-zinc-100">
            {children}
          </strong>
        ),

        em: ({
          children,
        }) => (
          <em className="italic">
            {children}
          </em>
        ),

        del: ({
          children,
        }) => (
          <del className="text-stone-500 dark:text-zinc-500">
            {children}
          </del>
        ),

        blockquote: ({
          children,
        }) => (
          <blockquote className="my-1 border-l-4 border-zinc-400 pl-3 text-stone-500 dark:border-zinc-600 dark:text-zinc-400">
            {children}
          </blockquote>
        ),

        ul: ({
          children,
        }) => (
          <ul className="ml-5 list-disc">
            {children}
          </ul>
        ),

        ol: ({
          children,
        }) => (
          <ol className="ml-5 list-decimal">
            {children}
          </ol>
        ),

        li: ({
          children,
        }) => (
          <li className="leading-5">
            {children}
          </li>
        ),

        a: ({
          href,
          children,
        }) => (
          <a
            href={href}
            target={href?.startsWith("/") ? undefined : "_blank"}
            rel={href?.startsWith("/") ? undefined : "noopener noreferrer"}
            onClick={(event) => {
              if (href?.startsWith("/")) {
                event.preventDefault();
                router.push(href);
              }
            }}
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
          const match =
            /language-(\w+)/.exec(
              className || "",
            );

          if (
            !inline &&
            match
          ) {
            return (
              <pre className="my-2 max-w-full overflow-x-auto rounded-md border border-stone-300 bg-stone-200 p-3 text-[13px] dark:border-zinc-800 dark:bg-[#1e1f22]">
                <code
                  className={
                    className
                  }
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

        img: ({
          src,
          alt,
        }) => (
          <img
            src={src}
            alt={
              alt ||
              "Imagem"
            }
            loading="lazy"
            className="my-2 max-h-[500px] max-w-[500px] rounded-lg border border-stone-200 object-contain dark:border-zinc-800"
          />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
