import { createHmac, timingSafeEqual } from "node:crypto";

import { normalizeStorageKey } from "@/lib/media";

const UPLOAD_TOKEN_TTL_SECONDS = 60 * 60;

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/flac": "flac",
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "text/plain": "txt",
  "application/octet-stream": "bin",
};

export interface UploadedFileDescriptor {
  key: string;
  filename: string;
  fileSize: number;
  fileType: string;
  uploadToken: string;
}

interface UploadTokenPayload {
  key: string;
  filename: string;
  fileSize: number;
  fileType: string;
  userId: string;
  expiresAt: number;
}

function getSigningSecret() {
  const secret =
    process.env.FILE_SIGNING_SECRET ?? process.env.NEXTAUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "FILE_SIGNING_SECRET (ou NEXTAUTH_SECRET) precisa ter ao menos 32 caracteres.",
    );
  }

  return secret;
}

function signPayload(encodedPayload: string) {
  return createHmac("sha256", getSigningSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function normalizeUploadContentType(value: string | undefined) {
  const contentType = (value || "application/octet-stream")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  const extension = MIME_EXTENSIONS[contentType];

  if (!extension) {
    throw new Error("Este tipo de arquivo não é permitido.");
  }

  return { contentType, extension };
}

export function sanitizeFilename(value: string) {
  const filename = value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]/g, "_")
    .trim()
    .slice(0, 255);

  return filename || "arquivo";
}

export function createUploadToken(
  file: Omit<UploadedFileDescriptor, "uploadToken">,
  userId: string,
) {
  const payload: UploadTokenPayload = {
    ...file,
    userId,
    expiresAt: Math.floor(Date.now() / 1000) + UPLOAD_TOKEN_TTL_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );

  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifyUploadedFile(
  value: unknown,
  userId: string,
): Omit<UploadedFileDescriptor, "uploadToken"> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<UploadedFileDescriptor>;

  if (typeof candidate.uploadToken !== "string") {
    return null;
  }

  const [encodedPayload, providedSignature, extra] =
    candidate.uploadToken.split(".");

  if (!encodedPayload || !providedSignature || extra !== undefined) {
    return null;
  }

  const expectedBuffer = Buffer.from(signPayload(encodedPayload));
  const providedBuffer = Buffer.from(providedSignature);

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return null;
  }

  let payload: UploadTokenPayload;

  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as UploadTokenPayload;
  } catch {
    return null;
  }

  const key = normalizeStorageKey(payload.key);

  if (
    !key ||
    payload.userId !== userId ||
    !Number.isSafeInteger(payload.expiresAt) ||
    payload.expiresAt < Math.floor(Date.now() / 1000) ||
    typeof payload.filename !== "string" ||
    typeof payload.fileType !== "string" ||
    !Number.isSafeInteger(payload.fileSize) ||
    payload.fileSize < 1 ||
    payload.fileSize > 25 * 1024 * 1024
  ) {
    return null;
  }

  if (
    candidate.key !== payload.key ||
    candidate.filename !== payload.filename ||
    candidate.fileType !== payload.fileType ||
    candidate.fileSize !== payload.fileSize
  ) {
    return null;
  }

  return {
    key,
    filename: payload.filename,
    fileSize: payload.fileSize,
    fileType: payload.fileType,
  };
}

export function canRenderInline(contentType: string) {
  return (
    contentType.startsWith("image/") ||
    contentType.startsWith("video/") ||
    contentType.startsWith("audio/")
  );
}
