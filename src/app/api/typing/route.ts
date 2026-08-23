import { NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher"; // Certifique-se que o caminho está correto

export async function POST(req: Request) {
  try {
    const { channelId, userName } = await req.json();

    if (!channelId || !userName) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    // Dispara o evento e aguarda a resposta do Pusher
    await pusherServer.trigger(`channel-${channelId}`, "typing", { userName });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[TYPING_ERROR_BACKEND]", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}