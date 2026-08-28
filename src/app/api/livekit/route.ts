import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      message: "Endpoint legado desativado. Use /api/livekit/token?channelId=... .",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
