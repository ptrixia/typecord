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

    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          message: result.error.issues[0]?.message ?? "Dados inválidos.",
        },
        { status: 400 }
      );
    }

    const { username, email, password } = result.data;

    const normalizedEmail = email.toLowerCase();

    const existingUser = await db.user.findFirst({
      where: {
        OR: [
          {
            email: normalizedEmail,
          },
          {
            username,
          },
        ],
      },
      select: {
        email: true,
        username: true,
      },
    });

    if (existingUser) {
      if (existingUser.email === normalizedEmail) {
        return NextResponse.json(
          {
            message: "Este e-mail já está sendo usado.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          message: "Este nome de usuário já está sendo usado.",
        },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

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
        avatarUrl: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        message: "Conta criada com sucesso.",
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[REGISTER_ERROR]", error);

    return NextResponse.json(
      {
        message: "Não foi possível criar sua conta.",
      },
      { status: 500 }
    );
  }
}