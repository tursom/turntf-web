import type { ElementDefinition } from "cytoscape";
import type { MessageTrace, TraceEvent } from "@/api/traces";

export const stageLabels: Record<string, string> = {
  accepted: "入口已接受", stored: "创建事件已存储", received: "节点已接收包", forwarded: "已转交下一跳",
  attempt_failed: "转发尝试失败", dropped: "节点丢弃", no_path: "暂无路径",
  retry_queued: "排队重试", retry_expired: "重试到期", session_queued: "会话写入队列",
  delivery_missed: "会话投递失败", replica_event_accepted: "复制事件已接纳或已存在",
  origin_cursor_confirmed: "复制游标已确认", client_write_succeeded: "客户端连接写入成功",
  client_write_failed: "客户端连接写入失败", probe_started: "探测已发起",
  probe_failed: "探测发起失败", probe_reached: "目标节点已接收探测包",
};

export function observedGraphElements(trace: MessageTrace | undefined): ElementDefinition[] {
  if (!trace) return [];
  const elements: ElementDefinition[] = [];
  const nodes = new Set<string>();
  const addNode = (id: string) => {
    if (!id || id === "0" || nodes.has(id)) return;
    nodes.add(id);
    elements.push({ data: { id: `node:${id}`, nodeId: id, label: id.length > 15 ? `${id.slice(0, 5)}…${id.slice(-7)}` : id, kind: "observed" }, classes: "observed" });
  };
  const received = new Set(trace.events.filter((event) => event.stage === "received")
    .map((event) => `${event.nodeId}:${event.sourceNodeId}:${event.sourceRuntimeEpoch}:${event.packetId}:${event.peerNodeId}`));
  for (const event of trace.events) {
    addNode(event.nodeId);
    if (event.stage === "forwarded" && event.peerNodeId && event.peerNodeId !== "0") {
      addNode(event.peerNodeId);
      const confirmed = received.has(`${event.peerNodeId}:${event.sourceNodeId}:${event.sourceRuntimeEpoch}:${event.packetId}:${event.nodeId}`);
      elements.push({ data: { id: `trace:${event.nodeId}:${event.sequence}`, source: `node:${event.nodeId}`,
        target: `node:${event.peerNodeId}`, kind: confirmed ? "trace-confirmed" : "trace-unconfirmed",
        label: confirmed ? "两端观测" : "仅发送端观测", traceEvent: event },
      classes: confirmed ? "trace-confirmed" : "trace-unconfirmed" });
    }
    if (event.stage === "replica_event_accepted" && event.peerNodeId && event.peerNodeId !== "0" &&
        !trace.events.some((hop) => hop.stage === "forwarded" && hop.nodeId === event.peerNodeId && hop.peerNodeId === event.nodeId)) {
      addNode(event.peerNodeId);
      elements.push({ data: { id: `trace:replica:${event.nodeId}:${event.sequence}`,
        source: `node:${event.peerNodeId}`, target: `node:${event.nodeId}`, kind: "trace-replica",
        label: "复制对端已记录", traceEvent: event }, classes: "trace-replica" });
    }
  }
  return elements;
}

export function eventIdentity(event: TraceEvent): string {
  if (event.kind === "probe") return event.packetId && event.packetId !== "0"
    ? `探测包 ${event.sourceNodeId}:${event.packetId}` : "本次探测";
  return event.kind === "persistent"
    ? `${event.messageNodeId || event.sourceNodeId}:${event.messageSeq || "?"} · 事件 ${event.eventId || "?"}`
    : `包 ${event.sourceNodeId}:${event.packetId}`;
}
