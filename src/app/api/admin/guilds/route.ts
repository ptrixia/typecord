import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, apiUnexpectedError } from "@/lib/api-response";
import { requirePlatformAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

const schema = z.object({ id: z.string().min(1), action: z.enum(["rename", "set-discoverable", "delete"]), name: z.string().trim().min(1).max(100).optional(), value: z.boolean().optional() });
const createSchema = z.object({ name: z.string().trim().min(1).max(100), ownerId: z.string().min(1) });

export async function GET(request: NextRequest) {
  try {
    await requirePlatformAdmin();
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const guilds = await db.guild.findMany({ where: q ? { name: { contains: q, mode: "insensitive" } } : undefined, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, name: true, ownerId: true, discoverable: true, verified: true, createdAt: true, _count: { select: { members: true, channels: true } }, owner: { select: { username: true, email: true } } } });
    return apiOk({ guilds });
  } catch (error) { return adminError(error, "admin.guilds.list"); }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePlatformAdmin();
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError("Nome e proprietário são obrigatórios.", 400, "INVALID_GUILD");
    const owner = await db.user.findUnique({ where: { id: parsed.data.ownerId }, select: { id: true } });
    if (!owner) return apiError("Proprietário não encontrado.", 404, "OWNER_NOT_FOUND");
    const guild = await db.$transaction(async (tx) => {
      const created = await tx.guild.create({ data: { name: parsed.data.name, ownerId: owner.id } });
      const role = await tx.role.create({ data: { guildId: created.id, name: "@everyone", color: "#99aab5", position: 0, isDefault: true, permissions: "7" } });
      await tx.member.create({ data: { guildId: created.id, userId: owner.id, roles: { connect: { id: role.id } } } });
      return created;
    });
    await db.platformLog.create({ data: { level: "audit", event: "admin.guild.create", userId: actor.id, metadata: { guildId: guild.id, ownerId: owner.id } } });
    return apiOk({ guild }, 201);
  } catch (error) { return adminError(error, "admin.guilds.create"); }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requirePlatformAdmin();
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError("Ação de guild inválida.", 400, "INVALID_GUILD_ACTION");
    if (parsed.data.action === "delete") {
      await db.guild.delete({ where: { id: parsed.data.id } });
      await db.platformLog.create({ data: { level: "audit", event: "admin.guild.delete", userId: actor.id, metadata: { guildId: parsed.data.id } } });
      return apiOk({ deleted: true });
    }
    const data = parsed.data.action === "rename" ? { name: parsed.data.name } : { discoverable: parsed.data.value === true };
    const guild = await db.guild.update({ where: { id: parsed.data.id }, data, select: { id: true, name: true, discoverable: true } });
    await db.platformLog.create({ data: { level: "audit", event: `admin.guild.${parsed.data.action}`, userId: actor.id, metadata: { guildId: guild.id, data } } });
    return apiOk({ guild });
  } catch (error) { return adminError(error, "admin.guilds.action"); }
}

function adminError(error: unknown, context: string) {
  if (error instanceof Error && error.message.includes("Acesso restrito")) return apiError(error.message, 403, "PLATFORM_ADMIN_REQUIRED");
  if (error instanceof Error && error.message === "Não autorizado.") return apiError(error.message, 401, "AUTH_REQUIRED");
  return apiUnexpectedError(error, context);
}
