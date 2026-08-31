import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";

export async function requirePlatformAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Não autorizado.");
  const admin = await db.user.findUnique({ where: { id: user.id }, select: { id: true, admin: true } });
  if (!admin?.admin) throw new Error("Acesso restrito aos administradores da plataforma.");
  return admin;
}
