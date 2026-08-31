type EnvelopeCandidate = {
  version?: unknown;
  algorithm?: unknown;
  iv?: unknown;
  ciphertext?: unknown;
  envelopes?: unknown;
};

/** Server-side shape validation only. It never decrypts or inspects message text. */
export function isE2EEEnvelope(value: string) {
  try {
    const parsed = JSON.parse(value) as EnvelopeCandidate;
    return (
      (parsed.version === 1 || parsed.version === 2) &&
      parsed.algorithm === "AES-GCM+RSA-OAEP-256" &&
      typeof parsed.iv === "string" &&
      parsed.iv.length > 0 &&
      typeof parsed.ciphertext === "string" &&
      parsed.ciphertext.length > 0 &&
      Boolean(parsed.envelopes && typeof parsed.envelopes === "object")
    );
  } catch {
    return false;
  }
}
