import { afterEach, describe, expect, it, vi } from "vitest";
import { parseJson } from "@tursom/turntf-web-sdk";
import { startMessageProbe, traceFromHTTP } from "./traces";

afterEach(() => vi.unstubAllGlobals());

describe("traceFromHTTP", () => {
  it("preserves large IDs without Number precision loss", () => {
    const traceId = "a".repeat(32);
    const result = traceFromHTTP(parseJson(`{"trace_id":"${traceId}","nodes":[{"node_id":54062570162229324,"events":[{"trace_id":"${traceId}","stage":"forwarded","node_id":54062570162229324,"peer_node_id":54062570162229330,"packet_id":18446744073709551615,"source_runtime_epoch":123}]}]}`));
    expect(result.nodes[0]?.nodeId).toBe("54062570162229324");
    expect(result.events[0]?.peerNodeId).toBe("54062570162229330");
    expect(result.events[0]?.packetId).toBe("18446744073709551615");
  });

  it("starts a probe through the selected trusted source and validates its response", async () => {
    const source = "54062570162229324";
    const target = "54062570162229330";
    const id = "a".repeat(32);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(`{"source_node_id":${source},"target_node_id":${target},"trace_id":"${id}","status":"dispatched"}`, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await startMessageProbe("token", source, target);
    expect(result).toEqual({ sourceNodeId: source, targetNodeId: target, traceId: id, status: "dispatched" });
    expect(fetchMock).toHaveBeenCalledWith(`/ui-api/probes/${source}`, {
      method: "POST", headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({ target_node_id: target }),
    });
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(`{"source_node_id":${target},"target_node_id":${target},"trace_id":"${id}","status":"dispatched"}`, { status: 202 })));
    await expect(startMessageProbe("token", source, target)).rejects.toThrow("不匹配");
  });
});
