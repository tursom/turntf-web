import { parseJson } from "@tursom/turntf-web-sdk";
import { wrappedFetch } from "./fetchWrapper";

export interface TraceEvent {
  traceId: string;
  kind: string;
  stage: string;
  nodeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  nextHopNodeId: string;
  peerNodeId: string;
  packetId: string;
  sourceRuntimeEpoch: string;
  messageNodeId: string;
  messageSeq: string;
  eventId: string;
  recipientNodeId: string;
  recipientUserId: string;
  transport: string;
  estimatedCost: string;
  durationMs: string;
  reason: string;
  path: string;
  at: string;
  sequence: string;
}

export interface TraceNode {
  nodeId: string;
  events: TraceEvent[];
  error: string;
}

export interface MessageTrace {
  traceId: string;
  nodes: TraceNode[];
  events: TraceEvent[];
}

export interface ProbeResult {
  traceId: string;
  sourceNodeId: string;
  targetNodeId: string;
  status: "dispatched" | "failed";
}

const field = (value: unknown, key: string): unknown => value && typeof value === "object"
  ? (value as Record<string, unknown>)[key] : undefined;
const text = (value: unknown) => value == null ? "" : String(value);

export function traceFromHTTP(value: unknown): MessageTrace {
  const traceId = text(field(value, "trace_id"));
  if (!/^[0-9a-f]{32}$/.test(traceId) || !Array.isArray(field(value, "nodes"))) throw new Error("轨迹响应无效");
  const nodes = (field(value, "nodes") as unknown[]).map((node): TraceNode => ({
    nodeId: text(field(node, "node_id")), error: text(field(node, "error")),
    events: (Array.isArray(field(node, "events")) ? field(node, "events") as unknown[] : []).map((event) => ({
      traceId: text(field(event, "trace_id")), kind: text(field(event, "kind")), stage: text(field(event, "stage")),
      nodeId: text(field(event, "node_id")), sourceNodeId: text(field(event, "source_node_id")),
      targetNodeId: text(field(event, "target_node_id")), nextHopNodeId: text(field(event, "next_hop_node_id")),
      peerNodeId: text(field(event, "peer_node_id")), packetId: text(field(event, "packet_id")),
      sourceRuntimeEpoch: text(field(event, "source_runtime_epoch")),
      messageNodeId: text(field(event, "message_node_id")), messageSeq: text(field(event, "message_seq")),
      eventId: text(field(event, "event_id")), recipientNodeId: text(field(event, "recipient_node_id")),
      recipientUserId: text(field(event, "recipient_user_id")), transport: text(field(event, "transport")),
      estimatedCost: text(field(event, "estimated_cost")), durationMs: text(field(event, "duration_ms")),
      reason: text(field(event, "reason")), path: text(field(event, "path")), at: text(field(event, "at")),
      sequence: text(field(event, "sequence")),
    })),
  }));
  return { traceId, nodes, events: nodes.flatMap((node) => node.events) };
}

export async function startMessageProbe(token: string, sourceNodeId: string, targetNodeId: string): Promise<ProbeResult> {
  const validId = (value: string) => /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;
  if (!validId(sourceNodeId) || !validId(targetNodeId)) throw new Error("请选择有效节点");
  const response = await wrappedFetch(`/ui-api/probes/${sourceNodeId}`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ target_node_id: targetNodeId }),
  });
  if (!response.ok) {
    if (response.status === 403) throw new Error("无权发起探测");
    if (response.status === 429) throw new Error("探测过于频繁，请稍后重试");
    throw new Error("探测发起失败");
  }
  const body: unknown = parseJson(await response.text());
  const traceId = text(field(body, "trace_id"));
  const status = text(field(body, "status"));
  if (!/^[0-9a-f]{32}$/.test(traceId) || text(field(body, "source_node_id")) !== sourceNodeId ||
      text(field(body, "target_node_id")) !== targetNodeId || (status !== "dispatched" && status !== "failed")) {
    throw new Error("探测响应与请求节点不匹配");
  }
  return { traceId, sourceNodeId, targetNodeId, status };
}

export async function getMessageTrace(token: string, traceId: string): Promise<MessageTrace> {
  if (!/^[0-9a-f]{32}$/.test(traceId)) throw new Error("追踪 ID 应为 32 位小写十六进制字符");
  const response = await wrappedFetch(`/ui-api/traces/${traceId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(response.status === 403 ? "无权查看消息轨迹" : "轨迹查询失败");
  return traceFromHTTP(parseJson(await response.text()));
}
