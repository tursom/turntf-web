import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { messageKey, messageKeyStr } from "./format";
import {
  clearRealtimePassword,
  createRealtimePassword,
  loadRealtimePassword,
  storeRealtimePassword
} from "./realtimeCredentials";

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe("realtime credentials", () => {
  const originalSessionStorage = globalThis.sessionStorage;

  beforeEach(() => {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: new MemoryStorage(),
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: originalSessionStorage,
    });
  });

  it("serializes and restores plaintext wire passwords without rehashing", () => {
    const password = createRealtimePassword("secret");

    storeRealtimePassword(password);
    const restored = loadRealtimePassword();

    expect(restored).not.toBeNull();
    expect(restored?.source).toBe("hashed");
    expect(password.encoded).toBe("secret");
    expect(restored?.encoded).toBe("secret");
  });

  it("rotates stored passwords and clears them on logout", () => {
    const original = createRealtimePassword("first-secret");
    const next = createRealtimePassword("next-secret");

    storeRealtimePassword(original);
    storeRealtimePassword(next);

    expect(loadRealtimePassword()?.encoded).toBe(next.encoded);

    clearRealtimePassword();
    expect(loadRealtimePassword()).toBeNull();
  });
});

describe("message keys", () => {
  it("produces stable keys for deduplication", () => {
    expect(messageKeyStr(4096, 7)).toBe("4096:7");
    expect(messageKey({ nodeId: "4096", seq: "7", recipient: { nodeId: "4096", userId: "1025" } })).toBe("4096:1025:7");
  });
});
