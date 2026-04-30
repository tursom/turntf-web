import {
  hashedPassword,
  type PasswordInput
} from "@tursom/turntf-web-sdk";
import { STORAGE_KEYS } from "./constants";

function getSessionStorage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

export function createRealtimePassword(plainPassword: string): PasswordInput {
  if (plainPassword.trim() === "") {
    throw new Error("password is required");
  }
  return hashedPassword(plainPassword);
}

export function storeRealtimePassword(password: PasswordInput): void {
  getSessionStorage()?.setItem(STORAGE_KEYS.RealtimePassword, password.encoded);
}

export function loadRealtimePassword(): PasswordInput | null {
  const encoded = getSessionStorage()?.getItem(STORAGE_KEYS.RealtimePassword) ?? "";
  if (encoded === "") {
    return null;
  }
  return hashedPassword(encoded);
}

export function hasRealtimePassword(): boolean {
  return loadRealtimePassword() != null;
}

export function clearRealtimePassword(): void {
  getSessionStorage()?.removeItem(STORAGE_KEYS.RealtimePassword);
}
