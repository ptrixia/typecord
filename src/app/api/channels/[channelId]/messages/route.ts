import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

import { db } from "@/lib/db";
import { pusherServer } from "@/lib/pusher";
import { gatewayService } from "@/lib/gateway/GatewayService";

interface RouteContext {
    params: Promise<{
        channelId: string;
    }>;
}

interface EmbedField {
    name: string;
    value: string;
    inline?: boolean;
}

interface EmbedAuthor {
    name: string;
    url?: string;
    iconUrl?: string;
}

interface EmbedFooter {
    text: string;
    iconUrl?: string;
}

interface EmbedImage {
    url: string;
}

interface BotEmbed {
    title?: string;
    description?: string;
    url?: string;
    color?: string;
    timestamp?: string;
    author?: EmbedAuthor;
    footer?: EmbedFooter;
    image?: EmbedImage;
    thumbnail?: EmbedImage;
    fields?: EmbedField[];
}

interface BotMessageBody {
    content?: unknown;
    replyToId?: unknown;
    embeds?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
    );
}

function isValidUrl(value: string) {
    try {
        const url = new URL(value);

        return (
            url.protocol === "http:" ||
            url.protocol === "https:"
        );
    } catch {
        return false;
    }
}

function isValidEmbedImage(value: unknown): value is EmbedImage {
    if (!isRecord(value)) {
        return false;
    }

    if (typeof value.url !== "string") {
        return false;
    }

    return isValidUrl(value.url);
}

function isValidEmbedAuthor(value: unknown): value is EmbedAuthor {
    if (!isRecord(value)) {
        return false;
    }

    if (
        typeof value.name !== "string" ||
        !value.name.trim()
    ) {
        return false;
    }

    if (
        value.url !== undefined &&
        (
            typeof value.url !== "string" ||
            !isValidUrl(value.url)
        )
    ) {
        return false;
    }

    if (
        value.iconUrl !== undefined &&
        (
            typeof value.iconUrl !== "string" ||
            !isValidUrl(value.iconUrl)
        )
    ) {
        return false;
    }

    return true;
}

function isValidEmbedFooter(value: unknown): value is EmbedFooter {
    if (!isRecord(value)) {
        return false;
    }

    if (
        typeof value.text !== "string" ||
        !value.text.trim()
    ) {
        return false;
    }

    if (
        value.iconUrl !== undefined &&
        (
            typeof value.iconUrl !== "string" ||
            !isValidUrl(value.iconUrl)
        )
    ) {
        return false;
    }

    return true;
}

function isValidEmbedField(value: unknown): value is EmbedField {
    if (!isRecord(value)) {
        return false;
    }

    if (
        typeof value.name !== "string" ||
        typeof value.value !== "string"
    ) {
        return false;
    }

    if (
        value.inline !== undefined &&
        typeof value.inline !== "boolean"
    ) {
        return false;
    }

    return true;
}

function isValidEmbed(embed: unknown): embed is BotEmbed {
    if (!isRecord(embed)) {
        return false;
    }

    if (
        embed.title !== undefined &&
        typeof embed.title !== "string"
    ) {
        return false;
    }

    if (
        embed.description !== undefined &&
        typeof embed.description !== "string"
    ) {
        return false;
    }

    if (
        embed.url !== undefined &&
        (
            typeof embed.url !== "string" ||
            !isValidUrl(embed.url)
        )
    ) {
        return false;
    }

    if (
        embed.color !== undefined &&
        typeof embed.color !== "string"
    ) {
        return false;
    }

    if (
        embed.timestamp !== undefined &&
        typeof embed.timestamp !== "string"
    ) {
        return false;
    }

    if (
        embed.author !== undefined &&
        !isValidEmbedAuthor(embed.author)
    ) {
        return false;
    }

    if (
        embed.footer !== undefined &&
        !isValidEmbedFooter(embed.footer)
    ) {
        return false;
    }

    if (
        embed.image !== undefined &&
        !isValidEmbedImage(embed.image)
    ) {
        return false;
    }

    if (
        embed.thumbnail !== undefined &&
        !isValidEmbedImage(embed.thumbnail)
    ) {
        return false;
    }

    if (embed.fields !== undefined) {
        if (!Array.isArray(embed.fields)) {
            return false;
        }

        if (
            embed.fields.length > 25 ||
            !embed.fields.every(isValidEmbedField)
        ) {
            return false;
        }
    }

    return true;
}

