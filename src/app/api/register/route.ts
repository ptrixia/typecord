import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { z } from "zod";
import { db } from "@/lib/db";

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "O nome de usuário precisa ter pelo menos 2 caracteres.")
    .max(32, "O nome de usuário pode ter no máximo 32 caracteres.")
    .regex(
      /^[a-zA-Z0-9_.-]+$/,
      "O nome de usuário contém caracteres inválidos."
    ),

  email: z
    .string()
    .trim()
    .email("Digite um e-mail válido.")
    .max(255),

  password: z
    .string()
    .min(6, "A senha precisa ter pelo menos 6 caracteres.")
    .max(128),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("[REGISTER] Body recebido:", { ...body, password: "[REDACTED]" });

    const result = registerSchema.safeParse(body);

    if (!result.success) {
      console.log("[REGISTER] Erro de validação:", result.error.format());
      return NextResponse.json(
        {
          message: result.error.issues[0]?.message ?? "Dados inválidos.",
        },
        { status: 400 }
      );
    }

    const { username, email, password } = result.data;
    const normalizedEmail = email.toLowerCase();

    console.log("[REGISTER] Verificando usuário existente para:", normalizedEmail);

    const existingUser = await db.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { username },
        ],
      },
      select: {
        email: true,
        username: true,
      },
    });

    if (existingUser) {
      console.log("[REGISTER] Conflito encontrado:", existingUser);
      if (existingUser.email === normalizedEmail) {
        return NextResponse.json(
          { message: "Este e-mail já está sendo usado." },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { message: "Este nome de usuário já está sendo usado." },
        { status: 409 }
      );
    }

    console.log("[REGISTER] Gerando hash da senha...");
    const passwordHash = await bcrypt.hash(password, 12);

    console.log("[REGISTER] Criando usuário no banco de dados...");
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
        email: true,
        globalName: true,
        createdAt: true,
      },
    });

    console.log("[REGISTER] Usuário criado com sucesso:", user.id);

    return NextResponse.json(
      {
        message: "Conta criada com sucesso.",
        user,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[REGISTER_FATAL_ERROR] Detalhes completos:", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
    });

    return NextResponse.json(
      {
        message: error?.message || "Não foi possível criar sua conta.",
      },
      { status: 500 }
    );
  }
}