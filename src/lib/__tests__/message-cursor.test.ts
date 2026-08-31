import test from "node:test";
import assert from "node:assert/strict";
import { decodeMessageCursor, encodeMessageCursor } from "@/services/message-service";

test("cursor de mensagens é reversível e ordenável", () => {
  const source = { id: "message-2", createdAt: new Date("2026-08-29T12:00:00.000Z") };
  const cursor = encodeMessageCursor(source);
  assert.deepEqual(decodeMessageCursor(cursor), {
    id: source.id,
    createdAt: source.createdAt.toISOString(),
  });
});

test("cursor inválido não é aceito", () => {
  assert.equal(decodeMessageCursor("not-a-cursor"), null);
});
