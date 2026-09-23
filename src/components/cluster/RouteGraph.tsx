import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Empty, Input, Space, Tooltip, Typography, message } from "antd";
import { AimOutlined, MinusOutlined, PlusOutlined } from "@ant-design/icons";
import cytoscape, { type Core, type StylesheetStyle } from "cytoscape";
import type { MeshRoute, TopologyStatus } from "@/api/topology";
import { graphElements } from "./topologyModel";

const style: StylesheetStyle[] = [
  { selector: "node", style: { "width": 52, "height": 52, "background-color": "#fff", "border-width": 2,
    "border-color": "#aab7c0", "label": "data(label)", "font-size": 11, "color": "#28353e",
    "text-valign": "bottom", "text-margin-y": 8, "text-background-color": "#fff", "text-background-opacity": 0.86,
    "text-background-padding": "3px", "text-max-width": "90px", "text-wrap": "ellipsis" } },
  { selector: "node.local", style: { "width": 66, "height": 66, "background-color": "#d8f3e9", "border-color": "#128568", "border-width": 3, "font-weight": "bold" } },
  { selector: "node.peer", style: { "background-color": "#e4f3ef", "border-color": "#3a9c85" } },
  { selector: "node.destination", style: { "background-color": "#fff2db", "border-color": "#bd812f" } },
  { selector: "node.offline", style: { "background-color": "#f1f3f5", "border-color": "#aab4bc", "color": "#747c83" } },
  { selector: "edge", style: { "curve-style": "bezier", "line-color": "#2a9b7f", "width": "mapData(weight, 0, 100, 2, 5)",
    "target-arrow-shape": "none", "label": "data(costLabel)", "font-size": 10, "color": "#54616a",
    "text-rotation": "autorotate", "text-margin-y": -9, "text-background-color": "#fff", "text-background-opacity": 0.9,
    "text-background-padding": "2px" } },
  { selector: "edge.route", style: { "line-color": "#c28531", "line-style": "dashed", "target-arrow-shape": "triangle",
    "target-arrow-color": "#c28531", "arrow-scale": 0.9 } },
  { selector: ":selected", style: { "overlay-opacity": 0, "border-color": "#1776bd", "border-width": 4,
    "line-color": "#1776bd", "target-arrow-color": "#1776bd" } },
];

type GraphData = Record<string, unknown>;

function SelectionDetails({ data, status, routes }: { data: GraphData; status: TopologyStatus; routes: MeshRoute[] }) {
  const id = String(data.nodeId ?? "");
  const route = (data.route as MeshRoute | undefined) ?? routes.find((item) => item.destinationNodeId === id);
  const peer = status.peers.find((item) => item.nodeId === id);
  const edge = data.source !== undefined;
  const entries = edge ? [
    ["关系", data.kind === "connection" ? "已连接的对等节点" : "经下一跳的路由（非物理链路）"],
    ["来源", String(data.source).replace(/^node:/, "")],
    ["目标", String(data.target).replace(/^node:/, "")],
  ] : [
    ["节点 ID", id],
    ["类型", id === status.nodeId ? "本节点" : peer ? "对等节点" : "路由目的节点"],
    ...(peer ? [["连接状态", peer.connected ? "已连接" : "未连接"], ["传输", peer.transport || "未知"]] : []),
  ];
  if (route) entries.push(
    ["可达", route.reachable ? "是" : "否"],
    ["下一跳", route.reachable ? route.nextHopNodeId || "未知" : "-"],
    ["出站传输", route.reachable ? route.outboundTransport || "未知" : "-"],
    ["路径类型", route.reachable ? route.pathClass || "未知" : "-"],
    ["估算成本", route.reachable ? route.estimatedCost : "不可达"],
  );
  return <div className="topology-details">
    <Typography.Title level={5} style={{ marginTop: 0 }}>关系详情</Typography.Title>
    <dl>{entries.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
  </div>;
}

export function RouteGraph({ status, routes }: { status: TopologyStatus; routes: MeshRoute[] }) {
  const container = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const elements = useMemo(() => graphElements(status, routes), [status, routes]);
  const selected = elements.find((element) => element.data.id === selectedId)?.data as GraphData | undefined;

  useEffect(() => {
    if (!container.current) return;
    const cy = cytoscape({ container: container.current, elements: [], style, layout: { name: "preset" },
      minZoom: 0.25, maxZoom: 2.5, wheelSensitivity: 0.18 });
    cyRef.current = cy;
    cy.on("tap", "node, edge", (event) => setSelectedId(event.target.id()));
    cy.on("tap", (event) => { if (event.target === cy) setSelectedId(null); });
    const observer = new ResizeObserver(() => {
      cy.resize();
      if (cy.nodes().length) cy.fit(undefined, cy.width() < 500 ? 16 : 48);
    });
    observer.observe(container.current);
    return () => { observer.disconnect(); cy.destroy(); cyRef.current = null; };
  }, []);

  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const ids = new Set(elements.map((item) => item.data.id));
    let changed = false;
    cy.batch(() => {
      cy.elements().forEach((element) => {
        if (!ids.has(element.id())) { element.remove(); changed = true; }
      });
      for (const item of elements) {
        const existing = cy.getElementById(item.data.id!);
        if (existing.length) {
          existing.data(item.data);
          existing.classes(item.classes ?? "");
        } else { cy.add(item); changed = true; }
      }
    });
    if (changed) cy.layout({ name: "cose", animate: false, randomize: false, fit: true, padding: 65,
      nodeRepulsion: () => 320000, idealEdgeLength: () => 140, numIter: 400 }).run();
  }, [elements]);

  const focus = () => {
    const cy = cyRef.current;
    const id = `node:${search.trim()}`;
    if (!cy) return;
    if (!cy.getElementById(id).length) { message.warning("未找到该节点"); return; }
    const node = cy.getElementById(id);
    cy.elements().unselect();
    node.select();
    setSelectedId(id);
    cy.fit(node, 150);
  };
  const zoom = (factor: number) => {
    const cy = cyRef.current;
    if (cy) cy.zoom({ level: Math.min(2.5, Math.max(0.25, cy.zoom() * factor)), renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  };

  return <div className="topology-workspace">
    <div className="topology-canvas-area">
      <div className="topology-graph-tools">
        <Input.Search aria-label="搜索节点 ID" placeholder="搜索节点 ID" value={search} onChange={(event) => setSearch(event.target.value)} onSearch={focus} style={{ maxWidth: 260 }} />
        <Space.Compact>
          <Tooltip title="放大"><Button aria-label="放大" icon={<PlusOutlined />} onClick={() => zoom(1.25)} /></Tooltip>
          <Tooltip title="缩小"><Button aria-label="缩小" icon={<MinusOutlined />} onClick={() => zoom(0.8)} /></Tooltip>
          <Tooltip title="适应视图"><Button aria-label="适应视图" icon={<AimOutlined />} onClick={() => cyRef.current?.fit(undefined, 65)} /></Tooltip>
        </Space.Compact>
      </div>
      <div ref={container} className="topology-canvas" aria-label="可缩放拖动的节点关系图" />
      <div className="topology-legend"><span className="topology-legend-link" />已连接 <span className="topology-legend-route" />经下一跳可达（非物理链路） <span className="topology-legend-offline" />未连接 / 不可达</div>
    </div>
    {selected ? <SelectionDetails data={selected} status={status} routes={routes} /> :
      <div className="topology-details"><Typography.Title level={5} style={{ marginTop: 0 }}>关系详情</Typography.Title>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择节点或关系查看详情" /></div>}
  </div>;
}
