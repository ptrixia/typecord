import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pusherServer } from "@/lib/pusher";

export async function POST(
  req: Request,
  props: { params: Promise<{ channelId: string }> | { channelId: string } }
) {
  try {

    const params = await props.params;
    const channelId = params.channelId;

    const body = await req.json();
    const { content, botName, avatarUrl } = body;

    if (!content) {
      return new NextResponse("O conteúdo da mensagem é obrigatório", { status: 400 });
    }

    const channel = await db.channel.findUnique({
      where: { id: channelId },
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
          nickname: botName || "Webhook",
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
        channelId: channelId,
        memberId: botMember.id,
      },
    });

    const formattedMessage = {
      id: newMessage.id,
      author: botName || botMember.nickname || systemUser.globalName,
      authorColor: "text-rose-500", 
      avatarColor: "bg-rose-600",
      avatarUrl: avatarUrl || "https://ui-avatars.com/api/?name=W+H&background=e11d48&color=fff",
      createdAt: newMessage.createdAt.toISOString(),
      content: newMessage.content,
      isWebhook: true,
    };

    await pusherServer.trigger(`channel-${channelId}`, "new-message", formattedMessage);

    return NextResponse.json({ success: true, message: formattedMessage });

  } catch (error) {

    console.error("[WEBHOOK_POST_DETALHADO]", error);
    
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    
    return NextResponse.json(
      { success: false, error: errorMessage }, 
      { status: 500 }
    );
  }
}