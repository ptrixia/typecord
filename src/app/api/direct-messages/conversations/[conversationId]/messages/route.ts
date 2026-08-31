import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import {
  assertConversationMember,
  directMessageInclude,
  isBlocked,
  serializeDirectMessage,
} from "@/lib/direct-messages.server";
import { emitToUser } from "@/lib/realtime/emitter";
import { enforceRateLimit, isSameOriginRequest, sameOriginError } from "@/lib/request-security";
import { isOwnedUploadKey } from "@/lib/storage-access";
import { storageObjectExists } from "@/lib/storage";
import { isE2EEEnvelope } from "@/lib/e2ee-envelope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ conversationId: string }>;
};

const attachmentSchema = z.object({
  url: z.string().min(1).max(2048),
  filename: z.string().trim().min(1).max(255),
  fileSize: z.number().int().min(0).max(25 * 1024 * 1024),
  fileType: z.string().trim().min(1).max(150),
});

const createMessageSchema = z.object({
  // E2EE envelopes expand the plaintext with base64 and one wrapped key per device.
  content: z.string().max(24000).default(""),
  replyToId: z.string().trim().min(1).max(128).nullable().optional(),
  attachments: z.array(attachmentSchema).max(10).default([]),
  expiresAt: z.string().datetime().nullable().optional(),
});

function extractStorageKey(value: string) {
  if (value.startsWith("attachments/")) {
    return value;
  }

  try {
    const url = new URL(value, "https://typecord.local");
    if (url.pathname === "/api/files") {
      return url.searchParams.get("key") ?? "";
    }
  } catch {
    return "";
  }

  return "";
}

async function notifyParticipants(
  conversationId: string,
  type: "MESSAGE_CREATE" | "MESSAGE_UPDATE" | "MESSAGE_DELETE",
  data: Record<string, unknown>,
) {
  const participants = await db.directConversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true },
  });

  await Promise.allSettled(
    participants.map((participant) =>
      emitToUser(participant.userId, type, {
        conversationId,
        ...data,
      }),
    ),
  );
}