export async function POST(
    request: NextRequest,
    context: RouteContext,
) {
    try {
        const { channelId } =
            await context.params;

        if (!channelId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Canal inválido.",
                },
                {
                    status: 400,
                },
            );
        }

        const authorization =
            request.headers.get("authorization");

        if (!authorization) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Authorization ausente.",
                },
                {
                    status: 401,
                },
            );
        }

        if (!authorization.startsWith("Bot ")) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Authorization inválido.",
                },
                {
                    status: 401,
                },
            );
        }

        const botToken =
            authorization
                .slice(4)
                .trim();

        if (!botToken) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Token do bot ausente.",
                },
                {
                    status: 401,
                },
            );
        }

        const tokenHash =
            crypto
                .createHash("sha256")
                .update(botToken)
                .digest("hex");

        const bot =
            await db.bot.findUnique({
                where: {
                    tokenHash,
                },

                include: {
                    user: true,
                },
            });

        if (!bot) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Token do bot inválido.",
                },
                {
                    status: 401,
                },
            );
        }

        if (bot.disabled) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Este bot está desativado.",
                },
                {
                    status: 403,
                },
            );
        }

        const channel =
            await db.channel.findUnique({
                where: {
                    id: channelId,
                },

                select: {
                    id: true,
                    guildId: true,
                    name: true,
                    type: true,
                },
            });

        if (!channel) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Canal não encontrado.",
                },
                {
                    status: 404,
                },
            );
        }

        if (!channel.guildId) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Este canal não pertence a uma guild.",
                },
                {
                    status: 400,
                },
            );
        }

        const member =
            await db.member.findUnique({
                where: {
                    userId_guildId: {
                        userId: bot.userId,
                        guildId: channel.guildId,
                    },
                },

                include: {
                    user: true,
                },
            });

        if (!member) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "O bot não é membro deste servidor.",
                },
                {
                    status: 403,
                },
            );
        }

        let body: BotMessageBody;

        try {
            body =
                (await request.json()) as BotMessageBody;
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    message: "JSON inválido.",
                },
                {
                    status: 400,
                },
            );
        }

        const content =
            typeof body.content === "string"
                ? body.content.trim()
                : "";

        if (content.length > 8000) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "A mensagem não pode possuir mais de 8000 caracteres.",
                },
                {
                    status: 400,
                },
            );
        }

        const replyToId =
            typeof body.replyToId === "string" &&
            body.replyToId.trim()
                ? body.replyToId.trim()
                : null;

        let replyMessage:
            | {
                  id: string;
                  content: string;
                  member: {
                      nickname: string | null;
                      user: {
                          username: string;
                          globalName: string | null;
                          avatarUrl: string | null;
                      };
                  };
              }
            | null = null;

        if (replyToId) {
            replyMessage =
                await db.message.findFirst({
                    where: {
                        id: replyToId,
                        channelId,
                        deleted: false,
                    },

                    select: {
                        id: true,
                        content: true,

                        member: {
                            select: {
                                nickname: true,

                                user: {
                                    select: {
                                        username: true,
                                        globalName: true,
                                        avatarUrl: true,
                                    },
                                },
                            },
                        },
                    },
                });

            if (!replyMessage) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Mensagem de resposta não encontrada neste canal.",
                    },
                    {
                        status: 400,
                    },
                );
            }
        }

        let embeds: BotEmbed[] = [];

        if (body.embeds !== undefined) {
            if (!Array.isArray(body.embeds)) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "embeds precisa ser um array.",
                    },
                    {
                        status: 400,
                    },
                );
            }

            if (body.embeds.length > 10) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Uma mensagem pode possuir no máximo 10 embeds.",
                    },
                    {
                        status: 400,
                    },
                );
            }

            if (
                !body.embeds.every(
                    isValidEmbed,
                )
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Um ou mais embeds possuem formato inválido.",
                    },
                    {
                        status: 400,
                    },
                );
            }

            embeds =
                body.embeds;
        }

        if (
            !content &&
            embeds.length === 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "A mensagem precisa possuir conteúdo ou pelo menos um embed.",
                },
                {
                    status: 400,
                },
            );
        }

        const message =
            await db.message.create({
                data: {
                    content,
                    channelId,
                    memberId: member.id,
                    replyToId,

                    embeds: {
                        create: embeds.map(
                            (embed) => ({
                                title:
                                    embed.title ??
                                    null,

                                description:
                                    embed.description ??
                                    null,

                                url:
                                    embed.url ??
                                    null,

                                color:
                                    embed.color ??
                                    null,

                                timestamp:
                                    embed.timestamp ??
                                    null,

                                authorName:
                                    embed.author
                                        ?.name ??
                                    null,

                                authorUrl:
                                    embed.author
                                        ?.url ??
                                    null,

                                authorIcon:
                                    embed.author
                                        ?.iconUrl ??
                                    null,

                                footerText:
                                    embed.footer
                                        ?.text ??
                                    null,

                                footerIcon:
                                    embed.footer
                                        ?.iconUrl ??
                                    null,

                                imageUrl:
                                    embed.image
                                        ?.url ??
                                    null,

                                thumbnailUrl:
                                    embed.thumbnail
                                        ?.url ??
                                    null,

                                fields:
                                    embed.fields
                                        ? (embed.fields as any)
                                        : undefined,
                            }),
                        ),
                    },
                },

                include: {
                    member: {
                        include: {
                            user: true,
                        },
                    },

                    attachments: true,
                    embeds: true,
                },
            });

        const gatewayEmbeds: BotEmbed[] =
            message.embeds.map(
                (embed) => ({
                    title:
                        embed.title ??
                        undefined,

                    description:
                        embed.description ??
                        undefined,

                    url:
                        embed.url ??
                        undefined,

                    color:
                        embed.color ??
                        undefined,

                    timestamp:
                        embed.timestamp ??
                        undefined,

                    author:
                        embed.authorName
                            ? {
                                  name:
                                      embed.authorName,

                                  url:
                                      embed.authorUrl ??
                                      undefined,

                                  iconUrl:
                                      embed.authorIcon ??
                                      undefined,
                              }
                            : undefined,

                    footer:
                        embed.footerText
                            ? {
                                  text:
                                      embed.footerText,

                                  iconUrl:
                                      embed.footerIcon ??
                                      undefined,
                              }
                            : undefined,

                    image:
                        embed.imageUrl
                            ? {
                                  url:
                                      embed.imageUrl,
                              }
                            : undefined,

                    thumbnail:
                        embed.thumbnailUrl
                            ? {
                                  url:
                                      embed.thumbnailUrl,
                              }
                            : undefined,

                    fields:
                        Array.isArray(
                            embed.fields,
                        )
                            ? (embed.fields as unknown as EmbedField[])
                            : undefined,
                }),
            );

        const frontendEmbeds =
            message.embeds.map(
                (embed) => ({
                    url:
                        embed.url ??
                        undefined,

                    title:
                        embed.title ??
                        undefined,

                    description:
                        embed.description ??
                        undefined,

                    siteName:
                        embed.authorName ??
                        undefined,

                    color:
                        embed.color ??
                        "#5865F2",

                    image:
                        embed.imageUrl ??
                        undefined,

                    thumbnail:
                        embed.thumbnailUrl ??
                        undefined,
                }),
            );

        const reply =
            replyMessage
                ? {
                      messageId:
                          replyMessage.id,

                      author:
                          replyMessage.member
                              .nickname ||
                          replyMessage.member.user
                              .globalName ||
                          replyMessage.member.user
                              .username,

                      content:
                          replyMessage.content,

                      avatarUrl:
                          replyMessage.member.user
                              .avatarUrl,
                  }
                : null;

        const isBotVerified =
            Boolean(bot.verified);

        const messageData = {
            id: message.id,

            content:
                message.content,

            guildId:
                channel.guildId,

            channelId:
                message.channelId,

            author: {
                id:
                    message.member.user.id,

                username:
                    message.member.user
                        .username,

                globalName:
                    message.member.user
                        .globalName,

                avatarUrl:
                    message.member.user
                        .avatarUrl,
            },

            isBot: true,

            isBotVerified,

            isWebhook: false,

            attachments:
                message.attachments.map(
                    (attachment) => ({
                        id:
                            attachment.id,

                        url:
                            attachment.url,

                        filename:
                            attachment.filename,

                        fileSize:
                            attachment.fileSize,

                        fileType:
                            attachment.fileType,
                    }),
                ),

            embeds:
                gatewayEmbeds,

            createdAt:
                message.createdAt.toISOString(),

            replyToId:
                message.replyToId,

            reply,
        };

        const formattedMessage = {
            id:
                message.id,

            author:
                message.member.nickname ||
                message.member.user
                    .globalName ||
                message.member.user
                    .username,

            authorId:
                message.member.user.id,

            authorColor:
                "text-indigo-400",

            avatarColor:
                "bg-indigo-600",

            avatarUrl:
                message.member.user
                    .avatarUrl,

            createdAt:
                message.createdAt.toISOString(),

            content:
                message.content,

            reply,

            attachments:
                message.attachments.map(
                    (attachment) => ({
                        id:
                            attachment.id,

                        url:
                            attachment.url,

                        key:
                            attachment.url,

                        name:
                            attachment.filename,

                        filename:
                            attachment.filename,

                        size:
                            attachment.fileSize,

                        fileSize:
                            attachment.fileSize,

                        contentType:
                            attachment.fileType,

                        fileType:
                            attachment.fileType,
                    }),
                ),

            embeds:
                frontendEmbeds,

            isPending: false,

            isWebhook: false,

            isBot: true,

            isBotVerified,
        };

        await pusherServer.trigger(
            `channel-${channelId}`,
            "new-message",
            formattedMessage,
        );

        const botMembers =
            await db.member.findMany({
                where: {
                    guildId:
                        channel.guildId,

                    user: {
                        bot: {
                            isNot: null,
                        },
                    },
                },

                select: {
                    user: {
                        select: {
                            id: true,

                            bot: {
                                select: {
                                    id: true,
                                },
                            },
                        },
                    },
                },
            });

        const otherBotIds =
            botMembers
                .map(
                    (item) =>
                        item.user.bot?.id,
                )
                .filter(
                    (
                        id,
                    ): id is string =>
                        Boolean(id) &&
                        id !== bot.id,
                );

        if (
            otherBotIds.length > 0
        ) {
            await gatewayService.broadcast(
                otherBotIds,
                "MESSAGE_CREATE",
                messageData,
            );
        }

        return NextResponse.json(
            {
                success: true,
                message: messageData,
            },
            {
                status: 201,
            },
        );
    } catch (error) {
        console.error(
            "[BOT_MESSAGE_API_ERROR]",
            error,
        );

        return NextResponse.json(
            {
                success: false,

                message:
                    "Não foi possível enviar a mensagem.",

                error:
                    process.env.NODE_ENV ===
                    "development"
                        ? error instanceof Error
                            ? error.message
                            : String(error)
                        : undefined,
            },
            {
                status: 500,
            },
        );
    }
}