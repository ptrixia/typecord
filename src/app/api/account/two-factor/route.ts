import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { createTotpSecret, verifyTotp } from "@/lib/totp";
import { apiError, apiOk, apiUnexpectedError } from "@/lib/api-response";

const bodySchema = z.object({ action: z.enum(["begin", "enable", "disable"]), code: z.string().optional(), secret: z.string().optional() });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("Não autorizado.", 401, "AUTH_REQUIRED");
  const account = await db.user.findUnique({ where: { id: user.id }, select: { twoFactorEnabled: true } });
  return apiOk({ enabled: Boolean(account?.twoFactorEnabled) });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("Não autorizado.", 401, "AUTH_REQUIRED");
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return apiError("Dados inválidos.", 400, "INVALID_BODY");
    const account = await db.user.findUnique({ where: { id: user.id }, select: { email: true, twoFactorSecret: true, twoFactorEnabled: true } });
    if (!account) return apiError("Conta não encontrada.", 404);
    if (parsed.data.action === "begin") {
      const secret = createTotpSecret();
      return apiOk({ secret, otpauth: `otpauth://totp/Typecord:${encodeURIComponent(account.email)}?secret=${secret}&issuer=Typecord` });
    }
    if (!parsed.data.code) return apiError("Informe o código do autenticador.", 400, "CODE_REQUIRED");
    if (parsed.data.action === "enable") {
      if (!parsed.data.secret || !verifyTotp(parsed.data.secret, parsed.data.code)) return apiError("Código inválido.", 400, "INVALID_CODE");
      await db.user.update({ where: { id: user.id }, data: { twoFactorSecret: parsed.data.secret, twoFactorEnabled: true } });
      await db.platformLog.create({ data: { level: "security", event: "account.two_factor.enable", userId: user.id } });
      return apiOk({ enabled: true });
    }
    if (!account.twoFactorSecret || !verifyTotp(account.twoFactorSecret, parsed.data.code)) return apiError("Código inválido.", 400, "INVALID_CODE");
    await db.user.update({ where: { id: user.id }, data: { twoFactorSecret: null, twoFactorEnabled: false } });
    await db.platformLog.create({ data: { level: "security", event: "account.two_factor.disable", userId: user.id } });
    return apiOk({ enabled: false });
  } catch (error) { return apiUnexpectedError(error, "account.two_factor"); }
}
