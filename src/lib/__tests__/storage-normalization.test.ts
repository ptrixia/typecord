import test from "node:test";
import assert from "node:assert/strict";
import { isSafeStorageKey, normalizeStorageKey } from "@/lib/storage";

test("normaliza uma URL interna de arquivo para a chave original", () => {
  const key = "attachments/881145420397416510/2026/video.mp4";
  const url = `/api/files?key=${encodeURIComponent(key)}`;
  const nested = `/api/files?key=${encodeURIComponent(url)}`;
  const doubleNested = `/api/files?key=${encodeURIComponent(nested)}`;
  assert.equal(normalizeStorageKey(doubleNested), key);
  assert.equal(isSafeStorageKey(normalizeStorageKey(doubleNested)), true);
});

test("não permite traversal no storage", () => {
  assert.equal(isSafeStorageKey(normalizeStorageKey("/attachments/../secret.txt")), false);
});
