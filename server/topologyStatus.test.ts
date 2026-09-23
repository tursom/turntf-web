import http, { type Server } from "node:http";
import { type AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTopologyStatusHandler, parseTopologyTargets } from "./topologyStatus";

const nodeId = "54062570162229324";
const origin = "https://node.example.com";
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function serve(fetchStatus: typeof fetch) {
  const handler = createTopologyStatusHandler(JSON.stringify({ [nodeId]: origin }), fetchStatus);
  const server = http.createServer((req, res) => {
    void handler(req, res, (req.url ?? "").slice(1).split("?", 1)[0]);
  });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

describe("topology status proxy", () => {
  it("accepts only explicit HTTPS targets and development loopback", () => {
    expect(parseTopologyTargets(JSON.stringify({ [nodeId]: origin })).get(nodeId)).toBe(origin);
    expect(parseTopologyTargets('{"1":"http://127.0.0.1:8080"}').get("1")).toBe("http://127.0.0.1:8080");
    for (const target of ["http://node.example.com", "https://node.example.com/path", "https://user@node.example.com", "https://node.example.com?x=1"]) {
      expect(() => parseTopologyTargets(JSON.stringify({ [nodeId]: target }))).toThrow();
    }
    expect(() => parseTopologyTargets('{"0":"https://node.example.com"}')).toThrow();
  });

  it("forwards only bearer credentials to the configured origin and preserves int64 IDs", async () => {
    const body = `{"node_id":${nodeId},"mesh":{"enabled":true,"routes":[]}}`;
    const outgoing = vi.fn<typeof fetch>().mockResolvedValue(new Response(body));
    const url = await serve(outgoing);
    const response = await fetch(`${url}/${nodeId}`, { headers: { Authorization: "Bearer fixture" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe(body);
    expect(outgoing).toHaveBeenCalledWith(`${origin}/ops/status`, expect.objectContaining({
      headers: { Authorization: "Bearer fixture" }, redirect: "manual",
    }));
    expect((await fetch(`${url}/2`, { headers: { Authorization: "Bearer fixture" } })).status).toBe(404);
    expect((await fetch(`${url}/${nodeId}`)).status).toBe(401);
    expect(outgoing).toHaveBeenCalledTimes(1);
  });

  it("does not follow redirects or accept a different node identity", async () => {
    const outgoing = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: "https://evil.example.com/" } }))
      .mockResolvedValueOnce(new Response('{"node_id":2,"mesh":{}}'))
      .mockResolvedValueOnce(new Response("denied", { status: 401 }));
    const url = await serve(outgoing);
    for (const expected of [502, 502, 403]) {
      const response = await fetch(`${url}/${nodeId}`, { headers: { Authorization: "Bearer fixture" } });
      expect(response.status).toBe(expected);
    }
    expect(outgoing).toHaveBeenCalledTimes(3);
  });
});
