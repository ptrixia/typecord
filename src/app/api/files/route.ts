import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/current-user";
import { getObject, isSafeStorageKey, normalizeStorageKey } from "@/lib/storage";
import { canUserReadStorageKey } from "@/lib/storage-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INLINE_MIME_PREFIXES = ["image/", "video/", "audio/"];
const NEVER_INLINE = new Set([
  "image/svg+xml",
  "text/html",
  "application/xhtml+xml",
  "application/xml",
  "text/xml",
  "application/javascript",
  "text/javascript",
]);

function safeFilename(key: string) {
  return (key.split("/").pop() || "arquivo")
    .replace(/[\r\n"\\]/g, "_")
    .slice(0, 180);
}

function errorName(error: unknown) {
  return typeof error === "object" && error !== null && "name" in error
    ? String((error as { name?: unknown }).name ?? "")
    : "";
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

    const contentType = (object.ContentType || "application/octet-stream")
      .toLowerCase()
      .split(";", 1)[0]
      .trim();
    const canInline =
      !NEVER_INLINE.has(contentType) &&
      INLINE_MIME_PREFIXES.some((prefix) => contentType.startsWith(prefix));

    const headers = new Headers({
      "Content-Type": contentType,
      "Content-Disposition": `${canInline ? "inline" : "attachment"}; filename="${safeFilename(key)}"`,
      "Cache-Control": "private, max-age=300, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
    });

    if (typeof object.ContentLength === "number") {
      headers.set("Content-Length", String(object.ContentLength));
    }

    const body = object.Body.transformToWebStream();
    return new NextResponse(body, { status: 200, headers });
  } catch (error) {
    const name = errorName(error);

    if (name === "NoSuchKey" || name === "NotFound") {
      return NextResponse.json(
        { success: false, message: "Arquivo não encontrado." },
        { status: 404 },
      );
    }

    console.error("[API_FILES_GET]", error);

    return NextResponse.json(
      { success: false, message: "Não foi possível carregar o arquivo." },
      { status: 500 },
    );
  }
}
