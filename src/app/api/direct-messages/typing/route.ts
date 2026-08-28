import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { assertConversationMember } from "@/lib/direct-messages.server";
import { emitToUser } from "@/lib/realtime/emitter";
import { enforceRateLimit, isSameOriginRequest, sameOriginError } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  conversationId: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return sameOriginError();
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Não autorizado." },
        { status: 401 },
      );
    }

    const limited = await enforceRateLimit(request, "dm-typing", 20, 10, user.id);
    if (limited) return limited;

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Conversa inválida." },
        { status: 400 },
      );
    }

    const { conversationId } = parsed.data;
    await assertConversationMember(conversationId, user.id);

    const participants = await db.directConversationParticipant.findMany({
      where: {
        conversationId,
        userId: { not: user.id },
      },
      select: { userId: true },
    });

    const payload = {
      conversationId,
      userId: user.id,
      username: user.username,
      globalName: user.globalName,
      expiresAt: Date.now() + 8_000,
    };

    await Promise.allSettled(
      participants.map((participant) =>
        emitToUser(participant.userId, "TYPING_START", payload),
      ),
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, message: "Sem acesso a esta conversa." },
        { status: 403 },
      );
    }

    console.error("[DIRECT_TYPING_POST]", error);
    return NextResponse.json(
      { success: false, message: "Não foi possível enviar o estado de digitação." },
      { status: 500 },
    );
  }
}
