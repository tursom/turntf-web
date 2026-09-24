import { afterEach, describe, expect, it, vi } from "vitest";
import { getTopologyStatus } from "./topology";

afterEach(() => vi.unstubAllGlobals());

describe("getTopologyStatus", () => {
  it("preserves int64 node IDs and costs without rounding", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(`{
      "node_id": 9223372036854775807,
      "mesh": {"enabled": true, "topology_generation": 9, "routes": [{
        "destination_node_id": 9223372036854775806, "traffic_class": "control_query",
        "reachable": true, "next_hop_node_id": 9223372036854775805,
        "estimated_cost": 9223372036854775804, "outbound_transport": "websocket", "path_class": "same_transport_forward"
      }]},
      "peers": [{"node_id": 9223372036854775805, "connected": true, "transport": "websocket"}]
    }`));
    vi.stubGlobal("fetch", fetchMock);
    const result = await getTopologyStatus("test-token");
    expect(fetchMock).toHaveBeenCalledWith("/api/ops/status", { headers: { Authorization: "Bearer test-token" } });
    expect(result.nodeId).toBe("9223372036854775807");
    expect(result.peers[0].nodeId).toBe("9223372036854775805");
    expect(result.routes[0]).toMatchObject({ destinationNodeId: "9223372036854775806", estimatedCost: "9223372036854775804" });
  });

  it("rejects errors and missing mesh status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 })));
    await expect(getTopologyStatus("token")).rejects.toThrow("forbidden");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response('{"node_id":1}')));
    await expect(getTopologyStatus("token")).rejects.toThrow("缺少 mesh");
  });

  it("treats an omitted estimated cost as zero", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(`{"node_id":1,"mesh":{"enabled":true,"routes":[
      {"destination_node_id":2,"traffic_class":"control_query","reachable":true}
    ]}}`)));
    expect((await getTopologyStatus("token")).routes[0].estimatedCost).toBe("0");
  });

  it("queries a selected node through the same-origin status proxy", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"node_id":2,"mesh":{"enabled":true,"routes":[]}}'));
    vi.stubGlobal("fetch", fetchMock);
    expect((await getTopologyStatus("token", "2")).nodeId).toBe("2");
    expect(fetchMock).toHaveBeenCalledWith("/ui-api/topology/2", { headers: { Authorization: "Bearer token" } });
  });
});
