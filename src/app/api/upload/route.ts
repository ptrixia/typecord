import crypto from "node:crypto";
import path from "node:path";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/current-user";
import { enforceRateLimit, isSameOriginRequest, sameOriginError } from "@/lib/request-security";
import { putObject } from "@/lib/storage";
import { uploadPrefixForUser } from "@/lib/storage-access";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const BLOCKED_MIME_TYPES = new Set([
  "image/svg+xml",
  "text/html",
  "application/xhtml+xml",
  "application/xml",
  "text/xml",
  "application/javascript",
  "text/javascript",
]);

const BLOCKED_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".xhtml",
  ".svg",
  ".xml",
  ".js",
  ".mjs",
  ".cjs",
]);

function sanitizeFilename(name: string) {
  const base = path.basename(name).replace(/[\u0000-\u001f\u007f]/g, "");
  return base.slice(0, 255) || "arquivo";
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return sameOriginError();
    }

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Não autorizado." },
        { status: 401 },
      );
    }

    const limited = await enforceRateLimit(request, "upload", 30, 60, user.id);
    if (limited) {
      return limited;
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "Nenhum arquivo válido foi enviado." },
        { status: 400 },
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { success: false, message: "O arquivo está vazio." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, message: "O arquivo não pode ultrapassar 25 MB." },
        { status: 413 },
      );
    }

    const filename = sanitizeFilename(file.name);
    const extension = path.extname(filename).toLowerCase().slice(0, 16);
    const contentType = (file.type || "application/octet-stream")
      .toLowerCase()
      .split(";", 1)[0]
      .trim();

    if (BLOCKED_MIME_TYPES.has(contentType) || BLOCKED_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        { success: false, message: "Este tipo de arquivo não é permitido." },
        { status: 415 },
      );
    }

    const objectName = `${uploadPrefixForUser(user.id)}${new Date().getUTCFullYear()}/${crypto.randomUUID()}${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await putObject({
      key: objectName,
      body: buffer,
      contentType,
      contentLength: file.size,
    });

    await db.upload.create({
      data: {
        key: objectName,
        filename,
        mimeType: contentType,
        size: file.size,
        ownerId: user.id,
        channelId: typeof formData.get("channelId") === "string" ? String(formData.get("channelId")) : null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return NextResponse.json(
      {
        success: true,
        key: objectName,
        url: `/api/files?key=${encodeURIComponent(objectName)}`,
        name: filename,
        size: file.size,
        contentType,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[UPLOAD_ERROR]", error);

    return NextResponse.json(
      { success: false, message: "Não foi possível concluir o upload." },
      { status: 500 },
    );
  }
}
