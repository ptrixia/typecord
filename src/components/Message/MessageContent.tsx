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

  users?: any[];

  channels?: any[];
}

export default function MessageContent({
  content,
  attachments = [],
  embeds = [],
  users = [],
  channels = [],
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