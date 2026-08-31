import test from "node:test";
import assert from "node:assert/strict";
import { hasPermission, Permissions, addPermission, removePermission } from "@/lib/permissions";

test("administrador possui qualquer permissão", () => {
  assert.equal(hasPermission(Permissions.ADMINISTRATOR, Permissions.MANAGE_CHANNELS), true);
});

test("permissões são manipuladas sem perder bits altos", () => {
  const value = addPermission(Permissions.VIEW_CHANNEL, Permissions.SEND_POLLS);
  assert.equal(hasPermission(value, Permissions.VIEW_CHANNEL), true);
  assert.equal(hasPermission(value, Permissions.SEND_POLLS), true);
  assert.equal(hasPermission(removePermission(value, Permissions.VIEW_CHANNEL), Permissions.VIEW_CHANNEL), false);
});
