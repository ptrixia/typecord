import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message:
        "A rota de webhook legada foi desativada. Use uma implementação com segredo por webhook, rotação e escopo de canal.",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
