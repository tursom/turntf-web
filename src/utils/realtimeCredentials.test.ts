import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { passwordWireValue, plainPasswordSync, proto } from "@tursom/turntf-web-sdk";
import { STORAGE_KEYS } from "./constants";
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
    clearRealtimePassword();
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: originalSessionStorage,
    });
  });

  it("retains plaintext wire passwords in memory without rehashing", () => {
    const password = createRealtimePassword("secret");

    storeRealtimePassword(password);
    const restored = loadRealtimePassword();

    expect(restored).not.toBeNull();
    expect(restored?.source).toBe("hashed");
    expect(password.encoded).toBe("secret");
    expect(restored?.encoded).toBe("secret");
  });

  it("keeps raw passwords only in memory and removes legacy session credentials", () => {
    sessionStorage.setItem(STORAGE_KEYS.RealtimePassword, "legacy-password");
    expect(loadRealtimePassword()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEYS.RealtimePassword)).toBeNull();
    storeRealtimePassword(createRealtimePassword("test-password"));
    expect(sessionStorage.length).toBe(0);
    expect(loadRealtimePassword()?.encoded).toBe("test-password");
  });

  it("does not restore a credential after the page module is reloaded", async () => {
    storeRealtimePassword(createRealtimePassword("test-password"));
    vi.resetModules();
    const reloaded = await import("./realtimeCredentials");
    expect(reloaded.loadRealtimePassword()).toBeNull();
  });

  it("passes raw passwords unchanged to the SDK WebSocket login serializer", () => {
    const password = createRealtimePassword(" test-password ");
    const request = proto.LoginRequest.create({
      user: { nodeId: "54062570162229324", userId: "9223372036854775807" },
      password: passwordWireValue(password),
    });
    const decoded = proto.LoginRequest.fromBinary(proto.LoginRequest.toBinary(request));
    expect(decoded.password).toBe(" test-password ");
    expect(decoded.user).toEqual(request.user);
    expect(plainPasswordSync(" test-password ").encoded).not.toBe(decoded.password);
  });

  it("supports the protocol version required by the deployed service", () => {
    const request = proto.LoginRequest.fromJson({ protocolVersion: "client-v1alpha5" });
    expect(proto.LoginRequest.fromBinary(proto.LoginRequest.toBinary(request))).toMatchObject({
      protocolVersion: "client-v1alpha5",
    });
  });

  it("rejects blank passwords without trimming nonblank passwords", () => {
    expect(() => createRealtimePassword("  ")).toThrow("password is required");
    expect(createRealtimePassword(" secret ").encoded).toBe(" secret ");
  });

  it("works when browser storage access is blocked", () => {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      get() { throw new Error("storage blocked"); },
    });
    storeRealtimePassword(createRealtimePassword("test-password"));
    expect(loadRealtimePassword()?.encoded).toBe("test-password");
    clearRealtimePassword();
    expect(loadRealtimePassword()).toBeNull();
  });

  it("does not expose the retained credential to mutation", () => {
    const password = createRealtimePassword("test-password");
    storeRealtimePassword(password);
    Object.assign(password, { encoded: "changed" });
    Object.assign(loadRealtimePassword()!, { encoded: "also-changed" });
    expect(loadRealtimePassword()?.encoded).toBe("test-password");
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
