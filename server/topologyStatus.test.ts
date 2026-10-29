import http, { type Server } from "node:http";
import { type AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMessageProbeHandler, createMessageTraceHandler, createTopologyStatusHandler } from "./topologyStatus";

const source = "54064871525449607";
const joined = "67853043149576892";
const backend = "http://turntf:8080";
const trace = "a".repeat(32);
const headers = { Authorization: "Bearer fixture", "Content-Type": "application/json" };
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
});
async function serve(kind: "status" | "probe" | "trace", fetchCore: typeof fetch) {
  const create = kind === "status" ? createTopologyStatusHandler : kind === "probe" ? createMessageProbeHandler : createMessageTraceHandler;
  const handler = create(backend, fetchCore);
  const server = http.createServer((req, res) => { void handler(req, res, (req.url ?? "").slice(1).split("?", 1)[0]); });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
const status = (node: string) => `{"node_id":${node},"mesh":{"enabled":true,"routes":[]}}`;
const probe = (from = source, target = joined, state = "dispatched") =>
  `{"source_node_id":${from},"target_node_id":${target},"trace_id":"${trace}","status":"${state}"}`;

describe("dynamic topology through the connected core", () => {
  it("handles a later joining node without any node mapping and preserves its int64 identity", async () => {
    const members = new Set([source]);
    const outgoing = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      const id = String(url).split("/").at(-2)!;
      return members.has(id) ? new Response(status(id)) : new Response('{"error":"node unreachable"}', { status: 503 });
    });
    const url = await serve("status", outgoing);
    expect((await fetch(`${url}/${source}`, { headers })).status).toBe(200);
    members.add(joined); // Web handler remains running; only the core membership changes.
    const response = await fetch(`${url}/${joined}`, { headers });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(status(joined));
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(outgoing).toHaveBeenLastCalledWith(`${backend}/ops/nodes/${joined}/status`, expect.objectContaining({
      headers: { Authorization: "Bearer fixture" }, redirect: "manual",
    }));
    members.delete(joined);
    const disconnected = await fetch(`${url}/${joined}`, { headers });
    expect(disconnected.status).toBe(503);
    expect(await disconnected.text()).toContain("node unreachable");
    expect(outgoing.mock.calls.every(([url]) => String(url).startsWith(backend))).toBe(true);
  });

  it("requires login and a valid ID before calling the core", async () => {
    const outgoing = vi.fn<typeof fetch>();
    const url = await serve("status", outgoing);
    expect((await fetch(`${url}/${joined}`)).status).toBe(401);
    for (const id of ["0", "-1", "9223372036854775808", "https:evil"]) {
      expect((await fetch(`${url}/${id}`, { headers })).status).toBe(400);
    }
    expect(outgoing).not.toHaveBeenCalled();
  });

  it("reports redirects and mismatched identities instead of substituting local state", async () => {
    const outgoing = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { Location: "https://other/" } }))
      .mockResolvedValueOnce(new Response(status(source)))
      .mockResolvedValueOnce(new Response('{"error":"admin required"}', { status: 403 }));
    const url = await serve("status", outgoing);
    for (const expected of [502, 502, 403]) expect((await fetch(`${url}/${joined}`, { headers })).status).toBe(expected);
    expect(outgoing).toHaveBeenCalledTimes(3);
  });
});

describe("dynamic probe source and target", () => {
  it("sends one request to the core for an arbitrary joined source, retaining exact int64 IDs", async () => {
    const outgoing = vi.fn<typeof fetch>().mockResolvedValue(new Response(probe(joined, source), { status: 202 }));
    const url = await serve("probe", outgoing);
    const response = await fetch(`${url}/${joined}`, { method: "POST", headers, body: JSON.stringify({ target_node_id: source }) });
    expect(response.status).toBe(202);
    expect(await response.text()).toBe(probe(joined, source));
    expect(outgoing).toHaveBeenCalledOnce();
    expect(outgoing).toHaveBeenCalledWith(`${backend}/ops/nodes/${joined}/probes`, expect.objectContaining({
      method: "POST", headers, redirect: "manual", body: `{"target_node_id":${source}}`,
    }));
  });

  it("preserves routing failure traces and actual core errors", async () => {
    const outgoing = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(probe(source, joined, "failed")))
      .mockResolvedValueOnce(new Response('{"error":"probe rate limit exceeded"}', { status: 429 }))
      .mockResolvedValueOnce(new Response('{"error":"node unavailable"}', { status: 504 }));
    const url = await serve("probe", outgoing);
    for (const expected of [200, 429, 504]) {
      const response = await fetch(`${url}/${source}`, { method: "POST", headers, body: JSON.stringify({ target_node_id: joined }) });
      expect(response.status).toBe(expected);
      if (expected === 200) expect(await response.text()).toContain('"status":"failed"');
    }
  });

  it("rejects invalid bodies, oversized bodies and mismatched source responses", async () => {
    const outgoing = vi.fn<typeof fetch>().mockResolvedValue(new Response(probe(joined, source), { status: 202 }));
    const url = await serve("probe", outgoing);
    const send = (body: string) => fetch(`${url}/${source}`, { method: "POST", headers, body });
    for (const body of ['{bad', '{"target_node_id":"0"}', '{"target_node_id":"9223372036854775808"}',
      '{"target_node_id":"1","url":"http://other"}']) expect((await send(body)).status).toBe(400);
    expect((await send("a".repeat(300))).status).toBe(413);
    expect((await fetch(`${url}/${source}`, { method: "POST", body: '{}' })).status).toBe(401);
    expect(outgoing).not.toHaveBeenCalled();
    expect((await send(JSON.stringify({ target_node_id: joined }))).status).toBe(502);
  });
});

describe("trace aggregation from live membership", () => {
  it("uses the core aggregate, includes a joining node and retains its reached evidence", async () => {
    let includeNew = false;
    const outgoing = vi.fn<typeof fetch>().mockImplementation(async () => new Response(`{"trace_id":"${trace}","nodes":[
      {"node_id":${source},"events":[]}${includeNew ? `,{"node_id":${joined},"events":[{"trace_id":"${trace}","node_id":${joined},"packet_id":18446744073709551615,"stage":"probe_reached"}]}` : ""}]}`));
    const url = await serve("trace", outgoing);
    expect((await fetch(`${url}/${trace}`, { headers })).status).toBe(200);
    includeNew = true;
    const response = await fetch(`${url}/${trace}`, { headers });
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain(joined);
    expect(body).toContain("18446744073709551615");
    expect(body).toContain("probe_reached");
    expect(outgoing).toHaveBeenLastCalledWith(`${backend}/ops/traces/${trace}/cluster`, expect.objectContaining({ redirect: "manual" }));
    expect(outgoing).toHaveBeenCalledTimes(2);
  });

  it("retains per-node unavailable errors, but rejects malformed or misattributed events", async () => {
    const outgoing = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(`{"trace_id":"${trace}","nodes":[{"node_id":${joined},"events":[],"error":"node disconnected"}]}`))
      .mockResolvedValueOnce(new Response(`{"trace_id":"${trace}","nodes":[{"node_id":${joined},"events":[{"node_id":${source},"trace_id":"${trace}"}]}]}`));
    const url = await serve("trace", outgoing);
    const response = await fetch(`${url}/${trace}`, { headers });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("node disconnected");
    expect((await fetch(`${url}/${trace}`, { headers })).status).toBe(502);
    expect((await fetch(`${url}/bad`, { headers })).status).toBe(400);
    expect((await fetch(`${url}/${trace}`)).status).toBe(401);
    expect(outgoing).toHaveBeenCalledTimes(2);
  });
});
