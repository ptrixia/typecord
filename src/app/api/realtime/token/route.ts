import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/current-user";
import { enforceRateLimit } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getRealtimeSecret() {
  const secret = process.env.REALTIME_JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("REALTIME_JWT_SECRET precisa ter pelo menos 32 caracteres.");
  }

  return new TextEncoder().encode(secret);
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Não autorizado." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const limited = await enforceRateLimit(
      request,
      "realtime-token",
      30,
      60,
      user.id,
    );
    if (limited) return limited;

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(user.id)
      .setIssuer("typecord-web")
      .setAudience("typecord-gateway")
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime("60s")
      .sign(getRealtimeSecret());

    return NextResponse.json(
      { success: true, token, expiresIn: 60 },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    console.error("[REALTIME_TOKEN_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Não foi possível gerar o token realtime." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
