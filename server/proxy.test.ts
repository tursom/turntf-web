import express from "express";
import http, { type Server } from "node:http";
import { Socket, type AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import WebSocket, { WebSocketServer } from "ws";
import { setupProxy } from "./proxy";

const servers: Server[] = [];
const connections = new Set<import("node:net").Socket>();

async function listen(server: Server): Promise<string> {
  servers.push(server);
  server.on("connection", (socket) => {
    connections.add(socket);
    socket.on("close", () => connections.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

afterEach(async () => {
  for (const socket of connections) socket.destroy();
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
});

async function fixture() {
  const upgradedPaths: string[] = [];
  const upgradedSockets: Socket[] = [];
  const backend = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ url: req.url, method: req.method, authorization: req.headers.authorization, body: Buffer.concat(chunks).toString() }));
  });
  const wsServer = new WebSocketServer({ server: backend });
  wsServer.on("connection", (socket, req) => {
    upgradedPaths.push(req.url ?? "");
    socket.on("message", (data, binary) => socket.send(data, { binary }));
  });
  backend.on("upgrade", (_req, socket) => {
    if (socket instanceof Socket) upgradedSockets.push(socket);
  });
  const backendUrl = await listen(backend);
  const app = express();
  const proxy = setupProxy(app, backendUrl);
  app.use((_req, res) => res.type("html").send("<html>frontend</html>"));
  const server = http.createServer(app);
  server.on("upgrade", (req, socket, head) => {
    if (!(socket instanceof Socket)) {
      socket.destroy();
      return;
    }
    proxy.upgrade!(req, socket, head);
  });
  return { url: await listen(server), upgradedPaths, upgradedSockets, backend };
}

async function echo(url: string): Promise<Buffer> {
  const socket = new WebSocket(url);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.terminate(); reject(new Error("WebSocket proxy timeout")); }, 2000);
    socket.once("error", (err) => { clearTimeout(timeout); reject(err); });
    socket.once("open", () => socket.send(Buffer.from([0, 1, 127, 255])));
    socket.once("message", (data) => {
      clearTimeout(timeout);
      socket.close();
      resolve(Buffer.from(data as Buffer));
    });
  });
}

describe("shared turntf entry", () => {
  it("strips /api exactly once and preserves request bodies and authorization", async () => {
    const { url } = await fixture();
    const response = await fetch(`${url}/api/auth/login?check=1`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer fixture" },
      body: JSON.stringify({ login_name: "fixture", password: "test-only" }),
    });
    expect(await response.json()).toEqual({ url: "/auth/login?check=1", method: "POST", authorization: "Bearer fixture", body: '{"login_name":"fixture","password":"test-only"}' });
  });

  it("keeps legacy service API paths while leaving UI routes to the SPA", async () => {
    const { url } = await fixture();
    for (const path of ["/healthz", "/metrics", "/users", "/users?name=fixture", "/nodes/123/users/1", "/cluster/nodes", "/ops/status", "/events?after=0"]) {
      const response = await fetch(url + path);
      expect(await response.json()).toMatchObject({ url: path });
    }
    for (const path of ["/", "/login", "/chat", "/admin/users", "/api-other", "/users-other"]) {
      expect(await (await fetch(url + path)).text()).toBe("<html>frontend</html>");
    }
  });

  it("rewrites the bare API root and its query without losing the leading slash", async () => {
    const { url } = await fixture();
    for (const [path, expected] of [["/api", "/"], ["/api?check=1", "/?check=1"]]) {
      expect(await (await fetch(url + path)).json()).toMatchObject({ url: expected });
    }
  });

  it("returns bounded 502 responses for both HTTP and WebSocket upstream errors", async () => {
    const { url, backend } = await fixture();
    await new Promise<void>((resolve) => backend.close(() => resolve()));
    const response = await fetch(url + "/api/healthz");
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "后端服务不可用" });
    await expect(echo(url.replace("http:", "ws:") + "/ws/client")).rejects.toThrow("502");
    expect(await (await fetch(url + "/login")).text()).toBe("<html>frontend</html>");
  });

  it("closes an upgraded connection without writing HTTP bytes after an upstream reset", async () => {
    const { url, upgradedSockets } = await fixture();
    const socket = new WebSocket(url.replace("http:", "ws:") + "/ws/client");
    const errors: string[] = [];
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => { socket.terminate(); reject(new Error("reset timeout")); }, 2000);
      socket.on("error", (error) => errors.push(error.message));
      socket.once("open", () => upgradedSockets[0].resetAndDestroy());
      socket.once("close", () => { clearTimeout(timeout); resolve(); });
    });
    expect(errors).toEqual([]);
  });

  it("supports a WebSocket upgrade before any HTTP request", async () => {
    const { url } = await fixture();
    expect(await echo(url.replace("http:", "ws:") + "/internal/cluster/ws")).toEqual(Buffer.from([0, 1, 127, 255]));
  });

  it.each(["/api/ws/client", "/ws/client", "/ws/realtime", "/internal/cluster/ws"])("forwards binary WebSocket frames at %s", async (path) => {
    const { url, upgradedPaths } = await fixture();
    // An HTTP request first must not cause a second automatic upgrade listener.
    await fetch(url + "/api/healthz");
    expect(await echo(url.replace("http:", "ws:") + path)).toEqual(Buffer.from([0, 1, 127, 255]));
    expect(upgradedPaths).toEqual([path.replace(/^\/api(?=\/|$)/, "")]);
  });
});
