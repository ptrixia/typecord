import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { assertConversationMember } from "@/lib/direct-messages.server";
import { isSameOriginRequest, sameOriginError } from "@/lib/request-security";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("favorite"), conversationId: z.string().min(1), value: z.boolean() }),
  z.object({ action: z.literal("move"), conversationId: z.string().min(1), folderId: z.string().min(1).nullable() }),
  z.object({ action: z.literal("create_folder"), name: z.string().trim().min(1).max(48), color: z.string().trim().max(16).nullable().optional() }),
  z.object({ action: z.literal("delete_folder"), folderId: z.string().min(1) }),
]);

export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) return sameOriginError();
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ success: false, message: "Não autorizado." }, { status: 401 });
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ success: false, message: "Organização inválida." }, { status: 400 });
    const body = parsed.data;
    if (body.action === "create_folder") {
      const count = await db.directConversationFolder.count({ where: { userId: user.id } });
      if (count >= 30) return NextResponse.json({ success: false, message: "Você atingiu o limite de pastas." }, { status: 400 });
      const folder = await db.directConversationFolder.create({ data: { userId: user.id, name: body.name, color: body.color || null, position: count }, select: { id: true, name: true, color: true, position: true } });
      return NextResponse.json({ success: true, folder }, { status: 201 });
    }
    if (body.action === "delete_folder") {
      await db.directConversationFolder.deleteMany({ where: { id: body.folderId, userId: user.id } });
      return NextResponse.json({ success: true });
    }
    await assertConversationMember(body.conversationId, user.id);
    if (body.action === "favorite") await db.directConversationParticipant.update({ where: { conversationId_userId: { conversationId: body.conversationId, userId: user.id } }, data: { isFavorite: body.value } });
    if (body.action === "move") {
      if (body.folderId) {
        const folder = await db.directConversationFolder.findFirst({ where: { id: body.folderId, userId: user.id }, select: { id: true } });
        if (!folder) return NextResponse.json({ success: false, message: "Pasta não encontrada." }, { status: 404 });
      }
      await db.directConversationParticipant.update({ where: { conversationId_userId: { conversationId: body.conversationId, userId: user.id } }, data: { folderId: body.folderId } });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return NextResponse.json({ success: false, message: "Você não participa desta conversa." }, { status: 403 });
    console.error("[DIRECT_MESSAGES_ORGANIZATION]", error);
    return NextResponse.json({ success: false, message: "Não foi possível atualizar a organização." }, { status: 500 });
  }
}
