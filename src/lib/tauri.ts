"use client";

import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type TauriAppInfo = {
  name: string;
  version: string;
  platform: string;
  debug: boolean;
};

export type TauriOpenApplication = { name: string; pid: string };

export function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function getTauriAppInfo() {
  if (!isTauriRuntime()) return null;
  return invoke<TauriAppInfo>("get_app_info");
}

export async function getTauriOpenApplications() {
  if (!isTauriRuntime()) return [];
  return invoke<TauriOpenApplication[]>("get_open_applications");
}

export async function getTauriSecureSecret(account: string) {
  if (!isTauriRuntime()) return null;
  return invoke<string | null>("get_secure_secret", { account });
}

export async function setTauriSecureSecret(account: string, value: string) {
  if (!isTauriRuntime()) return;
  await invoke("set_secure_secret", { account, value });
}

export async function deleteTauriSecureSecret(account: string) {
  if (!isTauriRuntime()) return;
  await invoke("delete_secure_secret", { account });
}

export async function hasTauriAppPin() {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>("has_app_pin");
}

export async function setTauriAppPin(pin: string) {
  if (!isTauriRuntime()) return;
  await invoke("set_app_pin", { pin });
}

export async function verifyTauriAppPin(pin: string) {
  if (!isTauriRuntime()) return true;
  return invoke<boolean>("verify_app_pin", { pin });
}

export async function verifyTauriAppBiometric() {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>("verify_app_biometric");
}

export async function clearTauriAppPin() {
  if (!isTauriRuntime()) return;
  await invoke("clear_app_pin");
}

export async function setTauriWindowMode(mode: "minimize" | "maximize" | "unmaximize" | "toggle-maximize" | "close") {
  if (!isTauriRuntime()) return;
  await invoke("set_window_mode", { mode });
}

export async function startTauriWindowDrag() {
  if (!isTauriRuntime()) return;
  await getCurrentWindow().startDragging();
}
