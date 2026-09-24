import type { MeshRoute, TopologyStatus } from "@/api/topology";
import type { ElementDefinition } from "cytoscape";

export const trafficLabels: Record<string, string> = {
  control_critical: "关键控制",
  control_query: "控制查询",
  transient_interactive: "实时交互",
  replication_stream: "复制流",
  snapshot_bulk: "快照传输",
};

export function routesForClass(status: TopologyStatus, trafficClass: string): MeshRoute[] {
  return status.routes.filter((route) => route.trafficClass === trafficClass && route.destinationNodeId !== status.nodeId)
    .sort((a, b) => a.destinationNodeId.localeCompare(b.destinationNodeId, "en", { numeric: true }));
}

export function costWidth(cost: string, maxCost: bigint): number {
  if (!maxCost || !/^\d+$/.test(cost)) return 0;
  const value = BigInt(cost);
  return Number((value * 100n) / maxCost);
}

export function graphElements(status: TopologyStatus, routes: MeshRoute[]): ElementDefinition[] {
  const elements: ElementDefinition[] = [{
    data: { id: `node:${status.nodeId}`, nodeId: status.nodeId, label: shortId(status.nodeId), kind: "local" },
    classes: "local",
  }];
  const peers = new Map(status.peers.filter((peer) => peer.nodeId && peer.nodeId !== status.nodeId)
    .map((peer) => [peer.nodeId, peer]));
  const routeById = new Map(routes.map((route) => [route.destinationNodeId, route]));
  const maxCost = routes.reduce((max, route) => route.reachable && /^\d+$/.test(route.estimatedCost) && BigInt(route.estimatedCost) > max
    ? BigInt(route.estimatedCost) : max, 0n);

  for (const peer of peers.values()) {
    elements.push({
      data: { id: `node:${peer.nodeId}`, nodeId: peer.nodeId, label: shortId(peer.nodeId), kind: "peer", connected: peer.connected, transport: peer.transport },
      classes: peer.connected ? "peer" : "offline",
    });
    if (peer.connected) {
      const route = routeById.get(peer.nodeId);
      elements.push({
        data: { id: `link:${peer.nodeId}`, source: `node:${status.nodeId}`, target: `node:${peer.nodeId}`,
          kind: "connection", cost: route?.reachable ? route.estimatedCost : "", route,
          costLabel: route?.reachable ? `估算 ${shortCost(route.estimatedCost)}` : "",
          weight: route?.reachable ? costWidth(route.estimatedCost, maxCost) : 0 },
        classes: "connection",
      });
    }
  }

  for (const route of routes) {
    if (peers.has(route.destinationNodeId)) continue;
    elements.push({
      data: { id: `node:${route.destinationNodeId}`, nodeId: route.destinationNodeId, label: shortId(route.destinationNodeId), kind: "destination", route },
      classes: route.reachable ? "destination" : "offline",
    });
    // A next hop is a known connection, not proof of a physical link to the destination.
    if (route.reachable && peers.get(route.nextHopNodeId)?.connected) {
      elements.push({
        data: { id: `route:${route.destinationNodeId}`, source: `node:${route.nextHopNodeId}`, target: `node:${route.destinationNodeId}`,
          kind: "route", cost: route.estimatedCost, costLabel: `估算 ${shortCost(route.estimatedCost)}`,
          weight: costWidth(route.estimatedCost, maxCost), route },
        classes: "route",
      });
    }
  }
  return elements;
}

function shortId(id: string): string {
  return id.length > 15 ? `${id.slice(0, 5)}…${id.slice(-7)}` : id;
}

function shortCost(cost: string): string {
  return cost.length > 9 ? `${cost.slice(0, 6)}…` : cost;
}
