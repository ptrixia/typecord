"use server";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { pusherServer } from "@/lib/pusher";

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

        return messages.map((msg) => ({
            id: msg.id,
            author: msg.member.nickname || msg.member.user.globalName || msg.member.user.username,
            authorColor: "text-stone-700 dark:text-zinc-200", 
            avatarColor: "bg-indigo-500", 
            avatarUrl: msg.member.user.avatarUrl,
            time: msg.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            content: msg.content,
        }));
    } catch (error) {
        console.error("[GET_MESSAGES_ERROR]", error);
        return [];
    }
}

export async function sendMessageAction(channelId: string, content: string) {
    if (!content || !content.trim()) throw new Error("A mensagem não pode estar vazia.");
    if (!channelId) throw new Error("Canal inválido.");

    try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Não autorizado.");

        const channel = await db.channel.findUnique({
            where: { id: channelId },
            select: { guildId: true },
        });

        if (!channel) throw new Error("Canal não encontrado.");

        const member = await db.member.findUnique({
            where: {
                userId_guildId: {
                    userId: user.id,
                    guildId: channel.guildId,
                }
            }
        });

        if (!member) throw new Error("Você não é membro deste servidor.");

        const newMessage = await db.message.create({
            data: {
                content: content.trim(),
                channelId: channelId,
                memberId: member.id,
            },
            include: {
                member: {
                    include: { user: true }
                }
            }
        });

        const formattedMessage = {
            id: newMessage.id,
            author: newMessage.member.nickname || newMessage.member.user.globalName || newMessage.member.user.username,
            authorColor: "text-indigo-400",
            avatarColor: "bg-indigo-600",
            avatarUrl: newMessage.member.user.avatarUrl,
            time: newMessage.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
            content: newMessage.content,
        };

        // A MÁGICA ACONTECE AQUI: Avisa o Pusher para espalhar a mensagem!
        await pusherServer.trigger(`channel-${channelId}`, "new-message", formattedMessage);

        return formattedMessage;
    } catch (error) {
        console.error("[SEND_MESSAGE_ERROR]", error);
        throw new Error("Não foi possível enviar a mensagem.");
    }
}