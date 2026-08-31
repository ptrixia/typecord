import { NextRequest, NextResponse } from "next/server";

import { getMessages } from "@/actions/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const channelId = request.nextUrl.searchParams.get("channelId")?.trim();

    if (!channelId) {
      return NextResponse.json(
        { success: false, message: "channelId é obrigatório." },
        { status: 400 },
      );
    }

    const cursor = request.nextUrl.searchParams.get("cursor")?.trim() || undefined;
    const result = await getMessages(channelId, cursor);

    return NextResponse.json(
      { success: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[GUILD_MESSAGES_GET]", error);

    return NextResponse.json(
      { success: false, message: "Não foi possível carregar as mensagens." },
      { status: 500 },
    );
  }
}
