import { afterEach, describe, expect, it, vi } from "vitest";
import { KVConflictError, listKVDatabases, listKVEntries, normalizeKVPrincipal, saveKVEntry } from "./kv";
import { decodeKVValue, encodeKVValue, initialKVValue, isKVValueDirty, kvJSON } from "@/utils/kvValue";

afterEach(() => vi.unstubAllGlobals());
function response(text: string, status = 200) {
  const mock = vi.fn<typeof fetch>().mockResolvedValue(new Response(text, { status }));
  vi.stubGlobal("fetch", mock); return mock;
}

describe("Raft 数据库 HTTP", () => {
  it("按精确 owner 查询，并编码 URL 参数", async () => {
    const fetch = response('{"items":[{"name":"a","owner":"9007199254740993:42"}],"revision":1}');
    expect(await listKVDatabases("token", "9007199254740993:42")).toEqual([{ name: "a", owner: "9007199254740993:42" }]);
    expect(String(fetch.mock.calls[0][0])).toContain("owner=9007199254740993%3A42");
    expect(fetch.mock.calls[0][1]?.headers).toMatchObject({ Authorization: "Bearer token" });
  });
  it("保留 uint64 版本、空值以及特殊键名", async () => {
    response('{"revision":18446744073709551615,"items":{"__proto__":{"value":null,"create_revision":1,"mod_revision":9007199254740993},"constructor":{"value":"AA==","create_revision":2,"mod_revision":3}}}');
    const result = await listKVEntries("token", "a");
    expect(result.revision).toBe("18446744073709551615");
    expect(Object.keys(result.items)).toEqual(["__proto__", "constructor"]);
    expect(result.items["__proto__"]).toEqual({ value: "", createRevision: "1", modRevision: "9007199254740993" });
  });
  it("通过事务原样发送精确版本与含特殊字符的键，并读取提交版本", async () => {
    const fetch = response('{"Succeeded":true,"Revision":9007199254740994}');
    await expect(saveKVEntry("token", "a/b", "config/a?b#c", "AA==", "9007199254740993")).resolves.toBe("9007199254740994");
    expect(String(fetch.mock.calls[0][0])).toContain("/a%2Fb/txn");
    const body = String(fetch.mock.calls[0][1]?.body);
    expect(body).toContain('"revision":9007199254740993');
    expect(kvJSON.parse(body).compare[0]).toMatchObject({ key: "config/a?b#c", exists: true });
  });
  it("新增键使用不存在条件；HTTP 200 Succeeded=false 必须报冲突", async () => {
    const fetch = response('{"Succeeded":false,"Revision":42}');
    await expect(saveKVEntry("token", "a", "new", "", null)).rejects.toBeInstanceOf(KVConflictError);
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body)).compare).toEqual([{ key: "new", exists: false }]);
  });
  it("权限拒绝不能被当作空列表", async () => {
    response('{"error":"kv: permission denied"}', 403);
    await expect(listKVDatabases("token", "1:2")).rejects.toMatchObject({ status: 403 });
  });
});

describe("Raft 值编辑", () => {
  it("不同格式显示文本相同也必须按实际字节判断修改", () => {
    const original = encodeKVValue("YQ==", "text");
    expect(isKVValueDirty("a", "text", original)).toBe(true);
    expect(isKVValueDirty("YQ==", "base64", original)).toBe(true);
    expect(isKVValueDirty(original, "base64", original)).toBe(false);
    expect(isKVValueDirty("{invalid", "json", original)).toBe(true);
  });
  it("校验并规范化授权用户 ID，不丢失 int64 精度", () => {
    expect(normalizeKVPrincipal("01:002")).toBe("1:2");
    expect(normalizeKVPrincipal("1:9223372036854775807")).toBe("1:9223372036854775807");
    expect(normalizeKVPrincipal("*")).toBe("*");
    for (const input of ["0:2", "1:0", "1:9223372036854775808", "reader", "1:2.5"]) expect(() => normalizeKVPrincipal(input)).toThrow();
  });
  it("任意二进制值回退到 Base64，编辑格式切换不损坏字节", () => {
    expect(initialKVValue("/wAB")).toEqual({ text: "/wAB", format: "base64" });
    expect(encodeKVValue("/wAB", "base64")).toBe("/wAB");
    expect(() => decodeKVValue("/wAB", "text")).toThrow();
    expect(encodeKVValue("你好", "text")).toBe("5L2g5aW9");
    expect(decodeKVValue("5L2g5aW9", "text")).toBe("你好");
    expect(encodeKVValue("", "base64")).toBe("");
    const bom = "77u/YQ==";
    expect(encodeKVValue(decodeKVValue(bom, "text"), "text")).toBe(bom);
  });
  it("拒绝无效 JSON 和 Base64", () => {
    expect(() => encodeKVValue("{broken", "json")).toThrow();
    expect(() => encodeKVValue("%%%", "base64")).toThrow();
  });
  it("格式化 JSON 不把大整数变成字符串或丢失特殊字段", () => {
    const input = '{"n":18446744073709551615,"__proto__":{"x":1},"constructor":"ok"}';
    const formatted = kvJSON.stringify(kvJSON.parse(input), null, 2);
    expect(formatted).toContain('"n": 18446744073709551615');
    expect(formatted).toContain('"__proto__"');
    expect(formatted).toContain('"constructor": "ok"');
    expect(decodeKVValue(encodeKVValue(input, "json"), "json")).toBe(input);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
});
