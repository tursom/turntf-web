import type { IncomingMessage, ServerResponse } from "node:http";
import JSONbig from "json-bigint";

const json = JSONbig({ useNativeBigInt: true });
const parseJson = json.parse;

const nodeIdPattern = /^[1-9]\d{0,18}$/;
const maxNodeId = 9223372036854775807n;
const maxResponseBytes = 4 * 1024 * 1024;

function validNodeId(value: string): boolean {
  return nodeIdPattern.test(value) && BigInt(value) <= maxNodeId;
}

export function parseTopologyTargets(raw: string | undefined): Map<string, string> {
  if (!raw) return new Map();
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("TURNTF_NODE_STATUS_URLS must be a JSON object");
  const targets = new Map<string, string>();
  for (const [id, address] of Object.entries(value)) {
    if (!validNodeId(id) || typeof address !== "string") throw new Error("Invalid node status target");
    const url = new URL(address);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
        url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      throw new Error("Node status targets must be HTTPS origins (or local HTTP for development)");
    }
    targets.set(id, url.origin);
  }
  return targets;
}

async function readBoundedBody(response: Response): Promise<string> {
  if (Number(response.headers.get("content-length")) > maxResponseBytes) throw new Error("Node status response too large");
  if (!response.body) throw new Error("Node status response is empty");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxResponseBytes) {
        await reader.cancel();
        throw new Error("Node status response too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function createTopologyStatusHandler(rawTargets: string | undefined, fetchStatus: typeof fetch = fetch) {
  const targets = parseTopologyTargets(rawTargets);
  return async (req: IncomingMessage, res: ServerResponse, nodeId: string): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const sendError = (status: number, error: string) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error }));
    };
    if (req.method !== "GET" || !validNodeId(nodeId)) return sendError(400, "无效的节点 ID");
    const target = targets.get(nodeId);
    if (!target) return sendError(404, "该节点尚未配置状态入口");
    const authorization = req.headers.authorization;
    if (typeof authorization !== "string" || !/^Bearer \S+$/.test(authorization)) return sendError(401, "请先登录");

    try {
      const response = await fetchStatus(`${target}/ops/status`, {
        headers: { Authorization: authorization },
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
      });
      if (response.status === 401 || response.status === 403) return sendError(403, "无权查看该节点状态");
      if (!response.ok) return sendError(502, "节点状态暂时不可用");
      const body = await readBoundedBody(response);
      const status: unknown = parseJson(body);
      if (!status || typeof status !== "object" || String((status as Record<string, unknown>).node_id) !== nodeId ||
          typeof (status as Record<string, unknown>).mesh !== "object") {
        return sendError(502, "节点状态与请求的节点不匹配");
      }
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(body);
    } catch {
      sendError(502, "节点状态暂时不可用");
    }
  };
}

const traceIdPattern = /^[0-9a-f]{32}$/;

