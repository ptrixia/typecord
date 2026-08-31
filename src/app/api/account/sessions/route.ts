import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { isSameOriginRequest, sameOriginError } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function currentSessionToken() {
  const store = await cookies();
  return store.get("__Secure-next-auth.session-token")?.value
    ?? store.get("next-auth.session-token")?.value
    ?? null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "Não autorizado." }, { status: 401 });

  const currentToken = await currentSessionToken();
  const sessions = await db.session.findMany({
    where: { userId: user.id, expires: { gt: new Date() } },
    orderBy: { expires: "desc" },
    select: { id: true, expires: true, sessionToken: true },
  });

  return NextResponse.json({
    success: true,
    sessions: sessions.map((session) => ({
      id: session.id,
      expires: session.expires.toISOString(),
      current: session.sessionToken === currentToken,
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) return sameOriginError();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "Não autorizado." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { id?: unknown; all?: unknown };
  if (body.all === true) {
    await db.session.deleteMany({ where: { userId: user.id } });
    await db.platformLog.create({ data: { level: "security", event: "account.session.revoke_all", userId: user.id } });
    return NextResponse.json({ success: true, revoked: "all" });
  }

  if (typeof body.id !== "string" || body.id.length < 8 || body.id.length > 128) {
    return NextResponse.json({ success: false, message: "Sessão inválida." }, { status: 400 });
  }

  const result = await db.session.deleteMany({ where: { id: body.id, userId: user.id } });
  if (!result.count) return NextResponse.json({ success: false, message: "Sessão não encontrada." }, { status: 404 });
  await db.platformLog.create({ data: { level: "security", event: "account.session.revoke", userId: user.id, metadata: { sessionId: body.id } } });
  return NextResponse.json({ success: true, revoked: body.id });
}
