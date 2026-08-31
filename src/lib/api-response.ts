import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status });
}

export function apiError(message: string, status = 400, code?: string) {
  return NextResponse.json(
    { success: false, error: message, ...(code ? { code } : {}) },
    { status },
  );
}

export function apiUnexpectedError(error: unknown, context: string) {
  console.error(`[API:${context}]`, error);
  void db.platformLog.create({
    data: {
      level: "error",
      event: "api.error",
      message: error instanceof Error ? error.message : String(error),
      route: context,
      metadata: error instanceof Error ? { name: error.name, stack: error.stack?.slice(0, 4000) } : undefined,
    },
  }).catch(() => undefined);
  return apiError("Erro interno do servidor.", 500, "INTERNAL_ERROR");
}
