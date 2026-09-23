import { lazy, Suspense, useEffect, useState } from "react";
import { Empty, Select, Skeleton, Table, Tag, Typography } from "antd";
import type { TopologyStatus } from "@/api/topology";
import type { MessageTrace } from "@/api/traces";
import { costWidth, routesForClass, trafficLabels } from "./topologyModel";
import type { MeshRoute } from "@/api/topology";

const RouteGraph = lazy(() => import("./RouteGraph").then((module) => ({ default: module.RouteGraph })));

export function TopologyView({ status, trace }: { status: TopologyStatus; trace?: MessageTrace }) {
  const classes = [...new Set(status.routes.map((route) => route.trafficClass))].sort();
  const [trafficClass, setTrafficClass] = useState("transient_interactive");
  useEffect(() => {
    if (trace?.events.some((event) => event.kind === "probe")) setTrafficClass("transient_interactive");
  }, [trace?.traceId]);
  const selectedClass = classes.includes(trafficClass) ? trafficClass : classes[0];
  const routes = selectedClass ? routesForClass(status, selectedClass) : [];
  const costs = routes.filter((route) => route.reachable && /^\d+$/.test(route.estimatedCost)).map((route) => BigInt(route.estimatedCost));
  const maxCost = costs.reduce((max, cost) => cost > max ? cost : max, 0n);

  if (!status.enabled) return <Empty description="当前节点未启用 mesh，暂无拓扑与路由成本" />;

  return <div className="topology-view">
    <div className="topology-toolbar">
      <div>
        <Typography.Title level={5} style={{ margin: 0 }}>节点拓扑与通信成本</Typography.Title>
        <Typography.Text type="secondary">节点 {status.nodeId} 视角 · 拓扑版本 {status.topologyGeneration || "未知"} · 线宽及数值表示整条路由的估算权重，非实际费用或流量</Typography.Text>
      </div>
      <Select aria-label="流量类别" value={selectedClass} style={{ width: 174 }} placeholder="流量类别"
        options={classes.map((value) => ({ label: trafficLabels[value] ?? value, value }))} onChange={setTrafficClass} />
    </div>
    <Suspense fallback={<Skeleton active paragraph={{ rows: 8 }} />}>
      <RouteGraph status={status} routes={routes} trace={trace} />
    </Suspense>
    <Typography.Title level={5} style={{ marginTop: 24 }}>目的节点路由与估算成本</Typography.Title>
    <Table rowKey="destinationNodeId" dataSource={routes} pagination={{ pageSize: 10, hideOnSinglePage: true }} scroll={{ x: 760 }}
      locale={{ emptyText: "当前流量类别暂无目的节点路由" }} columns={[
        { title: "目的节点", dataIndex: "destinationNodeId" },
        { title: "状态", render: (_, route: MeshRoute) => <Tag color={route.reachable ? "success" : "error"}>{route.reachable ? "可达" : "不可达"}</Tag> },
        { title: "下一跳", render: (_, route: MeshRoute) => route.reachable ? route.nextHopNodeId || "未知" : "-" },
        { title: "传输 / 路径", render: (_, route: MeshRoute) => route.reachable ? `${route.outboundTransport || "未知"} / ${route.pathClass || "未知"}` : "-" },
        { title: "估算成本 (权重)", width: 190, render: (_, route: MeshRoute) => route.reachable ? <div className="topology-cost">
          <span>{route.estimatedCost}</span>
          <div className="topology-cost-track"><span style={{ width: `${costWidth(route.estimatedCost, maxCost)}%` }} /></div>
        </div> : "不可达" },
      ]} />
  </div>;
}
