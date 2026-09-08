import { afterEach, describe, expect, it, vi } from "vitest";
import { login, loginByLoginName } from "./auth";

const nodeId = "54062570162229324";
const userId = "9223372036854775807";
const rawUser = `{"node_id":${nodeId},"user_id":${userId},"username":"Test","login_name":"tester","role":"user"}`;

function mockLogin(user = rawUser) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(`{"token":"test-token","user":${user}}`, { status: 200 })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("login compatibility", () => {
  it.each([rawUser, `{"node_id":"${nodeId}","user_id":"${userId}"}`])(
    "preserves numeric and string int64 login identifiers",
    async (user) => {
      mockLogin(user);
      const result = await loginByLoginName("tester", "test-password");
      expect(result.user.nodeId).toBe(nodeId);
      expect(result.user.userId).toBe(userId);
    }
  );

  it("sends the original password and trims only the login name", async () => {
    const fetchMock = mockLogin();
    const result = await loginByLoginName("  tester  ", " test-password ");
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toEqual({ login_name: "tester", password: " test-password " });
    expect(result.wirePasswordEncoded).toBe(" test-password ");
  });

  it("preserves int64 IDs and the original password in SDK ID login", async () => {
    const fetchMock = mockLogin();
    fetchMock.mockResolvedValueOnce(new Response('{"token":"test-token"}'));
    fetchMock.mockResolvedValueOnce(new Response(rawUser));
    const result = await login(nodeId, userId, " test-password ");
    const body = String(fetchMock.mock.calls[0][1]?.body);
    expect(body).toContain(`"node_id":${nodeId}`);
    expect(body).toContain(`"user_id":${userId}`);
    expect(JSON.parse(body).password).toBe(" test-password ");
    expect(String(fetchMock.mock.calls[1][0])).toContain(`/nodes/${nodeId}/users/${userId}`);
    expect(result.user.nodeId).toBe(nodeId);
    expect(result.user.userId).toBe(userId);
  });

  it("rejects a blank login name before making a request", async () => {
    const fetchMock = mockLogin();
    await expect(loginByLoginName("  ", "test-password")).rejects.toThrow("登录名不能为空");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['{"user":{}}', "登录响应中缺少 token"],
    ['{"token":"test-token"}', "登录响应中缺少用户信息"],
  ])("rejects incomplete login responses", async (body, error) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
    await expect(loginByLoginName("tester", "test-password")).rejects.toThrow(error);
  });

  it("preserves HTTP authentication errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("invalid credentials", { status: 401 })));
    await expect(loginByLoginName("tester", "test-password")).rejects.toThrow("invalid credentials");
  });
});
