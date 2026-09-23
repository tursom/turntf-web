import type { IncomingMessage, ServerResponse } from "node:http";
import JSONbig from "json-bigint";

const parseJson = JSONbig({ useNativeBigInt: true }).parse;

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
