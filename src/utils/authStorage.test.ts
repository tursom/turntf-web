import { describe, expect, it } from "vitest";
import { clearAuthSession, readAuthSession, storeAuthSession } from "./authStorage";
import { STORAGE_KEYS } from "./constants";

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}
const user = { nodeId: "54062570162229324", userId: "1", username: "fixture", loginName: "fixture", role: "user" };

describe("versioned authentication cache", () => {
  it("invalidates a legacy cache whose ID was already rounded to a string", () => {
    const storage = memory();
    storage.setItem(STORAGE_KEYS.Token, "fixture-token");
    storage.setItem(STORAGE_KEYS.User, JSON.stringify({ ...user, nodeId: "54062570162229330" }));
    expect(readAuthSession(storage)).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.Token)).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.User)).toBeNull();
  });

  it.each(["54062570162229324", "9223372036854775807"])("restores exact string ID %s after a fresh login", (nodeId) => {
    const storage = memory();
    storeAuthSession("fixture-token", { ...user, nodeId }, storage);
    expect(readAuthSession(storage)).toEqual({ token: "fixture-token", user: { ...user, nodeId } });
  });

  it.each([54062570162229324, "9223372036854775808", "0", "", "-1"])("rejects malformed identity %s even in a versioned cache", (nodeId) => {
    const storage = memory();
    storeAuthSession("fixture-token", user, storage);
    storage.setItem(STORAGE_KEYS.User, JSON.stringify({ ...user, nodeId }));
    expect(readAuthSession(storage)).toBeNull();
  });

  it("does not trust a partially written new session", () => {
    const storage = memory();
    storeAuthSession("old-token", user, storage);
    const failing = { ...storage, setItem(key: string, value: string) {
      if (key === STORAGE_KEYS.User) throw new Error("quota");
      storage.setItem(key, value);
    } };
    expect(() => storeAuthSession("new-token", user, failing)).toThrow("quota");
    expect(readAuthSession(storage)).toBeNull();
  });

  it("clears authentication on logout without deleting unrelated preferences", () => {
    const storage = memory();
    storage.setItem("theme", "light");
    storeAuthSession("fixture-token", user, storage);
    clearAuthSession(storage);
    expect(readAuthSession(storage)).toBeNull();
    expect(storage.getItem("theme")).toBe("light");
  });
});