async function createDirectMessageNotifications(
  conversationId: string,
  authorId: string,
  messageId: string,
) {
  const participants = await db.directConversationParticipant.findMany({
    where: { conversationId, userId: { not: authorId } },
    select: { userId: true },
  });
  await Promise.allSettled(participants.map(async ({ userId }) => {
    const notification = await db.notification.create({
      data: {
        userId,
        messageId,
        type: "SYSTEM",
        title: "Nova mensagem direta",
        content: "Você recebeu uma nova mensagem direta.",
        href: `/channels/@me/${conversationId}`,
      },
    });
    await emitToUser(userId, "NOTIFICATION_CREATE", { notification });
  }));
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "Não autorizado." },
        { status: 401 },
      );
    }

    const limited = await enforceRateLimit(
      request,
      "dm-read",
      180,
      60,
      currentUser.id,
    );
    if (limited) return limited;

    const { conversationId } = await context.params;
    await assertConversationMember(conversationId, currentUser.id);

    const beforeRaw = request.nextUrl.searchParams.get("before");
    const before = beforeRaw ? new Date(beforeRaw) : null;

    if (before && Number.isNaN(before.getTime())) {
      return NextResponse.json(
        { success: false, message: "Cursor de data inválido." },
        { status: 400 },
      );
    }

    const parsedLimit = Number(request.nextUrl.searchParams.get("limit") ?? 50);
    const take = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 100)
      : 50;

    const messages = await db.directMessage.findMany({
      where: {
        conversationId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      include: directMessageInclude,
    });

    await db.directConversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: currentUser.id,
        },
      },
      data: {
        lastReadAt: new Date(),
        isHidden: false,
      },
    });

    return NextResponse.json(
      {
        success: true,
        messages: messages
          .reverse()
          .map((message) => serializeDirectMessage(message, currentUser.id)),
        hasMore: messages.length === take,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, message: "Sem acesso a esta conversa." },
        { status: 403 },
      );
    }

    console.error("[DIRECT_MESSAGES_GET]", error);
    return NextResponse.json(
      { success: false, message: "Não foi possível carregar as mensagens." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    if (!isSameOriginRequest(request)) {
      return sameOriginError();
    }

    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "Não autorizado." },
        { status: 401 },
      );
    }

    const limited = await enforceRateLimit(
      request,
      "dm-send",
      60,
      60,
      currentUser.id,
    );
    if (limited) return limited;

    const { conversationId } = await context.params;
    await assertConversationMember(conversationId, currentUser.id);

    const conversation = await db.directConversation.findUnique({
      where: { id: conversationId },
      select: {
        type: true,
        participants: { select: { userId: true } },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { success: false, message: "Conversa não encontrada." },
        { status: 404 },
      );
    }

    if (conversation.type === "DM") {
      const otherUserId = conversation.participants.find(
        (participant) => participant.userId !== currentUser.id,
      )?.userId;

      if (otherUserId && (await isBlocked(currentUser.id, otherUserId))) {
        return NextResponse.json(
          { success: false, message: "Não é possível enviar mensagens nesta conversa." },
          { status: 403 },
        );
      }
    }

    const parsed = createMessageSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." },
        { status: 400 },
      );
    }

    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
    if (expiresAt && expiresAt <= new Date()) {
      return NextResponse.json(
        { success: false, message: "O prazo da mensagem temporária é inválido." },
        { status: 400 },
      );
    }

    const content = parsed.data.content.trim();

    if (content && !isE2EEEnvelope(content)) {
      return NextResponse.json(
        { success: false, message: "Esta conversa exige criptografia de ponta a ponta." },
        { status: 422 },
      );
    }

    const attachments = [] as Array<{
      url: string;
      filename: string;
      fileSize: number;
      fileType: string;
    }>;

    for (const attachment of parsed.data.attachments) {
      const key = extractStorageKey(attachment.url);

      if (!key || !isOwnedUploadKey(currentUser.id, key)) {
        return NextResponse.json(
          { success: false, message: "Anexo inválido ou pertencente a outro usuário." },
          { status: 400 },
        );
      }

      if (!(await storageObjectExists(key))) {
        return NextResponse.json(
          { success: false, message: "Um dos anexos não existe mais." },
          { status: 400 },
        );
      }

      attachments.push({
        url: `/api/files?key=${encodeURIComponent(key)}`,
        filename: attachment.filename,
        fileSize: attachment.fileSize,
        fileType: attachment.fileType,
      });
    }

    if (!content && attachments.length === 0) {
      return NextResponse.json(
        { success: false, message: "Digite uma mensagem ou adicione um arquivo." },
        { status: 400 },
      );
    }

    const replyToId = parsed.data.replyToId ?? null;

    if (replyToId) {
      const replyMessage = await db.directMessage.findFirst({
        where: { id: replyToId, conversationId },
        select: { id: true },
      });

      if (!replyMessage) {
        return NextResponse.json(
          { success: false, message: "Mensagem respondida inválida." },
          { status: 400 },
        );
      }
    }

    const message = await db.$transaction(async (tx) => {
      const created = await tx.directMessage.create({
        data: {
          conversationId,
          authorId: currentUser.id,
          content,
          replyToId,
          expiresAt,
          attachments: { create: attachments },
        },
        include: directMessageInclude,
      });

      await tx.directConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      await tx.directConversationParticipant.updateMany({
        where: { conversationId },
        data: { isHidden: false },
      });

      return created;
    });

    const serialized = serializeDirectMessage(message, currentUser.id);
    await Promise.all([
      notifyParticipants(conversationId, "MESSAGE_CREATE", { message: serialized }),
      createDirectMessageNotifications(conversationId, currentUser.id, message.id),
    ]);

    return NextResponse.json(
      { success: true, message: serialized },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, message: "Sem acesso a esta conversa." },
        { status: 403 },
      );
    }

    console.error("[DIRECT_MESSAGES_POST]", error);
    return NextResponse.json(
      { success: false, message: "Não foi possível enviar a mensagem." },
      { status: 500 },
    );
  }
}
