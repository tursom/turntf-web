import {
  hashedPassword,
  type PasswordInput
} from "@tursom/turntf-web-sdk";
import { STORAGE_KEYS } from "./constants";

// 原密码仅属于当前页面会话；刷新后沿用现有的重新认证流程。
let realtimePassword: PasswordInput | null = null;

function removeLegacyStoredPassword(): void {
  try {
    globalThis.sessionStorage?.removeItem(STORAGE_KEYS.RealtimePassword);
  } catch {
    // 浏览器禁止访问存储时，内存凭据仍可正常使用。
  }
}

export function createRealtimePassword(plainPassword: string): PasswordInput {
  if (plainPassword.trim() === "") {
    throw new Error("password is required");
  }
  // 185fd70 校验 bcrypt(原密码)。SDK hashedPassword 是透传入口，
  // plainPassword* 则会随机预哈希，不能用于这里。HTTP/WS 必须由 TLS 保护。
  return hashedPassword(plainPassword);
}

export function storeRealtimePassword(password: PasswordInput): void {
  removeLegacyStoredPassword();
  realtimePassword = hashedPassword(password.encoded);
}

export function loadRealtimePassword(): PasswordInput | null {
  removeLegacyStoredPassword();
  return realtimePassword == null ? null : hashedPassword(realtimePassword.encoded);
}

export function hasRealtimePassword(): boolean {
  return loadRealtimePassword() != null;
}

export function clearRealtimePassword(): void {
  realtimePassword = null;
  removeLegacyStoredPassword();
}
