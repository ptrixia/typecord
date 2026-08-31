import test from "node:test";
import assert from "node:assert/strict";
import { decryptBackup, encryptBackup } from "@/lib/secure-backup";

test("backup criptografado restaura o payload com a senha correta", async () => {
  const original = { preferences: { theme: "dark" }, templates: ["/help"] };
  const backup = await encryptBackup(original, "uma-senha-de-teste-com-mais-de-12");
  assert.deepEqual(await decryptBackup(backup, "uma-senha-de-teste-com-mais-de-12"), original);
  await assert.rejects(() => decryptBackup(backup, "senha-incorreta"));
});

test("backup rejeita payload adulterado ou formato desconhecido", async () => {
  await assert.rejects(() => decryptBackup(JSON.stringify({ version: 99 }), "qualquer-senha"), /Formato de backup inválido/);
  const backup = await encryptBackup({ value: true }, "uma-senha-de-teste-com-mais-de-12");
  const parsed = JSON.parse(backup) as { ciphertext: string };
  parsed.ciphertext = `${parsed.ciphertext.slice(0, -2)}aa`;
  await assert.rejects(() => decryptBackup(JSON.stringify(parsed), "uma-senha-de-teste-com-mais-de-12"));
});
