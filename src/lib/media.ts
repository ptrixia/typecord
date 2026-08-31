const STORAGE_KEY_PATTERN =
  /^attachments\/(?:[0-9]+\/)?[0-9]{4}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,10}$/i;

export function normalizeStorageKey(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const key = value.trim().replace(/^\/+/, "");

  return STORAGE_KEY_PATTERN.test(key) ? key : null;
}

export function normalizeMediaReference(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("Referência de mídia inválida.");
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length > 2048) {
    throw new Error("Referência de mídia muito longa.");
  }

  const storageKey = normalizeStorageKey(normalized);

  if (storageKey) {
    return storageKey;
  }

  if (normalized.startsWith("/api/files?")) {
    const localUrl = new URL(normalized, "https://typecord.invalid");
    const key = normalizeStorageKey(localUrl.searchParams.get("key"));

    if (!key) {
      throw new Error("Referência de arquivo inválida.");
    }

    return key;
  }

  let url: URL;

  try {
    url = new URL(normalized);
  } catch {
    throw new Error("URL de mídia inválida.");
  }

  if (url.username || url.password) {
    throw new Error("URLs com credenciais não são permitidas.");
  }

  const isLocalDevelopmentUrl =
    process.env.NODE_ENV !== "production" &&
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname);

  if (url.protocol !== "https:" && !isLocalDevelopmentUrl) {
    throw new Error("Use uma URL HTTPS para a mídia.");
  }

  return url.toString();
}

export function isSafeExternalHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return (
      !url.username &&
      !url.password &&
      (url.protocol === "http:" || url.protocol === "https:")
    );
  } catch {
    return false;
  }
}
