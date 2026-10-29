import type { IncomingMessage, ServerResponse } from "node:http";
import JSONbig from "json-bigint";

const parseJson = JSONbig({ useNativeBigInt: true }).parse;
const traceIdPattern = /^[0-9a-f]{32}$/;
const maxResponseBytes = 4 * 1024 * 1024;

function validNodeId(value: string): boolean {
  return /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;
}
function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined;
}
function sendError(res: ServerResponse, status: number, error: string): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error }));
}
function authorization(req: IncomingMessage, res: ServerResponse): string | undefined {
  res.setHeader("Cache-Control", "no-store");
  const value = req.headers.authorization;
  if (typeof value !== "string" || !/^Bearer \S+$/.test(value)) {
    sendError(res, 401, "请先登录");
    return;
  }
  return value;
}
async function readBoundedBody(response: Response): Promise<string> {
  if (Number(response.headers.get("content-length")) > maxResponseBytes) throw new Error("Cluster response too large");
  if (!response.body) throw new Error("Cluster response is empty");
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
        throw new Error("Cluster response too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

// Web 只连接所配置的本机 core。成员发现、目标查询和轨迹聚合均由 core 经 mesh 完成。
// 不使用节点 URL 映射，也不向各成员的 HTTP 入口分发管理员令牌。
async function forwardOperation(backend: string, path: string, token: string, res: ServerResponse,
  fetchCore: typeof fetch, validate: (value: Record<string, unknown>) => boolean, body?: string): Promise<void> {
  try {
    const response = await fetchCore(`${backend.replace(/\/+$/, "")}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? { Authorization: token } : { Authorization: token, "Content-Type": "application/json" },
      body, redirect: "manual", signal: AbortSignal.timeout(8000),
    });
    if (response.status >= 300 && response.status < 400) return sendError(res, 502, "集群查询返回了意外重定向");
    const text = await readBoundedBody(response);
    const result = object(parseJson(text));
    if (!response.ok) {
      return sendError(res, response.status, typeof result?.error === "string" ? result.error : "集群查询失败");
    }
    if (!result || !validate(result)) return sendError(res, 502, "集群响应与请求的节点或轨迹不匹配");
    res.writeHead(response.status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(text);
  } catch {
    sendError(res, 502, "当前入口的集群查询暂时不可用");
  }
}

export function createTopologyStatusHandler(backend: string, fetchCore: typeof fetch = fetch) {
  return async (req: IncomingMessage, res: ServerResponse, nodeId: string): Promise<void> => {
    const token = authorization(req, res);
    if (!token) return;
    if (req.method !== "GET" || !validNodeId(nodeId)) return sendError(res, 400, "无效的节点 ID");
    await forwardOperation(backend, `/ops/nodes/${nodeId}/status`, token, res, fetchCore,
      (value) => String(value.node_id) === nodeId && object(value.mesh) !== undefined);
  };
}

export function createMessageProbeHandler(backend: string, fetchCore: typeof fetch = fetch) {
  return async (req: IncomingMessage, res: ServerResponse, sourceNodeId: string): Promise<void> => {
    const token = authorization(req, res);
    if (!token) return;
    if (req.method !== "POST" || !validNodeId(sourceNodeId)) return sendError(res, 400, "无效的源节点 ID");
    const chunks: Buffer[] = [];
    let size = 0;
    let input: Record<string, unknown> | undefined;
    try {
      for await (const chunk of req) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
        size += bytes.length;
        if (size > 256) return sendError(res, 413, "探测请求过大");
        chunks.push(bytes);
      }
      input = object(parseJson(Buffer.concat(chunks).toString("utf8")));
    } catch {
      return sendError(res, 400, "无效的探测请求");
    }
    const targetNodeId = input && Object.keys(input).length === 1 ? String(input.target_node_id) : "";
    if (!validNodeId(targetNodeId)) return sendError(res, 400, "无效的目标节点 ID");
    await forwardOperation(backend, `/ops/nodes/${sourceNodeId}/probes`, token, res, fetchCore,
      (value) => String(value.source_node_id) === sourceNodeId && String(value.target_node_id) === targetNodeId &&
        traceIdPattern.test(String(value.trace_id)) && ["dispatched", "failed"].includes(String(value.status)),
      `{"target_node_id":${targetNodeId}}`);
  };
}

export function createMessageTraceHandler(backend: string, fetchCore: typeof fetch = fetch) {
  return async (req: IncomingMessage, res: ServerResponse, traceId: string): Promise<void> => {
    const token = authorization(req, res);
    if (!token) return;
    if (req.method !== "GET" || !traceIdPattern.test(traceId)) return sendError(res, 400, "无效的追踪 ID");
    await forwardOperation(backend, `/ops/traces/${traceId}/cluster`, token, res, fetchCore, (value) =>
      value.trace_id === traceId && Array.isArray(value.nodes) && value.nodes.every((entry: unknown) => {
        const node = object(entry);
        return node && validNodeId(String(node.node_id)) && Array.isArray(node.events) &&
          (node.error === undefined || typeof node.error === "string") && node.events.every((entry: unknown) => {
            const event = object(entry);
            return event && String(event.node_id) === String(node.node_id) && event.trace_id === traceId;
          });
      }));
  };
}
