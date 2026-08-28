import { NextRequest, NextResponse } from "next/server";

import { getEffectiveChannelPermissions } from "@/lib/channel-permissions";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { Permissions, hasPermission } from "@/lib/permissions";
import { emitToChannel } from "@/lib/realtime/emitter";
import {
  enforceRateLimit,
  isSameOriginRequest,
  sameOriginError,
} from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ optionId: string }>;
};

function serializePoll(poll: any, userId: string) {
  return {
    id: poll.id,
    question: poll.question,
    allowMultiple: poll.allowMultiple,
    expiresAt: poll.expiresAt?.toISOString?.() ?? null,
    options: [...poll.options]
      .sort((left: any, right: any) => left.position - right.position)
      .map((option: any) => ({
        id: option.id,
        label: option.label,
        count: option.votes.length,
        votedByMe: option.votes.some((vote: any) => vote.userId === userId),
      })),
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    if (!isSameOriginRequest(request)) return sameOriginError();

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { success: false, message: "Não autorizado." },
        { status: 401 },
      );
    }

    const limited = await enforceRateLimit(
      request,
      "poll-vote",
      80,
      60,
      currentUser.id,
    );
    if (limited) return limited;

    const { optionId } = await context.params;
    const option = await db.pollOption.findUnique({
      where: { id: optionId },
      include: {
        poll: {
          include: {
            message: {
              select: {
                id: true,
                channelId: true,
                deleted: true,
                channel: { select: { guildId: true } },
              },
            },
          },
        },
      },
    });

    if (!option || option.poll.message.deleted) {
      return NextResponse.json(
        { success: false, message: "Enquete inválida." },
        { status: 404 },
      );
    }

    if (option.poll.expiresAt && option.poll.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { success: false, message: "Esta enquete já foi encerrada." },
        { status: 409 },
      );
    }

    const message = option.poll.message;
    const permissions = await getEffectiveChannelPermissions(
      message.channel.guildId,
      currentUser.id,
      message.channelId,
    );

    if (
      !hasPermission(permissions, Permissions.VIEW_CHANNEL) ||
      !hasPermission(permissions, Permissions.READ_MESSAGE_HISTORY)
    ) {
      return NextResponse.json(
        { success: false, message: "Sem acesso a esta enquete." },
        { status: 403 },
      );
    }

    await db.$transaction(async (tx) => {
      const existing = await tx.pollVote.findUnique({
        where: {
          optionId_userId: {
            optionId,
            userId: currentUser.id,
          },
        },
        select: { id: true },
      });

      if (existing) {
        await tx.pollVote.delete({ where: { id: existing.id } });
        return;
      }

      if (!option.poll.allowMultiple) {
        await tx.pollVote.deleteMany({
          where: {
            userId: currentUser.id,
            option: { pollId: option.pollId },
          },
        });
      }

      await tx.pollVote.create({
        data: {
          optionId,
          userId: currentUser.id,
        },
      });
    });

    const updated = await db.poll.findUnique({
      where: { id: option.pollId },
      include: {
        options: {
          include: {
            votes: true,
          },
        },
      },
    });

    const poll = serializePoll(updated, currentUser.id);

    await emitToChannel(message.channelId, "MESSAGE_UPDATE", {
      guildId: message.channel.guildId,
      channelId: message.channelId,
      message: {
        id: message.id,
        poll,
      },
    });

    return NextResponse.json(
      { success: true, poll },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[POLL_VOTE]", error);
    return NextResponse.json(
      { success: false, message: "Não foi possível votar na enquete." },
      { status: 500 },
    );
  }
}
