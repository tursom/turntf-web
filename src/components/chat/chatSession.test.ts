import { describe, expect, it } from "vitest";
import type { Message } from "@/types";
import { emptySession, mergeMessages, sessionsReducer, type ChatSession, type SessionAction } from "./chatSession";

function message(seq: string, recipient = "10"): Message {
  return { nodeId: "1", seq, sender: { nodeId: "1", userId: "20" }, recipient: { nodeId: "1", userId: recipient }, body: new Uint8Array(), createdAtHlc: "1000-0" };
}

function sessions() {
  let state: Record<string, ChatSession> = {};
  return {
    dispatch(action: SessionAction) { state = sessionsReducer(state, action); },
    get(key: string) { return state[key] ?? emptySession; },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("会话异步状态", () => {
  it("A 的历史晚于 B 返回时只更新 A", async () => {
    const store = sessions();
    const a = deferred<Message[]>();
    const b = deferred<Message[]>();
    store.dispatch({ key: "A", type: "historyStart", request: 1 });
    const first = a.promise.then((messages) => store.dispatch({ key: "A", type: "historySuccess", request: 1, messages }));
    store.dispatch({ key: "B", type: "historyStart", request: 2 });
    const second = b.promise.then((messages) => store.dispatch({ key: "B", type: "historySuccess", request: 2, messages }));
    b.resolve([message("2")]);
    await second;
    const before = store.get("B");
    a.resolve([message("1")]);
    await first;
    expect(store.get("B")).toBe(before);
    expect(store.get("A").history).toEqual([message("1")]);
  });

  it("重试后忽略旧请求的成功和失败结果", () => {
    const store = sessions();
    store.dispatch({ key: "A", type: "historyStart", request: 1 });
    expect(store.get("A").historyStatus).toBe("loading");
    store.dispatch({ key: "A", type: "historyError", request: 1 });
    expect(store.get("A").historyStatus).toBe("error");
    store.dispatch({ key: "A", type: "historyStart", request: 2 });
    const pending = store.get("A");
    store.dispatch({ key: "A", type: "historySuccess", request: 1, messages: [message("old")] });
    store.dispatch({ key: "A", type: "historyError", request: 1 });
    expect(store.get("A")).toBe(pending);
    store.dispatch({ key: "A", type: "historySuccess", request: 2, messages: [] });
    expect(store.get("A").historyStatus).toBe("success");
  });

  it("切换至 B 后 A 的发送回执不改变 B 的草稿、消息或发送状态", async () => {
    const store = sessions();
    const receipt = deferred<Message>();
    store.dispatch({ key: "A", type: "draft", text: "草稿 A" });
    store.dispatch({ key: "A", type: "sendStart" });
    const task = receipt.promise.then((message) => store.dispatch({ key: "A", type: "sendSuccess", message, draft: "草稿 A" }));
    store.dispatch({ key: "B", type: "draft", text: "草稿 B" });
    store.dispatch({ key: "B", type: "sendStart" });
    const before = store.get("B");
    receipt.resolve(message("1"));
    await task;
    expect(store.get("B")).toBe(before);
    expect(store.get("A").draft).toBe("");
    expect(store.get("A").sent).toEqual([message("1")]);
    expect(store.get("A").sending).toBe(false);
  });

  it("失败只留在原会话并保留草稿，重试清理错误", () => {
    const store = sessions();
    store.dispatch({ key: "A", type: "draft", text: "保留" });
    store.dispatch({ key: "A", type: "sendStart" });
    store.dispatch({ key: "B", type: "draft", text: "另一会话" });
    store.dispatch({ key: "A", type: "sendError", error: "网络断开" });
    expect(store.get("A")).toMatchObject({ draft: "保留", sending: false, sendError: "网络断开" });
    expect(store.get("B")).toMatchObject({ draft: "另一会话", sendError: null });
    store.dispatch({ key: "A", type: "sendStart" });
    expect(store.get("A").sendError).toBeNull();
  });

  it("发送期间编辑的新草稿不会被成功回执清空", () => {
    const store = sessions();
    store.dispatch({ key: "A", type: "draft", text: "旧草稿" });
    store.dispatch({ key: "A", type: "sendStart" });
    store.dispatch({ key: "A", type: "draft", text: "新草稿" });
    store.dispatch({ key: "A", type: "sendSuccess", message: message("1"), draft: "旧草稿" });
    expect(store.get("A").draft).toBe("新草稿");
    expect(store.get("A").sendVersion).toBe(2);
  });

  it("历史、实时推送、发送回执使用包含收件人的同一 key 去重", () => {
    const first = message("1");
    const other = message("1", "30");
    expect(mergeMessages([first], [{ ...first }, other], [first, other])).toEqual([first, other]);
  });
});
