import { describe, expect, it } from "vitest";
import type { TopologyStatus } from "@/api/topology";
import { costWidth, graphElements, routesForClass } from "./topologyModel";

describe("topology model", () => {
  it("filters by traffic class and excludes local node", () => {
    const status: TopologyStatus = {
      nodeId: "1", enabled: true, topologyGeneration: "3", peers: [],
      routes: [
        { destinationNodeId: "10", trafficClass: "control_query", reachable: false, nextHopNodeId: "", outboundTransport: "", pathClass: "", estimatedCost: "" },
        { destinationNodeId: "1", trafficClass: "control_query", reachable: true, nextHopNodeId: "1", outboundTransport: "", pathClass: "", estimatedCost: "2" },
        { destinationNodeId: "2", trafficClass: "control_query", reachable: true, nextHopNodeId: "2", outboundTransport: "", pathClass: "", estimatedCost: "10" },
        { destinationNodeId: "3", trafficClass: "snapshot_bulk", reachable: true, nextHopNodeId: "3", outboundTransport: "", pathClass: "", estimatedCost: "8" },
      ],
    };
    expect(routesForClass(status, "control_query").map((route) => route.destinationNodeId)).toEqual(["2", "10"]);
    expect(costWidth("9223372036854775804", 9223372036854775808n)).toBe(99);
    expect(costWidth("", 8n)).toBe(0);
  });

  it("draws only observed connections and routes via connected next hops", () => {
    const status: TopologyStatus = {
      nodeId: "1", enabled: true, topologyGeneration: "4",
      peers: [
        { nodeId: "2", connected: true, transport: "websocket" },
        { nodeId: "3", connected: false, transport: "libp2p" },
      ],
      routes: [],
    };
    const route = (destinationNodeId: string, nextHopNodeId: string, reachable: boolean) => ({
      destinationNodeId, nextHopNodeId, reachable, trafficClass: "control_query", estimatedCost: "9223372036854775804",
      outboundTransport: "websocket", pathClass: "same_transport_forward",
    });
    const elements = graphElements(status, [route("2", "2", true), route("4", "2", true), route("5", "3", true), route("6", "", false)]);
    expect(elements.filter((element) => element.data.source).map((element) => element.data.id)).toEqual(["link:2", "route:4"]);
    expect(elements.find((element) => element.data.id === "link:2")?.data).toMatchObject({ cost: "9223372036854775804", weight: 100 });
    expect(elements.find((element) => element.data.id === "route:4")?.data).toMatchObject({ source: "node:2", target: "node:4" });
    expect(elements.find((element) => element.data.id === "node:6")?.classes).toBe("offline");
  });
});
