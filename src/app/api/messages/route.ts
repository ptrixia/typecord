import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

const MESSAGES_BATCH = 10;

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return new NextResponse("Não autorizado", {
        status: 401,
      });
    }

    const { searchParams } = new URL(req.url);

    const cursor = searchParams.get("cursor");
    const channelId = searchParams.get("channelId");

    if (!channelId) {
      return new NextResponse("ID do Canal ausente", {
        status: 400,
      });
    }

    const messages = await db.message.findMany({
      take: MESSAGES_BATCH,

      ...(cursor
        ? {
            skip: 1,
            cursor: {
              id: cursor,
            },
          }
        : {}),

      where: {
        channelId,
        deleted: false,
      },

      include: {
        member: {
          include: {
            user: {
              include: {
                bot: {
                  select: {
                    id: true,
                    verified: true,
                  },
                },
              },
            },
          },
        },

        attachments: true,

        embeds: true,

        replyTo: {
          include: {
            member: {
              include: {
                user: {
                  include: {
                    bot: {
                      select: {
                        id: true,
                        verified: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    const nextCursor =
      messages.length === MESSAGES_BATCH
        ? messages[MESSAGES_BATCH - 1].id
        : null;

    return NextResponse.json({
      items: messages,
      nextCursor,
    });
  } catch (error) {
    console.error("[MESSAGES_GET]", error);

    return new NextResponse("Erro Interno", {
      status: 500,
    });
  }
}