import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message: "A rota de typing legada foi removida. Use o Gateway Socket.IO autenticado.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
