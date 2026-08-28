import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { enforceRateLimit, isSameOriginRequest, sameOriginError } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "O nome de usuário precisa ter pelo menos 2 caracteres.")
    .max(32, "O nome de usuário pode ter no máximo 32 caracteres.")
    .regex(/^[a-zA-Z0-9_.-]+$/, "O nome de usuário contém caracteres inválidos."),
  email: z.string().trim().email("Digite um e-mail válido.").max(255),
  password: z
    .string()
    .min(10, "A senha precisa ter pelo menos 10 caracteres.")
    .max(128, "A senha é muito longa."),
});

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return sameOriginError();
    }

    const limited = await enforceRateLimit(request, "register", 5, 15 * 60);
    if (limited) {
      return limited;
    }

    const parsed = registerSchema.safeParse(await request.json().catch(() => null));

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: parsed.error.issues[0]?.message ?? "Dados inválidos.",
        },
        { status: 400 },
      );
    }

    const username = parsed.data.username;
    const normalizedEmail = parsed.data.email.toLowerCase();

    const existingUser = await db.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { username }],
      },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Não foi possível criar a conta com os dados informados.",
        },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const user = await db.user.create({
      data: {
        username,
        email: normalizedEmail,
        passwordHash,
        globalName: username,
      },
      select: {
        id: true,
        username: true,
        globalName: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Conta criada com sucesso.",
        user,
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("[REGISTER_ERROR]", error);

    return NextResponse.json(
      {
        success: false,
        message: "Não foi possível criar sua conta.",
      },
      { status: 500 },
    );
  }
}
