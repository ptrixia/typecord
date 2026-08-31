"use client";

import { getTauriSecureSecret, isTauriRuntime, setTauriSecureSecret } from "@/lib/tauri";

type StoredIdentity = { deviceId: string; privateKey: JsonWebKey; publicKey: JsonWebKey; publicKeyString: string };
type RecipientDevice = { deviceId: string; publicKey: string };
type Recipient = { id: string; e2eePublicKey?: string | null; e2eeDevices?: RecipientDevice[] };

const storageKey = (userId: string) => `typecord:e2ee:identity:${userId}`;
const secureStorageKey = (userId: string) => `e2ee-identity:${userId}`;
const encode = (value: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(value)));
const decode = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

async function generateIdentity(): Promise<StoredIdentity> {
  const pair = await crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]);
  const privateKey = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const publicKey = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { deviceId: crypto.randomUUID(), privateKey, publicKey, publicKeyString: JSON.stringify(publicKey) };
}

export async function ensureE2EEIdentity(userId: string) {
  const key = storageKey(userId);
  const stored = localStorage.getItem(key);
  const secureStored = isTauriRuntime()
    ? await getTauriSecureSecret(secureStorageKey(userId))
    : null;
  let parsedStored: Partial<StoredIdentity> | null = null;
  try {
    const candidate = secureStored ?? stored;
    if (candidate) parsedStored = JSON.parse(candidate) as Partial<StoredIdentity>;
  } catch {
    parsedStored = null;
  }
  const hasPrivateMaterial = Boolean(parsedStored?.privateKey && parsedStored?.publicKey && parsedStored?.publicKeyString);
  const identity: StoredIdentity = hasPrivateMaterial
    ? { ...(parsedStored as StoredIdentity), deviceId: parsedStored?.deviceId || crypto.randomUUID() }
    : await generateIdentity();
  if (isTauriRuntime()) {
    await setTauriSecureSecret(secureStorageKey(userId), JSON.stringify(identity));
    localStorage.setItem(key, JSON.stringify({
      deviceId: identity.deviceId,
      publicKey: identity.publicKey,
      publicKeyString: identity.publicKeyString,
    }));
  } else if (!stored || !parsedStored?.deviceId) {
    localStorage.setItem(key, JSON.stringify(identity));
  }
  const response = await fetch("/api/users/crypto", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: identity.deviceId, label: "Navegador", publicKey: identity.publicKeyString }) });
  if (!response.ok) throw new Error("Não foi possível registrar a chave do dispositivo.");
  return identity;
}

export async function encryptDirectMessage(text: string, recipients: Recipient[]) {
  const available = recipients.map((recipient) => {
    const devices = (recipient.e2eeDevices ?? [])
      .filter((device) => device.deviceId && device.publicKey)
      .map((device) => ({ deviceId: device.deviceId, publicKey: device.publicKey }));
    if (!devices.length && recipient.e2eePublicKey) {
      devices.push({ deviceId: "legacy", publicKey: recipient.e2eePublicKey });
    }
    return { ...recipient, devices: [...new Map(devices.map((device) => [device.deviceId, device])).values()] };
  });
  if (available.some((recipient) => recipient.devices.length === 0)) return null;
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const contentKey = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, contentKey, new TextEncoder().encode(text));
  const envelopes: Record<string, { keys: Record<string, string> }> = {};
  for (const recipient of available) {
    const keys: Record<string, string> = {};
    for (const device of recipient.devices) {
      const publicKey = await crypto.subtle.importKey("jwk", JSON.parse(device.publicKey), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
      keys[device.deviceId] = encode(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, rawKey));
    }
    envelopes[recipient.id] = { keys };
  }
  return JSON.stringify({ version: 2, algorithm: "AES-GCM+RSA-OAEP-256", iv: encode(iv), ciphertext: encode(ciphertext), envelopes });
}

export async function decryptDirectMessage(value: string, userId: string) {
  try {
    const stored = localStorage.getItem(storageKey(userId));
    const secureStored = isTauriRuntime()
      ? await getTauriSecureSecret(secureStorageKey(userId))
      : null;
    if (!secureStored && !stored) return null;
    const identity = JSON.parse(secureStored ?? stored!) as StoredIdentity;
    const payload = JSON.parse(value) as { version?: number; iv?: string; ciphertext?: string; envelopes?: Record<string, { key?: string; keys?: Record<string, string> }> };
    const envelope = payload.envelopes?.[userId];
    const deviceId = identity.deviceId || "legacy";
    const wrappedKey = payload.version === 1
      ? envelope?.key
      : envelope?.keys?.[deviceId];
    if (!wrappedKey || !payload.iv || !payload.ciphertext) return null;
    const privateKey = await crypto.subtle.importKey("jwk", identity.privateKey, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
    const rawKey = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, decode(wrappedKey));
    const contentKey = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(payload.iv) }, contentKey, decode(payload.ciphertext));
    return new TextDecoder().decode(plaintext);
  } catch { return null; }
}

export function isEncryptedMessage(value: string) {
  try { const parsed = JSON.parse(value); return (parsed?.version === 1 || parsed?.version === 2) && parsed?.algorithm === "AES-GCM+RSA-OAEP-256"; } catch { return false; }
}
