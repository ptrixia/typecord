"use client";

const encode = (value: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(value)));
const decode = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

export async function encryptBackup(value: unknown, passphrase: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 310_000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(value)));
  return JSON.stringify({ version: 1, algorithm: "AES-256-GCM+PBKDF2-SHA256", iterations: 310_000, salt: encode(salt), iv: encode(iv), ciphertext: encode(ciphertext) }, null, 2);
}

export async function decryptBackup(raw: string, passphrase: string) {
  const payload = JSON.parse(raw) as { version?: number; algorithm?: string; iterations?: number; salt?: string; iv?: string; ciphertext?: string };
  const iterations = payload.iterations ?? 310_000;
  if (payload.version !== 1 || payload.algorithm !== "AES-256-GCM+PBKDF2-SHA256" || iterations < 100_000 || iterations > 1_000_000 || !payload.salt || !payload.iv || !payload.ciphertext) {
    throw new Error("Formato de backup inválido.");
  }
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: decode(payload.salt), iterations, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(payload.iv) }, key, decode(payload.ciphertext));
  return JSON.parse(new TextDecoder().decode(plaintext)) as Record<string, unknown>;
}
