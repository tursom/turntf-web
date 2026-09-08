import type { AuthUser } from "@/types";
import { STORAGE_KEYS } from "./constants";

type AuthStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const SCHEMA = "2";

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 19 && /^[1-9]\d*$/.test(value)
    && BigInt(value) <= 9223372036854775807n;
}

function validUser(value: unknown): value is AuthUser {
  if (value == null || typeof value !== "object") return false;
  const user = value as Record<string, unknown>;
  return validId(user.nodeId) && validId(user.userId)
    && ["username", "loginName", "role"].every((key) => typeof user[key] === "string");
}

export function clearAuthSession(storage: AuthStorage = localStorage): void {
  storage.removeItem(STORAGE_KEYS.AuthSchema);
  storage.removeItem(STORAGE_KEYS.Token);
  storage.removeItem(STORAGE_KEYS.User);
}

export function readAuthSession(storage: AuthStorage = localStorage): { token: string; user: AuthUser } | null {
  try {
    const token = storage.getItem(STORAGE_KEYS.Token);
    // Old caches may contain already-rounded strings; parsing cannot repair them.
    if (storage.getItem(STORAGE_KEYS.AuthSchema) === SCHEMA && token) {
      const user: unknown = JSON.parse(storage.getItem(STORAGE_KEYS.User) ?? "null");
      if (validUser(user)) return { token, user };
    }
  } catch {
    // An incomplete or malformed cache must never hydrate an authenticated route.
  }
  clearAuthSession(storage);
  return null;
}

export function storeAuthSession(token: string, user: AuthUser, storage: AuthStorage = localStorage): void {
  if (!token || !validUser(user)) throw new Error("Invalid authentication session");
  storage.removeItem(STORAGE_KEYS.AuthSchema);
  storage.setItem(STORAGE_KEYS.Token, token);
  storage.setItem(STORAGE_KEYS.User, JSON.stringify(user));
  // Publish the schema only after both values have been written successfully.
  storage.setItem(STORAGE_KEYS.AuthSchema, SCHEMA);
}
