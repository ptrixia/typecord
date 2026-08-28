import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message: "A autenticação Pusher legada foi desativada. Use GET /api/gateway e o Gateway Socket.IO.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
