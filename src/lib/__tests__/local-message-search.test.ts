import test from "node:test";
import assert from "node:assert/strict";
import { clearLocalMessageIndex, indexLocalMessages, searchLocalMessages } from "@/lib/local-message-search";

test("busca local exige todos os termos e ordena por recência", () => {
  clearLocalMessageIndex();
  indexLocalMessages([
    { id: "old", content: "Projeto Typecord pronto", author: "Ana", scopeId: "a", scopeLabel: "Geral", href: "/a", createdAt: 10 },
    { id: "new", content: "Typecord projeto atualizado", author: "Bia", scopeId: "a", scopeLabel: "Geral", href: "/a", createdAt: 20 },
    { id: "other", content: "Somente Typecord", author: "Caio", scopeId: "a", scopeLabel: "Geral", href: "/a", createdAt: 30 },
  ]);

  assert.deepEqual(searchLocalMessages("PROJETO typecord").map((item) => item.id), ["new", "old"]);
  assert.deepEqual(searchLocalMessages("inexistente"), []);
  clearLocalMessageIndex();
});

test("índice local substitui mensagens atualizadas pelo mesmo id", () => {
  clearLocalMessageIndex();
  indexLocalMessages([{ id: "same", content: "versão antiga", author: "Ana", scopeId: "a", scopeLabel: "Geral", href: "/a", createdAt: 1 }]);
  indexLocalMessages([{ id: "same", content: "versão nova", author: "Ana", scopeId: "a", scopeLabel: "Geral", href: "/a", createdAt: 2 }]);
  assert.equal(searchLocalMessages("versão nova")[0]?.id, "same");
  assert.equal(searchLocalMessages("versão antiga").length, 0);
  clearLocalMessageIndex();
});
