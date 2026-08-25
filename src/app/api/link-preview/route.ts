import {
  NextResponse,
} from "next/server";

import {
  getCurrentUser,
} from "@/lib/current-user";

import {
  getLinkPreviews,
} from "@/lib/link-preview";

export const runtime =
  "nodejs";

export async function POST(
  request: Request,
) {
  try {
    const user =
      await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Não autorizado.",
        },
        {
          status: 401,
        },
      );
    }

    const body =
      await request
        .json()
        .catch(
          () => null,
        );

    const content =
      typeof body?.content ===
      "string"
        ? body.content.trim()
        : "";

    if (!content) {
      return NextResponse.json(
        {
          success: true,
          embeds: [],
        },
      );
    }

    if (
      content.length > 10_000
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Mensagem muito grande.",
        },
        {
          status: 400,
        },
      );
    }

    const embeds =
      await getLinkPreviews(
        content,
      );

    return NextResponse.json({
      success: true,
      embeds,
    });
  } catch (error) {
    console.error(
      "[LINK_PREVIEW_API]",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        embeds: [],
        message:
          "Não foi possível gerar a prévia.",
      },
      {
        status: 500,
      },
    );
  }
}