import { describe, expect, it } from "vitest";
import type { MessageTrace, TraceEvent } from "@/api/traces";
import { observedGraphElements } from "./traceModel";

function event(stage: string, nodeId: string, peerNodeId: string, sequence: string): TraceEvent {
  return { traceId: "a".repeat(32), kind: "transient", stage, nodeId, peerNodeId, sequence,
    packetId: "123", sourceRuntimeEpoch: "44", sourceNodeId: "1", targetNodeId: "3", nextHopNodeId: "", messageNodeId: "",
    messageSeq: "", eventId: "", recipientNodeId: "", recipientUserId: "", transport: "", estimatedCost: "",
    durationMs: "", reason: "", path: "", at: "" };
}

describe("observed trace graph", () => {
  it("does not claim arrival unless the next hop recorded the matching packet", () => {
    const trace: MessageTrace = { traceId: "a".repeat(32), nodes: [], events: [
      event("forwarded", "1", "2", "1"), event("received", "2", "1", "2"), event("forwarded", "2", "3", "3"),
    ] };
    const edges = observedGraphElements(trace).filter((item) => item.data.source);
    expect(edges.map((edge) => edge.data.kind)).toEqual(["trace-confirmed", "trace-unconfirmed"]);
  });

  it("keeps independent persistent replication branches", () => {
    const trace: MessageTrace = { traceId: "a".repeat(32), nodes: [], events: [
      { ...event("replica_event_accepted", "2", "1", "1"), kind: "persistent", eventId: "77" },
      { ...event("replica_event_accepted", "3", "1", "1"), kind: "persistent", eventId: "77" },
    ] };
    const edges = observedGraphElements(trace).filter((item) => item.data.source);
    expect(edges.map((edge) => `${edge.data.source}->${edge.data.target}`)).toEqual(["node:1->node:2", "node:1->node:3"]);
  });
});
