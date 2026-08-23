import { NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";
import {
  authenticateGatewaySession,
} from "@/lib/gateway/session";
import {
  extractBotToken,
} from "@/lib/bots/token";

export const runtime = "nodejs";

export async function POST(
  request: Request,
) {
  try {
    const authorization =
      request.headers.get(
        "authorization",
      );

    if (
      !authorization?.startsWith(
        "Bearer ",
      )
    ) {
      return NextResponse.json(
        {
          message:
            "Gateway session required.",
        },
        { status: 401 },
      );
    }

    const sessionToken =
      authorization
        .slice("Bearer ".length)
        .trim();

    const session =
      await authenticateGatewaySession(
        sessionToken,
      );

    if (!session) {
      return NextResponse.json(
        {
          message:
            "Invalid or expired gateway session.",
        },
        { status: 401 },
      );
    }

    const body =
      await request.formData();

    const socketId =
      body.get("socket_id");

    const channelName =
      body.get("channel_name");

    if (
      typeof socketId !== "string" ||
      typeof channelName !== "string"
    ) {
      return NextResponse.json(
        {
          message:
            "Invalid Pusher payload.",
        },
        { status: 400 },
      );
    }

    const expectedChannel =
      `private-bot-${session.botId}`;

    if (
      channelName !==
      expectedChannel
    ) {
      return NextResponse.json(
        {
          message:
            "Forbidden channel.",
        },
        { status: 403 },
      );
    }

    const auth =
      pusherServer.authorizeChannel(
        socketId,
        channelName,
      );

    return NextResponse.json(auth);
  } catch (error) {
    console.error(
      "[GATEWAY_AUTH]",
      error,
    );

    return NextResponse.json(
      {
        message:
          "Gateway authentication failed.",
      },
      { status: 500 },
    );
  }
}