import { afterEach, describe, expect, it, vi } from "vitest";
import { getUser, listUsers } from "./users";
import { decodeText } from "@/utils/text";

const nodeId = "54062570162229324";
const userId = "9223372036854775807";
const rawUser = `{"node_id":${nodeId},"user_id":${userId},"origin_node_id":${userId},"username":"Test","login_name":"tester","role":"admin","system_reserved":false,"created_at":"created","updated_at":"updated","profile":{"contact":{"nodeId":${nodeId},"userId":${userId}},"enabled":true,"count":3}}`;

function mockResponse(body: string, status = 200) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(body, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("user list HTTP precision", () => {
  it.each([`[${rawUser}]`, `{"items":[${rawUser}]}`])(
    "uses exact list identifiers in the real SDK detail GET",
    async (body) => {
      const fetchMock = mockResponse(body);
      fetchMock.mockResolvedValueOnce(new Response(rawUser));
      const [listed] = await listUsers("test-token");
      const detail = await getUser("test-token", listed.nodeId, listed.userId);
      expect(String(fetchMock.mock.calls[1][0])).toContain(`/nodes/${nodeId}/users/${userId}`);
      expect(detail.nodeId).toBe(nodeId);
      expect(detail.userId).toBe(userId);
      expect(fetchMock.mock.calls[0][1]?.headers).toEqual({
        Authorization: "Bearer test-token",
        "Content-Type": "application/json",
      });
    }
  );

  it("preserves shared contact/display-name caller IDs, fields and nested profile references", async () => {
    mockResponse(`[${rawUser}]`);
    const [user] = await listUsers("test-token");
    expect(user).toMatchObject({
      nodeId, userId, originNodeId: userId, username: "Test", loginName: "tester",
      role: "admin", systemReserved: false, createdAt: "created", updatedAt: "updated",
    });
    expect(JSON.parse(decodeText(user.profileJson))).toEqual({
      contact: { nodeId, userId }, enabled: true, count: 3,
    });
  });

  it("retains string IDs, safe numeric IDs, profile_json and field defaults", async () => {
    mockResponse(`[{"node_id":"${nodeId}","user_id":"${userId}","role":"channel","system_reserved":true,"profile_json":{"name":"profile"}},{"node_id":1,"user_id":2}]`);
    const users = await listUsers("test-token");
    expect(users[0]).toMatchObject({ nodeId, userId, role: "channel", systemReserved: true });
    expect(decodeText(users[0].profileJson)).toBe('{"name":"profile"}');
    expect(users[1]).toEqual({
      nodeId: "1", userId: "2", username: "", loginName: "", role: "",
      systemReserved: false, createdAt: "", updatedAt: "", originNodeId: "",
      profileJson: new TextEncoder().encode("{}"),
    });
  });

  it.each(["[]", "{}", '{"items":null}', '{"items":[]}', "42", '"text"']) (
    "retains empty results for %s", async (body) => {
      mockResponse(body);
      await expect(listUsers("test-token")).resolves.toEqual([]);
    }
  );

  it.each(["null", '{"items":{}}', '{"items":"invalid"}', '{"items":false}']) (
    "does not accept invalid list structures: %s", async (body) => {
      mockResponse(body);
      await expect(listUsers("test-token")).rejects.toThrow();
    }
  );

  it("preserves HTTP error text before JSON parsing", async () => {
    mockResponse("permission denied", 403);
    await expect(listUsers("test-token")).rejects.toThrow("permission denied");
  });

  it("rejects malformed JSON", async () => {
    mockResponse("{broken");
    await expect(listUsers("test-token")).rejects.toThrow();
  });
});
