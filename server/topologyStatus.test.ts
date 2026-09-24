import http, { type Server } from "node:http";
import { type AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMessageProbeHandler, createMessageTraceHandler, createTopologyStatusHandler, parseTopologyTargets } from "./topologyStatus";

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

async function serveTrace(fetchTrace: typeof fetch, targets: Record<string, string> = { [nodeId]: origin }) {
  const handler = createMessageTraceHandler(JSON.stringify(targets), fetchTrace);
  const server = http.createServer((req, res) => { void handler(req, res, (req.url ?? "").slice(1)); });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function serveProbe(fetchProbe: typeof fetch, targets: Record<string, string> = { [nodeId]: origin }) {
  const handler = createMessageProbeHandler(JSON.stringify(targets), fetchProbe);
  const server = http.createServer((req, res) => { void handler(req, res, (req.url ?? "").slice(1)); });
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

describe("message probe proxy", () => {
  const other = "54062570162229330";
  const id = "a".repeat(32);
  const headers = { Authorization: "Bearer fixture", "Content-Type": "application/json" };
  const body = JSON.stringify({ target_node_id: other });
  const send = (url: string, payload = body) => fetch(`${url}/${nodeId}`, { method: "POST", headers, body: payload });

  it("checks source identity before forwarding one bounded request and preserves int64 IDs", async () => {
    const outgoing = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(`{"node_id":${nodeId},"mesh":{}}`))
      .mockResolvedValueOnce(new Response(`{"source_node_id":${nodeId},"target_node_id":${other},"trace_id":"${id}","status":"dispatched"}`, { status: 202 }));
    const url = await serveProbe(outgoing, { [nodeId]: origin, [other]: "https://other.example.com" });
    const response = await send(url);
    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toContain(other);
    expect(outgoing).toHaveBeenNthCalledWith(1, `${origin}/ops/status`, expect.objectContaining({ redirect: "manual" }));
    expect(outgoing).toHaveBeenNthCalledWith(2, `${origin}/ops/probes`, expect.objectContaining({
      method: "POST", headers, redirect: "manual", body: `{"target_node_id":${other}}`,
    }));
  });

  it("never POSTs when source identity, authorization or target validation fails", async () => {
    const outgoing = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(`{"node_id":${other},"mesh":{}}`))
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: "https://evil.example.com" } }));
    const url = await serveProbe(outgoing, { [nodeId]: origin, [other]: "https://other.example.com" });
    expect((await send(url)).status).toBe(502);
    expect((await send(url)).status).toBe(502);
    expect((await fetch(`${url}/${nodeId}`, { method: "POST", body })).status).toBe(401);
    expect((await send(url, '{"target_node_id":"999"}')).status).toBe(400);
    expect((await send(url, '{bad json')).status).toBe(400);
    expect((await send(url, "a".repeat(300))).status).toBe(413);
    expect(outgoing).toHaveBeenCalledTimes(2);
  });

  it("rejects mismatched responses and propagates probe rate limiting", async () => {
    const outgoing = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(`{"node_id":${nodeId},"mesh":{}}`))
      .mockResolvedValueOnce(new Response(`{"source_node_id":${other},"target_node_id":${other},"trace_id":"${id}","status":"dispatched"}`, { status: 202 }))
      .mockResolvedValueOnce(new Response(`{"node_id":${nodeId},"mesh":{}}`))
      .mockResolvedValueOnce(new Response(null, { status: 429 }));
    const url = await serveProbe(outgoing, { [nodeId]: origin, [other]: "https://other.example.com" });
    expect((await send(url)).status).toBe(502);
    expect((await send(url)).status).toBe(429);
  });
});

describe("message trace proxy", () => {
  const traceId = "a".repeat(32);
  it("verifies node identity, preserves int64 IDs and forwards only to trusted origins", async () => {
    const outgoing = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      const path = String(url);
      if (path.endsWith("/ops/status")) return new Response(`{"node_id":${nodeId},"mesh":{}}`);
      return new Response(`{"trace_id":"${traceId}","events":[{"trace_id":"${traceId}","node_id":${nodeId},"packet_id":18446744073709551615,"stage":"received"}]}`);
    });
    const url = await serveTrace(outgoing);
    const response = await fetch(`${url}/${traceId}`, { headers: { Authorization: "Bearer fixture" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toContain("18446744073709551615");
    expect(outgoing).toHaveBeenNthCalledWith(2, `${origin}/ops/traces/${traceId}`, expect.objectContaining({
      headers: { Authorization: "Bearer fixture" }, redirect: "manual",
    }));
    expect((await fetch(`${url}/not-a-trace`, { headers: { Authorization: "Bearer fixture" } })).status).toBe(400);
    expect((await fetch(`${url}/${traceId}`)).status).toBe(401);
    expect(outgoing).toHaveBeenCalledTimes(2);
  });

  it("isolates unavailable nodes and rejects mismatched identity and authorization", async () => {
    const other = "54062570162229330";
    const outgoing = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      if (String(url).startsWith(origin)) return new Response(`{"node_id":${nodeId},"mesh":{}}`);
      return new Response(null, { status: 302, headers: { Location: "https://evil.example.com" } });
    });
    const url = await serveTrace(outgoing, { [nodeId]: origin, [other]: "https://other.example.com" });
    const response = await fetch(`${url}/${traceId}`, { headers: { Authorization: "Bearer fixture" } });
    const body = await response.json() as { nodes: { node_id: string; error?: string }[] };
    expect(response.status).toBe(200);
    expect(body.nodes.find((node) => node.node_id === other)?.error).toBeTruthy();
    expect(outgoing).not.toHaveBeenCalledWith(expect.stringContaining("evil.example.com"), expect.anything());
    const denied = await serveTrace(vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 403 })));
    expect((await fetch(`${denied}/${traceId}`, { headers: { Authorization: "Bearer fixture" } })).status).toBe(403);
  });
});
