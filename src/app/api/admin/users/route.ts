import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, apiUnexpectedError } from "@/lib/api-response";
import { requirePlatformAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

const createSchema = z.object({ username: z.string().trim().min(2).max(32).regex(/^[a-zA-Z0-9_.-]+$/), email: z.string().trim().email().max(255), password: z.string().min(10).max(128).optional() });
const actionSchema = z.object({ id: z.string().min(1), action: z.enum(["set-admin", "reset-password", "delete"]), value: z.boolean().optional() });

export async function GET(request: NextRequest) {
  try {
    const actor = await requirePlatformAdmin();
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const users = await db.user.findMany({ where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { username: { contains: q, mode: "insensitive" } }, { globalName: { contains: q, mode: "insensitive" } }] } : undefined, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, username: true, email: true, globalName: true, status: true, admin: true, createdAt: true, _count: { select: { memberships: true, directMessagesAuthored: true } } } });
    return apiOk({ users, actorId: actor.id });
  } catch (error) { return adminError(error, "admin.users.list"); }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requirePlatformAdmin();
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError("Dados do usuário inválidos.", 400, "INVALID_USER");
    const password = parsed.data.password ?? randomBytes(18).toString("base64url");
    const user = await db.user.create({ data: { username: parsed.data.username, email: parsed.data.email.toLowerCase(), globalName: parsed.data.username, passwordHash: await bcrypt.hash(password, 12) }, select: { id: true, username: true, email: true, createdAt: true } });
    await db.platformLog.create({ data: { level: "audit", event: "admin.user.create", userId: actor.id, metadata: { targetUserId: user.id } } });
    return apiOk({ user, temporaryPassword: parsed.data.password ? undefined : password }, 201);
  } catch (error) { return adminError(error, "admin.users.create"); }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await requirePlatformAdmin();
    const parsed = actionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError("Ação de usuário inválida.", 400, "INVALID_USER_ACTION");
    if (parsed.data.id === actor.id && parsed.data.action !== "set-admin") return apiError("Você não pode remover ou resetar a própria conta pelo painel.", 400, "SELF_PROTECTION");
    if (parsed.data.action === "set-admin") {
      const user = await db.user.update({ where: { id: parsed.data.id }, data: { admin: parsed.data.value === true }, select: { id: true, admin: true } });
      await db.platformLog.create({ data: { level: "audit", event: "admin.user.set_admin", userId: actor.id, metadata: { targetUserId: user.id, admin: user.admin } } });
      return apiOk({ user });
    }
    if (parsed.data.action === "reset-password") {
      const password = randomBytes(18).toString("base64url");
      await db.$transaction([db.user.update({ where: { id: parsed.data.id }, data: { passwordHash: await bcrypt.hash(password, 12) } }), db.session.deleteMany({ where: { userId: parsed.data.id } })]);
      await db.platformLog.create({ data: { level: "audit", event: "admin.user.reset_password", userId: actor.id, metadata: { targetUserId: parsed.data.id } } });
      return apiOk({ temporaryPassword: password });
    }
    await db.$transaction([db.guild.deleteMany({ where: { ownerId: parsed.data.id } }), db.user.delete({ where: { id: parsed.data.id } })]);
    await db.platformLog.create({ data: { level: "audit", event: "admin.user.delete", userId: actor.id, metadata: { targetUserId: parsed.data.id } } });
    return apiOk({ deleted: true });
  } catch (error) { return adminError(error, "admin.users.action"); }
}

function adminError(error: unknown, context: string) {
  if (error instanceof Error && error.message.includes("Acesso restrito")) return apiError(error.message, 403, "PLATFORM_ADMIN_REQUIRED");
  if (error instanceof Error && error.message === "Não autorizado.") return apiError(error.message, 401, "AUTH_REQUIRED");
  return apiUnexpectedError(error, context);
}
