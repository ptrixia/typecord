import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pusherServer } from "@/lib/pusher";

export async function POST(
  req: Request,
  { params }: { params: { channelId: string } }
) {
  try {

    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
      return new NextResponse("Não autorizado.", { status: 401 });
    }

    const body = await req.json();
    const { content, botName, avatarUrl } = body;

    if (!content) {
      return new NextResponse("O conteúdo da mensagem é obrigatório", { status: 400 });
    }

    const channel = await db.channel.findUnique({
      where: { id: params.channelId },
    });

    if (!channel) {
      return new NextResponse("Canal não encontrado.", { status: 404 });
    }

    let systemUser = await db.user.findUnique({
      where: { email: "webhook@typecord.bot" },
    });

    if (!systemUser) {
      systemUser = await db.user.create({
        data: {
          email: "webhook@typecord.bot",
          username: "TypecordWebhook",
          globalName: "Sistema Webhook",
        },
      });
    }

    let botMember = await db.member.findUnique({
      where: {
        userId_guildId: {
          userId: systemUser.id,
          guildId: channel.guildId,
        },
      },
    });

    if (!botMember) {
      botMember = await db.member.create({
        data: {
          userId: systemUser.id,
          guildId: channel.guildId,
          nickname: botName || "Bot",
        },
      });
    } else if (botName && botMember.nickname !== botName) {

      botMember = await db.member.update({
        where: { id: botMember.id },
        data: { nickname: botName },
      });
    }


    const newMessage = await db.message.create({
      data: {
        content: content,
        channelId: params.channelId,
        memberId: botMember.id,
      },
    });

    const formattedMessage = {
      id: newMessage.id,
      author: botName || botMember.nickname || systemUser.globalName,
      authorColor: "text-rose-500", 
      avatarColor: "bg-rose-600",
      avatarUrl: avatarUrl || "https://ui-avatars.com/api/?name=B+O+T&background=e11d48&color=fff",
      time: newMessage.createdAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      content: newMessage.content,
    };


    await pusherServer.trigger(`channel-${params.channelId}`, "new-message", formattedMessage);

    return NextResponse.json({ success: true, message: formattedMessage });

  } catch (error) {
    console.error("[WEBHOOK_POST]", error);
    return new NextResponse("Erro interno do servidor", { status: 500 });
  }
}