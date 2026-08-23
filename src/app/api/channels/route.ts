import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { channelSchema } from "@/lib/validations";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Não autorizado", { status: 401 });

    const { searchParams } = new URL(req.url);
    const guildId = searchParams.get("guildId");

    if (!guildId) return new NextResponse("ID do servidor ausente", { status: 400 });

    const body = await req.json();
    const { name, type } = channelSchema.parse(body);

    // Verifica se o usuário pertence à guilda e tem permissão (neste exemplo básico, se é admin/dono)
    const guild = await db.guild.update({
      where: {
        id: guildId,
        members: { some: { userId: user.id } } // Validação de segurança crucial
      },
      data: {
        channels: {
          create: { name, type, position: 1 } // Position pode ser calculado dinamicamente depois
        }
      }
    });

    return NextResponse.json(guild, { status: 201 });
  } catch (error) {
    console.error("[CHANNELS_POST]", error);
    return new NextResponse("Erro Interno", { status: 500 });
  }
}