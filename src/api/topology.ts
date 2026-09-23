import { parseJson } from "@tursom/turntf-web-sdk";
import { getApiUrl } from "./client";
import { wrappedFetch } from "./fetchWrapper";

export interface MeshRoute {
  destinationNodeId: string;
  trafficClass: string;
  reachable: boolean;
  nextHopNodeId: string;
  outboundTransport: string;
  pathClass: string;
  estimatedCost: string;
}

export interface TopologyStatus {
  nodeId: string;
  enabled: boolean;
  topologyGeneration: string;
  peers: { nodeId: string; connected: boolean; transport: string }[];
  routes: MeshRoute[];
}

function field(value: unknown, key: string): unknown {
  return value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

export function topologyFromHTTP(value: unknown): TopologyStatus {
  const mesh = field(value, "mesh");
  if (!mesh || typeof mesh !== "object") throw new Error("运维状态缺少 mesh 数据");
  const peers = field(value, "peers");
  const routes = field(mesh, "routes");
  return {
    nodeId: text(field(value, "node_id")),
    enabled: field(mesh, "enabled") === true,
    topologyGeneration: text(field(mesh, "topology_generation")),
    peers: (Array.isArray(peers) ? peers : []).map((peer) => ({
      nodeId: text(field(peer, "node_id")),
      connected: field(peer, "connected") === true,
      transport: text(field(peer, "transport")),
    })),
    routes: (Array.isArray(routes) ? routes : []).map((route) => ({
      destinationNodeId: text(field(route, "destination_node_id")),
      trafficClass: text(field(route, "traffic_class")),
      reachable: field(route, "reachable") === true,
      nextHopNodeId: text(field(route, "next_hop_node_id")),
      outboundTransport: text(field(route, "outbound_transport")),
      pathClass: text(field(route, "path_class")),
      estimatedCost: text(field(route, "estimated_cost") ?? 0),
    })),
  };
}

export async function getTopologyStatus(token: string): Promise<TopologyStatus> {
  const response = await wrappedFetch(`${getApiUrl()}/ops/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(await response.text());
  return topologyFromHTTP(parseJson(await response.text()));
}
