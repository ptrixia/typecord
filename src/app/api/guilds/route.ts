import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { guildSchema } from "@/lib/validations";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return new NextResponse("Não autorizado", { status: 401 });

    const body = await req.json();
    const { name, iconUrl } = guildSchema.parse(body);

    const guild = await db.guild.create({
      data: {
        ownerId: user.id,
        name,
        iconUrl,
        // Ao criar um servidor, já criamos o cargo @everyone, o criador como membro e o canal geral
        roles: {
          create: [{ name: "@everyone", position: 0, permissions: "0" }]
        },
        members: {
          create: [{ userId: user.id }]
        },
        channels: {
          create: [{ name: "geral", type: "GUILD_TEXT", position: 0 }]
        }
      }
    });

    return NextResponse.json(guild, { status: 201 });
  } catch (error) {
    console.error("[GUILDS_POST]", error);
    return new NextResponse("Erro Interno", { status: 500 });
  }
}