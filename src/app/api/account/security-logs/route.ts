import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { db } from "@/lib/db";
import { enforceRateLimit, isSameOriginRequest, sameOriginError } from "@/lib/request-security";

const labels: Record<string, string> = {
  "account.session.revoke": "Sessão encerrada",
  "account.session.revoke_all": "Todas as sessões encerradas",
  "account.e2ee.device_register": "Dispositivo E2EE registrado",
  "account.e2ee.device_revoke": "Dispositivo E2EE revogado",
  "account.two_factor.enable": "Autenticação em duas etapas ativada",
  "account.two_factor.disable": "Autenticação em duas etapas desativada",
  "account.sign_in": "Login realizado",
  "message.report.create": "Denúncia enviada",
};

export async function GET(request: NextRequest) {
  if (!isSameOriginRequest(request)) return sameOriginError();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, message: "Não autorizado." }, { status: 401 });
  const limited = await enforceRateLimit(request, "account-security-logs", 30, 60, user.id);
  if (limited) return limited;
  const logs = await db.platformLog.findMany({ where: { userId: user.id, level: { in: ["audit", "warn", "security"] } }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, event: true, level: true, createdAt: true } });
  return NextResponse.json({ success: true, logs: logs.map((log) => ({ id: log.id, label: labels[log.event] ?? "Atividade de segurança", level: log.level, createdAt: log.createdAt.toISOString() })) }, { headers: { "Cache-Control": "private, no-store" } });
}
