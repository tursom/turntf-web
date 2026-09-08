import { describe, expect, it } from "vitest";
import { addedMessageKeys, isNearBottom, shouldFollowMessages } from "./chatScroll";

describe("聊天滚动策略", () => {
  it("仅首次、主动发送或接近底部时有新消息才自动跟随", () => {
    expect(shouldFollowMessages(true, false, false, 0)).toBe(true);
    expect(shouldFollowMessages(false, true, false, 0)).toBe(true);
    expect(shouldFollowMessages(false, false, true, 1)).toBe(true);
    expect(shouldFollowMessages(false, false, false, 1)).toBe(false);
    expect(shouldFollowMessages(false, false, true, 0)).toBe(false);
  });

  it("距底部 80px 以内自动跟随，超过阈值保留阅读位置", () => {
    expect(isNearBottom(1000, 520, 400)).toBe(true);
    expect(isNearBottom(1000, 519, 400)).toBe(false);
    expect(isNearBottom(200, 0, 400)).toBe(true);
  });

  it("草稿重渲染、去重或排序变化不算新消息", () => {
    const previous = new Set(["1:10:1", "1:10:2"]);
    expect(addedMessageKeys(previous, ["1:10:2", "1:10:1"])).toEqual([]);
    expect(addedMessageKeys(previous, ["1:10:1", "1:10:2", "1:10:3"])).toEqual(["1:10:3"]);
  });
});
