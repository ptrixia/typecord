"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { pusherServer } from "@/lib/pusher";
import { gatewayService } from "@/lib/gateway/GatewayService";

export async function getMessages(channelId: string) {
    if (!channelId) return [];

    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Não autorizado.");

        const messages = await db.message.findMany({
            where: {
                channelId: channelId,
                deleted: false,
            },
            include: {
                member: {
                    include: {
                        user: true, 
                    }
                }
            },
            orderBy: {
                createdAt: "asc",
            },
            take: 50,
        });

        return messages.map((msg) => {

    const isWebhookMessage = msg.member.user.email === "webhook@typecord.bot";

    return {
        id: msg.id,
        author: msg.member.nickname || msg.member.user.globalName || msg.member.user.username,
        authorColor: isWebhookMessage ? "text-rose-500" : "text-stone-700 dark:text-zinc-200", 
        avatarColor: isWebhookMessage ? "bg-rose-600" : "bg-indigo-500", 
        avatarUrl: msg.member.user.avatarUrl,
        time: msg.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        content: msg.content,
        isWebhook: isWebhookMessage 
    };
});
    } catch (error) {
        console.error("[GET_MESSAGES_ERROR]", error);
        return [];
    }
}

export async function sendMessageAction(
    channelId: string,
    content: string
) {
    if (!content || !content.trim()) {
        throw new Error(
            "A mensagem não pode estar vazia."
        );
    }

    if (!channelId) {
        throw new Error(
            "Canal inválido."
        );
    }

    try {
        const user =
            await getCurrentUser();

        if (!user) {
            throw new Error(
                "Não autorizado."
            );
        }

        /*
         * Descobre a guild do canal.
         */
        const channel =
            await db.channel.findUnique({
                where: {
                    id: channelId,
                },

                select: {
                    id: true,
                    guildId: true,
                },
            });

        if (!channel) {
            throw new Error(
                "Canal não encontrado."
            );
        }

        /*
         * Verifica se o usuário pertence
         * à guild.
         */
        const member =
            await db.member.findUnique({
                where: {
                    userId_guildId: {
                        userId: user.id,
                        guildId:
                            channel.guildId,
                    },
                },
            });

        if (!member) {
            throw new Error(
                "Você não é membro deste servidor."
            );
        }

        /*
         * Cria a mensagem.
         */
        const newMessage =
            await db.message.create({
                data: {
                    content:
                        content.trim(),

                    channelId:
                        channelId,

                    memberId:
                        member.id,
                },

                include: {
                    member: {
                        include: {
                            user: true,
                        },
                    },
                },
            });

        /*
         * Dados utilizados pelo frontend.
         */
        const formattedMessage = {
            id: newMessage.id,

            author:
                newMessage.member
                    .nickname ||
                newMessage.member.user
                    .globalName ||
                newMessage.member.user
                    .username,

            authorColor:
                "text-indigo-400",

            avatarColor:
                "bg-indigo-600",

            avatarUrl:
                newMessage.member.user
                    .avatarUrl,

            time:
                newMessage.createdAt
                    .toLocaleTimeString(
                        "pt-BR",
                        {
                            hour: "2-digit",
                            minute: "2-digit",
                        }
                    ),

            content:
                newMessage.content,
        };

        /*
         * =====================================
         * FRONTEND
         * =====================================
         */
        await pusherServer.trigger(
            `channel-${channelId}`,
            "new-message",
            formattedMessage
        );

       const botMembers = await db.member.findMany({
    where: {
        guildId: channel.guildId,

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
        /*
         * Pega os IDs dos bots.
         */
        const botIds =
            botMembers
                .map(
                    (member) =>
                        member.user.bot
                            ?.id
                )
                .filter(
                    (
                        id
                    ): id is string =>
                        Boolean(id)
                );

        console.log(
            `[GATEWAY] Mensagem ${newMessage.id}`
        );

        console.log(
            `[GATEWAY] Guild: ${channel.guildId}`
        );

        console.log(
            `[GATEWAY] Bots encontrados: ${botIds.length}`
        );

        /*
         * Envia MESSAGE_CREATE para
         * todos os bots da guild.
         */
        if (botIds.length > 0) {
            await gatewayService.broadcast(
                botIds,
                "MESSAGE_CREATE",
                {
                    id: newMessage.id,

                    content:
                        newMessage.content,

                    guildId:
                        channel.guildId,

                    channelId:
                        channelId,

                    author: {
                        id:
                            newMessage
                                .member
                                .user
                                .id,

                        username:
                            newMessage
                                .member
                                .user
                                .username,

                        globalName:
                            newMessage
                                .member
                                .user
                                .globalName,

                        avatarUrl:
                            newMessage
                                .member
                                .user
                                .avatarUrl,
                    },

                    attachments: [],

                    createdAt:
                        newMessage.createdAt
                            .toISOString(),

                    replyToId:
                        null,
                }
            );
        }

        return formattedMessage;

    } catch (error) {
        console.error(
            "[SEND_MESSAGE_ERROR]",
            error
        );

        throw new Error(
            "Não foi possível enviar a mensagem."
        );
    }
}