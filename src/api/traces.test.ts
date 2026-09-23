import { describe, expect, it } from "vitest";
import { parseJson } from "@tursom/turntf-web-sdk";
import { traceFromHTTP } from "./traces";

describe("traceFromHTTP", () => {
  it("preserves large IDs without Number precision loss", () => {
    const traceId = "a".repeat(32);
    const result = traceFromHTTP(parseJson(`{"trace_id":"${traceId}","nodes":[{"node_id":54062570162229324,"events":[{"trace_id":"${traceId}","stage":"forwarded","node_id":54062570162229324,"peer_node_id":54062570162229330,"packet_id":18446744073709551615,"source_runtime_epoch":123}]}]}`));
    expect(result.nodes[0]?.nodeId).toBe("54062570162229324");
    expect(result.events[0]?.peerNodeId).toBe("54062570162229330");
    expect(result.events[0]?.packetId).toBe("18446744073709551615");
  });
});
