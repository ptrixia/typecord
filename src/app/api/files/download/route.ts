import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/current-user";
import { getObject, isSafeStorageKey, normalizeStorageKey } from "@/lib/storage";
import { canUserReadStorageKey } from "@/lib/storage-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFilename(key: string) {
  return (key.split("/").pop() || "arquivo")
    .replace(/[\r\n"\\]/g, "_")
    .slice(0, 180);
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Não autorizado." },
        { status: 401 },
      );
    }

    const key = normalizeStorageKey(new URL(request.url).searchParams.get("key") ?? "");

    if (!isSafeStorageKey(key)) {
      return NextResponse.json(
        { success: false, message: "Chave de arquivo inválida." },
        { status: 400 },
      );
    }

    if (!(await canUserReadStorageKey(user.id, key))) {
      return NextResponse.json(
        { success: false, message: "Você não possui acesso a este arquivo." },
        { status: 403 },
      );
    }

    const object = await getObject(key);

    if (!object.Body) {
      return NextResponse.json(
        { success: false, message: "Arquivo não encontrado." },
        { status: 404 },
      );
    }

    const headers = new Headers({
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeFilename(key)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin",
    });

    if (typeof object.ContentLength === "number") {
      headers.set("Content-Length", String(object.ContentLength));
    }

    return new NextResponse(object.Body.transformToWebStream(), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("[API_FILES_DOWNLOAD]", error);

    return NextResponse.json(
      { success: false, message: "Não foi possível baixar o arquivo." },
      { status: 500 },
    );
  }
}