export function createMessageProbeHandler(rawTargets: string | undefined, fetchProbe: typeof fetch = fetch) {
  const targets = parseTopologyTargets(rawTargets);
  return async (req: IncomingMessage, res: ServerResponse, sourceNodeId: string): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const sendError = (status: number, error: string) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error }));
    };
    if (req.method !== "POST" || !validNodeId(sourceNodeId)) return sendError(400, "无效的源节点 ID");
    const target = targets.get(sourceNodeId);
    if (!target) return sendError(404, "源节点未配置可信入口");
    const authorization = req.headers.authorization;
    if (typeof authorization !== "string" || !/^Bearer \S+$/.test(authorization)) return sendError(401, "请先登录");

    let size = 0;
    const chunks: Buffer[] = [];
    try {
      for await (const chunk of req) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
        size += bytes.length;
        if (size > 256) return sendError(413, "探测请求过大");
        chunks.push(bytes);
      }
      let input: unknown;
      try {
        input = parseJson(Buffer.concat(chunks).toString("utf8"));
      } catch {
        return sendError(400, "无效的探测请求");
      }
      const requested = input && typeof input === "object" && !Array.isArray(input) ? Object.keys(input) : [];
      const targetNodeId = requested.length === 1 && requested[0] === "target_node_id"
        ? String((input as Record<string, unknown>).target_node_id) : "";
      if (!validNodeId(targetNodeId) || !targets.has(targetNodeId)) return sendError(400, "无效的目标节点 ID");

      const headers = { Authorization: authorization };
      const statusResponse = await fetchProbe(`${target}/ops/status`, {
        headers, redirect: "manual", signal: AbortSignal.timeout(8000),
      });
      if (statusResponse.status === 401 || statusResponse.status === 403) return sendError(403, "无权使用源节点");
      if (!statusResponse.ok) return sendError(502, "源节点状态不可用");
      const status: unknown = parseJson(await readBoundedBody(statusResponse));
      if (!status || typeof status !== "object" || String((status as Record<string, unknown>).node_id) !== sourceNodeId ||
          typeof (status as Record<string, unknown>).mesh !== "object") {
        return sendError(502, "源节点身份不匹配");
      }
      const response = await fetchProbe(`${target}/ops/probes`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: `{"target_node_id":${targetNodeId}}`, redirect: "manual", signal: AbortSignal.timeout(8000),
      });
      if (response.status === 401 || response.status === 403) return sendError(403, "无权发起探测");
      if (response.status === 429) return sendError(429, "探测过于频繁");
      if (!response.ok) return sendError(502, "探测暂时不可用");
      const body = await readBoundedBody(response);
      const result: unknown = parseJson(body);
      if (!result || typeof result !== "object" ||
          String((result as Record<string, unknown>).source_node_id) !== sourceNodeId ||
          String((result as Record<string, unknown>).target_node_id) !== targetNodeId ||
          !traceIdPattern.test(String((result as Record<string, unknown>).trace_id)) ||
          !["dispatched", "failed"].includes(String((result as Record<string, unknown>).status))) {
        return sendError(502, "探测结果与请求节点不匹配");
      }
      res.writeHead(response.status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(body);
    } catch {
      sendError(502, "探测节点暂时不可用");
    }
  };
}

export function createMessageTraceHandler(rawTargets: string | undefined, fetchTrace: typeof fetch = fetch) {
  const targets = parseTopologyTargets(rawTargets);
  return async (req: IncomingMessage, res: ServerResponse, traceId: string): Promise<void> => {
    res.setHeader("Cache-Control", "no-store");
    const sendError = (status: number, error: string) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error }));
    };
    if (req.method !== "GET" || !traceIdPattern.test(traceId)) return sendError(400, "无效的追踪 ID");
    const authorization = req.headers.authorization;
    if (typeof authorization !== "string" || !/^Bearer \S+$/.test(authorization)) return sendError(401, "请先登录");
    if (!targets.size) return sendError(503, "尚未配置可信节点入口");

    const nodes = await Promise.all([...targets].map(async ([nodeId, target]) => {
      const request = (path: string) => fetchTrace(`${target}${path}`, {
        headers: { Authorization: authorization }, redirect: "manual", signal: AbortSignal.timeout(8000),
      });
      try {
        const statusResponse = await request("/ops/status");
        if (statusResponse.status === 401 || statusResponse.status === 403) return { node_id: nodeId, events: [], error: "无权查询" };
        if (!statusResponse.ok) throw new Error("status unavailable");
        const status: unknown = parseJson(await readBoundedBody(statusResponse));
        if (!status || typeof status !== "object" || String((status as Record<string, unknown>).node_id) !== nodeId) {
          throw new Error("node identity mismatch");
        }
        const traceResponse = await request(`/ops/traces/${traceId}`);
        if (traceResponse.status === 401 || traceResponse.status === 403) return { node_id: nodeId, events: [], error: "无权查询" };
        if (!traceResponse.ok) throw new Error("trace unavailable");
        const trace: unknown = parseJson(await readBoundedBody(traceResponse));
        if (!trace || typeof trace !== "object" || (trace as Record<string, unknown>).trace_id !== traceId ||
            !Array.isArray((trace as Record<string, unknown>).events) ||
            !(trace as { events: unknown[] }).events.every((event) => event && typeof event === "object" &&
              String((event as Record<string, unknown>).node_id) === nodeId &&
              (event as Record<string, unknown>).trace_id === traceId)) {
          throw new Error("trace identity mismatch");
        }
        return { node_id: nodeId, events: (trace as { events: unknown[] }).events };
      } catch {
        return { node_id: nodeId, events: [], error: "节点暂时不可用或身份不匹配" };
      }
    }));
    if (nodes.every((node) => node.error === "无权查询")) return sendError(403, "无权查看消息轨迹");
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(json.stringify({ trace_id: traceId, nodes }));
  };
}
