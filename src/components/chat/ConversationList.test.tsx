import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationList } from "./ConversationList";

const mocks = vi.hoisted(() => ({
  effects: [] as Array<() => unknown>,
  setState: vi.fn(),
  getUserMetadata: vi.fn(),
  listSubscriptions: vi.fn(),
  user: { nodeId: "1", userId: "2" },
}));

// Run the component's loading effect without a DOM; child components are not rendered.
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: (effect: () => unknown) => { mocks.effects.push(effect); },
  useState: (initial: unknown) => [initial, mocks.setState],
  useRef: (current: unknown) => ({ current }),
  useCallback: (callback: unknown) => callback,
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ token: "test-token", user: mocks.user }) }));
vi.mock("@/hooks/useChat", () => ({ useChat: () => ({ messages: [], connected: true }) }));
vi.mock("@/hooks/useUserDisplayName", () => ({ useUserDisplayName: () => ({ getUserDisplayName: vi.fn() }) }));
vi.mock("@/api/client", () => ({ getHTTPClient: () => ({ getUserMetadata: mocks.getUserMetadata }) }));
vi.mock("@/api/subscriptions", () => ({ listSubscriptions: mocks.listSubscriptions }));
vi.mock("./ContactPicker", () => ({ ContactPicker: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.effects.length = 0;
  mocks.listSubscriptions.mockResolvedValue([]);
});

async function loadMetadata(text: string) {
  mocks.getUserMetadata.mockResolvedValue({ value: new TextEncoder().encode(text) });
  ConversationList({ onSelect: vi.fn(), selectedTarget: null });
  for (const effect of mocks.effects) effect();
  await vi.waitFor(() => expect(mocks.setState).toHaveBeenCalledWith(false));
  expect(mocks.getUserMetadata).toHaveBeenCalledWith("test-token", mocks.user, "conversations");
}

describe("conversation metadata precision", () => {
  it("preserves numeric int64 references and deduplicates subscribed channels", async () => {
    const target = { nodeId: "54062570162229324", userId: "9223372036854775807" };
    mocks.listSubscriptions.mockResolvedValue([{ channel: target }]);
    await loadMetadata(`[{"target":{"nodeId":${target.nodeId},"userId":${target.userId}},"isChannel":true,"lastTime":"123","lastPreview":"hello"}]`);
    expect(mocks.setState).toHaveBeenCalledWith([
      { target, isChannel: true, lastTime: "123", lastPreview: "hello" },
    ]);
  });

  it("retains string references and ordinary fields", async () => {
    const saved = [{ target: { nodeId: "3", userId: "4" }, isChannel: false, lastPreview: "hello" }];
    await loadMetadata(JSON.stringify(saved));
    expect(mocks.setState).toHaveBeenCalledWith(saved);
  });

  it.each(["[]", "{}", '{"items":[]}', "null", "42", '"text"', "{broken"])(
    "retains empty fallback for non-list or invalid metadata: %s", async (text) => {
      await loadMetadata(text);
      expect(mocks.setState).toHaveBeenCalledWith([]);
    }
  );
});
